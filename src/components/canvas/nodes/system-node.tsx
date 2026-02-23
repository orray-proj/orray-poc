import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Globe,
  HardDrive,
  Pencil,
  Radio,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  HealthStatus,
  NodeKind,
  ServiceFeature,
  SystemNodeData,
} from "@/data/types";
import { cn } from "@/lib/utils";
import {
  ZOOM_CUE_MIN,
  ZOOM_EXIT_CUE_RANGE,
  ZOOM_EXPAND_MIN,
} from "@/lib/zoom-constants";
import { useLayerStore } from "@/stores/layer-store";

const kindConfig: Record<
  NodeKind,
  { icon: React.ElementType; accent: string; bgAccent: string }
> = {
  gateway: {
    icon: Globe,
    accent: "text-[oklch(0.78_0.15_200)]",
    bgAccent: "bg-[oklch(0.78_0.15_200)]",
  },
  service: {
    icon: Server,
    accent: "text-[oklch(0.78_0.12_260)]",
    bgAccent: "bg-[oklch(0.78_0.12_260)]",
  },
  database: {
    icon: Database,
    accent: "text-[oklch(0.75_0.14_145)]",
    bgAccent: "bg-[oklch(0.75_0.14_145)]",
  },
  queue: {
    icon: Radio,
    accent: "text-[oklch(0.75_0.15_55)]",
    bgAccent: "bg-[oklch(0.75_0.15_55)]",
  },
  cache: {
    icon: HardDrive,
    accent: "text-[oklch(0.70_0.18_330)]",
    bgAccent: "bg-[oklch(0.70_0.18_330)]",
  },
};

const healthColors: Record<HealthStatus, string> = {
  healthy: "text-emerald-400",
  degraded: "text-amber-400",
  critical: "text-red-400",
  warning: "text-amber-400",
  unknown: "text-zinc-500",
};

const healthIcons: Record<HealthStatus, React.ElementType> = {
  healthy: CheckCircle2,
  degraded: AlertCircle,
  critical: XCircle,
  warning: AlertCircle,
  unknown: AlertCircle,
};

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function getMetricColor(value: number): string {
  if (value > 80) {
    return "bg-red-400";
  }
  if (value > 60) {
    return "bg-amber-400";
  }
  return "bg-emerald-400";
}

function MetricBar({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-8 shrink-0 font-mono text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            color
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-foreground/70">
        {value}%
      </span>
    </div>
  );
}

function TracingOverlay({ data }: { data: SystemNodeData }) {
  const tracing = data.tracing;
  if (!tracing) {
    return null;
  }

  const isError = tracing.status === "error";
  const isWarning = tracing.status === "warning";

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span
            className={cn(
              "font-mono text-[11px]",
              isError ? "font-semibold text-layer-error" : "text-foreground/70"
            )}
          >
            {formatLatency(tracing.latencyMs)}
          </span>
        </div>
        {isError && (
          <Badge
            className="h-4 px-1.5 py-0 font-mono text-[9px]"
            variant="destructive"
          >
            ERROR
          </Badge>
        )}
        {isWarning && (
          <Badge className="h-4 border-layer-warning/30 bg-layer-warning/20 px-1.5 py-0 font-mono text-[9px] text-layer-warning hover:bg-layer-warning/20">
            WARN
          </Badge>
        )}
        {tracing.status === "ok" && (
          <Badge className="h-4 border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 font-mono text-[9px] text-emerald-400 hover:bg-emerald-500/15">
            OK
          </Badge>
        )}
      </div>
      {tracing.errorMessage && (
        <p className="rounded border border-layer-error/10 bg-layer-error/5 px-1.5 py-1 font-mono text-[10px] text-layer-error/80 leading-tight">
          {tracing.errorMessage}
        </p>
      )}
    </div>
  );
}

