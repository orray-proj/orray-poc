import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { motion } from "motion/react";
import type { SystemEdgeData } from "@/data/types";
import { cn } from "@/lib/utils";
import { useLayerStore } from "@/stores/layer-store";

type SystemEdgeType = Edge<SystemEdgeData>;

function getTracingStroke(
  isError: boolean,
  isWarning: boolean,
  isTraceActive: boolean
): string {
  if (isError) {
    return "oklch(0.65 0.25 15)";
  }
  if (isWarning) {
    return "oklch(0.75 0.18 55)";
  }
  if (isTraceActive) {
    return "oklch(0.78 0.15 200)";
  }
  return "oklch(0.25 0.01 270)";
}

function getPlatformStroke(errorRate: number): string {
  if (errorRate > 10) {
    return "oklch(0.65 0.25 15)";
  }
  if (errorRate > 1) {
    return "oklch(0.75 0.18 55)";
  }
  return "oklch(0.50 0.08 165)";
}

function getErrorRateClass(errorRate: number): string {
  if (errorRate > 10) {
    return "text-red-400";
  }
  if (errorRate > 1) {
    return "text-amber-400";
  }
  return "text-emerald-400";
}

const FLOW_TRANSITION = { duration: 0.6, ease: [0.32, 0, 0.67, 0] as const };

function EdgeFlowIndicator({
  edgePath,
  strokeColor,
  isError,
  isTraceActive,
}: {
  edgePath: string;
  strokeColor: string;
  isError: boolean;
  isTraceActive: boolean;
}) {
  if (isError) {
    return (
      <motion.path
        animate={{ d: edgePath }}
        className="animate-[trace-flow_0.5s_linear_infinite]"
        fill="none"
        stroke="oklch(0.65 0.25 15)"
        strokeDasharray="4 8"
        strokeWidth={3}
        style={{ opacity: 0.4 }}
        transition={FLOW_TRANSITION}
      />
    );
  }
  if (isTraceActive) {
    return (
      <motion.path
        animate={{ d: edgePath }}
        className="animate-[trace-flow_1s_linear_infinite]"
        fill="none"
        stroke={strokeColor}
        strokeDasharray="6 6"
        strokeWidth={2}
        style={{ opacity: 0.6 }}
        transition={FLOW_TRANSITION}
      />
    );
  }
  return null;
}

function EdgeLabel({
  data,
  labelX,
  labelY,
  isError,
  isWarning,
}: {
  data: SystemEdgeData;
  labelX: number;
  labelY: number;
  isError: boolean;
  isWarning: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-all nodrag nopan edge-label absolute",
        "rounded px-2 py-0.5 font-mono text-[9px]",
        "border border-border/50 bg-card/90 backdrop-blur-sm",
        "text-muted-foreground",
        isError && "border-layer-error/30 text-layer-error/80",
        isWarning && "border-layer-warning/30 text-layer-warning/80"
      )}
      style={{
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      }}
    >
      {data.label}
      {data.protocol && (
        <span className="ml-1.5 text-[8px] opacity-60">{data.protocol}</span>
      )}
    </div>
  );
}

function EdgeMetrics({
  platform,
  labelX,
  labelY,
}: {
  platform: NonNullable<SystemEdgeData["platform"]>;
  labelX: number;
  labelY: number;
}) {
  const errorRate = platform.errorRate ?? 0;
  return (
    <div
      className="pointer-events-all nodrag nopan edge-label absolute rounded border border-border/40 bg-card/90 px-2 py-1 font-mono text-[9px] backdrop-blur-sm"
      style={{
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{platform.requestsPerSec} rps</span>
        <span className={getErrorRateClass(errorRate)}>
          {platform.errorRate}% err
        </span>
        <span>p99: {platform.p99Latency}ms</span>
      </div>
    </div>
  );
}

function edgeOpacity(isFocusModeDimmed: boolean, dimmed: boolean): number {
  if (isFocusModeDimmed) {
    return 0.04;
  }
  if (dimmed) {
    return 0.15;
  }
  return 1;
}

export function DataFlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<SystemEdgeType>) {
  const activeLayer = useLayerStore((s) => s.activeLayer);
  const focusModeNodeId = useLayerStore((s) => s.focusModeNodeId);
  const isFocusModeEdge =
    focusModeNodeId !== null &&
    (source === focusModeNodeId || target === focusModeNodeId);
  const isFocusModeDimmed = focusModeNodeId !== null && !isFocusModeEdge;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  });

  const tracing = data?.tracing;
  const platform = data?.platform;
  const isTraceActive = activeLayer === "tracing" && (tracing?.active ?? false);
  const isError = tracing?.status === "error";
  const isWarning = tracing?.status === "warning";
  const dimmed = activeLayer === "tracing" && !(tracing?.active ?? false);

  let strokeColor = "oklch(0.35 0.02 270)";
  if (activeLayer === "tracing") {
    strokeColor = getTracingStroke(isError, isWarning, isTraceActive);
  } else if (activeLayer === "platform") {
    strokeColor = getPlatformStroke(platform?.errorRate ?? 0);
  } else if (activeLayer === "building") {
    strokeColor = "oklch(0.45 0.03 270)";
  }

  const showLabel = !!(
    data?.label &&
    (selected || isTraceActive || activeLayer === "building")
  );
  const showMetrics = activeLayer === "platform" && platform;

  const focusDrawStyle = isFocusModeEdge
    ? {
        strokeDasharray: 3000,
        strokeDashoffset: 3000,
        animation: "edge-draw-in 0.55s 0.1s ease-out forwards",
      }
    : {};

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: isTraceActive || selected ? 2 : 1.5,
          opacity: edgeOpacity(isFocusModeDimmed, dimmed),
          ...focusDrawStyle,
        }}
      />
      {!isFocusModeDimmed && (
        <EdgeFlowIndicator
          edgePath={edgePath}
          isError={isError}
          isTraceActive={isTraceActive}
          strokeColor={strokeColor}
        />
      )}
      <EdgeLabelRenderer>
        {!isFocusModeDimmed && showLabel && data && (
          <EdgeLabel
            data={data}
            isError={isError}
            isWarning={isWarning}
            labelX={labelX}
            labelY={labelY}
          />
        )}
        {!isFocusModeDimmed && showMetrics && platform && (
          <EdgeMetrics labelX={labelX} labelY={labelY} platform={platform} />
        )}
      </EdgeLabelRenderer>
    </>
  );
}
