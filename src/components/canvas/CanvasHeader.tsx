import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ScanSearch, PencilRuler, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayerStore } from "@/stores/layer-store";
import type { LayerId } from "@/data/types";

interface LayerConfig {
  id: LayerId;
  label: string;
  persona: string;
  icon: React.ElementType;
  accentClass: string;
  colorClass: string;
  glowColor: string;
  description: string;
  key: string;
}

const layers: LayerConfig[] = [
  {
    id: "tracing",
    label: "Tracing",
    persona: "SWE",
    icon: ScanSearch,
    accentClass: "text-layer-tracing",
    colorClass: "bg-layer-tracing",
    glowColor: "oklch(0.78 0.15 200 / 0.12)",
    description: "Debug flows & errors",
    key: "1",
  },
  {
    id: "building",
    label: "Building",
    persona: "PO / PM",
    icon: PencilRuler,
    accentClass: "text-layer-building",
    colorClass: "bg-layer-building",
    glowColor: "oklch(0.80 0.16 80 / 0.12)",
    description: "Design & backlog",
    key: "2",
  },
  {
    id: "platform",
    label: "Platform",
    persona: "DevOps",
    icon: Gauge,
    accentClass: "text-layer-platform",
    colorClass: "bg-layer-platform",
    glowColor: "oklch(0.77 0.15 165 / 0.12)",
    description: "Infra & health",
    key: "3",
  },
];

export function CanvasHeader() {
  const activeLayer = useLayerStore((s) => s.activeLayer);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeConfig = layers.find((l) => l.id === activeLayer)!;
  const ActiveIcon = activeConfig.icon;

  function enter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function leave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 250);
  }

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return (
    <div
      ref={containerRef}
      className="absolute top-4 left-4 z-50"
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      {/* Pill trigger */}
      <button
        className="flex items-center gap-2.5 pl-3.5 pr-3 py-2 rounded-full border border-border/30 bg-card/70 backdrop-blur-xl shadow-lg shadow-black/20 cursor-default select-none transition-colors hover:border-border/50"
        onClick={() => setOpen((v) => !v)}
      >
        <h1 className="font-serif text-[15px] text-foreground/60 italic tracking-wide leading-none">
          Meridian
        </h1>
        <div className="w-px h-4 bg-border/40" />
        <div className="flex items-center gap-1.5">
          <ActiveIcon className={cn("w-3.5 h-3.5", activeConfig.accentClass)} />
          <AnimatePresence mode="wait">
            <motion.span
              key={activeLayer}
              className={cn("text-[11px] font-mono font-medium tracking-wider uppercase", activeConfig.accentClass)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {activeConfig.label}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1 ml-0.5">
          {layers.map((l) => (
            <kbd
              key={l.key}
              className={cn(
                "text-[9px] font-mono leading-none rounded px-1 py-0.5 border transition-colors duration-200",
                activeLayer === l.id
                  ? `${l.accentClass} bg-white/[0.06] border-white/10`
                  : "text-muted-foreground/30 bg-transparent border-border/15",
              )}
            >
              {l.key}
            </kbd>
          ))}
        </div>
      </button>

      {/* Dropdown layer picker */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="mt-2 w-[240px] rounded-xl border border-border/40 bg-card/80 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/40"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
          >
            {layers.map((layer) => {
              const Icon = layer.icon;
              const isActive = activeLayer === layer.id;

              return (
                <button
                  key={layer.id}
                  onClick={() => {
                    setActiveLayer(layer.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-white/[0.05]"
                      : "hover:bg-white/[0.03]",
                  )}
                >
                  {/* Active accent line */}
                  {isActive && (
                    <motion.div
                      className={cn("absolute left-0 top-2 bottom-2 w-[2px] rounded-full", layer.colorClass)}
                      layoutId="layer-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}

                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md shrink-0 transition-colors duration-200",
                    isActive ? "bg-white/[0.08]" : "bg-white/[0.03]",
                  )}>
                    <Icon className={cn(
                      "w-4 h-4 transition-colors duration-200",
                      isActive ? layer.accentClass : "text-muted-foreground",
                    )} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[12px] font-semibold transition-colors duration-200",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}>
                        {layer.label}
                      </span>
                      <span className={cn(
                        "text-[9px] font-mono px-1.5 rounded-sm transition-colors duration-200",
                        isActive ? `${layer.accentClass} bg-white/[0.06]` : "text-muted-foreground/50",
                      )}>
                        {layer.persona}
                      </span>
                    </div>
                    <p className={cn(
                      "text-[10px] transition-colors duration-200",
                      isActive ? "text-muted-foreground" : "text-muted-foreground/40",
                    )}>
                      {layer.description}
                    </p>
                  </div>

                  <kbd className={cn(
                    "text-[9px] font-mono leading-none rounded px-1.5 py-0.5 border shrink-0 transition-colors duration-200",
                    isActive ? `${layer.accentClass} border-white/10` : "text-muted-foreground/30 border-border/15",
                  )}>
                    {layer.key}
                  </kbd>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
