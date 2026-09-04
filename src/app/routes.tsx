import { useState, useEffect, lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { useUser, useClerk, useSignIn, useSignUp, AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  LoaderCircle,
  Palette,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
const Dashboard = lazy(() => import("./Dashboard"));
const ParentDashboard = lazy(() => import("./ParentDashboard"));
import LandingPage from "./LandingPage";
import RoleSelectionScreen from "./components/RoleSelectionScreen";
import ParentLoginForm from "./components/ParentLoginForm";
import { useTheme } from "../lib/ThemeContext";
import ThemeSelector from "./components/ThemeSelector";
import { fetchParentLinks, upsertUserProfile } from "../lib/supabase";
const CadenceApp = lazy(() => import("./cadence/CadenceApp"));
const PrivacyPolicy = lazy(() => import("./PrivacyPolicy"));
const TermsOfService = lazy(() => import("./TermsOfService"));
const ContactPage = lazy(() => import("./ContactPage"));

function PageLoader() {
  return (
    <main
      className="grid min-h-screen place-items-center"
      style={{ backgroundColor: "var(--m-bg, #f6f4ee)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <LoaderCircle className="animate-spin text-[#315f48]" size={28} />
        <p className="text-xs text-[#56725d] font-medium">Loading...</p>
      </div>
    </main>
  );
}

/* ─────────────── Custom Auth Form ─────────────── */
function CustomAuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isSignInLoaded || !isSignUpLoaded) return;
    
    setLoading(true);
    try {
      if (mode === "signin") {
        const result = await signIn.create({ identifier: username, password });
        if (result.status === "complete") {
          await setSignInActive({ session: result.createdSessionId });
        } else {
          setError("Incomplete sign in. Please check your settings.");
        }
      } else {
        const result = await signUp.create({ username, password });
        if (result.status === "complete") {
          await setSignUpActive({ session: result.createdSessionId });
        } else {
          setError("Incomplete sign up. Please check your settings.");
        }
      }
    } catch (err: any) {
      console.error("Clerk Auth Error:", err);
      let errorMsg = "An error occurred";
      if (err.errors && err.errors.length > 0) {
        const firstError = err.errors[0];
        if (firstError.code === "form_identifier_exists") {
          errorMsg = "That username is already taken. Please choose a unique username.";
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
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--m-text-sub)" }}>
        <div className="flex-1 border-t" style={{ borderColor: "var(--m-border-light)" }}></div>
        <span>Sign in with your username</span>
        <div className="flex-1 border-t" style={{ borderColor: "var(--m-border-light)" }}></div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Unique username"
            className="rounded-xl py-2.5 px-3.5 text-sm transition outline-none focus:ring-2 border"
            style={{
              backgroundColor: "transparent",
              borderColor: "var(--m-border)",
              color: "var(--m-text)",
            }}
          />
        </div>
        
        <div className="flex flex-col gap-1.5 relative">
          <label className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Password</label>
          <div className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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

        {error && (
          <div className="text-xs font-semibold p-3 rounded-lg bg-red-500/10 text-red-500">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl py-3 text-sm font-bold transition hover:scale-[1.02] shadow-md mt-2 disabled:opacity-50 disabled:hover:scale-100"
          style={{
            backgroundColor: "var(--m-primary)",
            color: "var(--m-primary-text)",
          }}
        >
          {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Sign Up"}
        </button>
      </form>
    </div>
  );
}

/* ─────────────── Clerk Auth Screen ─────────────── */
function ClerkAuthCard({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      {/* Top Floating Theme Switcher Button */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={() => setThemeSelectorOpen(true)}
          className="minimal-surface flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition hover:scale-105 shadow-md"
          style={{
            color: "var(--m-text-heading)",
          }}
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

      {/* Back to Landing link */}
      {onBack && (
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
            ← Back
          </button>
        </div>
      )}

      <div
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl lg:grid-cols-[0.95fr_1.05fr] minimal-surface"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          border: "1px solid var(--m-border)",
        }}
      >
        {/* Left Side Banner (Theme Responsive) */}
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
              Your intelligent study workspace.
            </h1>
            <p className="mt-4 text-sm leading-6 opacity-90">
              AI-powered study companion with task management, focus timer,
              flashcards, grade tracking, and smart study planning — all synced
              to your personal account.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                "AI Study Companion & Tutor",
                "Flashcards & Notes Journal",
                "Pomodoro Focus Timer & Analytics",
                "Smart Deadline Planning",
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
            Secured with Clerk & Supabase Database
          </p>
        </section>

        {/* Right Side Clerk Form */}
        <section
          className="flex flex-col items-center justify-center p-6 md:p-10 transition-colors duration-500"
          style={{
            background: "var(--m-surface-solid)"
          }}
        >
          <div className="w-full max-w-md flex flex-col items-center">
            {/* Header & Tabs */}
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="grid size-8 place-items-center rounded-lg shadow-xs"
                  style={{
                    backgroundColor: "var(--m-primary)",
                    color: "var(--m-primary-text)",
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <span className="text-sm font-bold" style={{ color: "var(--m-text-heading)" }}>
                  {mode === "signin" ? "Sign In to Dream It" : "Create your Account"}
                </span>
              </div>
              <div
                className="flex rounded-lg p-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--m-surface-alt)",
                  border: "1px solid var(--m-border-light)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`rounded-md px-3 py-1.5 transition ${
                    mode === "signin"
                      ? "shadow-xs font-bold"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  style={
                    mode === "signin"
                      ? {
                          backgroundColor: "var(--m-surface-solid)",
                          color: "var(--m-primary)",
                        }
                      : { color: "var(--m-text-sub)" }
                  }
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-md px-3 py-1.5 transition ${
                    mode === "signup"
                      ? "shadow-xs font-bold"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  style={
                    mode === "signup"
                      ? {
                          backgroundColor: "var(--m-surface-solid)",
                          color: "var(--m-primary)",
                        }
                      : { color: "var(--m-text-sub)" }
                  }
                >
                  Sign Up
                </button>
              </div>
            </div>

            {/* Clerk Component Render */}
            <div className="w-full flex justify-center py-2">
              <CustomAuthForm mode={mode} />
            </div>
          </div>
        </section>
      </div>

      {/* ─── Theme Selector Modal ─── */}
      <ThemeSelector
        isOpen={themeSelectorOpen}
        onClose={() => setThemeSelectorOpen(false)}
      />
    </main>
  );
}

/* ─────────────── Root Component with Clerk Auth & Parental Control ─────────────── */
type AppScreen = "landing" | "role-select" | "auth" | "parent-auth" | "parent-dashboard";

function Root() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [isParentMode, setIsParentMode] = useState(false);
  const [childUserId, setChildUserId] = useState("");
  const [childUsername, setChildUsername] = useState("");
  const [parentCheckDone, setParentCheckDone] = useState(false);

  // Restore parent mode from session on reload
  useEffect(() => {
    const storedParent = sessionStorage.getItem("parentMode");
    const storedChildId = sessionStorage.getItem("childUserId");
    const storedChildName = sessionStorage.getItem("childUsername");
    if (storedParent === "true") {
      setIsParentMode(true);
      if (storedChildId) setChildUserId(storedChildId);
      if (storedChildName) setChildUsername(storedChildName);
    }
  }, []);

  // Check if signed-in user is a parent with existing links
  useEffect(() => {
    if (isSignedIn && user && !parentCheckDone) {
      const checkParent = async () => {
        // Upsert profile for the user
        await upsertUserProfile(user.id, user.username || user.firstName || "User", user.imageUrl);

        // If already in parent mode (from sessionStorage), skip check
        if (isParentMode) {
          setParentCheckDone(true);
          return;
        }

        // Check if user has parent links
        const links = await fetchParentLinks(user.id);
        if (links.length > 0) {
          // This is a returning parent
          setIsParentMode(true);
          setChildUserId(links[0].child_user_id);
          setChildUsername(links[0].child_username);
          sessionStorage.setItem("parentMode", "true");
          sessionStorage.setItem("childUserId", links[0].child_user_id);
          sessionStorage.setItem("childUsername", links[0].child_username);
        }
        setParentCheckDone(true);
      };
      checkParent();
    } else if (!isSignedIn) {
      setParentCheckDone(false);
    }
  }, [isSignedIn, user, parentCheckDone, isParentMode]);

  if (!isLoaded) {
    return <PageLoader />;
  }

  if (isSignedIn && user) {
    const activeParentMode = isParentMode || sessionStorage.getItem("parentMode") === "true";
    const activeChildId = childUserId || sessionStorage.getItem("childUserId") || user.id;
    const activeChildUsername = childUsername || sessionStorage.getItem("childUsername") || user.username || "Child";

    // Parent Mode → Show Parent Dashboard
    if (activeParentMode && activeChildId) {
      return (
        <Suspense fallback={<PageLoader />}>
          <ParentDashboard
            parentUserId={user.id}
            parentUsername="Parent"
            childUserId={activeChildId}
            childUsername={activeChildUsername}
            onSignOut={() => {
              setIsParentMode(false);
              setChildUserId("");
              setChildUsername("");
              sessionStorage.removeItem("parentMode");
              sessionStorage.removeItem("childUserId");
              sessionStorage.removeItem("childUsername");
              setScreen("landing");
              signOut();
            }}
          />
        </Suspense>
      );
    }

    // Normal User → Show Dashboard
    const userEmail = user.primaryEmailAddress?.emailAddress || "";
    const userName =
      user.fullName ||
      user.firstName ||
      user.username ||
      userEmail.split("@")[0] ||
      "Student";

    return (
      <Suspense fallback={<PageLoader />}>
        <Dashboard
          key={user.id}
          accessToken={user.id}
          userId={user.id}
          userEmail={userEmail}
          userName={userName}
          userImageUrl={user.imageUrl}
          onSignOut={() => signOut()}
        />
      </Suspense>
    );
  }

  // Not signed in → show Landing Page, Role Select, Auth Card, or Parent Auth
  switch (screen) {
    case "role-select":
      return (
        <RoleSelectionScreen
          onSelectRole={(role) => {
            if (role === "parent") {
              setScreen("parent-auth");
            } else {
              setScreen("auth");
            }
          }}
          onBack={() => setScreen("landing")}
        />
      );
    case "auth":
      return <ClerkAuthCard onBack={() => setScreen("role-select")} />;
    case "parent-auth":
      return (
        <ParentLoginForm
          onBack={() => setScreen("role-select")}
          onParentReady={(cUserId, cUsername) => {
            setIsParentMode(true);
            setChildUserId(cUserId);
            setChildUsername(cUsername);
            sessionStorage.setItem("parentMode", "true");
            sessionStorage.setItem("childUserId", cUserId);
            sessionStorage.setItem("childUsername", cUsername);
          }}
        />
      );
    default:
      return <LandingPage onGetStarted={() => setScreen("role-select")} />;
  }
}

/* ─────────────── Error Boundary Component ─────────────── */
function RouteErrorBoundary() {
  const { themeConfig } = useTheme();

  return (
    <main
      className={`grid min-h-screen place-items-center p-6 font-[DM_Sans] ${themeConfig.cssClass}`}
      style={{
        backgroundColor: "var(--m-bg)",
        color: "var(--m-text)",
      }}
    >
      <div
        className="minimal-surface max-w-md w-full rounded-3xl p-8 text-center space-y-4 shadow-2xl"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          border: "1px solid var(--m-border)",
        }}
      >
        <div
          className="mx-auto grid size-16 place-items-center rounded-2xl shadow-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--m-danger) 15%, transparent)",
            color: "var(--m-danger)",
          }}
        >
          <AlertTriangle size={32} />
        </div>

        <h1 className="font-[Roboto_Slab] text-2xl font-bold" style={{ color: "var(--m-text-heading)" }}>
          Something went wrong
        </h1>
        <p className="text-xs leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
          Dream It encountered an unexpected error. Your data is safely backed up in Supabase.
        </p>

        <div className="pt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl px-5 py-2.5 text-xs font-bold transition hover:scale-105 shadow-md"
            style={{
              backgroundColor: "var(--m-primary)",
              color: "var(--m-primary-text)",
            }}
          >
            Reload App
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              window.location.href = "/";
            }}
            className="rounded-xl px-5 py-2.5 text-xs font-bold border transition hover:opacity-80"
            style={{
              borderColor: "var(--m-border)",
              color: "var(--m-text-sub)",
            }}
          >
            Reset Cache
          </button>
        </div>
      </div>
    </main>
  );
}

// Wrap route components in Suspense
const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  { path: "/sso-callback", element: <AuthenticateWithRedirectCallback signUpForceRedirectUrl="/" signInForceRedirectUrl="/" /> },
  { path: "/cadence", element: withSuspense(CadenceApp) },
  { path: "/privacy", element: withSuspense(PrivacyPolicy) },
  { path: "/terms", element: withSuspense(TermsOfService) },
  { path: "/contact", element: withSuspense(ContactPage) },
  { path: "*", Component: Root, ErrorBoundary: RouteErrorBoundary },
]);
