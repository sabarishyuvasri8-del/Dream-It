/**
 * monitoring.ts
 * Production observability & crash reporting for Dream-It using @sentry/react.
 * Automatically captures uncaught errors, network failures, AI timeouts, and user context.
 */

import * as Sentry from "@sentry/react";

let isMonitoringInitialized = false;

export function initMonitoring() {
  if (isMonitoringInitialized || typeof window === "undefined") return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isProduction = import.meta.env.PROD;

  if (dsn && dsn !== "your_sentry_dsn_here") {
    try {
      Sentry.init({
        dsn,
        environment: isProduction ? "production" : "development",
        release: "dream-it@1.0.0",
        // Capture 10% of performance transactions in production
        tracesSampleRate: isProduction ? 0.1 : 1.0,
        // Filter out benign or noisy extension errors
        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          "Non-Error promise rejection captured",
          "Network request failed",
        ],
        beforeSend(event) {
          // Sanitize any sensitive tokens or passwords
          if (event.request?.headers) {
            delete event.request.headers["Authorization"];
          }
          return event;
        },
      });
      isMonitoringInitialized = true;
      console.log("[Observability] Sentry error monitoring initialized.");
    } catch (e) {
      console.warn("[Observability] Could not initialize Sentry:", e);
    }
  } else {
    // In development or when no DSN is supplied, fallback to console observability
    console.log("[Observability] Sentry DSN not configured; running in local telemetry mode.");
    isMonitoringInitialized = true;
  }
}

/**
 * Capture an error with additional diagnostics and metadata
 */
export function captureException(error: unknown, context?: Record<string, any>) {
  if (!error) return;

  if (import.meta.env.DEV) {
    console.error("[Observability] Exception captured:", error, context);
  }

  if (Sentry.isInitialized()) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Record a breadcrumb trace for user actions, network calls, or AI requests
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
  level: Sentry.SeverityLevel = "info"
) {
  if (Sentry.isInitialized()) {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level,
    });
  }
}

/**
 * Bind authenticated user context to error reports
 */
export function setUserContext(user: { id: string; username?: string; email?: string }) {
  if (Sentry.isInitialized()) {
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  }
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  if (Sentry.isInitialized()) {
    Sentry.setUser(null);
  }
}
