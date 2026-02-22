import { create } from "zustand";
import type { LayerId, SystemNode, SystemEdge } from "@/data/types";
import { systemNodes, systemEdges, draftNodes, draftEdges } from "@/data/system";

interface LayerState {
  activeLayer: LayerId;
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  showDraftNodes: boolean;

  setActiveLayer: (layer: LayerId) => void;
  setSelectedNodeId: (id: string | null) => void;
  setFocusedNodeId: (id: string | null) => void;

  getNodes: () => SystemNode[];
  getEdges: () => SystemEdge[];
}

export const useLayerStore = create<LayerState>((set, get) => ({
  activeLayer: "tracing",
  selectedNodeId: null,
  focusedNodeId: null,
  showDraftNodes: true,

  setActiveLayer: (layer) => set({ activeLayer: layer, selectedNodeId: null }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setFocusedNodeId: (id) => set({ focusedNodeId: id }),

  getNodes: () => {
    const { activeLayer } = get();
    if (activeLayer === "building") {
      return [...systemNodes, ...draftNodes];
    }
    return systemNodes;
  },

  getEdges: () => {
    const { activeLayer } = get();
    if (activeLayer === "building") {
      return [...systemEdges, ...draftEdges];
    }
    return systemEdges;
  },
}));
