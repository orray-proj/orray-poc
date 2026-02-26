import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef } from "react";
import "@xyflow/react/dist/style.css";
import type { SystemEdge, SystemNodeData } from "@/data/types";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useLayerStore } from "@/stores/layer-store";
import { BuildingToolbar } from "../panels/building-toolbar";
import { NodeDetailPanel } from "../panels/node-detail-panel";
import { TimelinePanel } from "../panels/timeline-panel";
import { CanvasHeader } from "./canvas-header";
import { DataFlowEdge } from "./edges/data-flow-edge";
import { GhostEdge } from "./edges/ghost-edge";
import { CARD_H, CARD_W, FocusModeOverlay } from "./focus-overlay";
import { SystemNodeComponent } from "./nodes/system-node";
import { ZoomController } from "./zoom-controller";

type SystemNodeType = Node<SystemNodeData>;

const nodeTypes = { system: SystemNodeComponent };
const edgeTypes = { dataflow: DataFlowEdge, ghost: GhostEdge };
const proOptions = { hideAttribution: true };

const bgColors = {
  live: "oklch(0.78 0.15 200 / 0.15)",
  building: "oklch(0.80 0.16 80 / 0.10)",
  platform: "oklch(0.77 0.15 165 / 0.12)",
} as const;

/** Computes angle from focused node center to each neighbor center.
 *  Uses originalPositions (pre-scatter) when available so directions
 *  are stable across focus switches. */
function buildNeighborAngles(
  allNodes: Node[],
  neighborIds: string[],
  fx: number,
  fy: number,
  originalPositions: Record<string, { x: number; y: number }>
): Record<string, number> {
  const angles: Record<string, number> = {};
  for (const n of allNodes) {
    if (!neighborIds.includes(n.id)) {
      continue;
    }
    const nw = n.measured?.width ?? 220;
    const nh = n.measured?.height ?? 160;
    const origPos = originalPositions[n.id] ?? n.position;
    angles[n.id] = Math.atan2(origPos.y + nh / 2 - fy, origPos.x + nw / 2 - fx);
  }
  return angles;
}

/**
 * Projects a node's angle onto the viewport boundary rectangle and returns
 * the scatter position (78% of boundary distance from the focused node center).
 */
function scatterPosition(
  cx: number,
  cy: number,
  fx: number,
  fy: number,
  halfW: number,
  halfH: number,
  nw: number,
  nh: number
): { x: number; y: number } {
  const angle = Math.atan2(cy - fy, cx - fx);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const tx =
    Math.abs(cosA) > 0.001 ? halfW / Math.abs(cosA) : Number.POSITIVE_INFINITY;
  const ty =
    Math.abs(sinA) > 0.001 ? halfH / Math.abs(sinA) : Number.POSITIVE_INFINITY;
  const dist = Math.min(tx, ty) * 0.78;
  return { x: fx + cosA * dist - nw / 2, y: fy + sinA * dist - nh / 2 };
}

/**
 * Handles scatter/restore logic and fitView — rendered inside <ReactFlow>
 * so it has access to the RF zustand context via useReactFlow().
 *
 * Scatter algorithm: project each node's angle onto the viewport boundary
 * rectangle (post-pan centering), then place it at 78% of that distance so
 * nodes peek visibly from the edges.
 */
