import React, { useEffect, useRef } from "react";
import { X, Snowflake, RotateCcw, Wind, Eye, Sparkles, Sliders, Check } from "lucide-react";

export interface SnowSettings {
  enabled: boolean;
  flake: "mixed" | "classic" | "dendrite" | "plate" | "soft" | "emoji";
  emojiFlakes: string[];
  count: number;
  speed: number;
  wind: number;
  minSize: number;
  maxSize: number;
  colorPreset: string;
  colors: string[];
  minOpacity: number;
  maxOpacity: number;
  spin: number;
  sway: number;
  depth: number;
}

export const DEFAULT_SNOW_SETTINGS: SnowSettings = {
  enabled: true,
  flake: "mixed",
  emojiFlakes: ["❄️", "✨", "🌟"],
  count: 85,
  speed: 0.7,
  wind: 0.15,
  minSize: 3,
  maxSize: 14,
  colorPreset: "classic",
  colors: ["#ffffff", "#eaf4ff"],
  minOpacity: 0.25,
  maxOpacity: 0.85,
  spin: 1,
  sway: 1,
  depth: 1,
};

export const COLOR_PRESETS: Record<string, { name: string; colors: string[]; preview: string }> = {
  classic: { name: "Pure Snow", colors: ["#ffffff", "#eaf4ff"], preview: "linear-gradient(135deg, #ffffff, #eaf4ff)" },
  icy: { name: "Icy Blue", colors: ["#ffffff", "#bae6fd", "#7dd3fc"], preview: "linear-gradient(135deg, #bae6fd, #38bdf8)" },
  cosmic: { name: "Cosmic Violet", colors: ["#ffffff", "#e9d5ff", "#c084fc"], preview: "linear-gradient(135deg, #e9d5ff, #a855f7)" },
  gold: { name: "Golden Star", colors: ["#ffffff", "#fef08a", "#facc15"], preview: "linear-gradient(135deg, #fef08a, #eab308)" },
  rose: { name: "Rose Quartz", colors: ["#ffffff", "#fbcfe8", "#f472b6"], preview: "linear-gradient(135deg, #fbcfe8, #ec4899)" },
  aurora: { name: "Aurora Mint", colors: ["#ffffff", "#a7f3d0", "#34d399"], preview: "linear-gradient(135deg, #a7f3d0, #10b981)" },
};

export const PRESETS: Record<string, { label: string; desc: string; icon: string; settings: Partial<SnowSettings> }> = {
  default: {
    label: "Dreamy Winter",
    desc: "Balanced cinematic drift",
    icon: "❄️",
    settings: {
      flake: "mixed",
      count: 85,
      speed: 0.7,
      wind: 0.15,
      minSize: 3,
      maxSize: 14,
      minOpacity: 0.25,
      maxOpacity: 0.85,
      spin: 1,
      sway: 1,
      depth: 1,
      colorPreset: "classic",
      colors: COLOR_PRESETS.classic.colors,
    },
  },
  gentle: {
    label: "Gentle Flurry",
    desc: "Light, peaceful, slow drift",
    icon: "🌬️",
    settings: {
      flake: "soft",
      count: 45,
      speed: 0.4,
      wind: 0.05,
      minSize: 2,
      maxSize: 10,
      minOpacity: 0.2,
      maxOpacity: 0.7,
      spin: 0.5,
      sway: 0.6,
      depth: 1,
      colorPreset: "classic",
      colors: COLOR_PRESETS.classic.colors,
    },
  },
  blizzard: {
    label: "Blizzard",
    desc: "Dense, fast, wind-blown storm",
    icon: "🌨️",
    settings: {
      flake: "mixed",
      count: 220,
      speed: 1.8,
      wind: 1.5,
      minSize: 4,
      maxSize: 20,
      minOpacity: 0.4,
      maxOpacity: 0.95,
      spin: 2,
      sway: 1.8,
      depth: 1,
      colorPreset: "icy",
      colors: COLOR_PRESETS.icy.colors,
    },
  },
  magical: {
    label: "Golden Stardust",
    desc: "Glittering golden bokeh",
    icon: "✨",
    settings: {
      flake: "dendrite",
      count: 95,
      speed: 0.6,
      wind: 0.2,
      minSize: 4,
      maxSize: 18,
      minOpacity: 0.35,
      maxOpacity: 0.9,
      spin: 1.2,
      sway: 1.3,
      depth: 1,
      colorPreset: "gold",
      colors: COLOR_PRESETS.gold.colors,
    },
  },
  emoji: {
    label: "Emoji Festive",
    desc: "Falling sparkles & snow emojis",
    icon: "🌟",
    settings: {
      flake: "emoji",
      emojiFlakes: ["❄️", "✨", "🌟"],
      count: 60,
      speed: 0.7,
      wind: 0.1,
      minSize: 14,
      maxSize: 26,
      minOpacity: 0.6,
      maxOpacity: 1,
      spin: 1,
      sway: 1.2,
      depth: 0.4,
      colorPreset: "classic",
      colors: ["#ffffff"],
    },
  },
};

