import { useReactFlow, useViewport } from "@xyflow/react";
import { useEffect, useRef } from "react";
import {
  ZOOM_CUE_MIN,
  ZOOM_EXIT_CUE_RANGE,
  ZOOM_EXPAND_MIN,
} from "@/lib/zoom-constants";
import { useLayerStore } from "@/stores/layer-store";

interface ZoomControllerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Render-null component placed inside <ReactFlow> (accesses RF context).
 *
 * State machine for wheel events:
 *
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │ EXPANDED (expandedNodeId set)                                           │
 *  │  • zoom-in  → hard block (no movement)                                  │
 *  │  • zoom-out in [EXPAND_MIN, EXPAND_MIN+EXIT_CUE_RANGE] → slowed (nudge) │
 *  │  • zoom-out below that range → normal d3-zoom (fast escape)             │
 *  ├─────────────────────────────────────────────────────────────────────────┤
 *  │ ENTER CUE (hoveredNodeId set, zoom in [CUE_MIN, EXPAND_MIN))            │
 *  │  • zoom-in → slowed (nudge toward expansion)                            │
 *  │  • zoom-out → normal d3-zoom                                            │
 *  ├─────────────────────────────────────────────────────────────────────────┤
 *  │ NORMAL (everything else)                                                │
 *  │  • d3-zoom handles the event unmodified                                 │
 *  └─────────────────────────────────────────────────────────────────────────┘
 */
export function ZoomController({ containerRef }: ZoomControllerProps) {
  const { setViewport, getViewport } = useReactFlow();
  const { zoom } = useViewport();
  const hoveredNodeId = useLayerStore((s) => s.hoveredNodeId);
  const expandedNodeId = useLayerStore((s) => s.expandedNodeId);

  // Refs keep event handler in sync without needing to re-attach the listener.
  const hoveredRef = useRef(hoveredNodeId);
  hoveredRef.current = hoveredNodeId;

  const expandedRef = useRef(expandedNodeId);
  expandedRef.current = expandedNodeId;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const applySlowZoom = (e: WheelEvent, newZoom: number) => {
      const { x, y } = getViewport();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ratio = newZoom / zoomRef.current;
      setViewport(
        { x: cx - (cx - x) * ratio, y: cy - (cy - y) * ratio, zoom: newZoom },
        { duration: 0 }
      );
    };

    /** Handles wheel events while a node is expanded. Always consumes the event. */
    const handleExpandedWheel = (e: WheelEvent) => {
      const currentZoom = zoomRef.current;
      if (e.deltaY < 0) {
        // Hard block — zoom-in is disabled while a node is focused.
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.deltaY > 0) {
        const isInExitCue =
          currentZoom >= ZOOM_EXPAND_MIN &&
          currentZoom < ZOOM_EXPAND_MIN + ZOOM_EXIT_CUE_RANGE;
        if (isInExitCue) {
          // Slow exit: same 0.3% cap as the enter cue — symmetrical feel.
          e.preventDefault();
          e.stopImmediatePropagation();
          const maxDelta = currentZoom * 0.003;
          applySlowZoom(e, Math.max(0.2, currentZoom - maxDelta));
        }
        // Below exit-cue zone: let d3-zoom handle it normally (fast escape).
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const currentZoom = zoomRef.current;

      // ── EXPANDED STATE ──────────────────────────────────────────────────
      if (expandedRef.current !== null) {
        handleExpandedWheel(e);
        return;
      }

      // ── ENTER CUE (no expansion yet) ────────────────────────────────────
      const isInEnterCue =
        currentZoom >= ZOOM_CUE_MIN && currentZoom < ZOOM_EXPAND_MIN;

      if (hoveredRef.current === null || !isInEnterCue || e.deltaY >= 0) {
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();
      const maxDelta = currentZoom * 0.003;
      applySlowZoom(e, Math.min(ZOOM_EXPAND_MIN, currentZoom + maxDelta));
    };

    // capture: true fires before d3-zoom's listener so we have first-mover control.
    el.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });
    return () => {
      el.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [containerRef, getViewport, setViewport]);

  return null;
}
