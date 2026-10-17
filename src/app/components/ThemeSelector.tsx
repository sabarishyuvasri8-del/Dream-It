/**
 * ThemeSelector — A premium theme picker with sector categorization
 * 
 * Includes:
 * 1. Dedicated Common User Sector: Strictly Black & White (Monochrome Light & Dark)
 * 2. Mood Palettes Sector: Curated multi-color palettes
 * - Smooth tabbed transitions
 * - Instant live preview and persistence
 * - Mobile pull handle and desktop modal styling
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { Check, Palette, X, Contrast } from "lucide-react";
import { useTheme, THEMES, type ThemeId, type ThemeSector } from "../../lib/ThemeContext";

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeSelector({ isOpen, onClose }: ThemeSelectorProps) {
  const { theme, setTheme, themeConfig } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  // Sector tab state (defaults to the sector of the current theme, or "common")
  const [activeSector, setActiveSector] = useState<ThemeSector>(() => {
    return themeConfig?.sector ?? "common";
  });

  // Sync active sector when modal opens or theme changes
  useEffect(() => {
    if (isOpen && themeConfig?.sector) {
      setActiveSector(themeConfig.sector);
    }
  }, [isOpen, themeConfig?.sector]);

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

  const commonThemes = THEMES.filter((t) => t.sector === "common");
  const paletteThemes = THEMES.filter((t) => t.sector === "palettes");
  const visibleThemes = activeSector === "common" ? commonThemes : paletteThemes;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200"
      style={{ backgroundColor: "var(--m-modal-overlay)" }}
      onClick={handleOverlayClick}
    >
      {/* ─── Main Panel ─── */}
      <div
        ref={panelRef}
        className="relative w-full sm:max-w-2xl flex flex-col rounded-t-[1.75rem] sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 overflow-hidden"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          color: "var(--m-text)",
          maxHeight: "92dvh",
        }}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-10 h-1 rounded-full mx-auto mt-2 mb-0 sm:hidden shrink-0" style={{ backgroundColor: "var(--m-border)" }} />

        {/* ─── Header ─── */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--m-border-light)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid size-9 sm:size-10 place-items-center rounded-xl shadow-xs transition-colors"
              style={{
                background: activeSector === "common" ? "var(--m-text-heading)" : "var(--m-primary)",
                color: activeSector === "common" ? "var(--m-bg)" : "var(--m-primary-text)",
              }}
            >
              {activeSector === "common" ? <Contrast size={18} /> : <Palette size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-base font-bold"
                  style={{ color: "var(--m-text-heading)" }}
                >
                  Choose Theme
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase"
                  style={{
                    backgroundColor: "var(--m-surface-alt)",
                    border: "1px solid var(--m-border-light)",
                    color: "var(--m-text-muted)",
                  }}
                >
                  {activeSector === "common" ? "Default" : "Cool Themes"}
                </span>
              </div>
              <p
                className="text-[11px]"
                style={{ color: "var(--m-text-muted)" }}
              >
                {activeSector === "common"
                  ? "Standard everyday black & white themes with clean readability"
                  : "Vibrant curated color themes that suit your mood"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-10 place-items-center rounded-xl transition hover:opacity-80 min-h-[44px] min-w-[44px]"
            style={{
              color: "var(--m-text-muted)",
              backgroundColor: "var(--m-surface-alt)",
              border: "1px solid var(--m-border-light)",
            }}
            aria-label="Close theme selector"
          >
            <X size={16} />
          </button>
        </div>

        {/* ─── Sector Switcher Tabs ─── */}
        <div
          className="px-4 sm:px-6 pt-3 pb-2 shrink-0"
          style={{ backgroundColor: "var(--m-surface-solid)" }}
        >
          <div
            className="flex p-1 rounded-2xl gap-1.5"
            style={{
              backgroundColor: "var(--m-surface-alt)",
              border: "1px solid var(--m-border-light)",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveSector("common")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeSector === "common"
                  ? "shadow-sm scale-[1.01]"
                  : "hover:opacity-75"
              }`}
              style={{
                backgroundColor:
                  activeSector === "common" ? "var(--m-surface-solid)" : "transparent",
                color:
                  activeSector === "common"
                    ? "var(--m-text-heading)"
                    : "var(--m-text-muted)",
                border: activeSector === "common" ? "1px solid var(--m-border)" : "1px solid transparent",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Contrast size={14} className={activeSector === "common" ? "opacity-100" : "opacity-60"} />
                <span>Default Theme</span>
              </div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor:
                    activeSector === "common"
                      ? "var(--m-text-heading)"
                      : "rgba(0,0,0,0.06)",
                  color:
                    activeSector === "common"
                      ? "var(--m-bg)"
                      : "inherit",
                }}
              >
                2 Themes
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSector("palettes")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeSector === "palettes"
                  ? "shadow-sm scale-[1.01]"
                  : "hover:opacity-75"
              }`}
              style={{
                backgroundColor:
                  activeSector === "palettes" ? "var(--m-surface-solid)" : "transparent",
                color:
                  activeSector === "palettes"
                    ? "var(--m-text-heading)"
                    : "var(--m-text-muted)",
                border: activeSector === "palettes" ? "1px solid var(--m-border)" : "1px solid transparent",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Palette size={14} className={activeSector === "palettes" ? "opacity-100" : "opacity-60"} />
                <span>Cool Themes</span>
              </div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor:
                    activeSector === "palettes"
                      ? "var(--m-primary)"
                      : "rgba(0,0,0,0.06)",
                  color:
                    activeSector === "palettes"
                      ? "var(--m-primary-text)"
                      : "inherit",
                }}
              >
                5 Themes
              </span>
            </button>
          </div>
        </div>


        {/* ─── Theme Cards List (Scrollable, mobile-first) ─── */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-3.5 sm:px-5 py-3 sm:py-4"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          <div
            className={`space-y-2.5 sm:space-y-0 sm:grid ${
              activeSector === "common"
                ? "sm:grid-cols-2 sm:gap-4 max-w-xl mx-auto"
                : "sm:grid-cols-2 lg:grid-cols-3 sm:gap-3"
            }`}
          >
            {visibleThemes.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`group relative w-full flex items-center sm:flex-col sm:items-start gap-3.5 sm:gap-0 rounded-2xl p-3.5 sm:p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                    isActive ? "ring-2" : ""
                  }`}
                  style={{
                    backgroundColor: isActive
                      ? "var(--m-surface-hover)"
                      : "var(--m-surface-alt)",
                    border: `1.5px solid ${
                      isActive
                        ? t.sector === "common"
                          ? "var(--m-text-heading)"
                          : t.swatches[1]
                        : "var(--m-border-light)"
                    }`,
                    boxShadow: isActive
                      ? t.sector === "common"
                        ? "0 4px 14px -3px rgba(0,0,0,0.08)"
                        : `0 8px 24px -6px ${t.swatches[1]}40`
                      : "0 2px 8px -2px rgba(0,0,0,0.04)",
                    "--ring-color": isActive
                      ? t.sector === "common"
                        ? "var(--m-text-heading)"
                        : t.swatches[1]
                      : "transparent",
                  } as React.CSSProperties}
                >
                  {/* Active checkmark badge */}
                  {isActive && (
                    <div
                      className="absolute right-2.5 top-2.5 sm:-right-1.5 sm:-top-1.5 grid size-6 sm:size-7 place-items-center rounded-full shadow-md transition-transform duration-200 scale-100"
                      style={{
                        background:
                          t.sector === "common"
                            ? "var(--m-text-heading)"
                            : t.swatches[1],
                        color:
                          t.sector === "common"
                            ? "var(--m-bg)"
                            : t.isDark
                            ? "#0a0c10"
                            : "#ffffff",
                      }}
                    >
                      <Check size={13} strokeWidth={3} />
                    </div>
                  )}

                  {/* Left side: emoji/icon + swatches (mobile) / top emoji (desktop) */}
                  <div className="flex flex-col items-center gap-2 sm:items-start">
                    <span className="text-2xl">{t.icon}</span>
                    {/* Swatches visible on mobile in left column */}
                    <div className="flex gap-1 sm:hidden">
                      {t.swatches.slice(0, 4).map((color, i) => (
                        <div
                          key={i}
                          className="size-4 rounded-full shadow-xs"
                          style={{
                            backgroundColor: color,
                            border: `1px solid ${
                              t.isDark
                                ? "rgba(255,255,255,0.2)"
                                : "rgba(0,0,0,0.08)"
                            }`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Right side: name + description (mobile) / below emoji (desktop) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-sm font-bold truncate"
                        style={{ color: "var(--m-text-heading)" }}
                      >
                        {t.name}
                      </h3>
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 transition-colors"
                        style={{
                          background: t.isDark
                            ? "var(--m-text-heading)"
                            : "var(--m-surface-alt)",
                          color: t.isDark
                            ? "var(--m-bg)"
                            : "var(--m-text-heading)",
                          border: "1px solid var(--m-border-light)",
                        }}
                      >
                        {t.isDark ? "Dark" : "Light"}
                      </span>
                    </div>
                    <p
                      className="mt-0.5 text-[11px] leading-relaxed line-clamp-2"
                      style={{ color: "var(--m-text-muted)" }}
                    >
                      {t.description}
                    </p>
                  </div>

                  {/* Desktop-only swatch row */}
                  <div className="hidden sm:flex mt-3 gap-1.5">
                    {t.swatches.map((color, i) => (
                      <div
                        key={i}
                        className="size-5 rounded-full shadow-xs transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: color,
                          border: `1.5px solid ${
                            t.isDark
                              ? "rgba(255,255,255,0.2)"
                              : "rgba(0,0,0,0.1)"
                          }`,
                        }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div
          className="shrink-0 px-4 sm:px-6 py-3 text-center pb-safe"
          style={{ borderTop: "1px solid var(--m-border-light)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--m-text-faint)" }}>
            Theme saved automatically • Changes apply instantly
          </p>
        </div>
      </div>
    </div>
  );
}
