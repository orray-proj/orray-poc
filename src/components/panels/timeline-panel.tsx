import { GitBranch as GitBranchIcon, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gitBranches, gitCommits, timelineEvents } from "@/data/system";
import type { TimelineEvent } from "@/data/types";
import { useLayerStore } from "@/stores/layer-store";

// ── Layout ─────────────────────────────────────────────────────────────────────
const PANEL_W = 600;
const BAR_MAX_H = 88;
const BAR_W = 11;
const ONE_DAY = 86_400_000;
const SHIFT_RATIO = 0.65;

// ── Colors ─────────────────────────────────────────────────────────────────────
const KIND_COLOR = {
  bug: {
    fill: "oklch(0.62 0.27 16)",
    glow: "oklch(0.62 0.27 16 / 0.5)",
    text: "oklch(0.78 0.27 16)",
  },
  deployment: {
    fill: "oklch(0.62 0.16 232)",
    glow: "oklch(0.62 0.16 232 / 0.45)",
    text: "oklch(0.80 0.16 232)",
  },
  proposal: {
    fill: "oklch(0.77 0.17 60)",
    glow: "oklch(0.77 0.17 60 / 0.35)",
    text: "oklch(0.88 0.17 60)",
  },
} as const;

const ACCENT = "oklch(0.65 0.18 165)";

// ── Time helpers ───────────────────────────────────────────────────────────────
function getAbsoluteRange(events: TimelineEvent[]): {
  absMax: number;
  absMin: number;
} {
  const times = events.map((e) => new Date(e.timestamp).getTime());
  const rawMin = Math.min(...times);
  const rawMax = Math.max(...times);
  const pad = (rawMax - rawMin) * 0.12;
  return { absMax: rawMax + pad, absMin: rawMin - pad };
}

function tToPercent(t: number, minT: number, maxT: number): number {
  return ((t - minT) / (maxT - minT)) * 100;
}

function toPercent(ts: string, minT: number, maxT: number): number {
  return tToPercent(new Date(ts).getTime(), minT, maxT);
}

function formatRange(ms: number): string {
  const days = ms / ONE_DAY;
  if (days >= 14) {
    return `${Math.round(days)}d`;
  }
  if (days >= 1) {
    return `${days.toFixed(1)}d`;
  }
  return `${Math.round(ms / 3_600_000)}h`;
}

function formatAxisDate(t: number, showTime = false): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (showTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  }
  return new Date(t).toLocaleDateString("en-US", opts);
}

