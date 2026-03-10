import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useCallback, useEffect, useState } from "react";

// ─── Mock data ────────────────────────────────────────────────────────────────

const GRAPH_NODES = [
  { id: "api", label: "API Gateway", x: 450, y: 60 },
  { id: "users", label: "User Service", x: 200, y: 200 },
  { id: "products", label: "Product Catalog", x: 700, y: 200 },
  { id: "orders", label: "Order Service", x: 450, y: 340 },
  { id: "payments", label: "Payment Service", x: 200, y: 480 },
  { id: "inventory", label: "Inventory", x: 700, y: 480 },
  { id: "notifications", label: "Notifications", x: 450, y: 620 },
] as const;

const GRAPH_EDGES = [
  { from: "api", to: "users" },
  { from: "api", to: "products" },
  { from: "api", to: "orders" },
  { from: "orders", to: "payments" },
  { from: "orders", to: "inventory" },
  { from: "inventory", to: "notifications" },
  { from: "payments", to: "notifications" },
] as const;

const SELECTED_IDS = ["api", "users", "orders", "payments"];

// Env-diff: nodes on a horizontal line at the vertical center of the viewport.
// Env cards grow ABOVE each node (z-axis points up).
const ENV_LINE_Y = 380;
const ENV_LINE: Record<string, { x: number; y: number }> = {
  api: { x: 130, y: ENV_LINE_Y },
  users: { x: 340, y: ENV_LINE_Y },
  orders: { x: 550, y: ENV_LINE_Y },
  payments: { x: 760, y: ENV_LINE_Y },
};

const ENV_VERSIONS: Record<
  string,
  Array<{ env: string; version: string; status: string; hue: number }>
