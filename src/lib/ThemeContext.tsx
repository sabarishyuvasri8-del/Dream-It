/**
 * ThemeContext — Global theme state management for Dream It
 * 
 * Provides a React Context for managing 5 minimalist themes with:
 * - Instant localStorage persistence for seamless page loads
 * - Background Supabase sync to user_metadata for cross-device consistency
 * - Derived `isDark` flag for conditional rendering
 * - Theme transition class management for smooth palette morphing
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { supabase } from "./supabase";

/* ─────────────── Theme Definitions ─────────────── */

/** All available theme IDs */
export type ThemeId =
  | "ethereal-light"
  | "midnight-void"
  | "sage-harmony"
  | "rose-quartz"
  | "arctic-dusk";

/** Full metadata for a theme palette */
export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  /** CSS class applied to the root element */
  cssClass: string;
  /** Preview swatch colors for the theme selector UI */
  swatches: [string, string, string, string];
  /** Emoji icon for the theme */
  icon: string;
}

/** Registry of all 5 themes */
export const THEMES: ThemeConfig[] = [
  {
    id: "ethereal-light",
    name: "Ethereal Light",
    description: "Soft whites, muted grays, icy blue",
    isDark: false,
    cssClass: "theme-ethereal-light",
    swatches: ["#f4f6f9", "#3b6b8a", "#a8c8e0", "#ffffff"],
    icon: "☁️",
  },
  {
    id: "midnight-void",
    name: "Midnight Void",
    description: "Deep charcoal, soft blacks, violet glow",
    isDark: true,
    cssClass: "theme-midnight-void",
    swatches: ["#0a0c10", "#a78bfa", "#c4b5fd", "#12141a"],
    icon: "🌑",
  },
  {
    id: "sage-harmony",
    name: "Sage Harmony",
    description: "Soft greens, earthy off-whites",
    isDark: false,
    cssClass: "theme-sage-harmony",
    swatches: ["#f6f4ee", "#244c3b", "#f2cf91", "#fffefb"],
    icon: "🌿",
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    description: "Blush pinks, warm grays, dusty mauve",
    isDark: false,
    cssClass: "theme-rose-quartz",
    swatches: ["#faf5f5", "#8b5a6b", "#d4a0b0", "#fffbfb"],
    icon: "🌸",
  },
  {
    id: "arctic-dusk",
    name: "Arctic Dusk",
    description: "Deep navy, frost blue, pale lavender",
    isDark: true,
    cssClass: "theme-arctic-dusk",
    swatches: ["#0c1020", "#60a5fa", "#93c5fd", "#141830"],
    icon: "🌌",
  },
];

/** Quick lookup map */
export const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

/** Default theme */
const DEFAULT_THEME: ThemeId = "sage-harmony";

/* ─────────────── Context Shape ─────────────── */

interface ThemeContextValue {
  /** Current active theme ID */
  theme: ThemeId;
  /** Switch to a new theme */
  setTheme: (id: ThemeId) => void;
  /** Full config object for the current theme */
  themeConfig: ThemeConfig;
  /** Whether current theme is dark */
  isDark: boolean;
  /** List of all available themes */
  themes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ─────────────── Local Storage Helpers ─────────────── */

const STORAGE_KEY = "dreamit_theme_id";
const LEGACY_STORAGE_KEY = "dreamit_theme";

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;

  // Try new key first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEME_MAP.has(stored as ThemeId)) {
    return stored as ThemeId;
  }

  // Migrate legacy dark/light toggle value
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === "dark") return "midnight-void";
  if (legacy === "light") return "sage-harmony";

  return DEFAULT_THEME;
}

function writeStoredTheme(id: ThemeId): void {
  localStorage.setItem(STORAGE_KEY, id);
  // Also write legacy key for backward compat
  const config = THEME_MAP.get(id);
  localStorage.setItem(LEGACY_STORAGE_KEY, config?.isDark ? "dark" : "light");
}

/* ─────────────── Provider Component ─────────────── */

interface ThemeProviderProps {
  children: ReactNode;
  /** Supabase access token for persisting theme to cloud (optional) */
  accessToken?: string;
}

export function ThemeProvider({ children, accessToken }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const themeConfig = useMemo(
    () => THEME_MAP.get(theme) ?? THEMES[2], // fallback to sage-harmony
    [theme]
  );

  /** Apply the theme CSS class to <main> and persist */
  const setTheme = useCallback(
    (id: ThemeId) => {
      if (!THEME_MAP.has(id) || id === theme) return;

      // Enable smooth transition class
      setIsTransitioning(true);
      setThemeState(id);
      writeStoredTheme(id);

      // Remove transition class after animation completes to avoid
      // affecting future micro-interactions
      setTimeout(() => setIsTransitioning(false), 600);

      // Background sync to Supabase user_metadata
      if (accessToken) {
        supabase.auth
          .updateUser({ data: { theme_preference: id } })
          .catch((err) => console.warn("Theme sync to Supabase failed:", err));
      }
    },
    [theme, accessToken]
  );

  // On mount: Try to read theme from Supabase user_metadata
  useEffect(() => {
    if (!accessToken) return;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        const cloudTheme = data.user?.user_metadata?.theme_preference;
        if (cloudTheme && THEME_MAP.has(cloudTheme as ThemeId)) {
          const cloudId = cloudTheme as ThemeId;
          // Cloud theme takes precedence if different from local
          if (cloudId !== theme) {
            setThemeState(cloudId);
            writeStoredTheme(cloudId);
          }
        }
      })
      .catch(() => {
        /* Silently ignore — localStorage is the fallback */
      });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Manage the CSS class on the root <html> element for global effects
  useEffect(() => {
    const html = document.documentElement;
    // Remove all theme classes
    THEMES.forEach((t) => html.classList.remove(t.cssClass));
    // Add current theme class
    html.classList.add(themeConfig.cssClass);

    // Transition class
    if (isTransitioning) {
      html.classList.add("theme-transition");
    } else {
      html.classList.remove("theme-transition");
    }

    return () => {
      html.classList.remove("theme-transition");
    };
  }, [themeConfig, isTransitioning]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      themeConfig,
      isDark: themeConfig.isDark,
      themes: THEMES,
    }),
    [theme, setTheme, themeConfig]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/* ─────────────── Hook ─────────────── */

/**
 * Access the current theme and switch function.
 * Must be used within a `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be used within a <ThemeProvider>");
  }
  return ctx;
}
