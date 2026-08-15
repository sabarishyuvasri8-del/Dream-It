/**
 * Dream It — Premium Landing Page
 *
 * A bento-grid-based, theme-aware landing page with scroll animations,
 * micro-interactions, and a premium SaaS aesthetic.
 */

import { useState, useEffect, useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Cpu,
  Flame,
  Goal,
  GraduationCap,
  Layout,
  Lock,
  Moon,
  Palette,
  Rocket,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useTheme, THEMES, type ThemeId } from "../lib/ThemeContext";
import ThemeSelector from "./components/ThemeSelector";

/* ─────────────── Animated Section Wrapper ─────────────── */
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────── Bento Card ─────────────── */
function BentoCard({
  icon,
  title,
  description,
  accent = false,
  large = false,
  children,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent?: boolean;
  large?: boolean;
  children?: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.02, y: -5 }}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ref.current.style.setProperty("--mouse-x", `${x}px`);
        ref.current.style.setProperty("--mouse-y", `${y}px`);
      }}
      className={`group relative overflow-hidden rounded-2xl p-6 md:p-8 transition-all duration-300 ${
        large ? "md:col-span-2" : ""
      }`}
      style={{
        background: accent
          ? "linear-gradient(135deg, var(--m-primary), color-mix(in srgb, var(--m-primary) 80%, #000))"
          : "var(--m-surface)",
        border: "1px solid var(--m-border)",
        color: accent ? "var(--m-primary-text)" : "var(--m-text)",
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: accent
            ? "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06), transparent 40%)"
            : "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), color-mix(in srgb, var(--m-primary) 8%, transparent), transparent 40%)",
        }}
      />

      <div className="relative z-10">
        <div
          className="inline-flex items-center justify-center size-11 rounded-xl mb-4 transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundColor: accent
              ? "rgba(255,255,255,0.15)"
              : "color-mix(in srgb, var(--m-primary) 12%, transparent)",
            color: accent ? "currentColor" : "var(--m-primary)",
          }}
        >
          {icon}
        </div>
        <h3
          className="text-lg font-bold mb-2"
          style={{ color: accent ? "inherit" : "var(--m-text-heading)" }}
        >
          {title}
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{
            color: accent ? "rgba(255,255,255,0.85)" : "var(--m-text-sub)",
          }}
        >
          {description}
        </p>
        {children}
      </div>
    </motion.div>
  );
}

/* ─────────────── Stat Card ─────────────── */
function StatCard({
  value,
  label,
  delay = 0,
}: {
  value: string;
  label: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay }}
      className="text-center px-6 py-4"
    >
      <div
        className="text-3xl md:text-4xl font-extrabold tracking-tight"
        style={{ color: "var(--m-primary)" }}
      >
        {value}
      </div>
      <div
        className="text-xs font-medium mt-1 uppercase tracking-wider"
        style={{ color: "var(--m-text-muted)" }}
      >
        {label}
      </div>
    </motion.div>
  );
}

/* ─────────────── Journey Step ─────────────── */
function JourneyStep({
  icon,
  label,
  index,
  total,
}: {
  icon: React.ReactNode;
  label: string;
  index: number;
  total: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex flex-col items-center gap-3"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
        className="size-16 md:size-20 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-110"
        style={{
          background: "var(--m-surface)",
          border: "1px solid var(--m-border)",
          color: "var(--m-primary)",
          boxShadow: "0 8px 32px color-mix(in srgb, var(--m-primary) 10%, transparent)",
        }}
      >
        {icon}
      </motion.div>
      <span
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: "var(--m-text-heading)" }}
      >
        {label}
      </span>
      {index < total - 1 && (
        <ChevronRight
          size={16}
          className="absolute right-0 top-1/2 -translate-y-1/2 hidden md:block"
          style={{ color: "var(--m-text-faint)" }}
        />
      )}
    </motion.div>
  );
}