function getAxisTicks(
  minT: number,
  maxT: number
): { label: string; pct: number }[] {
  const range = maxT - minT;
  let stepMs = 2 * ONE_DAY;
  if (range < 2 * ONE_DAY) {
    stepMs = ONE_DAY / 4;
  } else if (range < 5 * ONE_DAY) {
    stepMs = ONE_DAY;
  }
  const showTime = stepMs < ONE_DAY;
  const ticks: { label: string; pct: number }[] = [];
  const cursor = new Date(minT);
  if (showTime) {
    cursor.setUTCMinutes(0, 0, 0);
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  } else {
    cursor.setUTCHours(12, 0, 0, 0);
    if (cursor.getTime() < minT) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  while (cursor.getTime() <= maxT) {
    const pct = tToPercent(cursor.getTime(), minT, maxT);
    if (pct > 2 && pct < 98) {
      ticks.push({ label: formatAxisDate(cursor.getTime(), showTime), pct });
    }
    cursor.setTime(cursor.getTime() + stepMs);
  }
  return ticks;
}

function barHeightFraction(event: TimelineEvent): number {
  if (event.kind === "bug") {
    if (event.severity === "high") {
      return 1.0;
    }
    if (event.severity === "medium") {
      return 0.68;
    }
    return 0.48;
  }
  if (event.kind === "deployment") {
    return event.severity === "medium" ? 0.58 : 0.38;
  }
  return 0.3;
}

// ── Mock LLM date resolver ──────────────────────────────────────────────────────
const MOCK_PATTERNS: [RegExp, string][] = [
  [/kafka/i, "2026-02-14"],
  [/stripe|payment.*timeout|charge.*fail/i, "2026-02-22"],
  [/inventory|warehouse.*sync/i, "2026-02-21"],
  [/recommendation.*engine|plat-1042/i, "2026-02-18"],
  [/analytics.*service|plat-987/i, "2026-02-15"],
  [/user.*service|v1\.14/i, "2026-02-21"],
  [/order.*service|v4\.1|fulfillment/i, "2026-02-22"],
  [/api.*gateway|v2\.8|rate.limit/i, "2026-02-20"],
  [/last\s*week/i, "2026-02-16"],
  [/this\s*week/i, "2026-02-20"],
  [/start/i, "2026-02-14"],
  [/latest|most recent|newest/i, "2026-02-22"],
  [/feb(ruary)?\s*14|2[/-]14/i, "2026-02-14"],
  [/feb(ruary)?\s*15|2[/-]15/i, "2026-02-15"],
  [/feb(ruary)?\s*18|2[/-]18/i, "2026-02-18"],
  [/feb(ruary)?\s*20|2[/-]20/i, "2026-02-20"],
  [/feb(ruary)?\s*21|2[/-]21/i, "2026-02-21"],
  [/feb(ruary)?\s*22|2[/-]22/i, "2026-02-22"],
];

function resolveNaturalDate(query: string): Promise<Date | null> {
  return new Promise((resolve) => {
    const delay = 550 + Math.random() * 450;
    setTimeout(() => {
      for (const [pattern, dateStr] of MOCK_PATTERNS) {
        if (pattern.test(query)) {
          resolve(new Date(dateStr));
          return;
        }
      }
      const parsed = new Date(query);
      if (!Number.isNaN(parsed.getTime())) {
        resolve(parsed);
        return;
      }
      resolve(null);
    }, delay);
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.div
          animate={{ opacity: [0.15, 1, 0.15] }}
          className="h-[3px] w-[3px] rounded-full"
          key={i}
          style={{ background: ACCENT }}
          transition={{
            delay: i * 0.2,
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      ))}
    </div>
  );
}

function GotoBar({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (date: Date) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "idle" | "thinking" | "resolved" | "error"
  >("idle");
  const [resolvedDate, setResolvedDate] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-navigate after showing resolved date
  useEffect(() => {
    if (status !== "resolved" || !resolvedDate) {
      return;
    }
    const t = setTimeout(() => {
      onNavigate(resolvedDate);
      onClose();
    }, 950);
    return () => clearTimeout(t);
  }, [status, resolvedDate, onNavigate, onClose]);

  async function submit() {
    if (!query.trim() || status === "thinking") {
      return;
    }
    setStatus("thinking");
    setResolvedDate(null);
    const date = await resolveNaturalDate(query);
    if (date) {
      setResolvedDate(date);
      setStatus("resolved");
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="relative border-white/[0.07] border-t px-4 py-2.5">
      <div className="flex items-center gap-2">
        {/* Terminal prompt */}
        <span
          className="shrink-0 font-mono text-[10px] tracking-wider"
          style={{ color: `${ACCENT}aa` }}
        >
          JUMP ›
        </span>
        {/* Input */}
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-foreground/80 placeholder:text-muted-foreground/20 focus:outline-none"
          onChange={(e) => {
            setQuery(e.target.value);
            if (status !== "idle") {
              setStatus("idle");
              setResolvedDate(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              submit();
            }
            if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="feb 22  ·  last week  ·  stripe timeout  ·  kafka"
          ref={inputRef}
          value={query}
        />
        {/* Status indicators */}
        {status === "thinking" && <ThinkingDots />}
        {status === "resolved" && resolvedDate && (
          <motion.span
            animate={{ opacity: 1, x: 0 }}
            className="shrink-0 font-mono text-[9px]"
            initial={{ opacity: 0, x: 4 }}
            style={{ color: ACCENT }}
            transition={{ duration: 0.2 }}
          >
            →{" "}
            {resolvedDate.toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </motion.span>
        )}
        {status === "error" && (
          <span
            className="shrink-0 font-mono text-[9px] opacity-70"
            style={{ color: KIND_COLOR.bug.fill }}
          >
            not resolved
          </span>
        )}
        <button
          aria-label="Close jump bar"
          className="shrink-0 rounded p-0.5 text-muted-foreground/30 transition-colors hover:text-muted-foreground/70"
          onClick={onClose}
          type="button"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      {/* Underline */}
      <div
        className="mt-1.5 h-px w-full"
        style={{ background: `${ACCENT}22` }}
      />
    </div>
  );
}

function MiniBar({
  heightFrac,
  isActive,
  isInView,
  kind,
  xPct,
}: {
  heightFrac: number;
  isActive: boolean;
  isInView: boolean;
  kind: TimelineEvent["kind"];
  xPct: number;
}) {
  const h = Math.max(2, Math.round(heightFrac * 12));
  const { fill, glow } = KIND_COLOR[kind];
  return (
    <div
      className="absolute bottom-0 rounded-sm"
      style={{
        background: fill,
        boxShadow: isActive ? `0 0 7px 2px ${glow}` : undefined,
        height: h,
        left: `${xPct}%`,
        // biome-ignore lint/style/noNestedTernary: three-state opacity
        opacity: isActive ? 1 : isInView ? 0.55 : 0.18,
        transform: "translateX(-50%)",
        transition: "opacity 0.35s ease",
        width: 3,
      }}
    />
  );
}

function ChartBar({
  event,
  index,
  isActive,
  isHovered,
  onClick,
  onHover,
  onLeave,
  xPct,
}: {
  event: TimelineEvent;
  index: number;
  isActive: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
  xPct: number;
}) {
  const h = Math.round(barHeightFraction(event) * BAR_MAX_H);
  const { fill, glow } = KIND_COLOR[event.kind];
  const isDashed = event.kind === "proposal";
  const lit = isActive || isHovered;

  return (
    <button
      aria-label={`${event.title} — click to enter snapshot`}
      className="absolute bottom-0 cursor-pointer focus-visible:outline-none"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        height: BAR_MAX_H,
        left: `${xPct}%`,
        transform: "translateX(-50%)",
        transition: "left 0.38s cubic-bezier(0.32, 0, 0.67, 0)",
        width: BAR_W + 14,
      }}
      type="button"
    >
      <motion.div
        animate={{ opacity: 1, scaleY: 1 }}
        className="absolute bottom-0 left-1/2 origin-bottom rounded-t-sm"
        initial={{ opacity: 0, scaleY: 0 }}
        style={{
          background: isDashed
            ? `repeating-linear-gradient(0deg, transparent, transparent 4px, ${fill} 4px, ${fill} 7px)`
            : fill,
          boxShadow: lit
            ? `0 0 16px 5px ${glow}, 0 0 4px 1px ${fill}`
            : `0 0 5px 1px ${glow}`,
          height: h,
          outline: lit ? `1px solid ${fill}` : "none",
          transform: "translateX(-50%)",
          width: BAR_W,
        }}
        transition={{
          delay: 0.08 + index * 0.055,
          duration: 0.45,
          ease: [0.32, 0, 0.67, 0],
          type: "tween",
        }}
      />
    </button>
  );
}

function BarTooltip({ event, xPct }: { event: TimelineEvent; xPct: number }) {
  const { glow, text } = KIND_COLOR[event.kind];
  const d = new Date(event.timestamp);
  const dateStr = d.toLocaleDateString("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
  const clampedLeft = Math.min(Math.max(xPct, 16), 82);

  return (
    <div
      className="pointer-events-none absolute z-20 w-[196px] rounded-lg border bg-card/98 p-2.5 shadow-2xl backdrop-blur-sm"
      style={{
        borderColor: glow,
        bottom: BAR_MAX_H + 10,
        left: `${clampedLeft}%`,
        transform: "translateX(-50%)",
      }}
    >
      <p
        className="font-mono font-semibold text-[10px] leading-snug"
        style={{ color: text }}
      >
        {event.title}
      </p>
      <p className="mt-1 font-mono text-[9px] text-muted-foreground/70 leading-relaxed">
        {event.description}
      </p>
      <p className="mt-1.5 font-mono text-[8px] text-muted-foreground/35">
        {dateStr}
      </p>
    </div>
  );
}

// ── Edge navigation zone ───────────────────────────────────────────────────────
function EdgeZone({
  direction,
  eventsOffscreen,
  onShift,
  previewLabel,
}: {
  direction: "left" | "right";
  eventsOffscreen: number;
  onShift: () => void;
  previewLabel: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isLeft = direction === "left";
  const hasEvents = eventsOffscreen > 0;

  return (
    <button
      aria-label={`Shift view ${direction}`}
      className={`absolute inset-y-0 ${isLeft ? "left-0" : "right-0"} z-10 w-14 cursor-pointer focus-visible:outline-none`}
      onClick={onShift}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      type="button"
    >
      {/* Persistent edge glow when events exist off-screen */}
      {!hovered && hasEvents && (
        <motion.div
          animate={{ opacity: [0, 0.35, 0] }}
          className={`absolute inset-y-0 w-0.5 ${isLeft ? "left-0" : "right-0"}`}
          style={{ background: KIND_COLOR.deployment.fill }}
          transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
        />
      )}

      <AnimatePresence>
        {hovered && (
          <motion.div
            animate={{ opacity: 1 }}
            className={`absolute inset-0 flex flex-col ${isLeft ? "items-start pl-1.5" : "items-end pr-1.5"} justify-center gap-0.5`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{
              background: isLeft
                ? "linear-gradient(to right, oklch(0.08 0.02 240 / 0.94) 50%, transparent)"
                : "linear-gradient(to left, oklch(0.08 0.02 240 / 0.94) 50%, transparent)",
            }}
            transition={{ duration: 0.1 }}
          >
            <span className="font-mono text-[12px] text-muted-foreground/50 leading-none">
              {isLeft ? "◂" : "▸"}
            </span>
            {hasEvents && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                className="font-mono text-[8px]"
                style={{ color: KIND_COLOR.deployment.text }}
                transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY }}
              >
                +{eventsOffscreen}
              </motion.span>
            )}
            <span className="whitespace-nowrap font-mono text-[7px] text-muted-foreground/25 leading-tight">
              {previewLabel}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

// ── Zoom level pill ────────────────────────────────────────────────────────────
function ZoomPill({
  isDefault,
  ms,
  onClick,
}: {
  isDefault: boolean;
  ms: number;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-1 rounded border border-white/[0.07] px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground/45 tabular-nums transition-all hover:border-white/[0.14] hover:text-muted-foreground/75"
      onClick={onClick}
      title={isDefault ? "Already at full range" : "Reset to full range"}
      type="button"
    >
      <span
        className="h-[5px] w-[5px] rounded-sm opacity-60"
        style={{
          background: isDefault ? "oklch(0.4 0.02 270)" : ACCENT,
        }}
      />
      {formatRange(ms)}
    </button>
  );
}

// ── Git graph ──────────────────────────────────────────────────────────────────
const GIT_GRAPH_H = 44;
const SVG_W = PANEL_W - 56; // matches px-7 (28px) padding on each side
const MAIN_Y = 32;
const BRANCH_LANE_Y: Record<string, number> = {
  "feat/rec-engine": 18,
  "feat/retry-logic": 8,
};

interface GitCommitTooltip {
  author: string;
  message: string;
  sha: string;
  x: number;
}

function GitGraph({
  activeBugEventId,
  viewEnd,
  viewStart,
}: {
  activeBugEventId: string | null;
  viewEnd: number;
  viewStart: number;
}) {
  const [tooltipCommit, setTooltipCommit] = useState<GitCommitTooltip | null>(
    null
  );

  function tsToX(ts: string): number {
    return (
      (tToPercent(new Date(ts).getTime(), viewStart, viewEnd) / 100) * SVG_W
    );
  }

  const bugLinkedShas = useMemo(() => {
    if (!activeBugEventId) {
      return new Set<string>();
    }
    return new Set(
      gitCommits.filter((c) => c.eventId === activeBugEventId).map((c) => c.sha)
    );
  }, [activeBugEventId]);

  return (
    <div
      className="relative border-white/[0.07] border-t"
      style={{ height: GIT_GRAPH_H }}
    >
      {/* Subtle git branch icon in left gutter */}
      <div className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 opacity-[0.18]">
        <GitBranchIcon className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* SVG graph area */}
      <svg
        aria-labelledby="git-graph-title"
        height={GIT_GRAPH_H}
        role="img"
        style={{ left: 28, overflow: "hidden", position: "absolute", top: 0 }}
        width={SVG_W}
      >
        <title id="git-graph-title">Git branch graph</title>
        {/* Main branch horizontal line */}
        <line
          stroke="oklch(0.52 0.11 165 / 0.35)"
          strokeWidth={1}
          x1={0}
          x2={SVG_W}
          y1={MAIN_Y}
          y2={MAIN_Y}
        />

        {/* Feature branch paths */}
        {gitBranches
          .filter((b) => b.name !== "main" && b.originTimestamp)
          .map((branch) => {
            const laneY = BRANCH_LANE_Y[branch.name] ?? 15;
            const branchX = tsToX(branch.originTimestamp ?? "");
            const mergeX = branch.mergeTimestamp
              ? tsToX(branch.mergeTimestamp)
              : SVG_W + 20;
            const isMerged = !!branch.mergeTimestamp;
            const Q = 12; // curve control offset
            const runEnd = Math.max(branchX + Q, mergeX - Q);
            let d = `M ${branchX},${MAIN_Y} Q ${branchX},${laneY} ${branchX + Q},${laneY} L ${runEnd},${laneY}`;
            if (isMerged) {
              d += ` Q ${mergeX},${laneY} ${mergeX},${MAIN_Y}`;
            }
            return (
              <path
                d={d}
                fill="none"
                key={branch.name}
                stroke={branch.color}
                strokeDasharray={isMerged ? undefined : "3 3"}
                strokeOpacity={0.45}
                strokeWidth={1}
              />
            );
          })}

        {/* Commit circles */}
        {gitCommits.map((commit) => {
          const x = tsToX(commit.timestamp);
          if (x < -6 || x > SVG_W + 6) {
            return null;
          }
          const y =
            commit.branch === "main"
              ? MAIN_Y
              : (BRANCH_LANE_Y[commit.branch] ?? MAIN_Y);
          const branchData = gitBranches.find((b) => b.name === commit.branch);
          const color = branchData?.color ?? "oklch(0.52 0.11 165)";
          const isBugLinked = bugLinkedShas.has(commit.sha);
          const isEventLinked = !!commit.eventId;

          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: SVG <g> has no semantic equivalent
            <g
              key={commit.sha}
              onMouseEnter={() =>
                setTooltipCommit({
                  author: commit.author,
                  message: commit.message,
                  sha: commit.sha,
                  x,
                })
              }
              onMouseLeave={() => setTooltipCommit(null)}
              style={{ cursor: "default" }}
            >
              {isBugLinked && (
                <motion.circle
                  animate={{ opacity: [0.65, 0], r: [5, 10] }}
                  cx={x}
                  cy={y}
                  fill="none"
                  stroke={KIND_COLOR.bug.fill}
                  strokeWidth={1}
                  transition={{
                    duration: 1.1,
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                />
              )}
              <circle
                cx={x}
                cy={y}
                fill={isEventLinked ? color : "oklch(0.10 0.02 240)"}
                r={isEventLinked ? 3.5 : 2.5}
                stroke={color}
                strokeWidth={1.5}
              />
            </g>
          );
        })}
      </svg>

      {/* Commit hover tooltip */}
      {tooltipCommit && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-border/40 bg-card/98 px-2 py-1.5 shadow-xl backdrop-blur-sm"
          style={{
            bottom: GIT_GRAPH_H + 6,
            left: Math.min(
              Math.max(28 + tooltipCommit.x - 80, 8),
              PANEL_W - 200
            ),
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[8px] text-muted-foreground/40">
              {tooltipCommit.sha}
            </span>
            <span className="font-mono text-[8px] text-muted-foreground/30">
              {tooltipCommit.author}
            </span>
          </div>
          <p className="mt-0.5 max-w-[180px] truncate font-mono text-[9px] text-foreground/70">
            {tooltipCommit.message}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function TimelinePanel() {
  const timelineOpen = useLayerStore((s) => s.timelineOpen);
  const openTimeline = useLayerStore((s) => s.openTimeline);
  const closeTimeline = useLayerStore((s) => s.closeTimeline);
  const activeTimelineEvent = useLayerStore((s) => s.activeTimelineEvent);
  const enterTimelineSnapshot = useLayerStore((s) => s.enterTimelineSnapshot);
  const exitTimelineSnapshot = useLayerStore((s) => s.exitTimelineSnapshot);

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  const { absMax, absMin } = useMemo(
    () => getAbsoluteRange(timelineEvents),
    []
  );
  const [viewStart, setViewStart] = useState(absMin);
  const [viewEnd, setViewEnd] = useState(absMax);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showGoto, setShowGoto] = useState(false);

  // Ref mirror to avoid stale closures in wheel handler
  const viewRef = useRef({ viewEnd, viewStart });
  viewRef.current = { viewEnd, viewStart };

  const sortedEvents = useMemo(
    () =>
      [...timelineEvents].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    []
  );

  const eventsLeft = useMemo(
    () =>
      sortedEvents.filter((ev) => new Date(ev.timestamp).getTime() < viewStart)
        .length,
    [sortedEvents, viewStart]
  );

  const eventsRight = useMemo(
    () =>
      sortedEvents.filter((ev) => new Date(ev.timestamp).getTime() > viewEnd)
        .length,
    [sortedEvents, viewEnd]
  );

  const axisTicks = useMemo(
    () => getAxisTicks(viewStart, viewEnd),
    [viewStart, viewEnd]
  );

  const hoveredEvent = hoveredId
    ? timelineEvents.find((e) => e.id === hoveredId)
    : null;

  const activeColors = activeTimelineEvent
    ? KIND_COLOR[activeTimelineEvent.kind]
    : null;

  const isDefaultView =
    Math.abs(viewStart - absMin) < 1000 && Math.abs(viewEnd - absMax) < 1000;

  // ── Space → toggle JUMP bar ─────────────────────────────────────────────────
  useEffect(() => {
    if (!timelineOpen) {
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") {
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        return;
      }
      e.preventDefault();
      setShowGoto((v) => !v);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [timelineOpen]);

  // ── Wheel zoom ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timelineOpen) {
      return;
    }
    const el = chartAreaRef.current;
    if (!el) {
      return;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const { viewEnd: ve, viewStart: vs } = viewRef.current;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseXFrac = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const range = ve - vs;
      const factor = e.deltaY > 0 ? 1.28 : 0.78;
      const newRange = Math.max(
        ONE_DAY,
        Math.min(absMax - absMin, range * factor)
      );
      const pivotT = vs + mouseXFrac * range;
      const rawStart = pivotT - mouseXFrac * newRange;
      const newStart = Math.max(absMin, rawStart);
      const newEnd = Math.min(absMax, newStart + newRange);
      setViewStart(newStart);
      setViewEnd(newEnd);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [absMax, absMin, timelineOpen]);

  // ── Pan view ────────────────────────────────────────────────────────────────
  function shiftView(dir: "left" | "right") {
    const range = viewEnd - viewStart;
    const shift = range * SHIFT_RATIO;
    if (dir === "left") {
      const newStart = Math.max(absMin, viewStart - shift);
      setViewStart(newStart);
      setViewEnd(newStart + range);
    } else {
      const newEnd = Math.min(absMax, viewEnd + shift);
      setViewEnd(newEnd);
      setViewStart(newEnd - range);
    }
  }

  // ── Navigate to date ────────────────────────────────────────────────────────
  const navigateToDate = useCallback(
    (date: Date) => {
      const t = date.getTime();
      const windowMs = 3.5 * ONE_DAY;
      const newStart = Math.max(absMin, t - windowMs);
      const newEnd = Math.min(absMax, newStart + windowMs * 2);
      setViewStart(newStart);
      setViewEnd(newEnd);
    },
    [absMin, absMax]
  );

  function resetView() {
    setViewStart(absMin);
    setViewEnd(absMax);
  }

  // ── Hover open/close ────────────────────────────────────────────────────────
  function handleMouseEnter() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    openTimeline();
  }

  function handleMouseLeave() {
    hoverTimerRef.current = setTimeout(() => closeTimeline(), 350);
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Viewport box for mini-map (in absolute coords)
  const vpLeft = tToPercent(viewStart, absMin, absMax);
  const vpRight = 100 - tToPercent(viewEnd, absMin, absMax);

  return (
    <motion.div
      className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse items-center gap-1.5"
      drag
      dragMomentum={false}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ x: dragX, y: dragY }}
    >
      {/* ── Trigger strip (always visible) ── */}
      <div
        className="relative flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/90 px-3 py-2.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
        style={{ width: PANEL_W }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, oklch(1 0 0/0.013) 0px, oklch(1 0 0/0.013) 1px, transparent 1px, transparent 3px)",
          }}
        />

        {/* Live pulse + label */}
        <div className="flex shrink-0 items-center gap-1.5">
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
            transition={{
              duration: 2.4,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
            }}
          />
          <span className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest">
            Timeline
          </span>
        </div>

        <div className="h-3 w-px shrink-0 bg-border/30" />

        {/* Mini-map with viewport window */}
        <div className="relative h-[13px] flex-1">
          {/* Viewport scrubber window */}
          <div
            className="pointer-events-none absolute inset-y-[-2px] rounded-sm"
            style={{
              background: "oklch(0.55 0.1 240 / 0.1)",
              border: "1px solid oklch(0.55 0.1 240 / 0.28)",
              left: `${vpLeft}%`,
              right: `${vpRight}%`,
              transition: "left 0.35s ease, right 0.35s ease",
            }}
          />
          {timelineEvents.map((ev) => {
            const t = new Date(ev.timestamp).getTime();
            return (
              <MiniBar
                heightFrac={barHeightFraction(ev)}
                isActive={activeTimelineEvent?.id === ev.id}
                isInView={t >= viewStart && t <= viewEnd}
                key={ev.id}
                kind={ev.kind}
                xPct={tToPercent(t, absMin, absMax)}
              />
            );
          })}
        </div>

        <div className="h-3 w-px shrink-0 bg-border/30" />

        {/* Right: active snapshot badge or event count */}
        {activeTimelineEvent && activeColors ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: activeColors.fill }}
              transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY }}
            />
            <span
              className="max-w-[140px] truncate font-mono text-[9px]"
              style={{ color: activeColors.text }}
            >
              {activeTimelineEvent.title}
            </span>
            <button
              aria-label="Exit snapshot"
              className="ml-0.5 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                exitTimelineSnapshot();
              }}
              type="button"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <span className="shrink-0 font-mono text-[9px] text-muted-foreground/35">
            {timelineEvents.length} events
          </span>
        )}
      </div>

      {/* ── Expanded chart panel ── */}
      <AnimatePresence>
        {timelineOpen && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            initial={{ opacity: 0, y: 10 }}
            style={{ width: PANEL_W }}
            transition={{
              duration: 0.22,
              ease: [0.32, 0, 0.67, 0],
              type: "tween",
            }}
          >
            <div
              className="relative rounded-xl border border-border/25 shadow-2xl shadow-black/60 backdrop-blur-xl"
              style={{ background: "oklch(0.08 0.02 240 / 0.96)" }}
            >
              {/* Scanlines */}
              <div
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, oklch(1 0 0/0.016) 0px, oklch(1 0 0/0.016) 1px, transparent 1px, transparent 3px)",
                }}
              />

              {/* Chart area — pt-[100px] creates space for tooltip above bars */}
              <div className="relative px-7 pt-[100px]">
                {/* Tooltip renders here (outside overflow-hidden bar container) */}
                {hoveredEvent && (
                  <BarTooltip
                    event={hoveredEvent}
                    xPct={toPercent(hoveredEvent.timestamp, viewStart, viewEnd)}
                  />
                )}

                {/* Bar container — overflow-hidden clips out-of-viewport bars */}
                <div
                  className="relative overflow-hidden"
                  ref={chartAreaRef}
                  style={{ height: BAR_MAX_H }}
                >
                  {/* Grid lines */}
                  {([0.34, 0.67, 1.0] as const).map((frac) => (
                    <div
                      className="pointer-events-none absolute right-0 left-0 border-t"
                      key={frac}
                      style={{
                        borderColor: "oklch(1 0 0 / 0.04)",
                        bottom: Math.round(frac * BAR_MAX_H),
                      }}
                    />
                  ))}

                  {/* Edge navigation zones */}
                  <EdgeZone
                    direction="left"
                    eventsOffscreen={eventsLeft}
                    onShift={() => shiftView("left")}
                    previewLabel={formatAxisDate(
                      viewStart - (viewEnd - viewStart) * SHIFT_RATIO
                    )}
                  />
                  <EdgeZone
                    direction="right"
                    eventsOffscreen={eventsRight}
                    onShift={() => shiftView("right")}
                    previewLabel={formatAxisDate(
                      viewEnd + (viewEnd - viewStart) * SHIFT_RATIO
                    )}
                  />

                  {/* Bars */}
                  {sortedEvents.map((ev, i) => (
                    <ChartBar
                      event={ev}
                      index={i}
                      isActive={activeTimelineEvent?.id === ev.id}
                      isHovered={hoveredId === ev.id}
                      key={ev.id}
                      onClick={() =>
                        activeTimelineEvent?.id === ev.id
                          ? exitTimelineSnapshot()
                          : enterTimelineSnapshot(ev)
                      }
                      onHover={() => setHoveredId(ev.id)}
                      onLeave={() => setHoveredId(null)}
                      xPct={toPercent(ev.timestamp, viewStart, viewEnd)}
                    />
                  ))}
                </div>
              </div>

              {/* Time axis */}
              <div
                className="relative border-white/[0.07] border-t px-7"
                style={{ height: 28 }}
              >
                {axisTicks.map((tick) => (
                  <div
                    className="absolute flex flex-col items-center"
                    key={tick.label}
                    style={{
                      left: `${tick.pct}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="mb-0.5 h-1.5 w-px bg-white/[0.07]" />
                    <span className="whitespace-nowrap font-mono text-[8px] text-muted-foreground/35">
                      {tick.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Git graph row */}
              <GitGraph
                activeBugEventId={
                  activeTimelineEvent?.kind === "bug"
                    ? activeTimelineEvent.id
                    : null
                }
                viewEnd={viewEnd}
                viewStart={viewStart}
              />

              {/* GOTO bar (slides in above footer) */}
              <AnimatePresence>
                {showGoto && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    initial={{ opacity: 0, y: 4 }}
                    transition={{
                      duration: 0.15,
                      ease: [0.32, 0, 0.67, 0],
                      type: "tween",
                    }}
                  >
                    <GotoBar
                      onClose={() => setShowGoto(false)}
                      onNavigate={navigateToDate}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex items-center justify-between border-white/[0.06] border-t px-4 py-2">
                <div className="flex items-center gap-2.5">
                  {/* Zoom indicator — click to reset */}
                  <ZoomPill
                    isDefault={isDefaultView}
                    ms={viewEnd - viewStart}
                    onClick={resetView}
                  />
                  <div className="h-2 w-px bg-white/[0.06]" />
                  {/* Legend */}
                  {(["deployment", "bug", "proposal"] as const).map((kind) => (
                    <div className="flex items-center gap-1" key={kind}>
                      <div
                        className="h-1.5 w-2.5 rounded-sm"
                        style={{ background: KIND_COLOR[kind].fill }}
                      />
                      <span className="font-mono text-[8px] text-muted-foreground/40 capitalize">
                        {kind}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {/* JUMP button */}
                  <button
                    className="flex items-center gap-1.5 rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground/45 transition-all hover:border-white/[0.18] hover:text-muted-foreground/80"
                    onClick={() => setShowGoto((v) => !v)}
                    style={
                      showGoto
                        ? { borderColor: `${ACCENT}44`, color: ACCENT }
                        : {}
                    }
                    type="button"
                  >
                    JUMP ›
                    <kbd
                      className="rounded px-[3px] py-px font-mono text-[7px] leading-none"
                      style={{
                        background: "oklch(1 0 0 / 0.05)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                        color: "inherit",
                        opacity: 0.7,
                      }}
                    >
                      space
                    </kbd>
                  </button>

                  {activeTimelineEvent && (
                    <button
                      className="flex items-center gap-1.5 rounded-md border border-border/30 px-2 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:text-foreground"
                      onClick={exitTimelineSnapshot}
                      type="button"
                    >
                      <X className="h-2.5 w-2.5" />
                      Exit snapshot
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
