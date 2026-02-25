import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Globe,
  HardDrive,
  Radio,
  Server,
  X,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type {
  NodeKind,
  ServiceFeature,
  SystemEdge,
  SystemNode,
} from "@/data/types";
import { useLayerStore } from "@/stores/layer-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const CARD_W = 540;
export const CARD_H = 520;
const FEATURE_ARENA_H = 240;
const FEAT_W = 150;
const FEAT_H = 58;
const SPREAD_R = 80;
const ARENA_PADDING_X = 16;

const TWEEN: Parameters<typeof motion.div>[0]["transition"] = {
  type: "tween",
  duration: 0.6,
  ease: [0.32, 0, 0.67, 0],
};

// ---------------------------------------------------------------------------
// Helpers — layer-data display
// ---------------------------------------------------------------------------
function tracingStatusBg(status: string): string {
  if (status === "error") {
    return "oklch(0.65 0.25 15 / 0.15)";
  }
  if (status === "ok") {
    return "oklch(0.75 0.14 145 / 0.15)";
  }
  return "oklch(0.75 0.18 55 / 0.15)";
}

function tracingStatusFg(status: string): string {
  if (status === "error") {
    return "oklch(0.65 0.25 15)";
  }
  if (status === "ok") {
    return "oklch(0.75 0.14 145)";
  }
  return "oklch(0.75 0.18 55)";
}

function healthClass(health: string): string {
  if (health === "healthy") {
    return "text-emerald-400";
  }
  if (health === "critical") {
    return "text-red-400";
  }
  return "text-amber-400";
}

function metricBarClass(value: number): string {
  if (value > 80) {
    return "bg-red-400";
  }
  if (value > 60) {
    return "bg-amber-400";
  }
  return "bg-emerald-400";
}

function featureStatusColor(status: string): string {
  if (status === "healthy") {
    return "oklch(0.75 0.14 145)";
  }
  if (status === "critical") {
    return "oklch(0.65 0.25 15)";
  }
  return "oklch(0.75 0.18 55)";
}

// ---------------------------------------------------------------------------
// Kind config
// ---------------------------------------------------------------------------
const kindConfig: Record<
  NodeKind,
  { icon: React.ElementType; accent: string }
> = {
  gateway: { icon: Globe, accent: "oklch(0.78 0.15 200)" },
  service: { icon: Server, accent: "oklch(0.78 0.12 260)" },
  database: { icon: Database, accent: "oklch(0.75 0.14 145)" },
  queue: { icon: Radio, accent: "oklch(0.75 0.15 55)" },
  cache: { icon: HardDrive, accent: "oklch(0.70 0.18 330)" },
};

// ---------------------------------------------------------------------------
// Feature position algorithm
// ---------------------------------------------------------------------------
interface Pos {
  x: number;
  y: number;
}

function featureRawPosition(
  feature: ServiceFeature,
  neighborAngles: Record<string, number>,
  cx: number,
  cy: number
): Pos {
  const connected = feature.connectedNodeIds ?? [];
  if (!connected.length) {
    return { x: cx, y: cy };
  }
  let sumCos = 0;
  let sumSin = 0;
  let count = 0;
  for (const nid of connected) {
    const a = neighborAngles[nid];
    if (a === undefined) {
      continue;
    }
    sumCos += Math.cos(a);
    sumSin += Math.sin(a);
    count++;
  }
  if (count === 0) {
    return { x: cx, y: cy };
  }
  const mag = Math.sqrt(sumCos ** 2 + sumSin ** 2);
  if (mag < 0.01) {
    return { x: cx, y: cy };
  }
  const arenaW = CARD_W - 2 * ARENA_PADDING_X;
  return {
    x: Math.max(0, Math.min(arenaW - FEAT_W, cx + (sumCos / mag) * SPREAD_R)),
    y: Math.max(
      0,
      Math.min(FEATURE_ARENA_H - FEAT_H, cy + (sumSin / mag) * SPREAD_R)
    ),
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: O(n²) separation algorithm is inherently complex
function separatePositions(positions: Pos[]): void {
  const MIN_X = FEAT_W + 6;
  const MIN_Y = FEAT_H + 6;
  const arenaW = CARD_W - 2 * ARENA_PADDING_X;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i];
      const b = positions[j];
      const ovX = MIN_X - Math.abs(b.x - a.x);
      const ovY = MIN_Y - Math.abs(b.y - a.y);
      if (ovX > 0 && ovY > 0) {
        const axis = ovX < ovY ? "x" : "y";
        const push = (axis === "x" ? ovX : ovY) / 2;
        const dir = (axis === "x" ? b.x - a.x : b.y - a.y) >= 0 ? 1 : -1;
        const max = axis === "x" ? arenaW - FEAT_W : FEATURE_ARENA_H - FEAT_H;
        b[axis] = Math.max(0, Math.min(max, b[axis] + dir * push));
        a[axis] = Math.max(0, Math.min(max, a[axis] - dir * push));
      }
    }
  }
}

