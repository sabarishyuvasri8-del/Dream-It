import { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Palette,
  ShieldCheck,
  Users,
  CheckCircle2,
  LoaderCircle,
  Lock,
  User,
} from "lucide-react";
import { useSignIn, useUser, useClerk } from "@clerk/clerk-react";
import { useTheme } from "../../lib/ThemeContext";
import ThemeSelector from "./ThemeSelector";
import { supabase } from "../../lib/supabase";

interface ParentLoginFormProps {
  onBack: () => void;
  onParentReady: (childUserId: string, childUsername: string) => void;
}

export default function ParentLoginForm({ onBack, onParentReady }: ParentLoginFormProps) {
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { signOut } = useClerk();
  const { isSignedIn, user } = useUser();
  const { themeConfig } = useTheme();

  const [childUsername, setChildUsername] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!childUsername.trim()) {
      setError("Please enter your child's username.");
      return;
    }
    if (!childPassword) {
      setError("Please enter your child's password.");
      return;
    }

    if (!isSignInLoaded) {
      setError("Authentication service is initializing. Please wait a moment.");
      return;
    }

    setLoading(true);

    try {
      // If currently signed in as another user, sign out first for clean verification
      if (isSignedIn) {
        await signOut();
      }

      // Authenticate with Clerk using the child's credentials
      const result = await signIn.create({
        identifier: childUsername.trim(),
        password: childPassword,
      });

      if (result.status === "complete") {
        // Resolve child's user ID
        let resolvedChildId = result.createdUserId || "";

        // If createdUserId isn't immediately provided, query user_profiles by username
        if (!resolvedChildId) {
          try {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("id")
              .eq("username", childUsername.trim())
              .maybeSingle();
            if (profile?.id) {
              resolvedChildId = profile.id;
            }
          } catch (lookupErr) {
            console.warn("Could not lookup profile:", lookupErr);
          }
        }

        // Set session storage flags so ParentDashboard is immediately loaded
        sessionStorage.setItem("parentMode", "true");
        sessionStorage.setItem("childUserId", resolvedChildId);
        sessionStorage.setItem("childUsername", childUsername.trim());

        // Activate the session in Clerk
        await setSignInActive({ session: result.createdSessionId });

        // Trigger callback
        onParentReady(resolvedChildId, childUsername.trim());
      } else {
        setError("Incomplete verification. Please check your child's credentials and try again.");
      }
    } catch (err: any) {
      console.error("Parent auth verification error:", err);
      let errorMsg = "Invalid username or password. Both must match your child's account.";

      if (err.errors && err.errors.length > 0) {
        const firstError = err.errors[0];
        if (
          firstError.code === "form_password_incorrect" ||
          firstError.code === "form_identifier_not_found" ||
          firstError.code === "strategy_for_user_invalid"
        ) {
          errorMsg = "Incorrect child username or password. Both credentials must be valid to access monitoring reports.";
        } else {
          errorMsg = err.errors.map((e: any) => e.longMessage || e.message).join(", ");
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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
          Back to Roles
        </button>
      </div>

      <div
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl lg:grid-cols-[0.95fr_1.05fr] minimal-surface"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          border: "1px solid var(--m-border)",
        }}
      >
        {/* Left Side Banner */}
        <section
          className="relative overflow-hidden p-8 md:p-10 flex flex-col justify-between transition-colors duration-500"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--m-primary) 92%, #000) 0%, color-mix(in srgb, var(--m-primary) 78%, #000) 100%)",
            color: "var(--m-primary-text)",
            borderRight: "1px solid var(--m-border-light)",
          }}
        >
          <div className="relative flex items-center gap-3">
            <div className="size-9 rounded-xl overflow-hidden shadow-sm shrink-0 flex items-center justify-center bg-white/10 dark:bg-black/10">
              <img src="/logo.png" alt="Dream It Logo" className="w-full h-full object-contain object-center scale-[1.15]" />
            </div>
            <span className="font-[Roboto_Slab] text-xl font-semibold tracking-tight">
              Dream It
            </span>
          </div>

          <div className="relative my-auto py-8">
            <h1 className="font-[Roboto_Slab] text-2xl font-semibold leading-tight md:text-3xl">
              Parental Monitoring Portal
            </h1>
            <p className="mt-4 text-sm leading-6 opacity-90">
              Enter your child's login credentials to securely access their complete activity reports. Both username and password are required to verify account ownership.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                "Full Schedule & Task Progress",
                "Complete Chat Transparency (All Messages)",
                "Full Finance & Budget Breakdown",
                "Grades, Subjects & Study Notes",
                "Focus Timer & Streak Analytics",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-xs opacity-95">
                  <CheckCircle2
                    size={15}
                    className="shrink-0"
                    style={{ color: "var(--m-accent)" }}
                  />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative flex items-center gap-2 text-xs opacity-85">
            <ShieldCheck size={15} style={{ color: "var(--m-accent)" }} />
            Encrypted Read-Only Parental Access
          </p>
        </section>

        {/* Right Side Form */}
        <section
          className="flex flex-col items-center justify-center p-6 md:p-10 transition-colors duration-500"
          style={{ background: "var(--m-surface-solid)" }}
        >
          <div className="w-full max-w-md flex flex-col items-center">
            {/* Header */}
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="grid size-9 place-items-center rounded-xl shadow-xs"
                  style={{
                    backgroundColor: "var(--m-primary)",
                    color: "var(--m-primary-text)",
                  }}
                >
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: "var(--m-text-heading)" }}>
                    Verify Child's Account
                  </h2>
                  <p className="text-[11px]" style={{ color: "var(--m-text-sub)" }}>
                    Enter both credentials to unlock reports
                  </p>
                </div>
              </div>

              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--m-primary) 12%, transparent)",
                  color: "var(--m-primary)",
                }}
              >
                Parent Mode
              </span>
            </div>

            {/* Instruction Banner */}
            <div
              className="w-full p-3.5 rounded-xl text-xs leading-relaxed mb-4"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 8%, transparent)",
                color: "var(--m-text-sub)",
                border: "1px solid color-mix(in srgb, var(--m-primary) 18%, transparent)",
              }}
            >
              <strong style={{ color: "var(--m-text-heading)" }}>Parent Security Check:</strong> Enter your child's Dream-It username and password. Once both are verified, you will be redirected to the dedicated Parent Monitoring Dashboard.
            </div>

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
              {/* Child Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                  <User size={13} style={{ color: "var(--m-primary)" }} />
                  Child's Username
                </label>
                <input
                  type="text"
                  value={childUsername}
                  onChange={(e) => setChildUsername(e.target.value)}
                  required
                  placeholder="e.g. child_username"
                  className="rounded-xl py-2.5 px-3.5 text-sm transition outline-none focus:ring-2 border"
                  style={{
                    backgroundColor: "transparent",
                    borderColor: "var(--m-border)",
                    color: "var(--m-text)",
                  }}
                />
              </div>

              {/* Child Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--m-text-heading)" }}>
                  <Lock size={13} style={{ color: "var(--m-primary)" }} />
                  Child's Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={childPassword}
                    onChange={(e) => setChildPassword(e.target.value)}
                    required
                    placeholder="Enter child's password"
                    className="w-full rounded-xl py-2.5 pl-3.5 pr-10 text-sm transition outline-none focus:ring-2 border"
                    style={{
                      backgroundColor: "transparent",
                      borderColor: "var(--m-border)",
                      color: "var(--m-text)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 opacity-60 hover:opacity-100 transition"
                    style={{ color: "var(--m-text)" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-xs font-semibold p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl py-3 text-sm font-bold transition hover:scale-[1.02] shadow-md mt-1 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
                style={{
                  backgroundColor: "var(--m-primary)",
                  color: "var(--m-primary-text)",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoaderCircle size={16} className="animate-spin" />
                    Verifying Child's Credentials...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ShieldCheck size={16} />
                    Verify Credentials & View Reports
                  </span>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Theme Selector Modal */}
      <ThemeSelector
        isOpen={themeSelectorOpen}
        onClose={() => setThemeSelectorOpen(false)}
      />
    </main>
  );
}
