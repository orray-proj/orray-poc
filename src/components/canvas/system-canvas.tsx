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
} from "@xyflow/react";
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
import { SystemNodeComponent } from "./nodes/system-node";
import { ZoomController } from "./zoom-controller";

type SystemNodeType = Node<SystemNodeData>;

// Defined outside the component so the reference is stable across renders.
const nodeTypes = { system: SystemNodeComponent };
const edgeTypes = { dataflow: DataFlowEdge, ghost: GhostEdge };
const proOptions = { hideAttribution: true };

const bgColors = {
  tracing: "oklch(0.78 0.15 200 / 0.15)",
  building: "oklch(0.80 0.16 80 / 0.10)",
  platform: "oklch(0.77 0.15 165 / 0.12)",
} as const;

export function SystemCanvas() {
  useKeyboardShortcuts();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLayer = useLayerStore((s) => s.activeLayer);
  const selectedNodeId = useLayerStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useLayerStore((s) => s.setSelectedNodeId);
  const setHoveredNodeId = useLayerStore((s) => s.setHoveredNodeId);

  // Initialize React Flow state with the initial layer's data.
  const [nodes, setNodes, onNodesChange] = useNodesState(
    useLayerStore.getState().getNodes()
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    useLayerStore.getState().getEdges()
  );

  // Sync canvas data whenever the active layer changes.
  // useEffect is correct here — this is a side effect (updating React Flow
  // internal state) that must run after render, not during it.
  // activeLayer is intentionally in deps to trigger re-sync on layer switch;
  // data is read via getState() to avoid stale closures from store subscriptions.
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
    <div className="relative h-full w-full">
      <div className="h-full w-full" ref={containerRef}>
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
          proOptions={proOptions}
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
          <ZoomController containerRef={containerRef} />
        </ReactFlow>
      </div>

      <CanvasHeader />
      <BuildingToolbar />
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
