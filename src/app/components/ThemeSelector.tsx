/**
 * ThemeSelector — A premium theme picker with Liquid Glass & Anti-Gravity effects
 * 
 * Displays a modal overlay with 5 theme cards. Each card:
 * - Uses the `liquid-glass` glassmorphism effect
 * - Has the `anti-gravity` bobbing animation
 * - Shows live color swatches + active state glow ring
 * - Transitions smoothly on hover (float-up, enhanced shadow)
 */

import { useEffect, useRef, useCallback } from "react";
import { Check, Palette, X } from "lucide-react";
import { useTheme, THEMES, type ThemeId } from "../../lib/ThemeContext";

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeSelector({ isOpen, onClose }: ThemeSelectorProps) {
  const { theme, setTheme, isDark } = useTheme();
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

  // Close when clicking outside the panel
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSelectTheme = useCallback(
    (id: ThemeId) => {
      setTheme(id);
    },
    [setTheme]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--m-modal-overlay)" }}
      onClick={handleOverlayClick}
    >
      {/* ─── Main Panel ─── */}
      <div
        ref={panelRef}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl liquid-glass-float"
      >
        {/* ─── Header ─── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--m-border-light)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid size-9 place-items-center rounded-xl"
              style={{
                background: "var(--m-primary)",
                color: "var(--m-primary-text)",
              }}
            >
              <Palette size={16} />
            </div>
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--m-text-heading)" }}
              >
                Theme
              </h2>
              <p
                className="text-xs"
                style={{ color: "var(--m-text-muted)" }}
              >
                Pick a palette
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg transition hover:opacity-80 minimal-inset"
            style={{ color: "var(--m-text-muted)" }}
            aria-label="Close theme selector"
          >
            <X size={15} />
          </button>
        </div>

        {/* ─── Theme Cards Grid ─── */}
        <div className="p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((t, index) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`liquid-glass anti-gravity interactive group relative flex flex-col items-start rounded-xl p-4 text-left transition-all duration-300 ${
                    isActive ? "ring-2" : ""
                  }`}
                  style={{
                    /* Override liquid-glass backgrounds with theme-preview swatches */
                    background: isActive
                      ? `linear-gradient(135deg, ${t.swatches[0]}15, ${t.swatches[1]}12)`
                      : "var(--liquid-glass-bg)",
                    borderColor: isActive
                      ? t.swatches[1]
                      : "var(--liquid-glass-border)",
                    ringColor: isActive ? t.swatches[1] : undefined,
                    "--ring-color": isActive ? t.swatches[1] : "transparent",
                    animationDelay: `${-index * 1.2}s`,
                  } as React.CSSProperties}
                >
                  {/* Active checkmark badge */}
                  {isActive && (
                    <div
                      className="absolute -right-1.5 -top-1.5 grid size-7 place-items-center rounded-full shadow-lg"
                      style={{
                        background: t.swatches[1],
                        color: t.isDark ? "#0a0c10" : "#ffffff",
                      }}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}

                  {/* Theme emoji icon */}
                  <span className="text-2xl">{t.icon}</span>

                  {/* Theme name */}
                  <h3
                    className="mt-3 text-sm font-bold"
                    style={{ color: "var(--m-text-heading)" }}
                  >
                    {t.name}
                  </h3>

                  {/* Theme description */}
                  <p
                    className="mt-1 text-[11px] leading-relaxed"
                    style={{ color: "var(--m-text-muted)" }}
                  >
                    {t.description}
                  </p>

                  {/* Color swatch preview */}
                  <div className="mt-4 flex gap-1.5">
                    {t.swatches.map((color, i) => (
                      <div
                        key={i}
                        className="size-5 rounded-full shadow-sm transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: color,
                          border: `1.5px solid ${
                            t.isDark
                              ? "rgba(255,255,255,0.15)"
                              : "rgba(0,0,0,0.08)"
                          }`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Dark/Light indicator tag */}
                  <div
                    className="mt-3 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      background: t.isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.05)",
                      color: t.isDark
                        ? "rgba(255,255,255,0.5)"
                        : "rgba(0,0,0,0.4)",
                    }}
                  >
                    {t.isDark ? "Dark" : "Light"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ─── Footer hint ─── */}
          <p
            className="mt-4 text-center text-[10px]"
            style={{ color: "var(--m-text-faint)" }}
          >
            Saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}
