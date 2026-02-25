import { create } from "zustand";
import {
  draftEdges,
  draftNodes,
  systemEdges,
  systemNodes,
} from "@/data/system";
import type { LayerId, SystemEdge, SystemNode } from "@/data/types";

export interface NodeScreenRect {
  h: number;
  w: number;
  x: number;
  y: number;
}

interface LayerState {
  activeLayer: LayerId;

  enterFocusMode: (id: string) => void;
  exitFocusMode: () => void;
  /** Node currently in focus mode (null when none). */
  focusModeInitialRect: NodeScreenRect | null;
  /** Angle in radians (Math.atan2 convention) from focused node center to each neighbor center. */
  focusModeNeighborAngles: Record<string, number> | null;
  /** IDs of nodes directly connected to the focused node (null when not in focus mode). */
  focusModeNeighborIds: string[] | null;
  focusModeNodeId: string | null;
  getEdges: () => SystemEdge[];

  getNodes: () => SystemNode[];
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  setActiveLayer: (layer: LayerId) => void;
  setFocusModeInitialRect: (rect: NodeScreenRect | null) => void;
  setFocusModeNeighborAngles: (a: Record<string, number> | null) => void;
  setFocusModeNeighborIds: (ids: string[] | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  showDraftNodes: boolean;
}

export const useLayerStore = create<LayerState>((set, get) => ({
  activeLayer: "tracing",
  selectedNodeId: null,
  focusModeNodeId: null,
  focusModeInitialRect: null,
  focusModeNeighborAngles: null,
  focusModeNeighborIds: null,
  hoveredNodeId: null,
  showDraftNodes: true,

  setActiveLayer: (layer) => set({ activeLayer: layer, selectedNodeId: null }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  enterFocusMode: (id) => set({ focusModeNodeId: id }),
  exitFocusMode: () =>
    set({
      focusModeNodeId: null,
      focusModeNeighborIds: null,
      focusModeNeighborAngles: null,
    }),
  setFocusModeInitialRect: (rect) => set({ focusModeInitialRect: rect }),
  setFocusModeNeighborAngles: (a) => set({ focusModeNeighborAngles: a }),
  setFocusModeNeighborIds: (ids) => set({ focusModeNeighborIds: ids }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),

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