/* ─────────────── Tech Spec Card ─────────────── */
function TechCard({
  icon,
  title,
  desc,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "var(--m-surface)",
        border: "1px solid var(--m-border)",
      }}
    >
      <div
        className="inline-flex items-center justify-center size-10 rounded-xl mb-3 transition-transform duration-300 group-hover:scale-110"
        style={{
          backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)",
          color: "var(--m-primary)",
        }}
      >
        {icon}
      </div>
      <div
        className="text-sm font-bold mb-1"
        style={{ color: "var(--m-text-heading)" }}
      >
        {title}
      </div>
      <div
        className="text-xs leading-relaxed"
        style={{ color: "var(--m-text-muted)" }}
      >
        {desc}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LandingPage({
  onGetStarted,
}: {
  onGetStarted: () => void;
}) {
  const { theme, setTheme, themeConfig, isDark } = useTheme();
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [themeShowcase, setThemeShowcase] = useState<"light" | "dark">("light");

  /* ─── Parallax for hero ─── */
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  /* ─── Dashboard 3D Scroll Effect ─── */
  const dashRotateX = useTransform(scrollYProgress, [0, 0.5], [15, 0]);
  const dashScale = useTransform(scrollYProgress, [0, 0.5], [0.92, 1]);

  /* ─── Navbar scroll effect ─── */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const journeySteps = [
    { icon: <Sparkles size={28} />, label: "Dream" },
    { icon: <Target size={28} />, label: "Plan" },
    { icon: <Flame size={28} />, label: "Focus" },
    { icon: <Zap size={28} />, label: "Execute" },
    { icon: <TrendingUp size={28} />, label: "Track" },
    { icon: <GraduationCap size={28} />, label: "Achieve" },
  ];

  return (
    <div
      className="min-h-screen font-[DM_Sans] overflow-x-hidden"
      style={{
        backgroundColor: "var(--m-bg)",
        color: "var(--m-text)",
      }}
    >
      {/* ═══════════ NAVBAR ═══════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled
            ? isDark
              ? "var(--m-surface-solid)"
              : "var(--m-surface-solid)"
            : "transparent",
          borderBottom: scrolled ? "1px solid var(--m-border)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="size-9 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text)",
              }}
            >
              <BookOpenCheck size={18} />
            </div>
            <span
              className="font-[Roboto_Slab] text-lg font-bold tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Dream It
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme switcher pill */}
            <button
              type="button"
              onClick={() => setThemeSelectorOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:scale-105"
              style={{
                background: "var(--m-surface)",
                border: "1px solid var(--m-border)",
                color: "var(--m-text-heading)",
              }}
            >
              <Palette size={14} style={{ color: "var(--m-primary)" }} />
              {themeConfig.swatches.slice(0, 3).map((c, i) => (
                <span
                  key={i}
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
            </button>

            <button
              type="button"
              onClick={onGetStarted}
              className="rounded-full px-5 py-2.5 text-xs font-bold transition-all duration-200 hover:scale-105 hover:-translate-y-0.5"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text)",
                boxShadow:
                  "0 4px 20px color-mix(in srgb, var(--m-primary) 30%, transparent)",
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════ HERO SECTION ═══════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16">
        {/* Background – solid, no blur glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: "var(--m-bg)" }} />

        {/* Grid pattern overlay (with subtle scroll parallax) */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            y: useTransform(scrollYProgress, [0, 1], [0, -100]),
            backgroundImage: `linear-gradient(var(--m-text) 1px, transparent 1px), linear-gradient(90deg, var(--m-text) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-7xl mx-auto px-6 w-full"
        >
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold mb-8"
              style={{
                background: "var(--m-surface)",
                border: "1px solid var(--m-border)",
                color: "var(--m-primary)",
              }}
            >
              <Sparkles size={14} />
              Built for students who dream bigger
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, filter: "blur(10px)", y: 40 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="font-[Roboto_Slab] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95]"
              style={{ color: "var(--m-text-heading)" }}
            >
              Dream It.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, filter: "blur(10px)", y: 30 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 font-[Roboto_Slab] text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight"
              style={{ color: "var(--m-primary)" }}
            >
              Plan it. Do it. Become it.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, filter: "blur(10px)", y: 30 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 text-base md:text-lg leading-relaxed max-w-xl mx-auto"
              style={{ color: "var(--m-text-sub)" }}
            >
              The intelligent workspace that helps students organize goals, tasks,
              studies, habits, schedules, and daily priorities — all in one
              beautifully crafted platform.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.65 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button
                type="button"
                onClick={onGetStarted}
                className="group flex items-center gap-2.5 rounded-full px-8 py-4 text-sm font-bold transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                style={{
                  backgroundColor: "var(--m-primary)",
                  color: "var(--m-primary-text)",
                  boxShadow:
                    "0 8px 40px color-mix(in srgb, var(--m-primary) 35%, transparent)",
                }}
              >
                <Sparkles size={18} />
                Start Dreaming
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-2 rounded-full px-7 py-4 text-sm font-semibold transition-all duration-200 hover:scale-105"
                style={{
                  background: "var(--m-surface)",
                  border: "1px solid var(--m-border)",
                  color: "var(--m-text-heading)",
                }}
              >
                Explore Features
                <ChevronRight size={16} />
              </button>
            </motion.div>
          </div>

          {/* ─── Dashboard Preview ─── */}
          <motion.div
            style={{ rotateX: dashRotateX, scale: dashScale, perspective: 1200 }}
            className="mt-16 md:mt-24 max-w-5xl mx-auto will-change-transform origin-top"
          >
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative rounded-2xl overflow-hidden p-1"
              style={{
                background:
                  "linear-gradient(135deg, var(--m-primary), var(--m-accent), var(--m-primary))",
              }}
            >
              <div
                className="rounded-xl overflow-hidden p-6 md:p-10"
                style={{ background: "var(--m-bg)" }}
              >
                {/* Mock Dashboard */}
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                  {/* Sidebar mock */}
                  <div
                    className="col-span-1 hidden md:flex flex-col gap-3 rounded-xl p-4"
                    style={{
                      background: "var(--m-surface)",
                      border: "1px solid var(--m-border-light)",
                    }}
                  >
                    {[
                      "Dashboard",
                      "Tasks",
                      "Schedule",
                      "Notes",
                      "Flashcards",
                    ].map((item, i) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold transition"
                        style={{
                          backgroundColor:
                            i === 0
                              ? "color-mix(in srgb, var(--m-primary) 12%, transparent)"
                              : "transparent",
                          color:
                            i === 0 ? "var(--m-primary)" : "var(--m-text-muted)",
                        }}
                      >
                        <div
                          className="size-5 rounded"
                          style={{
                            backgroundColor:
                              i === 0
                                ? "var(--m-primary)"
                                : "var(--m-border)",
                          }}
                        />
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Main content mock */}
                  <div className="col-span-3 flex flex-col gap-3">
                    {/* Top bar */}
                    <div
                      className="flex items-center justify-between rounded-xl p-4"
                      style={{
                        background: "var(--m-surface)",
                        border: "1px solid var(--m-border-light)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="size-8 rounded-full"
                          style={{
                            backgroundColor:
                              "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                          }}
                        />
                        <div>
                          <div
                            className="h-2.5 w-24 rounded-full"
                            style={{
                              backgroundColor: "var(--m-text-heading)",
                              opacity: 0.7,
                            }}
                          />
                          <div
                            className="h-2 w-16 rounded-full mt-1.5"
                            style={{
                              backgroundColor: "var(--m-text-muted)",
                              opacity: 0.4,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className="size-7 rounded-lg"
                            style={{
                              backgroundColor: "var(--m-border)",
                              opacity: 0.5,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {["Tasks Done", "Study Hours", "Streak", "Focus Score"].map(
                        (stat, i) => (
                          <div
                            key={stat}
                            className="rounded-xl p-3 md:p-4"
                            style={{
                              background:
                                i === 0
                                  ? "linear-gradient(135deg, var(--m-primary), color-mix(in srgb, var(--m-primary) 80%, #000))"
                                  : "var(--m-surface)",
                              border:
                                i === 0 ? "none" : "1px solid var(--m-border-light)",
                              color:
                                i === 0
                                  ? "var(--m-primary-text)"
                                  : "var(--m-text)",
                            }}
                          >
                            <div className="text-[10px] font-medium opacity-70">
                              {stat}
                            </div>
                            <div className="text-lg font-extrabold mt-1">
                              {["12", "4.5h", "7🔥", "92%"][i]}
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* Chart placeholder */}
                    <div
                      className="rounded-xl p-4 h-28 md:h-36 flex items-end gap-1.5 md:gap-2"
                      style={{
                        background: "var(--m-surface)",
                        border: "1px solid var(--m-border-light)",
                      }}
                    >
                      {[35, 55, 40, 70, 85, 60, 90, 50, 75, 65, 80, 95].map(
                        (h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-md transition-all duration-500"
                            style={{
                              height: `${h}%`,
                              backgroundColor:
                                i === 11
                                  ? "var(--m-primary)"
                                  : "color-mix(in srgb, var(--m-primary) 25%, transparent)",
                              opacity: 0.4 + (i / 12) * 0.6,
                            }}
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════ STATS BAR ═══════════ */}
      <section className="relative z-10 py-12 md:py-16">
        <div
          className="max-w-5xl mx-auto rounded-2xl flex flex-wrap justify-center divide-x"
          style={{
            background: "var(--m-surface)",
            border: "1px solid var(--m-border)",
            // divider color
          }}
        >
          <style>{`.divide-x > * + * { border-color: var(--m-border); }`}</style>
          <StatCard value="10K+" label="Active Students" delay={0} />
          <StatCard value="50K+" label="Tasks Completed" delay={0.1} />
          <StatCard value="2M+" label="Study Hours Logged" delay={0.2} />
          <StatCard value="98%" label="Satisfaction" delay={0.3} />
        </div>
      </section>

      {/* ═══════════ BENTO FEATURES ═══════════ */}
      <section id="features" className="relative z-10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold mb-4"
              style={{
                background: "color-mix(in srgb, var(--m-primary) 8%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Layout size={14} />
              Everything you need
            </div>
            <h2
              className="font-[Roboto_Slab] text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Your complete student workspace
            </h2>
            <p
              className="mt-3 text-base max-w-lg mx-auto"
              style={{ color: "var(--m-text-sub)" }}
            >
              Every tool a student needs to dream bigger, stay organized, and
              make meaningful progress — beautifully integrated in one place.
            </p>
          </AnimatedSection>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            <BentoCard
              icon={<Goal size={22} />}
              title="Goals & Dreams"
              accent
              large
              delay={0}
              description="Turn ambitions into actionable milestones. Break down your biggest dreams into achievable steps with smart goal tracking and progress visualization."
            >
              {/* Mini progress bars inside */}
              <div className="mt-5 space-y-2.5">
                {[
                  { label: "Get into MIT", pct: 72 },
                  { label: "Learn Piano", pct: 45 },
                  { label: "Run a Marathon", pct: 88 },
                ].map((g) => (
                  <div key={g.label}>
                    <div className="flex justify-between text-[11px] font-medium mb-1 opacity-85">
                      <span>{g.label}</span>
                      <span>{g.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-white/70 transition-all duration-1000"
                        style={{ width: `${g.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard
              icon={<BookOpenCheck size={22} />}
              title="Study Planner"
              delay={0.1}
              description="Organize subjects, assignments, and study sessions with an intelligent calendar that adapts to your learning pace."
            />

            <BentoCard
              icon={<CheckCircle2 size={22} />}
              title="Smart Tasks"
              delay={0.15}
              description="Prioritize what actually matters. AI-powered task sorting ensures you're always working on the most impactful items first."
            />

            <BentoCard
              icon={<Clock size={22} />}
              title="Time Management"
              delay={0.2}
              description="Visualize and optimize your day with Pomodoro timers, time blocking, and focus analytics that reveal your peak productivity hours."
            />

            <BentoCard
              icon={<Flame size={22} />}
              title="Habit Tracking"
              accent
              delay={0.25}
              description="Build consistency through daily habits. Visual streaks and gentle reminders keep you accountable without the guilt."
            >
              {/* Mini streak display */}
              <div className="mt-4 flex gap-1.5">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                  <div key={day + i} className="flex flex-col items-center gap-1">
                    <div
                      className="size-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                      style={{
                        backgroundColor:
                          i < 5
                            ? "rgba(255,255,255,0.25)"
                            : "rgba(255,255,255,0.08)",
                        color: i < 5 ? "#fff" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {i < 5 ? "✓" : "·"}
                    </div>
                    <span className="text-[9px] opacity-60">{day}</span>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard
              icon={<Cpu size={22} />}
              title="AI Assistance"
              delay={0.3}
              description="Intelligent recommendations and productivity guidance powered by AI. Get personalized study tips, schedule optimization, and smart insights."
            />

            <BentoCard
              icon={<TrendingUp size={22} />}
              title="Progress Analytics"
              delay={0.35}
              description="Visualize your growth with beautiful charts and achievement badges. Understand your patterns and celebrate your wins."
            />

            <BentoCard
              icon={<Brain size={22} />}
              title="Student Dashboard"
              large
              delay={0.4}
              description="Everything important in one glanceable view. Your daily agenda, upcoming deadlines, active goals, study streaks, and AI-curated insights — all in a single, beautifully designed command center."
            >
              {/* Mini widget mosaic */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Today", value: "5 tasks" },
                  { label: "Streak", value: "14 days" },
                  { label: "Focus", value: "3.5 hrs" },
                ].map((w) => (
                  <div
                    key={w.label}
                    className="rounded-lg p-2.5 text-center"
                    style={{
                      background:
                        "color-mix(in srgb, var(--m-primary) 8%, transparent)",
                      border: "1px solid var(--m-border-light)",
                    }}
                  >
                    <div
                      className="text-[10px] font-medium"
                      style={{ color: "var(--m-text-muted)" }}
                    >
                      {w.label}
                    </div>
                    <div
                      className="text-sm font-bold mt-0.5"
                      style={{ color: "var(--m-primary)" }}
                    >
                      {w.value}
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ═══════════ THEME SHOWCASE ═══════════ */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold mb-4"
              style={{
                background: "color-mix(in srgb, var(--m-primary) 8%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Palette size={14} />
              Personalize your experience
            </div>
            <h2
              className="font-[Roboto_Slab] text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Five handcrafted themes
            </h2>
            <p
              className="mt-3 text-base max-w-lg mx-auto"
              style={{ color: "var(--m-text-sub)" }}
            >
              Choose the aesthetic that matches your mood. Every theme features
              Beautifully crafted themes with carefully tuned color palettes.
            </p>
          </AnimatedSection>

          {/* Theme Swatch Grid */}
          <AnimatedSection delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
              {THEMES.map((t, i) => (
                <motion.button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-2xl p-4 text-left transition-all duration-300 ${
                    theme === t.id ? "ring-2" : ""
                  }`}
                  style={{
                    background: t.swatches[3],
                    border: `1px solid ${t.swatches[1]}20`,
                    ringColor: theme === t.id ? t.swatches[1] : "transparent",
                  }}
                >
                  {theme === t.id && (
                    <div
                      className="absolute top-2 right-2 size-5 rounded-full flex items-center justify-center text-[10px]"
                      style={{
                        backgroundColor: t.swatches[1],
                        color: t.swatches[3],
                      }}
                    >
                      ✓
                    </div>
                  )}
                  <div className="flex gap-1.5 mb-3">
                    {t.swatches.map((color, ci) => (
                      <div
                        key={ci}
                        className="size-4 rounded-full"
                        style={{
                          backgroundColor: color,
                          border: `1px solid ${t.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"}`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-xs font-bold" style={{ color: t.swatches[1] }}>
                    {t.icon} {t.name}
                  </div>
                  <div
                    className="text-[10px] mt-0.5"
                    style={{ color: t.isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)" }}
                  >
                    {t.description}
                  </div>
                </motion.button>
              ))}
            </div>
          </AnimatedSection>

          {/* Dark / Light Side-by-Side Preview */}
          <AnimatedSection delay={0.2} className="mt-14">
            <div className="flex justify-center gap-3 mb-8">
              {(["light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setThemeShowcase(m)}
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-all duration-200"
                  style={{
                    backgroundColor:
                      themeShowcase === m
                        ? "var(--m-primary)"
                        : "var(--m-surface)",
                    color:
                      themeShowcase === m
                        ? "var(--m-primary-text)"
                        : "var(--m-text-sub)",
                    border: `1px solid ${themeShowcase === m ? "transparent" : "var(--m-border)"}`,
                  }}
                >
                  {m === "light" ? <Sun size={14} /> : <Moon size={14} />}
                  {m === "light" ? "Light Themes" : "Dark Themes"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {THEMES.filter((t) =>
                themeShowcase === "dark" ? t.isDark : !t.isDark
              ).map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: t.swatches[0],
                    border: `1px solid ${t.swatches[1]}15`,
                  }}
                >
                  <div className="p-5">
                    {/* Mock mini dashboard in that theme */}
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="size-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: t.swatches[1], color: t.swatches[3] }}
                      >
                        <BookOpenCheck size={14} />
                      </div>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: t.isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                        }}
                      >
                        {t.name}
                      </span>
                    </div>
                    {/* Mini cards */}
                    <div className="grid grid-cols-2 gap-2">
                      {[t.swatches[1], t.swatches[2]].map((c, ci) => (
                        <div
                          key={ci}
                          className="rounded-xl p-3"
                          style={{
                            backgroundColor: t.swatches[3],
                            border: `1px solid ${t.swatches[1]}10`,
                          }}
                        >
                          <div
                            className="h-1.5 w-12 rounded-full mb-2"
                            style={{ backgroundColor: c, opacity: 0.6 }}
                          />
                          <div
                            className="h-1 w-16 rounded-full mb-1"
                            style={{
                              backgroundColor: t.isDark
                                ? "rgba(255,255,255,0.2)"
                                : "rgba(0,0,0,0.1)",
                            }}
                          />
                          <div
                            className="h-1 w-10 rounded-full"
                            style={{
                              backgroundColor: t.isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.06)",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      className="mt-2 rounded-xl p-3 h-12 flex items-end gap-1"
                      style={{
                        backgroundColor: t.swatches[3],
                        border: `1px solid ${t.swatches[1]}10`,
                      }}
                    >
                      {[30, 50, 35, 70, 55, 80, 45].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm"
                          style={{
                            height: `${h}%`,
                            backgroundColor: t.swatches[1],
                            opacity: 0.2 + (i / 7) * 0.5,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════ BUILT FOR STUDENTS — JOURNEY ═══════════ */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold mb-4"
              style={{
                background: "color-mix(in srgb, var(--m-primary) 8%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <GraduationCap size={14} />
              Built for students
            </div>
            <h2
              className="font-[Roboto_Slab] text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              From dream to achievement
            </h2>
            <p
              className="mt-3 text-base max-w-lg mx-auto"
              style={{ color: "var(--m-text-sub)" }}
            >
              Dream It fits naturally into every step of your student journey,
              guiding you from initial inspiration all the way to meaningful results.
            </p>
          </AnimatedSection>

          {/* Journey Flow */}
          <AnimatedSection delay={0.1}>
            <div className="relative max-w-4xl mx-auto">
              {/* Connecting line */}
              <div
                className="absolute top-8 md:top-10 left-[10%] right-[10%] h-[2px] hidden md:block"
                style={{
                  background: `linear-gradient(90deg, transparent, var(--m-primary), var(--m-accent), var(--m-primary), transparent)`,
                  opacity: 0.25,
                }}
              />
              <div className="grid grid-cols-3 md:grid-cols-6 gap-6 md:gap-0 md:justify-items-center">
                {journeySteps.map((step, i) => (
                  <JourneyStep
                    key={step.label}
                    icon={step.icon}
                    label={step.label}
                    index={i}
                    total={journeySteps.length}
                  />
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════ TECHNICAL SPECS ═══════════ */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold mb-4"
              style={{
                background: "color-mix(in srgb, var(--m-primary) 8%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Rocket size={14} />
              Built for performance
            </div>
            <h2
              className="font-[Roboto_Slab] text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Engineered for speed
            </h2>
            <p
              className="mt-3 text-base max-w-lg mx-auto"
              style={{ color: "var(--m-text-sub)" }}
            >
              Every interaction is designed to feel instant. Dream It is built
              with modern architecture to deliver a snappy, reliable experience.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <TechCard
              icon={<Zap size={20} />}
              title="Lightning Fast"
              desc="Sub-50ms interactions with optimized rendering"
              delay={0}
            />
            <TechCard
              icon={<Smartphone size={20} />}
              title="Fully Responsive"
              desc="Pixel-perfect on every screen size"
              delay={0.05}
            />
            <TechCard
              icon={<Moon size={20} />}
              title="5 Themes"
              desc="Dark, light, and custom palettes with smooth transitions"
              delay={0.1}
            />
            <TechCard
              icon={<Lock size={20} />}
              title="Secure Auth"
              desc="Enterprise-grade authentication with Clerk"
              delay={0.15}
            />
            <TechCard
              icon={<Cpu size={20} />}
              title="AI Powered"
              desc="Intelligent recommendations and study guidance"
              delay={0.2}
            />
            <TechCard
              icon={<Cloud size={20} />}
              title="Cloud Ready"
              desc="Supabase backend with real-time sync"
              delay={0.25}
            />
            <TechCard
              icon={<Layout size={20} />}
              title="Modular System"
              desc="Component-based architecture for reliability"
              delay={0.3}
            />
            <TechCard
              icon={<Rocket size={20} />}
              title="Optimized"
              desc="Tree-shaken, code-split, and production-ready"
              delay={0.35}
            />
          </div>
        </div>
      </section>

      {/* ═══════════ SOCIAL PROOF / VISION ═══════════ */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <AnimatedSection className="text-center">
            <h2
              className="font-[Roboto_Slab] text-2xl md:text-4xl font-extrabold tracking-tight leading-snug max-w-2xl mx-auto"
              style={{ color: "var(--m-text-heading)" }}
            >
              "Every student has a dream.{" "}
              <span style={{ color: "var(--m-primary)" }}>
                Dream It helps turn that dream into a direction.
              </span>
              "
            </h2>
          </AnimatedSection>

          {/* Testimonial cards */}
          <AnimatedSection delay={0.15} className="mt-14">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  quote:
                    "Dream It completely transformed how I organize my study sessions. My grades went from B's to straight A's in one semester.",
                  name: "Priya M.",
                  role: "Computer Science, Year 3",
                  avatar: "PM",
                },
                {
                  quote:
                    "The habit tracking and focus timer are game-changers. I've maintained a 60-day study streak and it feels effortless.",
                  name: "James K.",
                  role: "Pre-Med, Year 2",
                  avatar: "JK",
                },
                {
                  quote:
                    "Having my goals, schedule, and notes all in one beautiful interface makes me actually want to plan my days. Best student app ever.",
                  name: "Aisha R.",
                  role: "Business, Year 1",
                  avatar: "AR",
                },
              ].map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: "var(--m-surface)",
                    border: "1px solid var(--m-border)",
                  }}
                >
                  {/* Stars */}
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className="text-sm" style={{ color: "var(--m-accent)" }}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p
                    className="text-sm leading-relaxed mb-5"
                    style={{ color: "var(--m-text-sub)" }}
                  >
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="size-9 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                        color: "var(--m-primary)",
                      }}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <div
                        className="text-xs font-bold"
                        style={{ color: "var(--m-text-heading)" }}
                      >
                        {t.name}
                      </div>
                      <div
                        className="text-[10px] mt-0.5"
                        style={{ color: "var(--m-text-muted)" }}
                      >
                        {t.role}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="relative z-10 py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection>
            <div
              className="relative overflow-hidden rounded-3xl px-8 py-16 md:px-16 md:py-24 text-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--m-primary), color-mix(in srgb, var(--m-primary) 75%, #000))",
                color: "var(--m-primary-text)",
              }}
            >


              <div className="relative z-10">
                <h2 className="font-[Roboto_Slab] text-3xl md:text-5xl font-extrabold tracking-tight leading-tight max-w-2xl mx-auto">
                  Your dream is the destination.
                  <br />
                  <span className="opacity-80">
                    Dream It is where the journey begins.
                  </span>
                </h2>

                <p className="mt-6 text-sm md:text-base opacity-80 max-w-md mx-auto leading-relaxed">
                  Dream. Plan. Focus. Achieve. Join thousands of students who are
                  already turning their ambitions into reality.
                </p>

                <button
                  type="button"
                  onClick={onGetStarted}
                  className="group mt-10 inline-flex items-center gap-3 rounded-full px-10 py-5 text-sm font-bold transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                  style={{
                    backgroundColor: "var(--m-primary)",
                    color: "var(--m-primary-text)",
                    border: "1px solid var(--m-primary)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                  }}
                >
                  Start Your Journey
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer
        className="relative z-10 py-10 border-t"
        style={{ borderColor: "var(--m-border)" }}
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="size-7 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text)",
              }}
            >
              <BookOpenCheck size={14} />
            </div>
            <span
              className="font-[Roboto_Slab] text-sm font-bold"
              style={{ color: "var(--m-text-heading)" }}
            >
              Dream It
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--m-text-muted)" }}>
            © {new Date().getFullYear()} Dream It. Dream. Plan. Focus. Achieve.
          </p>
        </div>
      </footer>

      {/* ─── Theme Selector Modal ─── */}
      <ThemeSelector
        isOpen={themeSelectorOpen}
        onClose={() => setThemeSelectorOpen(false)}
      />
    </div>
  );
}
