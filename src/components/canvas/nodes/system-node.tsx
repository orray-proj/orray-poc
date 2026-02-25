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
import { Fragment } from "react";
import {
  CARD_H,
  CARD_W,
  cardBorderPoint,
} from "@/components/canvas/focus-overlay";
import { Badge } from "@/components/ui/badge";
import type {
  HealthStatus,
  NodeKind,
  ServiceFeature,
  SystemNodeData,
} from "@/data/types";
import { cn } from "@/lib/utils";
import { ZOOM_FOCUS_THRESHOLD } from "@/lib/zoom-constants";
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

export function FeatureGrid({ features }: { features: ServiceFeature[] }) {
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

/**
 * Animated cue ring that sweeps around the node border over FOCUS_DWELL_MS,
 * signalling "about to enter focus mode". Re-mounts on each new hover via `key`.
 */
function CueRing() {
  // Perimeter ≈ 2*(220+160) = 760 for the default collapsed node size.
  const perimeter = 760;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
      fill="none"
      height="100%"
      width="100%"
    >
      {/* Soft bloom beneath the sweep line */}
      <rect
        filter="blur(4px)"
        height="100%"
        rx={8}
        ry={8}
        stroke="oklch(0.72 0.18 195 / 0.3)"
        strokeDasharray={perimeter}
        strokeDashoffset={0}
        strokeWidth={4}
        style={{
          animation: "cue-sweep 600ms linear forwards",
        }}
        width="100%"
        x={0}
        y={0}
      />
      {/* Sharp sweep line */}
      <rect
        height="100%"
        rx={8}
        ry={8}
        stroke="oklch(0.72 0.18 195 / 0.85)"
        strokeDasharray={perimeter}
        strokeDashoffset={perimeter}
        strokeWidth={1.5}
        style={{
          animation: "cue-sweep 600ms linear forwards",
        }}
        width="100%"
        x={0}
        y={0}
      />
    </svg>
  );
}

/** Derives the container className for the node outer div. */
function getNodeContainerClass(
  flags: NodeFlags,
  isCued: boolean,
  isFocused: boolean,
  isScattered: boolean,
  isNeighbor: boolean,
  selected: boolean
): string {
  const { isDraft, isError, isCritical, dimmed } = flags;
  return cn(
    "relative w-[220px] rounded-lg border transition-all duration-500",
    "bg-card/80 backdrop-blur-sm",
    // Scattered neighbors: clearly visible and clickable.
    isScattered && isNeighbor && "cursor-pointer opacity-[0.65]",
    // Scattered non-neighbors: nearly invisible.
    isScattered && !isNeighbor && "cursor-pointer opacity-[0.06]",
    // Focused node: hidden (rendered by the DOM overlay instead).
    isFocused && "pointer-events-none opacity-0",
    selected && "ring-1 ring-ring",
    isDraft &&
      "animate-[ghost-shimmer_3s_ease-in-out_infinite] border-layer-building/40 border-dashed bg-layer-building/5",
    isError &&
      "animate-[error-pulse_2s_ease-in-out_infinite] border-layer-error/50",
    isCritical &&
      "border-red-500/40 shadow-[0_0_16px_oklch(0.65_0.25_15_/_0.2)]",
    !(isDraft || isError || isCritical || isCued || isFocused || isScattered) &&
      "border-border/60",
    dimmed && "opacity-30"
  );
}

interface PortHandle {
  leftPct: number;
  neighborId: string;
  topPct: number;
}