> = {
  api: [
    { env: "prod", version: "v2.3.1", status: "stable", hue: 155 },
    { env: "staging", version: "v2.4.0-rc1", status: "testing", hue: 80 },
    { env: "dev", version: "v2.5.0-alpha", status: "building", hue: 200 },
  ],
  users: [
    { env: "prod", version: "v1.8.2", status: "stable", hue: 155 },
    { env: "staging", version: "v1.8.2", status: "in-sync", hue: 80 },
    { env: "dev", version: "v1.9.0-beta", status: "new features", hue: 200 },
  ],
  orders: [
    { env: "prod", version: "v3.1.0", status: "stable", hue: 155 },
    { env: "staging", version: "v3.2.0-rc2", status: "testing", hue: 80 },
    { env: "dev", version: "v3.3.0-alpha", status: "building", hue: 200 },
  ],
  payments: [
    { env: "prod", version: "v2.0.4", status: "stable", hue: 155 },
    { env: "staging", version: "v2.1.0-rc1", status: "hotfix", hue: 80 },
    { env: "dev", version: "v2.1.0-rc1", status: "same as stg", hue: 200 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeById(id: string) {
  return GRAPH_NODES.find((n) => n.id === id);
}

// ─── Node style (shared between modes) ───────────────────────────────────────

const SELECTED_STYLE = {
  background: "oklch(0.17 0.03 200)",
  borderColor: "oklch(0.38 0.1 200)",
  color: "oklch(0.85 0.06 200)",
  boxShadow: "0 0 16px oklch(0.5 0.15 200 / 0.2)",
} as const;

const UNSELECTED_STYLE = {
  background: "oklch(0.16 0.01 270)",
  borderColor: "oklch(0.26 0.02 270)",
  color: "oklch(0.58 0.02 270)",
  boxShadow: "0 2px 8px oklch(0 0 0 / 0.3)",
} as const;

// ─── Main component ───────────────────────────────────────────────────────────

export function EnvDiffCanvas() {
  const [mode, setMode] = useState<"graph" | "env">("graph");
  const [isAnimating, setIsAnimating] = useState(false);
  const [scope, animate] = useAnimate();

  const isEnv = mode === "env";

  const handleToggle = useCallback(async () => {
    if (isAnimating) {
      return;
    }
    setIsAnimating(true);

    const rotationOpts = { duration: 0.85, ease: [0.3, 0, 0.7, 1] } as const;

    if (mode === "graph") {
      // Forward: switch layout, then rotate to hide transition
      setMode("env");
      await animate(scope.current, { rotateX: 90 }, rotationOpts);
      await animate(scope.current, { rotateX: 0 }, { duration: 0 });
    } else {
      // Reverse: rotate to hide env view FIRST, then switch layout
      await animate(scope.current, { rotateX: -90 }, rotationOpts);
      setMode("graph");
      await animate(scope.current, { rotateX: 0 }, { duration: 0 });
    }

    setIsAnimating(false);
  }, [mode, isAnimating, animate, scope]);

  // Space to toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isAnimating) {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleToggle, isAnimating]);

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-border border-b px-6 py-3.5">
        <div>
          <h1 className="font-semibold text-sm tracking-tight">
            I8 — Env Diff PoC
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isEnv
              ? "Environment diff (X-Z plane) — Y axis rotated away"
              : "Graph view (X-Y plane) — preselected nodes highlighted"}
            <span className="ml-3 opacity-50">press Space to toggle</span>
          </p>
        </div>
        <button
          className="rounded-lg border border-border bg-secondary px-4 py-2 font-medium text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isAnimating}
          onClick={handleToggle}
          type="button"
        >
          {isEnv ? "Rotate to Graph" : "Rotate to Env Diff"}
        </button>
      </div>

      {/* 3D scene */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{ perspective: "1200px" }}
      >
        {/* Rotating wrapper */}
        <div
          className="relative mx-auto h-full w-full max-w-[900px]"
          ref={scope}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* ── Graph edges ── */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {GRAPH_EDGES.map((edge) => {
              const from = nodeById(edge.from);
              const to = nodeById(edge.to);
              if (!(from && to)) {
                return null;
              }
              return (
                <motion.line
                  animate={{ opacity: isEnv ? 0 : 1 }}
                  key={`${edge.from}-${edge.to}`}
                  stroke="oklch(0.32 0.02 270)"
                  strokeWidth={1.5}
                  transition={{ duration: 0.25, delay: isEnv ? 0 : 0.45 }}
                  x1={from.x}
                  x2={to.x}
                  y1={from.y}
                  y2={to.y}
                />
              );
            })}

            {/* Env-mode: horizontal dashed connector on the X line */}
            <motion.line
              animate={{ opacity: isEnv ? 1 : 0 }}
              stroke="oklch(0.28 0.02 270)"
              strokeDasharray="6 4"
              strokeWidth={1}
              transition={{ duration: 0.3, delay: isEnv ? 0.5 : 0 }}
              x1={130}
              x2={760}
              y1={ENV_LINE_Y}
              y2={ENV_LINE_Y}
            />
          </svg>

          {/* ── All nodes (hero-animate between graph pos ↔ env line) ── */}
          {GRAPH_NODES.map((node) => {
            const selected = SELECTED_IDS.includes(node.id);
            const envPos = ENV_LINE[node.id];
            const targetX = isEnv && selected && envPos ? envPos.x : node.x;
            const targetY = isEnv && selected && envPos ? envPos.y : node.y;

            return (
              <motion.div
                animate={{
                  left: targetX,
                  top: targetY,
                  opacity: isEnv && !selected ? 0 : 1,
                  scale: isEnv && !selected ? 0.7 : 1,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                key={node.id}
                transition={{
                  left: { duration: 0.75, ease: [0.4, 0, 0.15, 1] },
                  top: { duration: 0.75, ease: [0.4, 0, 0.15, 1] },
                  opacity: { duration: 0.25, delay: isEnv ? 0 : 0.3 },
                  scale: { duration: 0.25 },
                }}
              >
                <div
                  className="whitespace-nowrap rounded-lg border px-3.5 py-2 font-medium text-xs"
                  style={selected ? SELECTED_STYLE : UNSELECTED_STYLE}
                >
                  {node.label}
                </div>
              </motion.div>
            );
          })}

          {/* ── Env version cards ABOVE nodes (z-axis points up) ── */}
          <AnimatePresence>
            {isEnv &&
              SELECTED_IDS.map((id, i) => {
                const pos = ENV_LINE[id];
                if (!pos) {
                  return null;
                }
                const versions = ENV_VERSIONS[id] ?? [];
                // Reverse so dev is at top, prod at bottom (closest to node)
                const reversed = [...versions].reverse();
                const count = reversed.length;

                return (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="absolute flex flex-col items-center"
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    initial={{ opacity: 0 }}
                    key={`env-col-${id}`}
                    style={{
                      left: pos.x,
                      top: 0,
                      height: pos.y - 20,
                      transform: "translateX(-50%)",
                    }}
                    transition={{ duration: 0.3, delay: 0.88 + i * 0.04 }}
                  >
                    {/* Spacer pushes cards + stem to the bottom */}
                    <div className="flex-1" />

                    {/* Cards: dev(top) → staging → prod(bottom, closest to node) */}
                    <div className="flex flex-col gap-2.5">
                      {reversed.map((v, j) => (
                        <motion.div
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className="w-[148px] rounded-lg border p-2.5"
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          key={v.env}
                          style={{
                            borderColor: `oklch(0.4 0.1 ${v.hue})`,
                            background: `oklch(0.14 0.025 ${v.hue})`,
                            boxShadow: `0 2px 12px oklch(0.3 0.1 ${v.hue} / 0.15)`,
                          }}
                          transition={{
                            // prod first (closest to node), ripple upward to dev
                            delay: 0.9 + i * 0.04 + (count - 1 - j) * 0.1,
                            duration: 0.35,
                            ease: [0, 0, 0.2, 1],
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="font-bold text-[10px] uppercase tracking-wider"
                              style={{ color: `oklch(0.72 0.14 ${v.hue})` }}
                            >
                              {v.env}
                            </span>
                            <span className="truncate text-[9px] text-muted-foreground">
                              {v.status}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-foreground text-xs">
                            {v.version}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Vertical stem connecting cards to node */}
                    <motion.div
                      animate={{ scaleY: 1 }}
                      className="mt-2 h-3 w-px origin-bottom"
                      initial={{ scaleY: 0 }}
                      style={{ background: "oklch(0.3 0.02 270)" }}
                      transition={{ delay: 0.88 + i * 0.04, duration: 0.25 }}
                    />
                  </motion.div>
                );
              })}
          </AnimatePresence>

          {/* ── Axis labels ── */}
          <div className="absolute inset-x-0 bottom-4 text-center text-[10px] text-muted-foreground/50 uppercase tracking-[0.25em]">
            x axis
          </div>
          <AnimatePresence mode="wait">
            {isEnv ? (
              <motion.div
                animate={{ opacity: 0.5 }}
                className="absolute top-1/2 left-4 -translate-y-1/2 -rotate-90 text-[10px] text-muted-foreground uppercase tracking-[0.25em]"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="z"
                transition={{ duration: 0.3 }}
              >
                z axis (environments)
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 0.5 }}
                className="absolute top-1/2 left-4 -translate-y-1/2 -rotate-90 text-[10px] text-muted-foreground uppercase tracking-[0.25em]"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="y"
                transition={{ duration: 0.3 }}
              >
                y axis
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend (graph mode only) */}
          <motion.div
            animate={{ opacity: isEnv ? 0 : 1 }}
            className="absolute top-6 left-6 flex items-center gap-2 text-[10px] text-muted-foreground"
            transition={{ duration: 0.3 }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "oklch(0.6 0.15 200)" }}
            />
            preselected for env diff
          </motion.div>
        </div>
      </div>
    </div>
  );
}
