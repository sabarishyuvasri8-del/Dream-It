import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { registerServiceWorker } from "./lib/pwa";
import { initMonitoring, captureException } from "./lib/monitoring";

// 1. Initialize production error tracking & telemetry
initMonitoring();

// 2. Polyfill Promise.withResolvers for older Chrome, Edge, and Safari versions
if (typeof Promise.withResolvers === "undefined") {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 3. Register / manage PWA Service Worker
registerServiceWorker();

// 4. Bulletproof Root Error Boundary preventing white screens
interface RootErrorBoundaryProps {
  children: React.ReactNode;
}
interface RootErrorBoundaryState {
  hasError: boolean;
  error?: any;
}

class RootErrorBoundary extends React.Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("[RootErrorBoundary] Caught uncaught application error:", error, errorInfo);
    captureException(error, { errorInfo, source: "RootErrorBoundary" });
  }

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) r.unregister();
        });
      }
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0B0F17",
            color: "#f8fafc",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              backgroundColor: "#161D2B",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "1.5rem",
              padding: "2rem",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(99,102,241,0.15)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
                color: "#818cf8",
                fontSize: "24px",
              }}
            >
              ✨
            </div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "0.5rem" }}>
              Welcome back to Dream-It
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              A temporary browser cache conflict occurred. Click below to refresh your study workspace.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "#6366f1",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleClearCacheAndReload}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: "#cbd5e1",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                Reset Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);