interface SnowSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SnowSettings;
  onChange: (updated: SnowSettings) => void;
  onReset: () => void;
}

export default function SnowSettingsModal({
  isOpen,
  onClose,
  settings,
  onChange,
  onReset,
}: SnowSettingsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = (patch: Partial<SnowSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const applyPreset = (presetKey: string) => {
    const p = PRESETS[presetKey];
    if (p) {
      onChange({ ...settings, ...p.settings, enabled: true });
    }
  };

  const applyColor = (key: string) => {
    const cp = COLOR_PRESETS[key];
    if (cp) {
      update({ colorPreset: key, colors: cp.colors });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Snow Falling Settings"
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          color: "var(--m-text)",
          border: "1px solid var(--m-border)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: "var(--m-border-light)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Snowflake size={22} className="animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--m-text-heading)" }}>
                Snowfall Studio
              </h2>
              <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
                Customize realistic falling snow physics & visuals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Master Toggle */}
            <label
              className="flex items-center gap-2 cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                backgroundColor: settings.enabled
                  ? "color-mix(in srgb, var(--m-primary) 18%, transparent)"
                  : "var(--m-surface-alt)",
                color: settings.enabled ? "var(--m-primary)" : "var(--m-text-sub)",
                border: "1px solid var(--m-border-light)",
              }}
            >
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
                className="sr-only"
              />
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: settings.enabled ? "var(--m-primary)" : "var(--m-text-sub)",
                  boxShadow: settings.enabled ? "0 0 8px var(--m-primary)" : "none",
                }}
              />
              {settings.enabled ? "Snowing" : "Paused"}
            </label>

            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              style={{ color: "var(--m-text-sub)" }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-sub)" }}>
                Instant Presets
              </span>
              <button
                onClick={onReset}
                className="text-xs flex items-center gap-1 hover:underline cursor-pointer"
                style={{ color: "var(--m-primary)" }}
              >
                <RotateCcw size={12} />
                Reset Defaults
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className="p-2.5 rounded-2xl text-left border transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-between"
                  style={{
                    backgroundColor: "var(--m-surface-alt)",
                    borderColor: "var(--m-border-light)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{p.icon}</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
                      {p.label}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: "var(--m-text-sub)" }}>
                      {p.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Flake Artwork */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block mb-2.5" style={{ color: "var(--m-text-sub)" }}>
              Flake Crystal Style
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { id: "mixed", label: "Mixed", icon: "❄️" },
                { id: "classic", label: "Classic", icon: "✳️" },
                { id: "dendrite", label: "Branch", icon: "🌲" },
                { id: "plate", label: "Crystal", icon: "💠" },
                { id: "soft", label: "Bokeh", icon: "⚪" },
                { id: "emoji", label: "Emoji", icon: "✨" },
              ].map((style) => {
                const isSelected = settings.flake === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => update({ flake: style.id as any })}
                    className="p-2.5 rounded-2xl flex flex-col items-center gap-1 border transition-all cursor-pointer text-center"
                    style={{
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--m-primary) 15%, transparent)"
                        : "var(--m-surface-alt)",
                      borderColor: isSelected ? "var(--m-primary)" : "var(--m-border-light)",
                      color: isSelected ? "var(--m-primary)" : "var(--m-text)",
                    }}
                  >
                    <span className="text-lg">{style.icon}</span>
                    <span className="text-xs font-semibold">{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Palettes */}
          {settings.flake !== "emoji" && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block mb-2.5" style={{ color: "var(--m-text-sub)" }}>
                Color Mood
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(COLOR_PRESETS).map(([key, cp]) => {
                  const isSelected = settings.colorPreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => applyColor(key)}
                      className="px-3 py-2 rounded-xl flex items-center justify-between border transition-all cursor-pointer"
                      style={{
                        backgroundColor: isSelected
                          ? "color-mix(in srgb, var(--m-primary) 15%, transparent)"
                          : "var(--m-surface-alt)",
                        borderColor: isSelected ? "var(--m-primary)" : "var(--m-border-light)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border border-black/20 shadow-sm shrink-0"
                          style={{ background: cp.preview }}
                        />
                        <span className="text-xs font-semibold" style={{ color: "var(--m-text-heading)" }}>
                          {cp.name}
                        </span>
                      </div>
                      {isSelected && <Check size={14} style={{ color: "var(--m-primary)" }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Density & Dynamics Sliders */}
          <div className="space-y-4 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: "var(--m-text-sub)" }}>
              Physics & Dynamics
            </span>

            {/* Flake Count */}
            <div className="p-3.5 rounded-2xl border space-y-2" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                  <Snowflake size={14} style={{ color: "var(--m-primary)" }} /> Flake Density
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[11px]" style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-primary)" }}>
                  {settings.count} flakes
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={300}
                step={5}
                value={settings.count}
                onChange={(e) => update({ count: Number(e.target.value) })}
                className="w-full accent-[var(--m-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                <span>Subtle (15)</span>
                <span>Balanced (85)</span>
                <span>Heavy (300)</span>
              </div>
            </div>

            {/* Speed & Wind Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Fall Speed */}
              <div className="p-3.5 rounded-2xl border space-y-2" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                    <Sparkles size={14} style={{ color: "var(--m-primary)" }} /> Fall Speed
                  </span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[11px]" style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-primary)" }}>
                    {settings.speed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  value={settings.speed}
                  onChange={(e) => update({ speed: Number(e.target.value) })}
                  className="w-full accent-[var(--m-primary)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                  <span>Slow (0.2x)</span>
                  <span>Fast (2.5x)</span>
                </div>
              </div>

              {/* Horizontal Wind */}
              <div className="p-3.5 rounded-2xl border space-y-2" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                    <Wind size={14} style={{ color: "var(--m-primary)" }} /> Wind Drift
                  </span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[11px]" style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-primary)" }}>
                    {settings.wind < 0 ? `← ${Math.abs(settings.wind).toFixed(1)}` : settings.wind > 0 ? `${settings.wind.toFixed(1)} →` : "Calm"}
                  </span>
                </div>
                <input
                  type="range"
                  min={-2.0}
                  max={2.0}
                  step={0.1}
                  value={settings.wind}
                  onChange={(e) => update({ wind: Number(e.target.value) })}
                  className="w-full accent-[var(--m-primary)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                  <span>Left (←)</span>
                  <span>Calm</span>
                  <span>Right (→)</span>
                </div>
              </div>
            </div>

            {/* Depth & Sway */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cinematic Depth (Bokeh) */}
              <div className="p-3.5 rounded-2xl border space-y-2" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                    <Eye size={14} style={{ color: "var(--m-primary)" }} /> Cinematic 3D Depth
                  </span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[11px]" style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-primary)" }}>
                    {Math.round(settings.depth * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.depth}
                  onChange={(e) => update({ depth: Number(e.target.value) })}
                  className="w-full accent-[var(--m-primary)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                  <span>Flat 2D</span>
                  <span>Full Bokeh 3D</span>
                </div>
              </div>

              {/* Side-to-Side Sway */}
              <div className="p-3.5 rounded-2xl border space-y-2" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                    <Sliders size={14} style={{ color: "var(--m-primary)" }} /> Flutter & Sway
                  </span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[11px]" style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-primary)" }}>
                    {settings.sway.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.1}
                  value={settings.sway}
                  onChange={(e) => update({ sway: Number(e.target.value) })}
                  className="w-full accent-[var(--m-primary)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                  <span>Straight</span>
                  <span>Swirling Flutter</span>
                </div>
              </div>
            </div>

            {/* Size Range */}
            <div className="p-3.5 rounded-2xl border space-y-2" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                  <Snowflake size={14} style={{ color: "var(--m-primary)" }} /> Flake Size Bounds
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[11px]" style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-primary)" }}>
                  {settings.minSize}px – {settings.maxSize}px
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] block mb-1" style={{ color: "var(--m-text-sub)" }}>Min Size ({settings.minSize}px)</span>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={settings.minSize}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      update({ minSize: v, maxSize: Math.max(v + 2, settings.maxSize) });
                    }}
                    className="w-full accent-[var(--m-primary)] cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-[10px] block mb-1" style={{ color: "var(--m-text-sub)" }}>Max Size ({settings.maxSize}px)</span>
                  <input
                    type="range"
                    min={8}
                    max={36}
                    step={1}
                    value={settings.maxSize}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      update({ maxSize: v, minSize: Math.min(v - 2, settings.minSize) });
                    }}
                    className="w-full accent-[var(--m-primary)] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between shrink-0"
          style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}
        >
          <span className="text-xs" style={{ color: "var(--m-text-sub)" }}>
            Changes apply instantly & persist in browser
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-sm"
            style={{
              backgroundColor: "var(--m-primary)",
              color: "var(--m-primary-text)",
            }}
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