function BuildingOverlay({ data }: { data: SystemNodeData }) {
  const building = data.building;
  if (!building) {
    return null;
  }

  if (building.isDraft) {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] text-layer-building/70">
          <FileText className="h-3 w-3" />
          <span className="font-mono">{building.ticketId}</span>
        </div>
        {building.proposedBy && (
          <p className="text-[10px] text-muted-foreground">
            Proposed by {building.proposedBy}
          </p>
        )}
        {building.description && (
          <p className="text-[10px] text-foreground/50 leading-tight">
            {building.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        type="button"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
        type="button"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function PlatformOverlay({ data }: { data: SystemNodeData }) {
  const platform = data.platform;
  if (!platform) {
    return null;
  }

  const HealthIcon = healthIcons[platform.health];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <div
          className={cn(
            "flex items-center gap-1",
            healthColors[platform.health]
          )}
        >
          <HealthIcon className="h-3 w-3" />
          <span className="font-medium capitalize">{platform.health}</span>
        </div>
        <span className="font-mono text-muted-foreground">
          {platform.version}
        </span>
      </div>
      <MetricBar
        color={getMetricColor(platform.cpu)}
        label="CPU"
        value={platform.cpu}
      />
      <MetricBar
        color={getMetricColor(platform.memory)}
        label="MEM"
        value={platform.memory}
      />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Box className="h-3 w-3" />
          <span className="font-mono">
            {platform.pods.ready}/{platform.pods.total} pods
          </span>
        </div>
        <span className="font-mono">{platform.lastDeploy}</span>
      </div>
    </div>
  );
}

function getFeatureStatusDot(status: HealthStatus): string {
  if (status === "healthy") {
    return "bg-emerald-400";
  }
  if (status === "warning") {
    return "bg-amber-400";
  }
  if (status === "degraded") {
    return "bg-amber-500";
  }
  if (status === "critical") {
    return "bg-red-400";
  }
  return "bg-zinc-500";
}

function FeatureGrid({ features }: { features: ServiceFeature[] }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-1 border-border/25 border-t pt-2.5">
      {features.map((f) => (
        <div
          className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1.5 ring-1 ring-white/[0.06]"
          key={f.id}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              getFeatureStatusDot(f.status)
            )}
          />
          <span className="min-w-0 truncate font-mono text-[10px] text-foreground/70 leading-none">
            {f.name}
          </span>
        </div>
      ))}
    </div>
  );
}

type SystemNodeType = Node<SystemNodeData>;

interface NodeFlags {
  dimmed: boolean;
  isCritical: boolean;
  isDraft: boolean;
  isError: boolean;
}

function NodeAccentStripe({
  config,
  flags,
}: {
  config: { bgAccent: string };
  flags: NodeFlags;
}) {
  return (
    <div
      className={cn(
        "absolute top-3 bottom-3 left-0 w-[3px] rounded-full transition-colors duration-500",
        flags.isDraft ? "bg-layer-building/50" : config.bgAccent,
        flags.isError && "!bg-layer-error",
        flags.dimmed && "opacity-50"
      )}
    />
  );
}

function NodeIconBox({
  Icon,
  config,
  flags,
}: {
  Icon: React.ElementType;
  config: { accent: string };
  flags: NodeFlags;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded p-1",
        flags.isDraft
          ? "bg-layer-building/10 text-layer-building/70"
          : "bg-white/5",
        flags.isError && "bg-layer-error/10 text-layer-error"
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          !(flags.isDraft || flags.isError) && config.accent
        )}
      />
    </div>
  );
}

function NodeStatusIcon({
  activeLayer,
  data,
  isError,
}: {
  activeLayer: string;
  data: SystemNodeData;
  isError: boolean;
}) {
  if (isError) {
    return (
      <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-layer-error" />
    );
  }
  if (activeLayer === "platform" && data.platform) {
    return (
      <Activity
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          healthColors[data.platform.health]
        )}
      />
    );
  }
  return null;
}

