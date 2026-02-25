import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef } from "react";
import "@xyflow/react/dist/style.css";
import type { SystemNodeData } from "@/data/types";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useLayerStore } from "@/stores/layer-store";
import { BuildingToolbar } from "../panels/building-toolbar";
import { NodeDetailPanel } from "../panels/node-detail-panel";
import { CanvasHeader } from "./canvas-header";
import { DataFlowEdge } from "./edges/data-flow-edge";
import { GhostEdge } from "./edges/ghost-edge";
import { FocusModeOverlay } from "./focus-overlay";
import { SystemNodeComponent } from "./nodes/system-node";
import { ZoomController } from "./zoom-controller";

type SystemNodeType = Node<SystemNodeData>;

const nodeTypes = { system: SystemNodeComponent };
const edgeTypes = { dataflow: DataFlowEdge, ghost: GhostEdge };
const proOptions = { hideAttribution: true };

const bgColors = {
  tracing: "oklch(0.78 0.15 200 / 0.15)",
  building: "oklch(0.80 0.16 80 / 0.10)",
  platform: "oklch(0.77 0.15 165 / 0.12)",
} as const;

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
  setNodes,
}: {
  setNodes: ReturnType<typeof useNodesState<SystemNodeType>>[1];
}) {
  const rf = useReactFlow();
  const focusModeNodeId = useLayerStore((s) => s.focusModeNodeId);
  const setFocusModeNeighborIds = useLayerStore(
    (s) => s.setFocusModeNeighborIds
  );
  // originalPositionsRef: true pre-focus positions, set once per node when first scattered.
  // Never overwritten on node switches so exit always restores correctly.
  const originalPositionsRef = useRef<Record<string, { x: number; y: number }>>(
    {}
  );
  const prevFocusModeRef = useRef(focusModeNodeId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setNodes and rf are stable RF instances
  useEffect(() => {
    if (focusModeNodeId === null) {
      // Capture positions before clearing the ref — the setNodes updater runs
      // asynchronously during React's reconciliation, by which point .current
      // would already be {} if we cleared it first.
      const savedPositions = originalPositionsRef.current;
      originalPositionsRef.current = {};
      setNodes((nds) =>
        nds.map((n) =>
          savedPositions[n.id] ? { ...n, position: savedPositions[n.id] } : n
        )
      );
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
    const fx = focusedNode.position.x + fw / 2;
    const fy = focusedNode.position.y + fh / 2;

    const { zoom } = rf.getViewport();
    // Viewport half-dimensions in flow coordinates (after centering on focused node).
    const halfW = window.innerWidth / zoom / 2;
    const halfH = window.innerHeight / zoom / 2;

    const newPositions: Record<string, { x: number; y: number }> = {};

    for (const n of allNodes) {
      if (n.id === focusModeNodeId) {
        continue;
      }
      // Only save the original position the first time this node gets scattered.
      // On subsequent node switches, the stored value remains the true original.
      if (!originalPositionsRef.current[n.id]) {
        originalPositionsRef.current[n.id] = { ...n.position };
      }
      const nw = n.measured?.width ?? 220;
      const nh = n.measured?.height ?? 160;
      newPositions[n.id] = scatterPosition(
        n.position.x + nw / 2,
        n.position.y + nh / 2,
        fx,
        fy,
        halfW,
        halfH,
        nw,
        nh
      );
    }

    setNodes((nds) =>
      nds.map((n) =>
        n.id === focusModeNodeId || !newPositions[n.id]
          ? n
          : { ...n, position: newPositions[n.id] }
      )
    );

    // Compute neighbor IDs (nodes directly connected to the focused node).
    const neighborIds = rf
      .getEdges()
      .filter(
        (e) => e.source === focusModeNodeId || e.target === focusModeNodeId
      )
      .map((e) => (e.source === focusModeNodeId ? e.target : e.source));
    setFocusModeNeighborIds(neighborIds);

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

  const onPaneClick = () => setSelectedNodeId(null);

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
          nodeTypes={nodeTypes}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodesChange={onNodesChange}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          nodesDraggable={activeLayer === "building"}
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
          <FocusController setNodes={setNodes} />
        </ReactFlow>
      </div>

      <CanvasHeader />
      <BuildingToolbar />
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
