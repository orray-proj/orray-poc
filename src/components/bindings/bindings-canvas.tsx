import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

// ─── Mock topology ───────────────────────────────────────────────────────────

type NodeKind = "gateway" | "service" | "database" | "cache" | "queue";

interface TopoNode {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
}

interface TopoEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  protocol: string;
  /** If true, this is a structural dependency (service→resource) that becomes a binding. */
  isBinding: boolean;
}

interface BindingDef {
  serviceId: string;
  resourceId: string;
}

const NODES: TopoNode[] = [
  { id: "gateway", label: "API Gateway", kind: "gateway", x: 450, y: 55 },
  { id: "users", label: "User Service", kind: "service", x: 170, y: 210 },
  { id: "orders", label: "Order Service", kind: "service", x: 450, y: 210 },
  {
    id: "catalog",
    label: "Product Catalog",
    kind: "service",
    x: 730,
    y: 210,
  },
  {
    id: "payments",
    label: "Payment Service",
    kind: "service",
    x: 250,
    y: 410,
  },
  {
    id: "inventory",
    label: "Inventory Service",
    kind: "service",
    x: 650,
    y: 410,
  },
  { id: "eventbus", label: "Event Bus", kind: "queue", x: 450, y: 560 },
  // Resources
  { id: "users-db", label: "Users DB", kind: "database", x: 30, y: 280 },
  { id: "orders-db", label: "Orders DB", kind: "database", x: 370, y: 360 },
  {
    id: "products-db",
    label: "Products DB",
    kind: "database",
    x: 840,
    y: 350,
  },
  { id: "cache", label: "Redis Cache", kind: "cache", x: 880, y: 150 },
];

const EDGES: TopoEdge[] = [
  // Communication edges (stay as edges)
  {
    id: "gw-users",
    from: "gateway",
    to: "users",
    label: "Auth check",
    protocol: "gRPC",
    isBinding: false,
  },
  {
    id: "gw-orders",
    from: "gateway",
    to: "orders",
    label: "Order commands",
    protocol: "REST",
    isBinding: false,
  },
  {
    id: "gw-catalog",
    from: "gateway",
    to: "catalog",
    label: "Product queries",
    protocol: "REST",
    isBinding: false,
  },
  {
    id: "orders-payments",
    from: "orders",
    to: "payments",
    label: "Charge request",
    protocol: "gRPC",
    isBinding: false,
  },
  {
    id: "orders-inventory",
    from: "orders",
    to: "inventory",
    label: "Stock check",
    protocol: "gRPC",
    isBinding: false,
  },
  {
    id: "orders-eventbus",
    from: "orders",
    to: "eventbus",
    label: "Order events",
    protocol: "Kafka",
    isBinding: false,
  },
  {
    id: "payments-eventbus",
    from: "payments",
    to: "eventbus",
    label: "Payment events",
    protocol: "Kafka",
    isBinding: false,
  },
  {
    id: "inventory-eventbus",
    from: "inventory",
    to: "eventbus",
    label: "Inventory events",
    protocol: "Kafka",
    isBinding: false,
  },
  // Dependency edges (become bindings)
  {
    id: "users-usersdb",
    from: "users",
    to: "users-db",
    label: "User queries",
    protocol: "TCP",
    isBinding: true,
  },
  {
    id: "orders-ordersdb",
    from: "orders",
    to: "orders-db",
    label: "Order persistence",
    protocol: "TCP",
    isBinding: true,
  },
  {
    id: "catalog-productsdb",
    from: "catalog",
    to: "products-db",
    label: "Product queries",
    protocol: "TCP",
    isBinding: true,
  },
  {
    id: "catalog-cache",
    from: "catalog",
    to: "cache",
    label: "Cache lookup",
    protocol: "TCP",
    isBinding: true,
  },
  {
    id: "inventory-productsdb",
    from: "inventory",
    to: "products-db",
    label: "Stock sync",
    protocol: "TCP",
    isBinding: true,
  },
];

// Which resources bind to which services
const BINDINGS: BindingDef[] = EDGES.filter((e) => e.isBinding).map((e) => ({
  serviceId: e.from,
  resourceId: e.to,
}));

const SERVICE_IDS = NODES.filter(
  (n) => n.kind === "service" || n.kind === "gateway" || n.kind === "queue"
).map((n) => n.id);
const RESOURCE_IDS = NODES.filter(
  (n) => n.kind === "database" || n.kind === "cache"
).map((n) => n.id);

// ─── Style config ────────────────────────────────────────────────────────────