/** Derives the container className for the node outer div. */
function getNodeContainerClass(
  flags: NodeFlags,
  isCued: boolean,
  isExpanded: boolean,
  isExitCue: boolean,
  isOtherExpanded: boolean,
  selected: boolean
): string {
  const { isDraft, isError, isCritical, dimmed } = flags;
  return cn(
    "relative rounded-lg border transition-all duration-500",
    "bg-card/80 backdrop-blur-sm",
    isExpanded ? "w-[340px]" : "w-[220px]",
    // Enter cue: outer glow + slight scale signals the node is about to open.
    isCued &&
      "scale-[1.05] border-[oklch(0.6_0.18_220_/_0.6)] shadow-[0_0_0_2px_oklch(0.6_0.18_220_/_0.5),0_0_28px_oklch(0.6_0.18_220_/_0.18)]",
    // Exit cue: breathing pulse nudges "zoom out a little more to leave focus mode".
    isExitCue && "animate-[exit-cue-pulse_1.5s_ease-in-out_infinite]",
    // Expanded (stable): static glow to anchor the focused node when not in exit cue.
    isExpanded &&
      !isExitCue &&
      "shadow-[0_0_0_1px_oklch(0.6_0.18_220_/_0.3),0_0_48px_oklch(0.6_0.18_220_/_0.15)]",
    // Focus mode: other nodes retreat to near-invisible.
    isOtherExpanded && "pointer-events-none opacity-[0.06]",
    selected && "ring-1 ring-ring",
    isDraft &&
      "animate-[ghost-shimmer_3s_ease-in-out_infinite] border-layer-building/40 border-dashed bg-layer-building/5",
    isError &&
      "animate-[error-pulse_2s_ease-in-out_infinite] border-layer-error/50",
    isCritical &&
      "border-red-500/40 shadow-[0_0_16px_oklch(0.65_0.25_15_/_0.2)]",
    !(isDraft || isError || isCritical || isCued || isExpanded) &&
      "border-border/60",
    dimmed && "opacity-30"
  );
}

/** Returns true when a tracing-layer node is not part of the active trace path. */
function isNodeDimmed(
  activeLayer: string,
  isOnTracePath: boolean,
  kind: NodeKind
): boolean {
  return (
    activeLayer === "tracing" &&
    !isOnTracePath &&
    kind !== "database" &&
    kind !== "cache" &&
    kind !== "queue"
  );
}

/**
 * Computes the semantic zoom state for a node and manages the "expanded" lifecycle:
 * - tracks cue / expanded states from viewport zoom + hover
 * - on first expansion: registers the node as focused and pans the viewport to center it
 * - on collapse: clears the focus if this node was the focused one
 *
 * Extracted to keep SystemNodeComponent within the cognitive-complexity limit.
 */
function useSemanticZoom(id: string, hasFeatures: boolean) {
  const { zoom } = useViewport();
  const rf = useReactFlow();
  const hoveredNodeId = useLayerStore((s) => s.hoveredNodeId);
  const expandedNodeId = useLayerStore((s) => s.expandedNodeId);
  const setExpandedNodeId = useLayerStore((s) => s.setExpandedNodeId);

  const isHovered = hoveredNodeId === id;
  // Sticky: once locked in the store, stays expanded even after mouse leaves.
  const isLocked = expandedNodeId === id;
  const isCued = isHovered && zoom >= ZOOM_CUE_MIN && zoom < ZOOM_EXPAND_MIN;
  const isExpanded =
    isLocked || (isHovered && zoom >= ZOOM_EXPAND_MIN && hasFeatures);
  // Exit cue: locked node inside the slow-exit zone — breathing pulse nudges the user.
  const isExitCue =
    isLocked &&
    zoom >= ZOOM_EXPAND_MIN &&
    zoom < ZOOM_EXPAND_MIN + ZOOM_EXIT_CUE_RANGE;

  useEffect(() => {
    // Lock: node enters expanded state while hovered.
    if (!isLocked && isHovered && zoom >= ZOOM_EXPAND_MIN && hasFeatures) {
      setExpandedNodeId(id);

      // Pan to center the expanding node (zoom preserved to avoid threshold feedback).
      const node = rf.getNode(id);
      if (!node) {
        return;
      }
      const { zoom: currentZoom } = rf.getViewport();
      const expandedW = 340;
      const expandedH = (node.measured?.height ?? 160) + 80;
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      rf.setViewport(
        {
          x: vpW / 2 - (node.position.x + expandedW / 2) * currentZoom,
          y: vpH / 2 - (node.position.y + expandedH / 2) * currentZoom,
          zoom: currentZoom,
        },
        { duration: 550 }
      );
      return;
    }

    // Unlock: user zoomed out below the expand threshold.
    if (isLocked && zoom < ZOOM_EXPAND_MIN) {
      setExpandedNodeId(null);
    }
  }, [isHovered, isLocked, zoom, hasFeatures, id, setExpandedNodeId, rf]);

  return { isCued, isExpanded, isExitCue };
}