/** Computes per-neighbor port handles when a node is in focus mode. */
function buildPortHandles(
  isFocused: boolean,
  neighborAngles: Record<string, number> | null
): PortHandle[] | null {
  if (!(isFocused && neighborAngles)) {
    return null;
  }
  return Object.entries(neighborAngles).map(([neighborId, angle]) => {
    const pt = cardBorderPoint(angle);
    return {
      neighborId,
      leftPct: (pt.x / CARD_W) * 100,
      topPct: (pt.y / CARD_H) * 100,
    };
  });
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: JSX branching across layers is inherently complex
export function SystemNodeComponent({
  id,
  data,
  selected,
}: NodeProps<SystemNodeType>) {
  const activeLayer = useLayerStore((s) => s.activeLayer);
  const hoveredNodeId = useLayerStore((s) => s.hoveredNodeId);
  const focusModeNodeId = useLayerStore((s) => s.focusModeNodeId);
  const enterFocusMode = useLayerStore((s) => s.enterFocusMode);
  const setFocusModeInitialRect = useLayerStore(
    (s) => s.setFocusModeInitialRect
  );
  const rf = useReactFlow();
  const { zoom } = useViewport();

  const isDraft = data.building?.isDraft ?? false;
  const isError = data.tracing?.status === "error" && activeLayer === "tracing";
  const isOnTracePath = Boolean(data.tracing && activeLayer === "tracing");
  const isCritical =
    data.platform?.health === "critical" && activeLayer === "platform";
  const dimmed = isNodeDimmed(activeLayer, isOnTracePath, data.kind);

  const focusModeNeighborIds = useLayerStore((s) => s.focusModeNeighborIds);
  const focusModeNeighborAngles = useLayerStore(
    (s) => s.focusModeNeighborAngles
  );
  const isFocused = focusModeNodeId === id;
  const isScattered = focusModeNodeId !== null && !isFocused;
  const isNeighbor =
    isScattered && (focusModeNeighborIds?.includes(id) ?? false);
  const isCued =
    hoveredNodeId === id &&
    zoom >= ZOOM_FOCUS_THRESHOLD &&
    focusModeNodeId === null;

  const config = kindConfig[data.kind];
  const Icon = config.icon;
  const flags: NodeFlags = { isDraft, isError, isCritical, dimmed };

  // Compute per-port handles when focused (one source + one target per neighbor at border point).
  const portHandles = buildPortHandles(isFocused, focusModeNeighborAngles);

  return (
    <>
      {portHandles ? (
        // Per-neighbor handles for precise edge routing in focus mode.
        portHandles.map(({ neighborId, leftPct, topPct }) => (
          <Fragment key={neighborId}>
            <Handle
              id={`src-${neighborId}`}
              position={Position.Top}
              style={{ left: `${leftPct}%`, top: `${topPct}%`, opacity: 0 }}
              type="source"
            />
            <Handle
              id={`tgt-${neighborId}`}
              position={Position.Top}
              style={{ left: `${leftPct}%`, top: `${topPct}%`, opacity: 0 }}
              type="target"
            />
          </Fragment>
        ))
      ) : (
        <Handle
          className="!bg-border !border-surface !w-2 !h-2"
          position={Position.Top}
          type="target"
        />
      )}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions lint/a11y/noStaticElementInteractions: React Flow requires a div as node root; role/keyboard attrs added when interactive */}
      <div
        className={getNodeContainerClass(
          flags,
          isCued,
          isFocused,
          isScattered,
          isNeighbor,
          selected
        )}
        onClick={
          isScattered
            ? () => {
                // Capture screen rect for hero transition before switching focus.
                const node = rf.getNode(id);
                if (node) {
                  const { x: vpX, y: vpY, zoom: vz } = rf.getViewport();
                  setFocusModeInitialRect({
                    x: node.position.x * vz + vpX,
                    y: node.position.y * vz + vpY,
                    w: (node.measured?.width ?? 220) * vz,
                    h: (node.measured?.height ?? 160) * vz,
                  });
                }
                enterFocusMode(id);
              }
            : undefined
        }
        onKeyDown={
          isScattered
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  enterFocusMode(id);
                }
              }
            : undefined
        }
        role={isScattered ? "button" : undefined}
        tabIndex={isScattered ? 0 : undefined}
      >
        <NodeAccentStripe config={config} flags={flags} />

        {/* Cue ring: remount on each new hover start to restart the animation */}
        {isCued && <CueRing key={`cue-${id}-${hoveredNodeId}`} />}

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
        </div>
      </div>
      {!portHandles && (
        <Handle
          className="!bg-border !border-surface !w-2 !h-2"
          position={Position.Bottom}
          type="source"
        />
      )}
    </>
  );
}
