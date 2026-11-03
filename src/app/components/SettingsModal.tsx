import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Palette,
  Timer,
  Bell,
  Database,
  Check,
  Download,
  FileSpreadsheet,
  LogOut,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Sparkles,
  Flame,
  Clock,
  ToggleLeft,
  ToggleRight,
  Cpu,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useTheme, THEMES, type ThemeId, type ThemeSector } from "../../lib/ThemeContext";
import {
  getNotificationPermission,
  requestNotificationPermission,
  isNotificationsMuted,
  setNotificationsMuted,
  playNotificationChime
} from "../../lib/desktopNotifications";
import { registerPushNotifications, isPushSupported } from "../../lib/pushNotifications";

export type SettingsTab = "profile" | "appearance" | "ai" | "study" | "notifications" | "data";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userNameDisplay: string;
  userEmail?: string;
  userImageUrl?: string;
  streakCount?: number;
  timerPreset?: number;
  onUpdateTimerPreset?: (minutes: number) => void;
  onOpenProfile?: () => void;
  onOpenAccountSwitcher?: () => void;
  onSignOut?: () => void;
  onExportJSON?: () => void;
  onExportCSV?: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  userId,
  userNameDisplay,
  userEmail,
  userImageUrl,
  streakCount = 0,
  timerPreset = 25,
  onUpdateTimerPreset,
  onOpenProfile,
  onOpenAccountSwitcher,
  onSignOut,
  onExportJSON,
  onExportCSV,
}: SettingsModalProps) {
  const { theme, setTheme, themeConfig } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Study & Productivity Preferences (Persisted locally)
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    const saved = localStorage.getItem("dreamit_daily_goal_hours");
    return saved ? parseInt(saved, 10) : 3;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dreamit_sound_enabled") !== "false";
  });

  const [autoStartBreaks, setAutoStartBreaks] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dreamit_auto_breaks") !== "false";
  });

  // Notification State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(getNotificationPermission());
  const [isMuted, setIsMuted] = useState<boolean>(() => isNotificationsMuted());
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  // AI Orchestration Engine Preference (Persisted in localStorage)
  const [aiEngine, setAiEngine] = useState<"auto" | "nvidia" | "gemini" | "nebius">(() => {
    if (typeof window === "undefined") return "auto";
    return (localStorage.getItem("dreamit_ai_engine") as any) || "auto";
  });
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    provider?: string;
    model?: string;
    latencyMs?: number;
    message?: string;
  } | null>(null);

  // Sync notification state
  useEffect(() => {
    if (isOpen) {
      setNotifPermission(getNotificationPermission());
      setIsMuted(isNotificationsMuted());
    }
  }, [isOpen]);

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

  const handleUpdateGoalHours = (hours: number) => {
    setDailyGoalHours(hours);
    localStorage.setItem("dreamit_daily_goal_hours", hours.toString());
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("dreamit_sound_enabled", next ? "true" : "false");
    if (next) playNotificationChime();
  };

  const handleToggleAutoBreaks = () => {
    const next = !autoStartBreaks;
    setAutoStartBreaks(next);
    localStorage.setItem("dreamit_auto_breaks", next ? "true" : "false");
  };

  const handleRequestNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      setNotificationsMuted(false);
      setIsMuted(false);
      playNotificationChime();
      if (userId && isPushSupported()) {
        registerPushNotifications(userId)
          .then(() => setPushStatus("Push notifications activated!"))
          .catch(() => {});
        setTimeout(() => setPushStatus(null), 3000);
      }
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setNotificationsMuted(next);
    setIsMuted(next);
  };

  const handleSelectAiEngine = (engine: "auto" | "nvidia" | "gemini" | "nebius") => {
    setAiEngine(engine);
    localStorage.setItem("dreamit_ai_engine", engine);
    setAiTestResult(null);
  };

  const handleTestAiConnection = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    const startTime = performance.now();
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Ping test. Reply 'OK'." }],
          provider: aiEngine,
          max_tokens: 10,
        }),
      });
      const latencyMs = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        setAiTestResult({
          success: true,
          provider: data.provider || aiEngine,
          model: data.model || "Optimized Model",
          latencyMs,
          message: "Centralized orchestrator operational",
        });
      } else {
        const errJson = await res.json().catch(() => ({}));
        setAiTestResult({
          success: false,
          latencyMs,
          message: errJson?.error || `Status ${res.status}`,
        });
      }
    } catch (err: any) {
      setAiTestResult({
        success: false,
        latencyMs: Math.round(performance.now() - startTime),
        message: err?.message || "Connection failed",
      });
    } finally {
      setAiTesting(false);
    }
  };

  const TABS = [
    { id: "profile" as SettingsTab, label: "Profile", icon: User },
    { id: "appearance" as SettingsTab, label: "Appearance", icon: Palette },
    { id: "ai" as SettingsTab, label: "AI Engine", icon: Cpu },
    { id: "study" as SettingsTab, label: "Study & Focus", icon: Timer },
    { id: "notifications" as SettingsTab, label: "Alerts", icon: Bell },
    { id: "data" as SettingsTab, label: "Data & Backup", icon: Database },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      {/* Background dismissal */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Main Card */}
      <div
        className="w-full sm:max-w-2xl h-[90dvh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border animate-in slide-in-from-bottom-4 duration-200"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          borderColor: "var(--m-border)",
          color: "var(--m-text)",
        }}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0 select-none" style={{ borderColor: "var(--m-border-light)" }}>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center shadow-xs" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-bold font-[Roboto_Slab] text-base sm:text-lg leading-tight">Settings</h3>
              <p className="text-xs opacity-60 mt-0.5">Customize your Dream It experience</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition shrink-0 cursor-pointer opacity-70 hover:opacity-100"
            title="Close Settings"
            aria-label="Close Settings"
          >
            <X size={19} />
          </button>
        </div>

        {/* Tab Navigation Pill Bar (Smooth Touch Scrollable on Mobile) */}
        <div className="px-3 sm:px-5 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0 select-none" style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-surface)" }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? "shadow-sm"
                    : "opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={
                  isActive
                    ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                    : { color: "var(--m-text)" }
                }
              >
                <Icon size={14} className="shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Tab Body */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 min-h-0 select-text"
          style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
        >
          {/* ─────────────── TAB 1: PROFILE & ACCOUNT ─────────────── */}
          {activeTab === "profile" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Profile Card */}
              <div
                className="p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
              >
                {userImageUrl ? (
                  <img
                    src={userImageUrl}
                    alt={userNameDisplay}
                    className="size-16 sm:size-18 rounded-full object-cover border-2 shadow-sm shrink-0"
                    style={{ borderColor: "var(--m-primary)" }}
                  />
                ) : (
                  <div
                    className="size-16 sm:size-18 rounded-full flex items-center justify-center text-xl font-bold border-2 shadow-sm shrink-0"
                    style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)", borderColor: "var(--m-primary)" }}
                  >
                    {userNameDisplay.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-base sm:text-lg truncate">{userNameDisplay}</h4>
                      <p className="text-xs opacity-60 truncate">{userEmail || "Signed in student"}</p>
                    </div>
                    {streakCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold self-center sm:self-auto bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Flame size={13} className="fill-current" />
                        <span>{streakCount} day streak</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    {onOpenProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenProfile();
                          onClose();
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer"
                        style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                      >
                        <ShieldCheck size={14} />
                        <span>Manage Clerk Account</span>
                      </button>
                    )}

                    {onOpenAccountSwitcher && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenAccountSwitcher();
                          onClose();
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        style={{ borderColor: "var(--m-border)", color: "var(--m-text)" }}
                      >
                        <ArrowRightLeft size={14} />
                        <span>Switch Account</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Quick Details */}
              <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--m-border-light)" }}>
                <h5 className="text-xs font-bold uppercase tracking-wider opacity-60">Account Details</h5>
                <div className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: "var(--m-border-light)" }}>
                  <span className="opacity-70">User ID</span>
                  <span className="font-mono text-[11px] opacity-90 truncate max-w-[200px]">{userId || "Local Session"}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: "var(--m-border-light)" }}>
                  <span className="opacity-70">Role</span>
                  <span className="font-semibold text-emerald-500">Learner / Student</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="opacity-70">Security</span>
                  <span className="font-semibold opacity-90 flex items-center gap-1 text-emerald-400">
                    <ShieldCheck size={13} /> Active & Verified
                  </span>
                </div>
              </div>

              {/* Sign Out Option */}
              {onSignOut && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSignOut();
                    }}
                    className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>Sign Out from this Device</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── TAB 2: APPEARANCE & THEMES ─────────────── */}
          {activeTab === "appearance" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h4 className="font-bold text-sm sm:text-base">Color Theme</h4>
                <p className="text-xs opacity-60 mt-0.5">Select a palette. Colors update immediately across the entire workspace.</p>
              </div>

              {/* Themes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {THEMES.map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer group ${
                        isSelected
                          ? "ring-2 ring-[var(--m-primary)] shadow-md"
                          : "hover:border-[var(--m-primary)]/50 hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                      style={{
                        backgroundColor: isSelected ? "var(--m-surface-alt)" : "var(--m-surface)",
                        borderColor: isSelected ? "var(--m-primary)" : "var(--m-border-light)",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base select-none">{t.icon}</span>
                          <span className={`text-xs font-bold truncate ${isSelected ? "text-[var(--m-primary)]" : ""}`}>
                            {t.name}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-60 mt-1 line-clamp-1">{t.description}</p>
                      </div>

                      {/* Swatches */}
                      <div className="flex items-center gap-1 shrink-0">
                        {t.swatches.slice(0, 3).map((swatch, i) => (
                          <span
                            key={i}
                            className="size-3.5 rounded-full border border-black/15 dark:border-white/20 shadow-xs"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                        {isSelected && (
                          <div className="ml-1 size-5 rounded-full bg-[var(--m-primary)] text-[var(--m-primary-text)] flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─────────────── TAB: CENTRALIZED AI ORCHESTRATION ─────────────── */}
          {activeTab === "ai" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Header Card */}
              <div
                className="p-4 sm:p-5 rounded-2xl border"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                  >
                    <Cpu size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm sm:text-base">AI Orchestration & Routing Layer</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                        Multi-Provider
                      </span>
                    </div>
                    <p className="text-xs opacity-70 mt-1 leading-relaxed">
                      Dream It routes each learning task to the best AI provider (Google Gemini, NVIDIA NIM, and Nebius Studio) with automatic cross-provider failover.
                    </p>
                  </div>
                </div>
              </div>

              {/* Provider Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs uppercase tracking-wider opacity-60">Primary AI Engine</h5>
                  <span className="text-[11px] opacity-50">Select preference</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Smart Auto-Router */}
                  <button
                    type="button"
                    onClick={() => handleSelectAiEngine("auto")}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between gap-3 cursor-pointer ${
                      aiEngine === "auto"
                        ? "ring-2 ring-[var(--m-primary)] shadow-md"
                        : "hover:border-[var(--m-primary)]/50 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: aiEngine === "auto" ? "var(--m-surface-alt)" : "var(--m-surface)",
                      borderColor: aiEngine === "auto" ? "var(--m-primary)" : "var(--m-border-light)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">⚡</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">Smart Auto-Router</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                              RECOMMENDED
                            </span>
                          </div>
                          <p className="text-[10px] opacity-60 mt-0.5">Task-based dynamic selection & failover</p>
                        </div>
                      </div>
                      {aiEngine === "auto" && (
                        <div className="size-5 rounded-full bg-[var(--m-primary)] text-[var(--m-primary-text)] flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] opacity-70">
                      Dispatches vision to NVIDIA Nemotron 120B and rapid study chat to Gemini Flash with zero-downtime failover.
                    </p>
                  </button>

                  {/* Option 2: NVIDIA NIM */}
                  <button
                    type="button"
                    onClick={() => handleSelectAiEngine("nvidia")}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between gap-3 cursor-pointer ${
                      aiEngine === "nvidia"
                        ? "ring-2 ring-[var(--m-primary)] shadow-md"
                        : "hover:border-[var(--m-primary)]/50 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: aiEngine === "nvidia" ? "var(--m-surface-alt)" : "var(--m-surface)",
                      borderColor: aiEngine === "nvidia" ? "var(--m-primary)" : "var(--m-border-light)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">🟢</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">NVIDIA NIM Cloud</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-500">
                              120B VISION
                            </span>
                          </div>
                          <p className="text-[10px] opacity-60 mt-0.5">Nemotron 3.5 Super VL & Lightning</p>
                        </div>
                      </div>
                      {aiEngine === "nvidia" && (
                        <div className="size-5 rounded-full bg-[var(--m-primary)] text-[var(--m-primary-text)] flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] opacity-70">
                      State-of-the-art multimodal reasoning, handwriting analysis, and diagram extraction.
                    </p>
                  </button>

                  {/* Option 3: Google Gemini */}
                  <button
                    type="button"
                    onClick={() => handleSelectAiEngine("gemini")}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between gap-3 cursor-pointer ${
                      aiEngine === "gemini"
                        ? "ring-2 ring-[var(--m-primary)] shadow-md"
                        : "hover:border-[var(--m-primary)]/50 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: aiEngine === "gemini" ? "var(--m-surface-alt)" : "var(--m-surface)",
                      borderColor: aiEngine === "gemini" ? "var(--m-primary)" : "var(--m-border-light)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">🔷</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">Google Gemini</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                              ULTRA FAST
                            </span>
                          </div>
                          <p className="text-[10px] opacity-60 mt-0.5">Gemini 3.1 Flash Lite & 3.6 Flash</p>
                        </div>
                      </div>
                      {aiEngine === "gemini" && (
                        <div className="size-5 rounded-full bg-[var(--m-primary)] text-[var(--m-primary-text)] flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] opacity-70">
                      Ultra-responsive study conversations, flashcard synthesis, and structured JSON outputs.
                    </p>
                  </button>

                  {/* Option 4: Nebius AI Studio */}
                  <button
                    type="button"
                    onClick={() => handleSelectAiEngine("nebius")}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between gap-3 cursor-pointer ${
                      aiEngine === "nebius"
                        ? "ring-2 ring-[var(--m-primary)] shadow-md"
                        : "hover:border-[var(--m-primary)]/50 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: aiEngine === "nebius" ? "var(--m-surface-alt)" : "var(--m-surface)",
                      borderColor: aiEngine === "nebius" ? "var(--m-primary)" : "var(--m-border-light)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">🟣</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">Nebius AI Studio</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
                              PLUG & PLAY
                            </span>
                          </div>
                          <p className="text-[10px] opacity-60 mt-0.5">Llama 3.1 & Qwen 2.5 Coder</p>
                        </div>
                      </div>
                      {aiEngine === "nebius" && (
                        <div className="size-5 rounded-full bg-[var(--m-primary)] text-[var(--m-primary-text)] flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] opacity-70">
                      OpenAI-compatible inference hub ready for open-source high-throughput models.
                    </p>
                  </button>
                </div>
              </div>

              {/* Task Routing Matrix Details */}
              <div
                className="p-4 rounded-2xl border space-y-3"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
              >
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs">Task-Based Routing Matrix</h5>
                  <span className="text-[10px] opacity-60">Auto Dispatch Rules</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border flex items-center justify-between gap-2" style={{ borderColor: "var(--m-border-light)" }}>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">📸 Snap & Solve / OCR</p>
                      <p className="text-[10px] opacity-60">Handwritten & Vision tasks</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/15 text-green-500 shrink-0 font-bold">
                      NVIDIA Nemotron 120B
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl border flex items-center justify-between gap-2" style={{ borderColor: "var(--m-border-light)" }}>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">📐 Exam Grader & Code</p>
                      <p className="text-[10px] opacity-60">Step-by-step verification</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/15 text-green-500 shrink-0 font-bold">
                      Nemotron 120B / Gemini
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl border flex items-center justify-between gap-2" style={{ borderColor: "var(--m-border-light)" }}>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">💬 Study Tutor & Chat</p>
                      <p className="text-[10px] opacity-60">Conversational Q&A</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-500 shrink-0 font-bold">
                      Gemini 3.1 Flash Lite
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl border flex items-center justify-between gap-2" style={{ borderColor: "var(--m-border-light)" }}>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">📑 Flashcards & Summaries</p>
                      <p className="text-[10px] opacity-60">High-speed JSON extraction</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-500 shrink-0 font-bold">
                      Gemini Flash / Nemotron
                    </span>
                  </div>
                </div>
              </div>

              {/* Engine Diagnostics & Connection Test */}
              <div
                className="p-4 rounded-2xl border space-y-3"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm">Orchestrator Diagnostics</h5>
                    <p className="text-[11px] opacity-60 mt-0.5">Test live API connectivity across providers</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestAiConnection}
                    disabled={aiTesting}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    style={{
                      borderColor: "var(--m-primary)",
                      backgroundColor: "var(--m-primary)",
                      color: "var(--m-primary-text)",
                    }}
                  >
                    {aiTesting ? (
                      <>
                        <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={13} />
                        <span>Ping AI Engine</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Status Indicator Bar */}
                <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="opacity-75">Auto-Failover: <strong className="text-emerald-500">Active</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-blue-500" />
                    <span className="opacity-75">Gemini 3.1: <strong className="text-blue-500">Ready</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-green-500" />
                    <span className="opacity-75">NVIDIA NIM: <strong className="text-green-500">Ready</strong></span>
                  </div>
                </div>

                {/* Test Result Message Box */}
                {aiTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
                      aiTestResult.success
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/30 text-red-500"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {aiTestResult.success ? (
                        <CheckCircle2 size={15} className="shrink-0" />
                      ) : (
                        <AlertCircle size={15} className="shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold">{aiTestResult.message}</p>
                        {aiTestResult.provider && (
                          <p className="text-[10px] opacity-75">
                            Routed via: <strong>{aiTestResult.provider.toUpperCase()}</strong> ({aiTestResult.model})
                          </p>
                        )}
                      </div>
                    </div>
                    {aiTestResult.latencyMs !== undefined && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0">
                        {aiTestResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────── TAB 3: STUDY & FOCUS ─────────────── */}
          {activeTab === "study" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Daily Study Target */}
              <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm">Daily Study Goal</h5>
                    <p className="text-[11px] opacity-60 mt-0.5">Target study hours for streak credit</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--m-primary)] text-[var(--m-primary-text)]">
                    {dailyGoalHours} {dailyGoalHours === 1 ? "Hour" : "Hours"} / day
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5, 6].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => handleUpdateGoalHours(hrs)}
                      className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        dailyGoalHours === hrs
                          ? "bg-[var(--m-primary)] text-[var(--m-primary-text)] border-[var(--m-primary)]"
                          : "hover:bg-black/5 dark:hover:bg-white/5 border-[var(--m-border-light)]"
                      }`}
                    >
                      {hrs}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Pomodoro Focus Timer Presets */}
              <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm">Focus Session Duration</h5>
                    <p className="text-[11px] opacity-60 mt-0.5">Length of one Pomodoro study block</p>
                  </div>
                  <span className="text-xs font-bold font-mono opacity-80">{timerPreset} min</span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[15, 25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onUpdateTimerPreset?.(mins)}
                      className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        timerPreset === mins
                          ? "bg-[var(--m-primary)] text-[var(--m-primary-text)] border-[var(--m-primary)]"
                          : "hover:bg-black/5 dark:hover:bg-white/5 border-[var(--m-border-light)]"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Study Automation Toggles */}
              <div className="space-y-3">
                <div
                  onClick={handleToggleSound}
                  className="p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
                  style={{ borderColor: "var(--m-border-light)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-black/5 dark:bg-white/10 shrink-0">
                      {soundEnabled ? <Volume2 size={16} className="text-emerald-500" /> : <VolumeX size={16} className="opacity-50" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold">Session Completion Chimes</p>
                      <p className="text-[10px] opacity-60">Play audio chime when focus or break concludes</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${soundEnabled ? "text-emerald-500 bg-emerald-500/10" : "opacity-40"}`}>
                    {soundEnabled ? "Enabled" : "Muted"}
                  </span>
                </div>

                <div
                  onClick={handleToggleAutoBreaks}
                  className="p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
                  style={{ borderColor: "var(--m-border-light)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-black/5 dark:bg-white/10 shrink-0">
                      <Clock size={16} className="text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Auto-Transition Breaks</p>
                      <p className="text-[10px] opacity-60">Automatically switch between focus time and short breaks</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${autoStartBreaks ? "text-indigo-400 bg-indigo-500/10" : "opacity-40"}`}>
                    {autoStartBreaks ? "Auto" : "Manual"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────── TAB 4: NOTIFICATIONS & ALERTS ─────────────── */}
          {activeTab === "notifications" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h4 className="font-bold text-sm sm:text-base">Notifications & Sounds</h4>
                <p className="text-xs opacity-60 mt-0.5">Control desktop, push, and audio alerts for messages and study reminders.</p>
              </div>

              {pushStatus && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-in fade-in duration-200">
                  {pushStatus}
                </div>
              )}

              {/* Browser Permission Status */}
              <div
                className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold">Browser Push Permission</p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        notifPermission === "granted"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : notifPermission === "denied"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {notifPermission}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-60 mt-1">Needed for incoming call ringing, friend messages, and study reminders</p>
                </div>

                {notifPermission !== "granted" ? (
                  <button
                    type="button"
                    onClick={handleRequestNotifications}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition shrink-0 cursor-pointer"
                  >
                    Enable Notifications
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0 cursor-pointer"
                    style={{ borderColor: "var(--m-border)" }}
                  >
                    {isMuted ? "Unmute Sounds" : "Mute Sounds"}
                  </button>
                )}
              </div>

              {/* Sound Test Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => playNotificationChime()}
                  className="w-full py-2.5 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  style={{ borderColor: "var(--m-border-light)" }}
                >
                  <Volume2 size={14} />
                  <span>Test Notification Audio Chime</span>
                </button>
              </div>
            </div>
          )}

          {/* ─────────────── TAB 5: DATA & BACKUP ─────────────── */}
          {activeTab === "data" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h4 className="font-bold text-sm sm:text-base">Data Portability & Backups</h4>
                <p className="text-xs opacity-60 mt-0.5">Download your study logs, tasks, and full user data anytime.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Export CSV */}
                <div
                  className="p-4 rounded-2xl border flex flex-col justify-between gap-3"
                  style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={16} className="text-emerald-500" />
                      <h5 className="text-xs font-bold">Tasks Spreadsheet</h5>
                    </div>
                    <p className="text-[11px] opacity-60 mt-1">Export all daily tasks, priorities, and status in CSV format.</p>
                  </div>
                  {onExportCSV && (
                    <button
                      type="button"
                      onClick={onExportCSV}
                      className="w-full py-2 rounded-xl text-xs font-bold border hover:bg-emerald-500/10 hover:border-emerald-500/40 text-emerald-500 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{ borderColor: "var(--m-border)" }}
                    >
                      <Download size={13} />
                      <span>Export CSV</span>
                    </button>
                  )}
                </div>

                {/* Export JSON (Full Backup) */}
                <div
                  className="p-4 rounded-2xl border flex flex-col justify-between gap-3"
                  style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Database size={16} className="text-indigo-400" />
                      <h5 className="text-xs font-bold">Full JSON Archive</h5>
                    </div>
                    <p className="text-[11px] opacity-60 mt-1">Export full snapshot of subjects, study sessions, and history.</p>
                  </div>
                  {onExportJSON && (
                    <button
                      type="button"
                      onClick={onExportJSON}
                      className="w-full py-2 rounded-xl text-xs font-bold border hover:bg-indigo-500/10 hover:border-indigo-500/40 text-indigo-400 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{ borderColor: "var(--m-border)" }}
                    >
                      <Download size={13} />
                      <span>Export JSON</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sync Status Info */}
              <div className="p-3.5 rounded-2xl border text-xs flex items-center justify-between" style={{ borderColor: "var(--m-border-light)" }}>
                <span className="opacity-70">Cloud Sync Status</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-time Supabase Sync Active</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t flex items-center justify-between shrink-0 select-none pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-surface)" }}>
          <p className="text-[11px] opacity-50 hidden sm:block">Dream It v2.0 • Real-time Productivity</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-sm hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

