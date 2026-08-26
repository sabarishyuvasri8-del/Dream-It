import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  CreditCard,
  FileText,
  FolderOpen,
  GraduationCap,
  Layout,
  Lock,
  Menu,
  MessageSquare,
  Mic,
  PieChart,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Wallet,
  X,
  Palette,
} from "lucide-react";
import ParticleField from "./components/ParticleField";
import ThemeSelector from "./components/ThemeSelector";

/* ─── HOOKS ─── */
const useParallax = (speed: number) => {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      setOffset(window.scrollY * speed);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [speed]);
  return offset;
};

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);
  return prefersReducedMotion;
};

/* ─── ANIMATION VARIANTS ─── */
const getSectionVariants = (reducedMotion: boolean) =>
  reducedMotion
    ? {}
    : {
      hidden: { opacity: 0, y: 40 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.4,
          ease: [0.25, 0.46, 0.45, 0.94],
          staggerChildren: 0.1,
        },
      },
    };

const getItemVariants = (reducedMotion: boolean) =>
  reducedMotion
    ? {}
    : {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: "easeOut" },
      },
    };

/* ─── COMPONENTS ─── */

function AnimatedSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const variants = getSectionVariants(prefersReducedMotion);
  return (
    <motion.section
      id={id}
      className={className}
      initial={prefersReducedMotion ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={variants as any}
      style={{ scrollMarginTop: "80px" }}
    >
      {children}
    </motion.section>
  );
}