export function SystemNodeComponent({
  id,
  data,
  selected,
}: NodeProps<SystemNodeType>) {
  const activeLayer = useLayerStore((s) => s.activeLayer);

  const isDraft = data.building?.isDraft ?? false;
  const isError = data.tracing?.status === "error" && activeLayer === "tracing";
  const isOnTracePath = Boolean(data.tracing && activeLayer === "tracing");
  const isCritical =
    data.platform?.health === "critical" && activeLayer === "platform";
  const dimmed = isNodeDimmed(activeLayer, isOnTracePath, data.kind);

  const hasFeatures = (data.features?.length ?? 0) > 0;
  const { isCued, isExpanded, isExitCue } = useSemanticZoom(id, hasFeatures);

  // True when a *different* node is expanded — triggers focus-mode dimming.
  const expandedNodeId = useLayerStore((s) => s.expandedNodeId);
  const isOtherExpanded = expandedNodeId !== null && expandedNodeId !== id;

  const config = kindConfig[data.kind];
  const Icon = config.icon;
  const flags: NodeFlags = { isDraft, isError, isCritical, dimmed };

  return (
    <>
      <Handle
        className="!bg-border !border-surface !w-2 !h-2"
        position={Position.Top}
        type="target"
      />
      <div
        className={getNodeContainerClass(
          flags,
          isCued,
          isExpanded,
          isExitCue,
          isOtherExpanded,
          selected
        )}
      >
        <NodeAccentStripe config={config} flags={flags} />

        <div className="px-3 py-2.5 pl-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <NodeIconBox config={config} flags={flags} Icon={Icon} />
              <div className="min-w-0">
                <h3
                  className={cn(
                    "truncate font-semibold text-[12px] leading-tight",
                    isDraft && "text-layer-building/80"
                  )}
                >
                  {data.label}
                </h3>
                {data.team && (
                  <span
                    className="font-mono text-[9px] leading-none"
                    style={{ color: `${data.team.color}99` }}
                  >
                    {data.team.name}
                  </span>
                )}
              </div>
            </div>
            <NodeStatusIcon
              activeLayer={activeLayer}
              data={data}
              isError={isError}
            />
          </div>

          <p
            className={cn(
              "mt-1.5 text-[10px] text-muted-foreground leading-snug",
              dimmed && "text-muted-foreground/50"
            )}
          >
            {data.description}
          </p>

          {activeLayer === "tracing" && <TracingOverlay data={data} />}
          {activeLayer === "building" && <BuildingOverlay data={data} />}
          {activeLayer === "platform" && <PlatformOverlay data={data} />}

          {isExpanded && data.features && (
            <FeatureGrid features={data.features} />
          )}
        </div>
      </div>
      <Handle
        className="!bg-border !border-surface !w-2 !h-2"
        position={Position.Bottom}
        type="source"
      />
    </>
  );
}
