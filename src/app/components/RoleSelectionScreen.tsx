import { useState } from "react";
import { GraduationCap, BookOpen, Users, Sparkles, ArrowLeft, Palette } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext";
import ThemeSelector from "./ThemeSelector";

type UserRole = "student" | "teacher" | "parent" | "other";

interface RoleSelectionScreenProps {
  onSelectRole: (role: UserRole) => void;
  onBack: () => void;
}

const roles: { id: UserRole; label: string; description: string; icon: typeof GraduationCap }[] = [
  {
    id: "student",
    label: "Student",
    description: "Access your study workspace, tasks, and AI tools",
    icon: GraduationCap,
  },
  {
    id: "teacher",
    label: "Teacher",
    description: "Manage coursework, assignments, and track progress",
    icon: BookOpen,
  },
  {
    id: "parent",
    label: "Parent",
    description: "Monitor your child's progress, reports, and activity",
    icon: Users,
  },
  {
    id: "other",
    label: "Other",
    description: "Explore Dream-It as a general productivity platform",
    icon: Sparkles,
  },
];

export default function RoleSelectionScreen({ onSelectRole, onBack }: RoleSelectionScreenProps) {
  const [hoveredRole, setHoveredRole] = useState<UserRole | null>(null);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const { themeConfig } = useTheme();

  return (
    <main
      className={`dreamit-dash grid min-h-screen place-items-center p-4 sm:p-6 font-[DM_Sans] ${themeConfig.cssClass}`}
      style={{
        backgroundColor: "var(--m-bg)",
        color: "var(--m-text)",
      }}
    >
      {/* Top Floating Theme Switcher */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={() => setThemeSelectorOpen(true)}
          className="minimal-surface flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition hover:scale-105 shadow-md"
          style={{ color: "var(--m-text-heading)" }}
        >
          <Palette size={15} style={{ color: "var(--m-primary)" }} />
          <span>{themeConfig.name}</span>
          <span className="flex items-center gap-1 ml-1">
            {themeConfig.swatches.slice(0, 3).map((color, i) => (
              <span
                key={i}
                className="inline-block size-2.5 rounded-full shadow-xs"
                style={{ backgroundColor: color }}
              />
            ))}
          </span>
        </button>
      </div>

      {/* Back Button */}
      <div className="absolute top-5 left-5 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition hover:scale-105"
          style={{
            background: "var(--m-surface)",
            border: "1px solid var(--m-border)",
            color: "var(--m-text-heading)",
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="size-10 rounded-xl overflow-hidden shadow-sm shrink-0 flex items-center justify-center bg-white/10 dark:bg-black/10">
              <img src="/logo.png" alt="Dream It Logo" className="w-full h-full object-contain object-center scale-[1.15]" />
            </div>
            <span className="font-[Roboto_Slab] text-2xl font-semibold tracking-tight" style={{ color: "var(--m-text-heading)" }}>
              Dream It
            </span>
          </div>
          <h1
            className="font-[Roboto_Slab] text-xl sm:text-2xl font-bold"
            style={{ color: "var(--m-text-heading)" }}
          >
            How would you like to use Dream-It?
          </h1>
          <p className="text-sm" style={{ color: "var(--m-text-sub)" }}>
            Select your role to get started with the right experience
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          {roles.map((role) => {
            const Icon = role.icon;
            const isHovered = hoveredRole === role.id;
            const isParent = role.id === "parent";

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onSelectRole(role.id)}
                onMouseEnter={() => setHoveredRole(role.id)}
                onMouseLeave={() => setHoveredRole(null)}
                className="group relative flex flex-col items-center gap-3 rounded-2xl p-6 transition-all duration-300 text-center border"
                style={{
                  backgroundColor: isHovered
                    ? "color-mix(in srgb, var(--m-primary) 8%, var(--m-surface-solid))"
                    : "var(--m-surface-solid)",
                  borderColor: isHovered ? "var(--m-primary)" : "var(--m-border)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  boxShadow: isHovered
                    ? "0 12px 32px color-mix(in srgb, var(--m-primary) 15%, transparent)"
                    : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Parent Badge */}
                {isParent && (
                  <span
                    className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--m-accent) 15%, transparent)",
                      color: "var(--m-accent)",
                    }}
                  >
                    Monitoring
                  </span>
                )}

                {/* Icon */}
                <div
                  className="grid size-14 place-items-center rounded-2xl transition-all duration-300"
                  style={{
                    backgroundColor: isHovered
                      ? "var(--m-primary)"
                      : "color-mix(in srgb, var(--m-primary) 10%, transparent)",
                    color: isHovered ? "var(--m-primary-text)" : "var(--m-primary)",
                  }}
                >
                  <Icon size={26} />
                </div>

                {/* Label */}
                <span
                  className="text-base font-bold"
                  style={{ color: "var(--m-text-heading)" }}
                >
                  {role.label}
                </span>

                {/* Description */}
                <span
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--m-text-sub)" }}
                >
                  {role.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Selector Modal */}
      <ThemeSelector
        isOpen={themeSelectorOpen}
        onClose={() => setThemeSelectorOpen(false)}
      />
    </main>
  );
}