function AnimatedItem({
  children,
  className,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const itemVariants = getItemVariants(prefersReducedMotion);
  if (!prefersReducedMotion && itemVariants.visible) {
    (itemVariants.visible as any).transition.delay = delay;
  }
  return (
    <motion.div variants={itemVariants as any} className={className} style={style}>
      {children}
    </motion.div>
  );
}

function TypewriterHero({ reducedMotion }: { reducedMotion: boolean }) {
  const fullText = "Dream It.";
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(fullText);
      setShowCursor(false);
      return;
    }

    // Orchestration delays based on spec
    let i = 0;
    const startDelay = setTimeout(() => {
      const typingInterval = setInterval(() => {
        if (i <= fullText.length) {
          setDisplayText(fullText.substring(0, i));
          i++;
        } else {
          clearInterval(typingInterval);
          setTimeout(() => setShowCursor(false), 3100); // Wait till end of sequence + grace
        }
      }, 80);
      return () => clearInterval(typingInterval);
    }, 500);

    return () => clearTimeout(startDelay);
  }, [reducedMotion]);

  return (
    <div
      className="relative inline-flex justify-center items-center h-[1.2em] font-[Roboto_Slab] font-bold tracking-tight leading-[1.0]"
      style={{
        fontSize: "clamp(3rem, 8vw, 6rem)",
        color: "var(--m-text-heading)",
        letterSpacing: "-0.03em"
      }}
      aria-label="Dream It"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">{displayText}</span>
      <span className="sr-only">{fullText}</span>
      {showCursor && (
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes blinkCursor {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `}} />
      )}
      {showCursor && (
        <span
          className="inline-block ml-1 w-[3px]"
          style={{
            backgroundColor: "var(--m-text-heading)",
            height: "clamp(2.4rem, 6.4vw, 4.8rem)",
            animation: "blinkCursor 1.4s infinite step-start",
          }}
        />
      )}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="border-b transition-colors duration-200"
      style={{ borderColor: "var(--m-border-light)" }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between py-5 text-left focus:outline-none focus-visible:ring-2 rounded focus-visible:ring-offset-2"
        style={{ color: "var(--m-text-heading)", outlineColor: "var(--m-primary)" }}
      >
        <span className="font-bold text-[1.125rem]">{question}</span>
        <ChevronDown
          size={20}
          style={{
            color: "var(--m-text-muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: prefersReducedMotion ? "none" : "transform 300ms ease",
          }}
        />
      </button>
      <div
        style={{
          maxHeight: isOpen ? "500px" : "0",
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: prefersReducedMotion
            ? "opacity 200ms ease"
            : "max-height 300ms ease, opacity 300ms ease",
        }}
      >
        <p
          className="pb-6 text-[1rem] leading-relaxed"
          style={{ color: "var(--m-text-sub)" }}
        >
          {answer}
        </p>
      </div>
    </div>
  );
}

/* ─── MAIN EXPORT ─── */
export default function LandingPage({
  onGetStarted = () => { },
}: {
  onGetStarted?: () => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const parallaxOffset = useParallax(0.3);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [mobileMenuOpen]);

  // Handle escape key for mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinks = [
    { name: "Autopilot", href: "#autopilot" },
    { name: "Workspace", href: "#workspace" },
    { name: "Cadence", href: "#cadence" },
    { name: "Finance", href: "#finance" },
    { name: "FAQ", href: "#faq" },
  ];

  return (
    <div
      className="min-h-screen font-[DM_Sans] selection:bg-black/10"
      style={{
        backgroundColor: "var(--m-bg)",
        color: "var(--m-text)",
        scrollBehavior: prefersReducedMotion ? "auto" : "smooth",
      }}
    >
      <ParticleField />
      {/* ─── HEADER ─── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "color-mix(in srgb, var(--m-surface-solid) 75%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(16px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px) saturate(180%)" : "none",
          borderBottom: scrolled ? "1px solid color-mix(in srgb, var(--m-border) 40%, transparent)" : "1px solid transparent",
          boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.05)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl overflow-hidden shadow-sm shrink-0 flex items-center justify-center bg-white/10 dark:bg-black/10">
              <img src="/logo.png" alt="Dream It Logo" className="w-full h-full object-contain object-center scale-[1.15]" />
            </div>
            <span
              className="font-[Roboto_Slab] text-xl font-bold tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Dream It
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium transition-all duration-200"
                style={{
                  color: "var(--m-text-sub)",
                  textDecoration: "underline",
                  textDecorationColor: "transparent",
                  textUnderlineOffset: "3px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "var(--m-primary)";
                  e.currentTarget.style.textDecorationColor = "var(--m-primary)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--m-text-sub)";
                  e.currentTarget.style.textDecorationColor = "transparent";
                }}
              >
                {link.name}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => setIsThemeSelectorOpen(true)}
              className="p-2 rounded-xl transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: "var(--m-surface-alt)",
                color: "var(--m-text-sub)",
                border: "1px solid var(--m-border-light)",
              }}
              title="Change Theme"
            >
              <Palette size={18} />
            </button>
            <button
              onClick={onGetStarted}
              className="group relative overflow-hidden rounded-full px-6 py-2.5 text-sm font-bold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center justify-center"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text)",
                outlineColor: "var(--m-primary)",
                boxShadow: "0 4px 14px 0 color-mix(in srgb, var(--m-primary) 40%, transparent)",
              }}
              onMouseOver={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px 0 color-mix(in srgb, var(--m-primary) 60%, transparent)";
              }}
              onMouseOut={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px 0 color-mix(in srgb, var(--m-primary) 40%, transparent)";
              }}
              onMouseDown={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.transform = "scale(0.96) translateY(0)";
              }}
              onMouseUp={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
              <span className="relative z-10 flex items-center gap-1.5">
                Get Started
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          </div>

          <button
            className="md:hidden p-2 rounded-md focus:outline-none focus-visible:ring-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            style={{ color: "var(--m-text-heading)", outlineColor: "var(--m-primary)" }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className="md:hidden overflow-hidden transition-all duration-300"
          style={{
            maxHeight: mobileMenuOpen ? "400px" : "0",
            opacity: mobileMenuOpen ? 1 : 0,
            backgroundColor: "var(--m-surface-solid)",
            borderBottom: mobileMenuOpen ? "1px solid var(--m-border)" : "none",
          }}
        >
          <div className="flex flex-col px-6 py-4 gap-4">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={closeMobileMenu}
                className="text-base font-medium py-2"
                style={{ color: "var(--m-text-heading)" }}
              >
                {link.name}
              </a>
            ))}
            <button
              onClick={() => {
                closeMobileMenu();
                onGetStarted();
              }}
              className="group relative overflow-hidden rounded-full px-6 py-3 text-sm font-bold mt-2 w-full flex items-center justify-center transition-all duration-300"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
              <span className="relative z-10 flex items-center gap-2">
                Get Started
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-[-1]"
            onClick={closeMobileMenu}
            style={{ backgroundColor: "transparent" }}
          />
        )}
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 overflow-hidden flex flex-col items-center text-center">
        <div className="max-w-4xl mx-auto px-6 w-full relative z-10">
          <motion.div
            initial={prefersReducedMotion ? false : { y: 20, opacity: 0 }}
            animate={prefersReducedMotion ? false : { y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
            className="mb-12 relative inline-block"
          >
            <TypewriterHero reducedMotion={prefersReducedMotion} />
            
            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
              animate={prefersReducedMotion ? false : { opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 1.0 }}
              className="absolute -bottom-6 md:-bottom-8 right-0 md:-right-4 font-[Roboto_Slab] text-xl md:text-3xl font-bold tracking-tight whitespace-nowrap"
              style={{ color: "var(--m-text-heading)" }}
            >
              - Agentic Ai
            </motion.p>
          </motion.div>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 1.2 }}
            className="font-[Roboto_Slab] text-xl md:text-3xl font-medium tracking-tight mb-6"
            style={{ color: "var(--m-text-sub)" }}
          >
            Plan it. Do it. Become it.
          </motion.p>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
            animate={prefersReducedMotion ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : 1.4 }}
            className="text-[1.125rem] leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ color: "var(--m-text-muted)" }}
          >
            An agentic AI study workspace that turns unstructured input — a pasted syllabus, meeting notes, a spoken passage — into scheduled, tracked, actionable work.
          </motion.p>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 1.6 }}
          >
            <button
              onClick={onGetStarted}
              className="rounded-full px-8 py-4 text-base font-bold inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text)",
                outlineColor: "var(--m-primary)",
                transition: prefersReducedMotion ? "none" : "all 200ms ease",
              }}
              onMouseOver={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.filter = "brightness(1.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px color-mix(in srgb, var(--m-primary) 25%, transparent)";
              }}
              onMouseOut={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.filter = "none";
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Start for free <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
          animate={prefersReducedMotion ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 1.8 }}
          className="mt-24 max-w-7xl w-full px-6 relative z-0"
          style={{ transform: prefersReducedMotion ? "none" : `translateY(${parallaxOffset}px)` }}
        >
          <div className="text-center mb-12 relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-6" 
                 style={{ backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)", color: "var(--m-primary)" }}>
              <Sparkles size={14} />
              <span>Productivity Reimagined</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6" 
                style={{ 
                  background: "linear-gradient(135deg, var(--m-text-heading) 0%, var(--m-primary) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "var(--m-text-heading)"
                }}>
              Awesome Task Management
            </h2>
            
            <p className="text-xl max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--m-text-muted)" }}>
              Organize your study schedule, track your daily streak, and let our AI prioritize your assignments so you can focus on learning.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)", boxShadow: "0 4px 12px -4px rgba(0,0,0,0.1)" }}>
                <CheckCircle2 size={16} style={{ color: "var(--m-primary)" }} />
                <span style={{ color: "var(--m-text)" }}>Smart Prioritization</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)", boxShadow: "0 4px 12px -4px rgba(0,0,0,0.1)" }}>
                <Clock size={16} style={{ color: "var(--m-primary)" }} />
                <span style={{ color: "var(--m-text)" }}>Time Blocking</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)", boxShadow: "0 4px 12px -4px rgba(0,0,0,0.1)" }}>
                <Layout size={16} style={{ color: "var(--m-primary)" }} />
                <span style={{ color: "var(--m-text)" }}>Drag & Drop Canvas</span>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl p-2 sm:p-4 md:p-8"
            style={{
              backgroundColor: "var(--m-surface)",
              border: "1px solid var(--m-border)",
              boxShadow: "0 24px 48px -12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              className="rounded-xl overflow-hidden h-[300px] md:h-[500px] relative"
              style={{ backgroundColor: "var(--m-bg)" }}
            >
              {/* Detailed Dashboard Mockup */}
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 p-4 md:p-6 h-full">
                {/* Sidebar mock */}
                <div
                  className="col-span-1 hidden md:flex flex-col gap-3 rounded-xl p-4"
                  style={{
                    background: "var(--m-surface-solid)",
                    border: "1px solid var(--m-border-light)",
                  }}
                >
                  {["Dashboard", "Tasks", "Schedule", "Notes", "Flashcards"].map((item, i) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
                      style={{
                        backgroundColor: i === 0 ? "color-mix(in srgb, var(--m-primary) 12%, transparent)" : "transparent",
                        color: i === 0 ? "var(--m-primary)" : "var(--m-text-muted)",
                      }}
                    >
                      <div
                        className="size-4 rounded"
                        style={{
                          backgroundColor: i === 0 ? "var(--m-primary)" : "var(--m-border-light)",
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
                      background: "var(--m-surface-solid)",
                      border: "1px solid var(--m-border-light)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="size-8 rounded-full"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                        }}
                      />
                      <div>
                        <div
                          className="h-2.5 w-24 rounded-full"
                          style={{ backgroundColor: "var(--m-text-heading)", opacity: 0.7 }}
                        />
                        <div
                          className="h-2 w-16 rounded-full mt-1.5"
                          style={{ backgroundColor: "var(--m-text-muted)", opacity: 0.4 }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="size-7 rounded-lg"
                          style={{ backgroundColor: "var(--m-border)", opacity: 0.5 }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {["Tasks Done", "Study Hours", "Streak", "Focus Score"].map((stat, i) => (
                      <div
                        key={stat}
                        className="rounded-xl p-3 md:p-4"
                        style={{
                          background: i === 0
                            ? "linear-gradient(135deg, var(--m-primary), color-mix(in srgb, var(--m-primary) 80%, #000))"
                            : "var(--m-surface-solid)",
                          border: i === 0 ? "none" : "1px solid var(--m-border-light)",
                          color: i === 0 ? "var(--m-primary-text)" : "var(--m-text)",
                        }}
                      >
                        <div className="text-[10px] font-medium opacity-70 uppercase tracking-wide">{stat}</div>
                        <div className="text-lg font-extrabold mt-1">{["12", "4.5h", "7🔥", "92%"][i]}</div>
                      </div>
                    ))}
                  </div>

                  {/* Chart placeholder */}
                  <div
                    className="flex-1 rounded-xl p-4 flex items-end gap-1.5 md:gap-2 mt-2"
                    style={{
                      background: "var(--m-surface-solid)",
                      border: "1px solid var(--m-border-light)",
                    }}
                  >
                    {[35, 55, 40, 70, 85, 60, 90, 50, 75, 65, 80, 95].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md transition-all duration-500"
                        style={{
                          height: `${h}%`,
                          backgroundColor: i === 11 ? "var(--m-primary)" : "color-mix(in srgb, var(--m-primary) 25%, transparent)",
                          opacity: 0.4 + (i / 12) * 0.6,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── AUTOPILOT (THE DIFFERENTIATOR) ─── */}
      <AnimatedSection id="autopilot" className="py-16 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimatedItem className="text-center mb-16">
            <h2
              className="font-[Roboto_Slab] text-[2rem] md:text-[3rem] font-bold mb-4 tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Autopilot
            </h2>
            <p
              className="text-[1.125rem] max-w-2xl mx-auto leading-relaxed"
              style={{ color: "var(--m-text-sub)" }}
            >
              A three-stage agentic engine that doesn't just parse text—it reasons, resolves conflicts, and executes transparently.
            </p>
          </AnimatedItem>

          <div className="flex flex-col lg:flex-row gap-6 mb-16 relative">
            {/* Stage A */}
            <AnimatedItem
              delay={0}
              className="flex-1 p-8 rounded-2xl relative z-10"
              style={{
                backgroundColor: "var(--m-surface)",
                border: "1px solid var(--m-border)",
              }}
            >
              <div className="text-[0.875rem] font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--m-primary)" }}>Stage A</div>
              <h3 className="font-[Roboto_Slab] text-[1.5rem] font-bold mb-4" style={{ color: "var(--m-text-heading)" }}>Extract</h3>
              <p className="text-[1rem] leading-relaxed mb-6" style={{ color: "var(--m-text-sub)" }}>
                Paste raw text. The agent extracts structured JSON with type, deadline, and a 0-1 confidence score.
              </p>
              <div className="p-4 rounded bg-[var(--m-bg)] border border-[var(--m-border-light)] font-mono text-xs opacity-70">
                {"{"} "title": "Read Chapter 4", "confidence": 0.95 {"}"}
              </div>
            </AnimatedItem>

            {/* Stage B */}
            <AnimatedItem
              delay={0.2}
              className="flex-1 p-8 rounded-2xl relative z-10"
              style={{
                backgroundColor: "var(--m-surface)",
                border: "1px solid var(--m-primary)",
                boxShadow: "0 8px 32px color-mix(in srgb, var(--m-primary) 10%, transparent)"
              }}
            >
              <div className="text-[0.875rem] font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--m-primary)" }}>Stage B</div>
              <h3 className="font-[Roboto_Slab] text-[1.5rem] font-bold mb-4" style={{ color: "var(--m-text-heading)" }}>Plan</h3>
              <p className="text-[1rem] leading-relaxed mb-6" style={{ color: "var(--m-text-sub)" }}>
                The orchestrator reads your workspace to decide context. It chooses between five explicit actions to reconcile against existing data.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['create_task', 'create_schedule', 'create_subject', 'flag_conflict', 'skip_duplicate'].map((action, i) => (
                  <AnimatedItem key={action} delay={0.3 + (i * 0.1)} className="text-[10px] font-mono p-2 rounded bg-[var(--m-bg)] border border-[var(--m-border-light)] text-center transition-all hover:-translate-y-[2px]" style={{ color: "var(--m-text)" }}>
                    {action}
                  </AnimatedItem>
                ))}
              </div>
            </AnimatedItem>

            {/* Stage C */}
            <AnimatedItem
              delay={0.4}
              className="flex-1 p-8 rounded-2xl relative z-10"
              style={{
                backgroundColor: "var(--m-surface)",
                border: "1px solid var(--m-border)",
              }}
            >
              <div className="text-[0.875rem] font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--m-primary)" }}>Stage C</div>
              <h3 className="font-[Roboto_Slab] text-[1.5rem] font-bold mb-4" style={{ color: "var(--m-text-heading)" }}>Execute</h3>
              <p className="text-[1rem] leading-relaxed mb-6" style={{ color: "var(--m-text-sub)" }}>
                Approved actions become real tasks, Calendar events, and Slack digests. You retain full control.
              </p>
              <div className="flex gap-2">
                <div className="size-8 rounded-full bg-[var(--m-bg)] border border-[var(--m-border-light)] flex items-center justify-center">
                  <Calendar size={14} style={{ color: "var(--m-primary)" }} />
                </div>
                <div className="size-8 rounded-full bg-[var(--m-bg)] border border-[var(--m-border-light)] flex items-center justify-center">
                  <MessageSquare size={14} style={{ color: "var(--m-primary)" }} />
                </div>
              </div>
            </AnimatedItem>
          </div>

          {/* Audit Trail Callout */}
          <AnimatedItem delay={0.6}>
            <div className="max-w-3xl mx-auto rounded-xl p-6 border-l-4" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-primary)", borderTop: "1px solid var(--m-border-light)", borderRight: "1px solid var(--m-border-light)", borderBottom: "1px solid var(--m-border-light)" }}>
              <h4 className="font-bold text-[1rem] mb-2" style={{ color: "var(--m-text-heading)" }}>Full Audit Trail</h4>
              <p className="text-[0.875rem] leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
                Every run is logged. The agent tells you exactly what it extracted, the plan it formed, and the success or failure of each action. Nothing happens invisibly.
              </p>
            </div>
          </AnimatedItem>
        </div>
      </AnimatedSection>

      {/* ─── WORKSPACE MODULES ─── */}
      <AnimatedSection id="workspace" className="py-16 md:py-24 px-6" style={{ backgroundColor: "var(--m-surface-solid)" }}>
        <div className="max-w-6xl mx-auto">
          <AnimatedItem className="mb-16">
            <h2
              className="font-[Roboto_Slab] text-[2rem] md:text-[3rem] font-bold mb-4 tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              The Workspace
            </h2>
            <p
              className="text-[1.125rem] max-w-2xl leading-relaxed"
              style={{ color: "var(--m-text-sub)" }}
            >
              8 integrated modules rendering real math via KaTeX + Markdown, seamlessly connected by your study coach.
            </p>
          </AnimatedItem>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "Today", icon: <Clock />, desc: "Your immediate daily priorities, filtered and focused." },
              { name: "Planner", icon: <Calendar />, desc: "Long-term scheduling synced directly with Google Calendar." },
              { name: "Projects", icon: <FolderOpen />, desc: "Complex assignments broken down into manageable sub-tasks." },
              { name: "Focus", icon: <Timer />, desc: "Pomodoro timer integrated with session analytics." },
              { name: "Notes", icon: <FileText />, desc: "Rich text with native KaTeX for mathematics." },
              { name: "Grades", icon: <Target />, desc: "Track performance against your academic targets." },
              { name: "Cards", icon: <BookOpen />, desc: "Spaced repetition flashcards generated from your notes." },
              { name: "Money", icon: <Wallet />, desc: "Student finance tracking, budgeting, and goal forecasting." },
            ].map((mod, i) => (
              <AnimatedItem key={mod.name} delay={i * 0.08}>
                <div
                  className="p-6 rounded-2xl h-full transition-all duration-250 cursor-default"
                  style={{
                    backgroundColor: "var(--m-bg)",
                    border: "1px solid var(--m-border)",
                  }}
                  onMouseOver={(e) => {
                    if (prefersReducedMotion) return;
                    e.currentTarget.style.borderColor = "var(--m-primary)";
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)";
                  }}
                  onMouseOut={(e) => {
                    if (prefersReducedMotion) return;
                    e.currentTarget.style.borderColor = "var(--m-border)";
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="mb-4" style={{ color: "var(--m-primary)" }}>{mod.icon}</div>
                  <h4 className="font-bold text-[1.125rem] mb-2" style={{ color: "var(--m-text-heading)" }}>{mod.name}</h4>
                  <p className="text-[0.875rem] leading-relaxed" style={{ color: "var(--m-text-sub)" }}>{mod.desc}</p>
                </div>
              </AnimatedItem>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ─── CADENCE ─── */}
      <AnimatedSection id="cadence" className="py-16 md:py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <AnimatedItem>
              <h2
                className="font-[Roboto_Slab] text-[2rem] md:text-[3rem] font-bold mb-4 tracking-tight"
                style={{ color: "var(--m-text-heading)" }}
              >
                Cadence Screening
              </h2>
              <p
                className="text-[1.125rem] leading-relaxed mb-8"
                style={{ color: "var(--m-text-sub)" }}
              >
                AI speech analysis that provides word-by-word articulation, rhythm, and pacing feedback based on clinical benchmarks.
              </p>
            </AnimatedItem>

            <div className="space-y-4">
              {[
                "Read aloud from 35 standard clinical passages",
                "Get instant word-level feedback",
                "Conversational AI coach discusses your report",
                "Explicit consent required before recording",
              ].map((text, i) => (
                <AnimatedItem key={i} delay={i * 0.12} className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="mt-1" style={{ color: "var(--m-primary)" }} />
                  <span className="text-[1rem] leading-relaxed" style={{ color: "var(--m-text)" }}>{text}</span>
                </AnimatedItem>
              ))}
            </div>

            <AnimatedItem delay={0.6} className="mt-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)", color: "var(--m-text-muted)" }}>
                <ShieldCheck size={16} style={{ color: "var(--success, #22c55e)" }} />
                <span className="text-xs font-medium">Audio is analyzed and discarded, never stored.</span>
              </div>
            </AnimatedItem>
          </div>

          <AnimatedItem delay={0.2} className="relative h-[300px] rounded-2xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
            {/* Minimal Waveform Visual */}
            <div className="flex items-center gap-1">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 rounded-full"
                  style={{ backgroundColor: "var(--m-primary)", opacity: 0.8 }}
                  initial={{ height: 10 }}
                  animate={prefersReducedMotion ? { height: 40 } : { height: [10, Math.random() * 80 + 20, 10] }}
                  transition={prefersReducedMotion ? {} : { duration: 1.5, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                />
              ))}
            </div>
          </AnimatedItem>
        </div>
      </AnimatedSection>

      {/* ─── FINANCE COACH ─── */}
      <AnimatedSection id="finance" className="py-16 md:py-24 px-6" style={{ backgroundColor: "var(--m-surface-solid)" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <AnimatedItem delay={0.2} className="order-2 md:order-1 relative h-[300px] rounded-2xl p-6 flex items-end justify-between" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border)" }}>
            {/* Abstract Chart */}
            {[40, 60, 45, 80, 65, 95].map((h, i) => (
              <AnimatedItem key={i} delay={i * 0.1} className="w-[12%] rounded-t-md" style={{ backgroundColor: "var(--m-primary)", height: `${h}%`, opacity: 0.8 }} />
            ))}
          </AnimatedItem>

          <div className="order-1 md:order-2">
            <AnimatedItem>
              <h2
                className="font-[Roboto_Slab] text-[2rem] md:text-[3rem] font-bold mb-4 tracking-tight"
                style={{ color: "var(--m-text-heading)" }}
              >
                Finance Coach
              </h2>
              <p
                className="text-[1.125rem] leading-relaxed mb-8"
                style={{ color: "var(--m-text-sub)" }}
              >
                Powered by gemma-4-31b-it, track your student finances with precision and voice input.
              </p>
            </AnimatedItem>
            <div className="space-y-4">
              {[
                "Real-time Net Worth & Savings Rate tracking",
                "Cash Flow Analytics & Income vs. Expense forecasting",
                "AI-powered Financial Health scoring",
                "Budgets, Simulator, and multi-account tracking",
                "Frictionless voice input for quick transaction entry",
              ].map((text, i) => (
                <AnimatedItem key={i} delay={i * 0.12} className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="mt-1" style={{ color: "var(--m-primary)" }} />
                  <span className="text-[1rem] leading-relaxed" style={{ color: "var(--m-text)" }}>{text}</span>
                </AnimatedItem>
              ))}
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ─── FREE FOREVER ─── */}
      <AnimatedSection className="py-32 px-6 relative overflow-hidden text-center">
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={prefersReducedMotion ? {} : { opacity: [0, 0.05, 0] }}
          transition={prefersReducedMotion ? {} : { duration: 3, repeat: Infinity }}
          style={{ background: "radial-gradient(circle at center, var(--m-primary) 0%, transparent 60%)" }}
        />
        <div className="max-w-3xl mx-auto relative z-10">
          <AnimatedItem>
            <h2 className="font-[Roboto_Slab] text-[4rem] md:text-[6rem] font-extrabold mb-4 leading-none" style={{ color: "var(--m-text-heading)" }}>
              ₹0 forever.
            </h2>
          </AnimatedItem>
          <AnimatedItem delay={0.3}>
            <p className="text-[1.125rem] md:text-[1.5rem] font-medium leading-relaxed mb-6" style={{ color: "var(--m-text-sub)" }}>
              No paywall, no tiers, no credit card, no trial.
            </p>
            <p className="text-[1rem] leading-relaxed max-w-2xl mx-auto" style={{ color: "var(--m-text-muted)" }}>
              How? Because Dream It utilizes the open-weight Gemma 4 model under Apache 2.0. Free is a permanent property of the product, not a promotion.
            </p>
          </AnimatedItem>
          
          <AnimatedItem delay={0.4} className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left max-w-4xl mx-auto">
             <div className="p-5 rounded-xl border" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
                <h4 className="font-bold text-lg mb-1" style={{ color: "var(--m-text-heading)" }}>8 Core Modules</h4>
                <p className="text-xs leading-relaxed" style={{ color: "var(--m-text-muted)" }}>Planner, Projects, Focus, Notes, Finance, and more.</p>
             </div>
             <div className="p-5 rounded-xl border" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
                <h4 className="font-bold text-lg mb-1" style={{ color: "var(--m-text-heading)" }}>3 Agent Stages</h4>
                <p className="text-xs leading-relaxed" style={{ color: "var(--m-text-muted)" }}>Extract, Plan, and Execute directly into your workspace.</p>
             </div>
             <div className="p-5 rounded-xl border" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
                <h4 className="font-bold text-lg mb-1" style={{ color: "var(--m-text-heading)" }}>35 Clinical Passages</h4>
                <p className="text-xs leading-relaxed" style={{ color: "var(--m-text-muted)" }}>Standardized speech screening modules for edge analysis.</p>
             </div>
             <div className="p-5 rounded-xl border" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
                <h4 className="font-bold text-lg mb-1" style={{ color: "var(--m-text-heading)" }}>5 Premium Themes</h4>
                <p className="text-xs leading-relaxed" style={{ color: "var(--m-text-muted)" }}>Switch UI aesthetics instantly without unlocking a paywall.</p>
             </div>
          </AnimatedItem>
        </div>
      </AnimatedSection>

      {/* ─── WHO IT'S FOR ─── */}
      <AnimatedSection className="py-16 md:py-24 px-6" style={{ backgroundColor: "var(--m-surface-solid)" }}>
        <div className="max-w-6xl mx-auto">
          <AnimatedItem className="text-center mb-16">
            <h2
              className="font-[Roboto_Slab] text-[2rem] md:text-[3rem] font-bold mb-4 tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Who it's for
            </h2>
          </AnimatedItem>

          <div className="grid md:grid-cols-3 gap-8">
            <AnimatedItem delay={0} className="p-8 rounded-2xl" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
              <h3 className="font-bold text-[1.25rem] mb-4" style={{ color: "var(--m-text-heading)" }}>Students</h3>
              <p className="text-[1rem] leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
                Organize chaotic syllabi, manage part-time job schedules alongside classes, and keep track of grades and finances in one coherent view without monthly fees.
              </p>
            </AnimatedItem>
            <AnimatedItem delay={0.15} className="p-8 rounded-2xl md:mt-8" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
              <h3 className="font-bold text-[1.25rem] mb-4" style={{ color: "var(--m-text-heading)" }}>Teachers</h3>
              <p className="text-[1rem] leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
                Plan course curriculums, organize lecture notes, and recommend an entirely free, privacy-first study workspace to your classes without requiring school budgets.
              </p>
            </AnimatedItem>
            <AnimatedItem delay={0.3} className="p-8 rounded-2xl" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
              <h3 className="font-bold text-[1.25rem] mb-4" style={{ color: "var(--m-text-heading)" }}>General Users</h3>
              <p className="text-[1rem] leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
                A robust tool for self-learners, independent researchers, and anyone needing disciplined, AI-assisted project and time management.
              </p>
            </AnimatedItem>
          </div>
        </div>
      </AnimatedSection>

      {/* ─── TECH STACK ─── */}
      <AnimatedSection className="py-16 md:py-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <AnimatedItem>
            <h2
              className="font-[Roboto_Slab] text-[2rem] md:text-[2.5rem] font-bold mb-4 tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              How it's built
            </h2>
            <p
              className="text-[1.125rem] leading-relaxed max-w-2xl mx-auto mb-12"
              style={{ color: "var(--m-text-muted)" }}
            >
              Powered by Gemma 4 and integrated with Gemini 3.6 Flash & Gemini 3.5 Flash Lite
            </p>
          </AnimatedItem>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            {['React 18', 'TypeScript', 'Vite 6', 'Tailwind CSS 4', 'shadcn/ui', 'Motion', 'KaTeX', 'Clerk', 'Supabase'].map((tech, i) => (
              <AnimatedItem key={tech} delay={i * 0.06}>
                <div className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)", color: "var(--m-text)" }}>
                  {tech}
                </div>
              </AnimatedItem>
            ))}
          </div>

          <AnimatedItem delay={0.5} className="flex flex-col md:flex-row justify-center gap-6">
            <div className="px-6 py-4 rounded-xl font-mono text-sm relative overflow-hidden" style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)", color: "var(--m-text-heading)" }}>
              gemini-3.6-flash
              <span className="block text-xs mt-1 font-[DM_Sans]" style={{ color: "var(--m-text-muted)" }}>Study Coach & Autopilot</span>
            </div>
            <div className="px-6 py-4 rounded-xl font-mono text-sm relative overflow-hidden" style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)", color: "var(--m-text-heading)" }}>
              gemma-4-31b-it
              <span className="block text-xs mt-1 font-[DM_Sans]" style={{ color: "var(--m-text-muted)" }}>Speech Coach</span>
            </div>
            <div className="px-6 py-4 rounded-xl font-mono text-sm relative overflow-hidden" style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)", color: "var(--m-text-heading)" }}>
              gemini-3.5-flash-lite
              <span className="block text-xs mt-1 font-[DM_Sans]" style={{ color: "var(--m-text-muted)" }}>Finance Coach</span>
            </div>
          </AnimatedItem>

          <AnimatedItem delay={0.6} className="mt-16 grid md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}>
              <div className="size-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border)" }}>
                <Cpu size={20} style={{ color: "var(--m-primary)" }} />
              </div>
              <h3 className="font-bold mb-2 text-lg" style={{ color: "var(--m-text-heading)" }}>Agentic Workflows</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--m-text-muted)" }}>
                The AI doesn't just chat; it autonomously extracts tasks, structures study plans, and executes calendar events on your behalf.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}>
              <div className="size-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border)" }}>
                <Mic size={20} style={{ color: "var(--m-primary)" }} />
              </div>
              <h3 className="font-bold mb-2 text-lg" style={{ color: "var(--m-text-heading)" }}>Local Audio Processing</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--m-text-muted)" }}>
                Voice notes in the Cadence module are transcribed and analyzed entirely on the edge. No audio files are ever stored on our servers.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}>
              <div className="size-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border)" }}>
                <FileText size={20} style={{ color: "var(--m-primary)" }} />
              </div>
              <h3 className="font-bold mb-2 text-lg" style={{ color: "var(--m-text-heading)" }}>Advanced Rendering</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--m-text-muted)" }}>
                Native KaTeX rendering handles complex math and chemistry formulas flawlessly, alongside robust Markdown support for all your structured notes.
              </p>
            </div>
          </AnimatedItem>
        </div>
      </AnimatedSection>

      {/* ─── PRIVACY & DATA ─── */}
      <AnimatedSection className="py-16 md:py-24 px-6" style={{ backgroundColor: "var(--m-surface-solid)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedItem className="flex justify-center mb-6">
            <motion.div
              animate={prefersReducedMotion ? {} : { y: [-3, 3, -3] }}
              transition={prefersReducedMotion ? {} : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="p-4 rounded-full"
              style={{ backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)", color: "var(--m-primary)" }}
            >
              <Shield size={32} />
            </motion.div>
          </AnimatedItem>

          <AnimatedItem>
            <h2
              className="font-[Roboto_Slab] text-[2rem] md:text-[2.5rem] font-bold mb-6 tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              Privacy in plain language
            </h2>
            <p
              className="text-[1.125rem] leading-relaxed mb-12"
              style={{ color: "var(--m-text-sub)" }}
            >
              Clerk holds your login credentials securely. Supabase stores your workspace data. Cadence audio is analyzed on the edge and instantly discarded. We train no models on your input.
            </p>
          </AnimatedItem>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm font-medium mb-16">
            <AnimatedItem delay={0.2} className="px-6 py-3 rounded-lg border" style={{ backgroundColor: "var(--m-bg)", borderColor: "var(--m-border)" }}>Clerk (Auth)</AnimatedItem>
            <AnimatedItem delay={0.3} className="hidden md:block" style={{ color: "var(--m-border)" }}><ArrowRight size={20} /></AnimatedItem>
            <AnimatedItem delay={0.4} className="px-6 py-3 rounded-lg border" style={{ backgroundColor: "var(--m-bg)", borderColor: "var(--m-border)" }}>Supabase (Database)</AnimatedItem>
            <AnimatedItem delay={0.5} className="hidden md:block" style={{ color: "var(--m-border)" }}><ArrowRight size={20} /></AnimatedItem>
            <AnimatedItem delay={0.6} className="px-6 py-3 rounded-lg border" style={{ backgroundColor: "var(--m-bg)", borderColor: "var(--m-primary)", color: "var(--m-primary)" }}>Discarded Audio</AnimatedItem>
          </div>

          <div className="grid md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
            <AnimatedItem delay={0.7} className="p-6 rounded-2xl" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border-light)" }}>
              <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: "var(--m-text-heading)" }}><ShieldCheck size={18} style={{ color: "var(--m-primary)" }} /> Data Ownership</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--m-text-muted)" }}>You own your data completely. Export your notes, projects, and flashcards at any time with a single click.</p>
            </AnimatedItem>
            <AnimatedItem delay={0.8} className="p-6 rounded-2xl" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border-light)" }}>
              <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: "var(--m-text-heading)" }}><X size={18} style={{ color: "var(--m-primary)" }} /> Zero Tracking</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--m-text-muted)" }}>No third-party trackers, no hidden analytics, and no advertising profiles. What you study is entirely your business.</p>
            </AnimatedItem>
          </div>
        </div>
      </AnimatedSection>

      {/* ─── FAQ ─── */}
      <AnimatedSection id="faq" className="py-16 md:py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <AnimatedItem className="mb-12 text-center">
            <h2
              className="font-[Roboto_Slab] text-[2rem] md:text-[3rem] font-bold tracking-tight"
              style={{ color: "var(--m-text-heading)" }}
            >
              FAQ's
            </h2>
          </AnimatedItem>

          <AnimatedItem delay={0.2} className="border-t" style={{ borderColor: "var(--m-border-light)" }}>
            <FaqItem
              question="Is it really free?"
              answer="Yes. Free is a permanent property of the product. By utilizing the open-weight Gemma 4 model under the Apache 2.0 license, we eliminate the high inference costs that usually force apps into subscription tiers."
            />
            <FaqItem
              question="What happens to my voice recording in Cadence?"
              answer="Audio is processed through the speech screening pipeline and then immediately discarded. It is never saved to the database or stored on the server."
            />
            <FaqItem
              question="Do I need a Google account for calendar sync?"
              answer="Yes. Currently, the execution stage relies on Google Calendar to schedule events and time-blocks. You will need to authenticate with Google to use the execution features fully."
            />
            <FaqItem
              question="Can a teacher use this for a class?"
              answer="Absolutely. Since there is no paywall or trial period, teachers can confidently direct students to use the workspace without worrying about exclusion due to cost."
            />
            <FaqItem
              question="What does the agent do without asking me?"
              answer="Nothing. Autopilot extracts and plans, but all actions remain in a pending state until you approve them. Furthermore, every action is recorded in the Audit Trail for complete transparency."
            />
            <FaqItem
              question="What if the AI extracts something wrong?"
              answer="You review the entire plan before execution. If the extracted deadline or priority is incorrect, you simply edit or discard the proposed action before it is written to your workspace."
            />
          </AnimatedItem>
        </div>
      </AnimatedSection>

      {/* ─── CTA ─── */}
      <AnimatedSection className="py-32 px-6 flex justify-center text-center">
        <div className="max-w-2xl">
          <AnimatedItem>
            <h2 className="font-[Roboto_Slab] text-[2.5rem] md:text-[4rem] font-bold mb-4 leading-tight tracking-tight" style={{ color: "var(--m-text-heading)" }}>
              Dream It.Build It.
            </h2>
            <p className="text-lg md:text-xl font-medium mb-10" style={{ color: "var(--m-text-muted)" }}>
              Start executing today. No credit card required, 100% free forever.
            </p>
            <button
              onClick={onGetStarted}
              className="group relative overflow-hidden rounded-full px-10 py-5 text-lg font-bold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center justify-center mx-auto"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text)",
                outlineColor: "var(--m-primary)",
                animation: prefersReducedMotion ? "none" : "pulse-glow 2s infinite ease-in-out",
              }}
              onMouseOver={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.transform = "scale(1.04)";
              }}
              onMouseOut={(e) => {
                if (prefersReducedMotion) return;
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
              <span className="relative z-10 flex items-center gap-2">
                Get Started
                <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1.5" />
              </span>
            </button>
            {!prefersReducedMotion && (
              <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes pulse-glow {
                  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--m-primary) 40%, transparent); }
                  70% { box-shadow: 0 0 0 15px color-mix(in srgb, var(--m-primary) 0%, transparent); }
                  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--m-primary) 0%, transparent); }
                }
              `}} />
            )}
          </AnimatedItem>
        </div>
      </AnimatedSection>

      {/* ─── FOOTER ─── */}
      <footer className="py-12 px-6 border-t" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-surface-solid)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Layout size={18} style={{ color: "var(--m-primary)" }} />
            <span className="font-[Roboto_Slab] font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>Dream It</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium">
            <a href="/privacy" className="hover:underline" style={{ color: "var(--m-text-sub)", textUnderlineOffset: "3px" }}>Privacy</a>
            <a href="/terms" className="hover:underline" style={{ color: "var(--m-text-sub)", textUnderlineOffset: "3px" }}>Terms</a>
            <a href="/contact" className="hover:underline text-sm font-medium" style={{ color: "var(--m-text-sub)", textUnderlineOffset: "3px" }}>Contact</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--m-text-sub)", textUnderlineOffset: "3px" }}>Source Code</a>
          </div>

          <div className="text-xs" style={{ color: "var(--m-text-muted)" }}>
            © {new Date().getFullYear()} Dream It. Free forever.
          </div>
        </div>
      </footer>

      {/* ─── THEME SELECTOR MODAL ─── */}
      <ThemeSelector
        isOpen={isThemeSelectorOpen}
        onClose={() => setIsThemeSelectorOpen(false)}
      />
    </div>
  );
}
