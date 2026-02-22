import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useLayerStore } from "@/stores/layer-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { SystemNodeComponent } from "./nodes/SystemNode";
import { DataFlowEdge } from "./edges/DataFlowEdge";
import { GhostEdge } from "./edges/GhostEdge";
import { CanvasHeader } from "./CanvasHeader";
import { NodeDetailPanel } from "../panels/NodeDetailPanel";
import { BuildingToolbar } from "../panels/BuildingToolbar";
import type { SystemNodeData } from "@/data/types";

type SystemNodeType = Node<SystemNodeData>;

const nodeTypes = {
  system: SystemNodeComponent,
};

const edgeTypes = {
  dataflow: DataFlowEdge,
  ghost: GhostEdge,
};

const proOptions = { hideAttribution: true };

export function SystemCanvas() {
  useKeyboardShortcuts();
  const { activeLayer, selectedNodeId, setSelectedNodeId, getNodes, getEdges } = useLayerStore();

  const rawNodes = useMemo(() => getNodes(), [activeLayer, getNodes]);
  const rawEdges = useMemo(() => getEdges(), [activeLayer, getEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // Sync nodes/edges when layer changes
  useMemo(() => {
    setNodes(rawNodes);
    setEdges(rawEdges);
  }, [rawNodes, rawEdges, setNodes, setEdges]);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id);
      } else {
        setSelectedNodeId(null);
      }
    },
    [setSelectedNodeId],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const bgColor = useMemo(() => {
    switch (activeLayer) {
      case "tracing":
        return "oklch(0.78 0.15 200 / 0.15)";
      case "building":
        return "oklch(0.80 0.16 80 / 0.10)";
      case "platform":
        return "oklch(0.77 0.15 165 / 0.12)";
    }
  }, [activeLayer]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) as SystemNodeType | undefined,
    [nodes, selectedNodeId],
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={proOptions}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "dataflow",
        }}
        className="!bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color={bgColor}
          className="transition-colors duration-700"
        />
        <Controls
          showInteractive={false}
          className="!bottom-4 !right-4 !left-auto"
        />
        <MiniMap
          nodeColor={() => "oklch(0.40 0.03 270)"}
          maskColor="oklch(0.08 0.01 270 / 0.85)"
          className="!bottom-4 !left-4"
          style={{ width: 160, height: 110 }}
          pannable
          zoomable
        />
      </ReactFlow>

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