const KIND_COLORS: Record<NodeKind, { hue: number; accent: string }> = {
  gateway: { hue: 200, accent: "oklch(0.78 0.15 200)" },
  service: { hue: 260, accent: "oklch(0.78 0.12 260)" },
  database: { hue: 145, accent: "oklch(0.75 0.14 145)" },
  cache: { hue: 330, accent: "oklch(0.70 0.18 330)" },
  queue: { hue: 55, accent: "oklch(0.75 0.15 55)" },
};

const KIND_ICONS: Record<NodeKind, string> = {
  gateway: "⬡",
  service: "■",
  database: "⛁",
  cache: "◈",
  queue: "≋",
};

function nodeById(id: string) {
  return NODES.find((n) => n.id === id);
}

function getBindingsForService(serviceId: string): BindingDef[] {
  return BINDINGS.filter((b) => b.serviceId === serviceId);
}

// ─── Animation config ────────────────────────────────────────────────────────

const EDGE_FADE = { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const };
const NODE_SLIDE = { duration: 0.55, ease: [0.4, 0, 0.15, 1] as const };
const BADGE_APPEAR = { duration: 0.3, ease: [0, 0, 0.2, 1] as const };

// ─── Main component ─────────────────────────────────────────────────────────

export function BindingsCanvas() {
  const [mode, setMode] = useState<"edges" | "bindings">("edges");
  const [isAnimating, setIsAnimating] = useState(false);
  const isBindings = mode === "bindings";

  const handleToggle = useCallback(async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setMode((m) => (m === "edges" ? "bindings" : "edges"));
    // Let the animations finish
    setTimeout(() => setIsAnimating(false), 700);
  }, [isAnimating]);

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
            Edges vs Bindings — Option B
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isBindings
              ? "Bindings mode — resources shown as badges, only communication edges remain"
              : "All Edges — resource dependencies rendered as identical edge lines"}
            <span className="ml-3 opacity-50">press Space to toggle</span>
          </p>
        </div>
        <button
          className="rounded-lg border border-border bg-secondary px-4 py-2 font-medium text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isAnimating}
          onClick={handleToggle}
          type="button"
        >
          {isBindings ? "Show All Edges" : "Show Bindings"}
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        <div className="relative mx-auto h-full w-full max-w-[940px]">
          {/* Edges layer */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {EDGES.map((edge) => {
              const from = nodeById(edge.from);
              const to = nodeById(edge.to);
              if (!(from && to)) return null;

              const isDepEdge = edge.isBinding;
              const fromColor = KIND_COLORS[from.kind];

              return (
                <motion.g key={edge.id}>
                  <motion.line
                    animate={{
                      opacity: isDepEdge && isBindings ? 0 : 1,
                      strokeWidth: isDepEdge && !isBindings ? 1 : 1.5,
                    }}
                    stroke={
                      isDepEdge
                        ? "oklch(0.32 0.04 270)"
                        : `oklch(0.38 0.08 ${fromColor.hue})`
                    }
                    strokeDasharray={isDepEdge ? "4 3" : undefined}
                    transition={EDGE_FADE}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                  {/* Edge label */}
                  <motion.text
                    animate={{
                      opacity: isDepEdge && isBindings ? 0 : 0.5,
                    }}
                    fill="oklch(0.5 0.02 270)"
                    fontSize={9}
                    fontFamily="IBM Plex Mono, monospace"
                    textAnchor="middle"
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 6}
                    transition={EDGE_FADE}
                  >
                    {edge.label}
                  </motion.text>
                  <motion.text
                    animate={{
                      opacity: isDepEdge && isBindings ? 0 : 0.3,
                    }}
                    fill="oklch(0.45 0.02 270)"
                    fontSize={8}
                    fontFamily="IBM Plex Mono, monospace"
                    textAnchor="middle"
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 + 5}
                    transition={EDGE_FADE}
                  >
                    {edge.protocol}
                  </motion.text>
                </motion.g>
              );
            })}
          </svg>

          {/* Service & queue nodes (always visible) */}
          {NODES.filter((n) => SERVICE_IDS.includes(n.id)).map((node) => {
            const color = KIND_COLORS[node.kind];
            const bindings = getBindingsForService(node.id);
            return (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                key={node.id}
                style={{ left: node.x, top: node.y }}
              >
                <div
                  className="whitespace-nowrap rounded-lg border px-3.5 py-2.5 font-medium text-xs"
                  style={{
                    background: `oklch(0.14 0.02 ${color.hue})`,
                    borderColor: `oklch(0.34 0.08 ${color.hue})`,
                    color: `oklch(0.82 0.06 ${color.hue})`,
                    boxShadow: `0 0 12px oklch(0.4 0.12 ${color.hue} / 0.15)`,
                  }}
                >
                  <span className="mr-1.5 opacity-50">
                    {KIND_ICONS[node.kind]}
                  </span>
                  {node.label}
                </div>

                {/* Binding badges — appear when in bindings mode */}
                <AnimatePresence>
                  {isBindings && bindings.length > 0 && (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 flex gap-1.5"
                      exit={{ opacity: 0, y: -4 }}
                      initial={{ opacity: 0, y: -4 }}
                      style={{ top: "calc(100% + 6px)" }}
                      transition={{
                        ...BADGE_APPEAR,
                        delay: 0.25,
                      }}
                    >
                      {bindings.map((b) => {
                        const res = nodeById(b.resourceId);
                        if (!res) return null;
                        const rc = KIND_COLORS[res.kind];
                        return (
                          <div
                            className="flex items-center gap-1 rounded-md border px-2 py-1"
                            key={b.resourceId}
                            style={{
                              background: `oklch(0.13 0.02 ${rc.hue})`,
                              borderColor: `oklch(0.28 0.06 ${rc.hue})`,
                              fontSize: 9,
                              color: `oklch(0.65 0.1 ${rc.hue})`,
                            }}
                          >
                            <span style={{ fontSize: 10 }}>
                              {KIND_ICONS[res.kind]}
                            </span>
                            <span
                              style={{
                                fontFamily: "IBM Plex Mono, monospace",
                              }}
                            >
                              {res.label}
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Resource nodes — fade/shrink when switching to bindings */}
          {NODES.filter((n) => RESOURCE_IDS.includes(n.id)).map((node) => {
            const color = KIND_COLORS[node.kind];
            return (
              <motion.div
                animate={{
                  opacity: isBindings ? 0 : 1,
                  scale: isBindings ? 0.6 : 1,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                key={node.id}
                style={{ left: node.x, top: node.y }}
                transition={NODE_SLIDE}
              >
                <div
                  className="whitespace-nowrap rounded-lg border px-3 py-2 text-[11px]"
                  style={{
                    background: `oklch(0.13 0.015 ${color.hue})`,
                    borderColor: `oklch(0.28 0.06 ${color.hue})`,
                    color: `oklch(0.65 0.08 ${color.hue})`,
                    boxShadow: `0 1px 6px oklch(0.3 0.08 ${color.hue} / 0.1)`,
                  }}
                >
                  <span className="mr-1.5 opacity-60">
                    {KIND_ICONS[node.kind]}
                  </span>
                  {node.label}
                </div>
              </motion.div>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-6 left-6 space-y-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-px w-4"
                style={{ background: "oklch(0.38 0.08 260)" }}
              />
              <span>Communication edge (api / event)</span>
            </div>
            <motion.div
              animate={{ opacity: isBindings ? 0.3 : 1 }}
              className="flex items-center gap-2"
              transition={{ duration: 0.3 }}
            >
              <span
                className="inline-block h-px w-4"
                style={{
                  background: "oklch(0.32 0.04 270)",
                  borderTop: "1px dashed oklch(0.32 0.04 270)",
                }}
              />
              <span>
                {isBindings ? (
                  <s className="opacity-50">
                    Dependency edge → replaced by binding badges
                  </s>
                ) : (
                  "Dependency edge (service → resource)"
                )}
              </span>
            </motion.div>
            <AnimatePresence>
              {isBindings && (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                  exit={{ opacity: 0, x: -5 }}
                  initial={{ opacity: 0, x: -5 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <span
                    className="inline-flex items-center rounded border px-1 py-0.5"
                    style={{
                      background: "oklch(0.13 0.02 145)",
                      borderColor: "oklch(0.28 0.06 145)",
                      fontSize: 8,
                      color: "oklch(0.65 0.1 145)",
                    }}
                  >
                    ⛁ DB
                  </span>
                  <span>Binding badge (structural dependency)</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Edge count indicator */}
          <motion.div
            className="absolute top-6 right-6 text-right text-[10px] text-muted-foreground"
            layout
          >
            <AnimatePresence mode="wait">
              {isBindings ? (
                <motion.div
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="bindings-count"
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <span className="font-mono text-foreground/70">8</span>{" "}
                    communication edges
                  </div>
                  <div className="mt-0.5">
                    <span className="font-mono text-foreground/70">5</span>{" "}
                    bindings (on nodes)
                  </div>
                  <div className="mt-1 text-[9px] text-emerald-400/70">
                    38% fewer visual connections
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="edges-count"
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <span className="font-mono text-foreground/70">13</span>{" "}
                    total edges
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground/50">
                    all visually identical
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