function FocusController({
  setEdges,
  setNodes,
}: {
  setEdges: (updater: (eds: SystemEdge[]) => SystemEdge[]) => void;
  setNodes: ReturnType<typeof useNodesState<SystemNodeType>>[1];
}) {
  const rf = useReactFlow();
  const focusModeNodeId = useLayerStore((s) => s.focusModeNodeId);
  const setFocusModeNeighborIds = useLayerStore(
    (s) => s.setFocusModeNeighborIds
  );
  const setFocusModeNeighborAngles = useLayerStore(
    (s) => s.setFocusModeNeighborAngles
  );
  // originalPositionsRef: true pre-focus positions, set once per node when first scattered.
  // Never overwritten on node switches so exit always restores correctly.
  const originalPositionsRef = useRef<Record<string, { x: number; y: number }>>(
    {}
  );
  // Saves the focused node's original position/style so we can restore them on exit.
  const focusedNodeStateRef = useRef<{
    id: string;
    position: { x: number; y: number };
    style: SystemNodeType["style"];
  } | null>(null);
  const prevFocusModeRef = useRef(focusModeNodeId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setNodes, setEdges and rf are stable RF instances
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: scatter/restore algorithm is inherently branchy
  useEffect(() => {
    if (focusModeNodeId === null) {
      // Capture before clearing — setNodes updater runs asynchronously.
      const savedPositions = originalPositionsRef.current;
      const savedFocused = focusedNodeStateRef.current;
      const savedFocusedId = savedFocused?.id;
      originalPositionsRef.current = {};
      focusedNodeStateRef.current = null;
      setNodes((nds) =>
        nds.map((n) => {
          if (savedFocused && n.id === savedFocused.id) {
            return {
              ...n,
              position: savedFocused.position,
              style: savedFocused.style,
            };
          }
          if (savedPositions[n.id]) {
            return { ...n, position: savedPositions[n.id] };
          }
          return n;
        })
      );
      // Restore edge handles to default (clear port handle IDs).
      if (savedFocusedId) {
        setEdges((eds) =>
          eds.map((e) => {
            if (e.source === savedFocusedId || e.target === savedFocusedId) {
              return { ...e, sourceHandle: undefined, targetHandle: undefined };
            }
            return e;
          })
        );
      }
      setFocusModeNeighborAngles(null);
      return;
    }

    // Compute scatter positions using current RF node state.
    const allNodes = rf.getNodes();
    const focusedNode = allNodes.find((n) => n.id === focusModeNodeId);
    if (!focusedNode) {
      return;
    }

    const fw = focusedNode.measured?.width ?? 220;
    const fh = focusedNode.measured?.height ?? 160;

    // When switching focus nodes the new target may already be scattered
    // (sitting at the viewport edge). Always use the pre-scatter original
    // position so fx/fy lands at the node's true canvas location.
    const focusOrigPos =
      originalPositionsRef.current[focusModeNodeId] ??
      focusedNodeStateRef.current?.position ?? // fallback: previously-focused pos
      focusedNode.position;
    const fx = focusOrigPos.x + fw / 2;
    const fy = focusOrigPos.y + fh / 2;

    const { zoom } = rf.getViewport();
    // Viewport half-dimensions in flow coordinates (after centering on focused node).
    const halfW = window.innerWidth / zoom / 2;
    const halfH = window.innerHeight / zoom / 2;

    // Save focused node's original state (use the pre-scatter origin, not current pos).
    if (
      !focusedNodeStateRef.current ||
      focusedNodeStateRef.current.id !== focusModeNodeId
    ) {
      focusedNodeStateRef.current = {
        id: focusModeNodeId,
        position: focusOrigPos,
        style: focusedNode.style,
      };
    }

    // Card dimensions in flow units — node wrapper will match overlay card exactly.
    const cardFlowW = CARD_W / zoom;
    const cardFlowH = CARD_H / zoom;
    const cardFlowX = fx - cardFlowW / 2;
    const cardFlowY = fy - cardFlowH / 2;

    const newPositions: Record<string, { x: number; y: number }> = {};

    for (const n of allNodes) {
      if (n.id === focusModeNodeId) {
        continue;
      }
      // Use the stored original position for scatter input so directions are
      // computed from the true canvas layout, not the current scattered positions.
      // For the previously-focused node (not yet in originalPositionsRef), seed
      // its original position from focusedNodeStateRef before overwriting it.
      if (!originalPositionsRef.current[n.id]) {
        const prevFocused = focusedNodeStateRef.current;
        if (prevFocused && prevFocused.id === n.id) {
          originalPositionsRef.current[n.id] = { ...prevFocused.position };
        } else {
          originalPositionsRef.current[n.id] = { ...n.position };
        }
      }
      const origPos = originalPositionsRef.current[n.id];
      const nw = n.measured?.width ?? 220;
      const nh = n.measured?.height ?? 160;
      newPositions[n.id] = scatterPosition(
        origPos.x + nw / 2,
        origPos.y + nh / 2,
        fx,
        fy,
        halfW,
        halfH,
        nw,
        nh
      );
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === focusModeNodeId) {
          // Resize focused node to match overlay card so handles sit on card border.
          return {
            ...n,
            position: { x: cardFlowX, y: cardFlowY },
            style: { ...n.style, width: cardFlowW, height: cardFlowH },
          };
        }
        if (!newPositions[n.id]) {
          return n;
        }
        return { ...n, position: newPositions[n.id] };
      })
    );

    // Compute neighbor IDs (nodes directly connected to the focused node).
    const neighborIds = rf
      .getEdges()
      .filter(
        (e) => e.source === focusModeNodeId || e.target === focusModeNodeId
      )
      .map((e) => (e.source === focusModeNodeId ? e.target : e.source));
    setFocusModeNeighborIds(neighborIds);

    // Compute angle from focused node center to each neighbor center.
    setFocusModeNeighborAngles(
      buildNeighborAngles(
        allNodes,
        neighborIds,
        fx,
        fy,
        originalPositionsRef.current
      )
    );

    // Route edges to per-neighbor port handles so they terminate at border points.
    setEdges((eds) =>
      eds.map((e) => {
        if (e.source === focusModeNodeId) {
          return { ...e, sourceHandle: `src-${e.target}` };
        }
        if (e.target === focusModeNodeId) {
          return { ...e, targetHandle: `tgt-${e.source}` };
        }
        return e;
      })
    );

    // Pan viewport to center focused node (simultaneously with scatter animation).
    rf.setViewport(
      {
        x: window.innerWidth / 2 - fx * zoom,
        y: window.innerHeight / 2 - fy * zoom,
        zoom,
      },
      { duration: 600 }
    );
  }, [focusModeNodeId]);

  // fitView when exiting focus mode.
  useEffect(() => {
    if (prevFocusModeRef.current !== null && focusModeNodeId === null) {
      rf.fitView({ padding: 0.15, duration: 500 });
    }
    prevFocusModeRef.current = focusModeNodeId;
  }, [focusModeNodeId, rf]);

  return null;
}