function computeFeaturePositions(
  features: ServiceFeature[],
  neighborAngles: Record<string, number> | null
): Pos[] {
  const cx = (CARD_W - 2 * ARENA_PADDING_X) / 2 - FEAT_W / 2;
  const cy = FEATURE_ARENA_H / 2 - FEAT_H / 2;
  const positions = features.map((f) =>
    neighborAngles
      ? featureRawPosition(f, neighborAngles, cx, cy)
      : { x: cx, y: cy }
  );
  separatePositions(positions);
  return positions;
}

// ---------------------------------------------------------------------------
// Card border point (for port positioning) — exported for handle placement
// ---------------------------------------------------------------------------
export function cardBorderPoint(angle: number): { x: number; y: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const t = Math.min(
    Math.abs(cosA) > 1e-9
      ? CARD_W / 2 / Math.abs(cosA)
      : Number.POSITIVE_INFINITY,
    Math.abs(sinA) > 1e-9
      ? CARD_H / 2 / Math.abs(sinA)
      : Number.POSITIVE_INFINITY
  );
  return { x: CARD_W / 2 + cosA * t, y: CARD_H / 2 + sinA * t };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
interface PortDotProps {
  color: string;
  x: number;
  y: number;
}

function PortDot({ x, y, color }: PortDotProps) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x - 5,
        top: y - 5,
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px 2px ${color.replace(")", " / 0.5)")}`,
        opacity: 0.9,
      }}
    />
  );
}

interface Port {
  color: string;
  neighborId: string;
  x: number;
  y: number;
}

function portEdgeColor(
  allEdges: SystemEdge[],
  nodeId: string,
  neighborId: string
): string {
  const edge = allEdges.find(
    (e) =>
      (e.source === nodeId && e.target === neighborId) ||
      (e.target === nodeId && e.source === neighborId)
  );
  const status = edge?.data?.tracing?.status;
  if (status === "error") {
    return "oklch(0.65 0.25 15)";
  }
  if (status === "warning") {
    return "oklch(0.75 0.18 55)";
  }
  if (status === "ok") {
    return "oklch(0.75 0.14 145)";
  }
  return "oklch(0.6 0.05 260)";
}

interface XRayConnectorsProps {
  accent: string;
  allEdges: SystemEdge[];
  arenaTop: number;
  featurePositions: Array<{ x: number; y: number }>;
  features: ServiceFeature[];
  nodeId: string;
  ports: Port[];
}

function XRayConnectors({
  ports,
  featurePositions,
  features,
  arenaTop,
  allEdges,
  nodeId,
}: XRayConnectorsProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      height={CARD_H}
      style={{ overflow: "visible" }}
      width={CARD_W}
    >
      {ports.map((p) => {
        const color = portEdgeColor(allEdges, nodeId, p.neighborId);
        return features.map((f, i) => {
          if (!f.connectedNodeIds?.includes(p.neighborId)) {
            return null;
          }
          const fp = featurePositions[i];
          // Terminate at nearest point on feature box border, not its center.
          const bx = ARENA_PADDING_X + fp.x;
          const by = arenaTop + fp.y;
          const tx = Math.max(bx, Math.min(bx + FEAT_W, p.x));
          const ty = Math.max(by, Math.min(by + FEAT_H, p.y));
          // Step path: horizontal to midpoint, vertical to target y, horizontal to target.
          const midX = (p.x + tx) / 2;
          const stepPath = `M ${p.x} ${p.y} H ${midX} V ${ty} H ${tx}`;
          return (
            <path
              d={stepPath}
              fill="none"
              key={`${p.neighborId}-${f.id}`}
              opacity={0.5}
              stroke={color}
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          );
        });
      })}
    </svg>
  );
}

interface FeatureBoxProps {
  accent: string;
  feature: ServiceFeature;
  index: number;
  position: { x: number; y: number };
}

function FeatureBox({ feature, position, index, accent }: FeatureBoxProps) {
  const statusColor = featureStatusColor(feature.status);
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="absolute"
      initial={{ opacity: 0, scale: 0.8 }}
      style={{
        left: ARENA_PADDING_X + position.x,
        top: position.y,
        width: FEAT_W,
        height: FEAT_H,
        background: "oklch(1 0 0 / 0.04)",
        border: "1px solid oklch(1 0 0 / 0.09)",
        borderRadius: 6,
        padding: "6px 8px",
        overflow: "hidden",
      }}
      transition={{
        type: "tween",
        duration: 0.3,
        delay: index * 0.06 + 0.3,
        ease: [0.32, 0, 0.67, 0],
      }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: statusColor, flexShrink: 0 }}
        />
        <span
          className="truncate font-mono text-[10px] leading-none"
          style={{ color: accent }}
        >
          {feature.name}
        </span>
      </div>
      <p
        className="font-mono text-[9px] leading-tight"
        style={{
          color: "oklch(1 0 0 / 0.40)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {feature.description}
      </p>
      {feature.team && (
        <span
          className="absolute right-2 bottom-1 font-mono text-[8px]"
          style={{ color: `${feature.team.color}80` }}
        >
          {feature.team.name}
        </span>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FocusModeOverlayProps {
  allEdges: SystemEdge[];
  allNodes: SystemNode[];
  nodeId: string;
  onExit: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function FocusModeOverlay({
  nodeId,
  allNodes,
  allEdges,
  onExit,
}: FocusModeOverlayProps) {
  const activeLayer = useLayerStore((s) => s.activeLayer);

  // Captured at mount — persists through exit animation even if store clears.
  const [capturedRect] = useState(
    () => useLayerStore.getState().focusModeInitialRect
  );
  // Angles arrive after mount (set by FocusController.useEffect).
  // Subscribe so we catch the update, then latch the value so it persists
  // through the exit animation even after the store clears.
  const [neighborAngles, setNeighborAngles] = useState<Record<
    string,
    number
  > | null>(() => useLayerStore.getState().focusModeNeighborAngles);
  useEffect(() => {
    return useLayerStore.subscribe((s) => {
      if (s.focusModeNeighborAngles !== null) {
        setNeighborAngles(s.focusModeNeighborAngles);
      }
    });
  }, []);

  // arenaTop: measured offset of the feature arena div within the card.
  const [arenaTop, setArenaTop] = useState(CARD_H - FEATURE_ARENA_H - 16);
  const arenaRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      setArenaTop(el.offsetTop);
    }
  }, []);

  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) {
    return null;
  }

  const data = node.data;
  const cfg = kindConfig[data.kind] ?? kindConfig.service;
  const { icon: Icon, accent } = cfg;
  const accentTint = accent.replace(")", " / 0.12)");
  const accentBorder = accent.replace(")", " / 0.25)");
  const accentGlow = accent.replace(")", " / 0.1)");

  // Card screen geometry.
  const cardX = (window.innerWidth - CARD_W) / 2;
  const cardY = (window.innerHeight - CARD_H) / 2;

  // Hero transition: scale-from-origin toward the node's screen position.
  let transformOrigin = "center center";
  let initScaleX = 0.95;
  let initScaleY = 0.95;

  if (capturedRect) {
    const originX = capturedRect.x + capturedRect.w / 2 - cardX;
    const originY = capturedRect.y + capturedRect.h / 2 - cardY;
    initScaleX = capturedRect.w / CARD_W;
    initScaleY = capturedRect.h / CARD_H;
    transformOrigin = `${originX}px ${originY}px`;
  }

  const tracing = data.tracing;
  const platform = data.platform;
  const building = data.building;
  const features = data.features ?? [];

  // Build ports (one per neighbor with a known angle and edge-status color).
  const ports: Port[] = neighborAngles
    ? Object.entries(neighborAngles).map(([neighborId, angle]) => {
        const pt = cardBorderPoint(angle);
        const color = portEdgeColor(allEdges, nodeId, neighborId);
        return { neighborId, x: pt.x, y: pt.y, color };
      })
    : [];

  // Compute feature positions inside the arena.
  const featurePositions = computeFeaturePositions(features, neighborAngles);

  // Blueprint background.
  const blueprintBg = {
    background: "oklch(0.08 0.02 240 / 0.97)",
    backgroundImage:
      "repeating-linear-gradient(0deg, oklch(1 0 0/0.015) 0px, oklch(1 0 0/0.015) 1px, transparent 1px, transparent 3px)",
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Faint backdrop */}
      <motion.div
        animate={{ opacity: 1 }}
        className="pointer-events-auto absolute inset-0"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onExit}
        style={{ background: "oklch(0.07 0.01 240 / 0.42)" }}
        transition={{ duration: 0.25 }}
      />

      {/* Outer motion wrapper — no overflow so port dots aren't clipped */}
      <motion.div
        animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
        className="pointer-events-auto absolute"
        exit={{ opacity: 0, scaleX: initScaleX, scaleY: initScaleY }}
        initial={{ opacity: 0, scaleX: initScaleX, scaleY: initScaleY }}
        style={{
          left: cardX,
          top: cardY,
          width: CARD_W,
          height: CARD_H,
          transformOrigin,
        }}
        transition={TWEEN}
      >
        {/* Card content — this div has overflow-hidden */}
        <div
          className="absolute inset-0 overflow-hidden rounded-lg border"
          style={{
            ...blueprintBg,
            borderColor: accentBorder,
            boxShadow: [
              `0 0 0 1px ${accentGlow}`,
              "0 24px 64px oklch(0 0 0 / 0.6)",
              "inset 0 1px 0 oklch(1 0 0 / 0.04)",
            ].join(", "),
          }}
        >
          {/* Left accent stripe */}
          <div
            className="absolute top-3 bottom-3 left-0 w-[3px] rounded-full"
            style={{ background: accent }}
          />

          {/* Close button */}
          <button
            className="absolute top-2.5 right-2.5 z-10 rounded p-1 text-white/25 transition-colors hover:bg-white/5 hover:text-white/60"
            onClick={onExit}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="px-4 py-3 pl-5">
            {/* Header: icon + label + kind badge */}
            <div className="flex items-start gap-2.5">
              <div
                className="mt-0.5 shrink-0 rounded p-1.5"
                style={{ background: accentTint }}
              >
                <Icon className="h-4 w-4" style={{ color: accent }} />
              </div>
              <div className="min-w-0 flex-1 pr-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="font-semibold text-[15px] leading-tight">
                    {data.label}
                  </h2>
                  <span
                    className="shrink-0 rounded-sm px-1 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                    style={{
                      background: accentTint,
                      color: accent,
                      border: `1px solid ${accentBorder}`,
                    }}
                  >
                    {data.kind}
                  </span>
                </div>
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

            {/* Description */}
            {data.description && (
              <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                {data.description}
              </p>
            )}

            {/* Tracing layer */}
            {activeLayer === "tracing" && tracing && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-[11px] text-foreground/70">
                      {tracing.latencyMs}ms
                    </span>
                  </div>
                  <span
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                    style={{
                      background: tracingStatusBg(tracing.status),
                      color: tracingStatusFg(tracing.status),
                    }}
                  >
                    {tracing.status}
                  </span>
                </div>
                {tracing.errorMessage && (
                  <p className="rounded border border-red-500/10 bg-red-500/5 px-2 py-1 font-mono text-[10px] text-red-400/80 leading-tight">
                    {tracing.errorMessage}
                  </p>
                )}
              </div>
            )}

            {/* Platform layer */}
            {activeLayer === "platform" && platform && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <div
                    className={`flex items-center gap-1 ${healthClass(platform.health)}`}
                  >
                    {platform.health === "healthy" && (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {platform.health === "critical" && (
                      <XCircle className="h-3 w-3" />
                    )}
                    {platform.health !== "healthy" &&
                      platform.health !== "critical" && (
                        <AlertCircle className="h-3 w-3" />
                      )}
                    <span className="font-medium capitalize">
                      {platform.health}
                    </span>
                  </div>
                  <span className="font-mono text-muted-foreground">
                    {platform.version}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-7 shrink-0 font-mono text-muted-foreground">
                    CPU
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${metricBarClass(platform.cpu)}`}
                      style={{ width: `${Math.min(platform.cpu, 100)}%` }}
                    />
                  </div>
                  <span className="w-7 text-right font-mono text-foreground/70">
                    {platform.cpu}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-7 shrink-0 font-mono text-muted-foreground">
                    MEM
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${metricBarClass(platform.memory)}`}
                      style={{ width: `${Math.min(platform.memory, 100)}%` }}
                    />
                  </div>
                  <span className="w-7 text-right font-mono text-foreground/70">
                    {platform.memory}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Box className="h-3 w-3" />
                    <span className="font-mono">
                      {platform.pods.ready}/{platform.pods.total} pods
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    <span className="font-mono">{platform.lastDeploy}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Building layer */}
            {activeLayer === "building" && building && (
              <div className="mt-3 space-y-1">
                {building.ticketId && (
                  <div className="flex items-center gap-1.5 text-[10px] text-layer-building/70">
                    <FileText className="h-3 w-3" />
                    <span className="font-mono">{building.ticketId}</span>
                  </div>
                )}
                {building.proposedBy && (
                  <p className="text-[10px] text-muted-foreground">
                    Proposed by {building.proposedBy}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Feature arena — spatially positioned X-ray view */}
          {features.length > 0 && (
            <>
              <div
                className="mx-4 border-t"
                style={{ borderColor: `${accentBorder}` }}
              />
              <div
                className="relative mx-0"
                ref={arenaRef}
                style={{
                  height: FEATURE_ARENA_H,
                  marginTop: 8,
                }}
              >
                {features.map((f, i) => (
                  <FeatureBox
                    accent={accent}
                    feature={f}
                    index={i}
                    key={f.id}
                    position={featurePositions[i]}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* SVG connector lines — rendered after content div so they paint on top */}
        <XRayConnectors
          accent={accent}
          allEdges={allEdges}
          arenaTop={arenaTop}
          featurePositions={featurePositions}
          features={features}
          nodeId={nodeId}
          ports={ports}
        />

        {/* Port dots — sit on card border, on top of everything */}
        {ports.map((p) => (
          <PortDot color={p.color} key={p.neighborId} x={p.x} y={p.y} />
        ))}
      </motion.div>
    </div>
  );
}