export function SystemCanvas() {
  useKeyboardShortcuts();

  const activeLayer = useLayerStore((s) => s.activeLayer);
  const selectedNodeId = useLayerStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useLayerStore((s) => s.setSelectedNodeId);
  const setHoveredNodeId = useLayerStore((s) => s.setHoveredNodeId);
  const focusModeNodeId = useLayerStore((s) => s.focusModeNodeId);
  const exitFocusMode = useLayerStore((s) => s.exitFocusMode);

  const isInFocusMode = focusModeNodeId !== null;
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);

  // Add .focus-transitioning class during scatter/restore so CSS can animate edge paths.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusModeNodeId intentionally triggers this effect
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.classList.add("focus-transitioning");
    const timer = setTimeout(() => {
      el.classList.remove("focus-transitioning");
    }, 700);
    return () => {
      clearTimeout(timer);
      el.classList.remove("focus-transitioning");
    };
  }, [focusModeNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    useLayerStore.getState().getNodes()
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    useLayerStore.getState().getEdges()
  );

  // Always-current ref so onNodeDragStop reads the latest positions,
  // not a stale closure snapshot captured by the React Compiler.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeLayer triggers re-sync; getState() avoids stale closures
  useEffect(() => {
    const { getNodes, getEdges } = useLayerStore.getState();
    setNodes(getNodes());
    setEdges(getEdges());
  }, [activeLayer, setNodes, setEdges]);

  const onSelectionChange: OnSelectionChangeFunc = ({ nodes: selected }) => {
    setSelectedNodeId(selected.length === 1 ? selected[0].id : null);
  };

  const onNodeMouseEnter: NodeMouseHandler = (_evt, node) => {
    setHoveredNodeId(node.id);
  };

  const onNodeMouseLeave: NodeMouseHandler = () => {
    setHoveredNodeId(null);
  };

  // Clicking the empty canvas dismisses focus mode (if active) or clears selection.
  const onPaneClick = () => {
    if (isInFocusMode) {
      exitFocusMode();
    } else {
      setSelectedNodeId(null);
    }
  };

  // In building mode (dev only): persist all node positions to system.ts after each drag.
  const onNodeDragStop: OnNodeDrag = () => {
    if (activeLayer !== "building" || !import.meta.env.DEV) {
      return;
    }
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of nodesRef.current) {
      positions[n.id] = n.position;
    }
    fetch("/api/save-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(positions),
    }).catch((_err: unknown) => {
      // fire-and-forget: silently ignore save errors in dev
    });
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as
    | SystemNodeType
    | undefined;

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      <div className="h-full w-full">
        <ReactFlow
          className="!bg-background"
          defaultEdgeOptions={{ type: "dataflow" }}
          edges={edges}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          maxZoom={4}
          minZoom={0.2}
          nodes={nodes}
          nodesDraggable={activeLayer === "building"}
          nodeTypes={nodeTypes}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodesChange={onNodesChange}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          panOnDrag={!isInFocusMode}
          panOnScroll={!isInFocusMode}
          proOptions={proOptions}
          zoomOnDoubleClick={!isInFocusMode}
          zoomOnScroll={!isInFocusMode}
        >
          <Background
            className="transition-colors duration-700"
            color={bgColors[activeLayer]}
            gap={24}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <Controls
            className="!bottom-4 !right-4 !left-auto"
            showInteractive={false}
          />
          <MiniMap
            className="!bottom-4 !left-4"
            maskColor="oklch(0.08 0.01 270 / 0.85)"
            nodeColor={() => "oklch(0.40 0.03 270)"}
            pannable
            style={{ width: 160, height: 110 }}
            zoomable
          />
          <ZoomController />
          <FocusController setEdges={setEdges} setNodes={setNodes} />
        </ReactFlow>
      </div>

      <CanvasHeader />
      <BuildingToolbar />
      <TimelinePanel />
      {!isInFocusMode && selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {/* key=focusModeNodeId so AnimatePresence re-triggers on node switch */}
      <AnimatePresence mode="wait">
        {isInFocusMode && (
          <FocusModeOverlay
            allEdges={edges}
            allNodes={nodes}
            key={focusModeNodeId}
            nodeId={focusModeNodeId}
            onExit={exitFocusMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
