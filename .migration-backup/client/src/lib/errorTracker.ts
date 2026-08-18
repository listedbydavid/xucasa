type Breadcrumb = {
  type: "navigation" | "click" | "network" | "console";
  message: string;
  timestamp: number;
  data?: Record<string, any>;
};

const MAX_BREADCRUMBS = 30;
const REPORT_INTERVAL_MS = 2000;
const SESSION_KEY = "xc_error_session";

let breadcrumbs: Breadcrumb[] = [];
let pendingReports: any[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function getUserId(): string | null {
  try {
    const el = document.querySelector("[data-user-id]");
    return el?.getAttribute("data-user-id") || null;
  } catch {
    return null;
  }
}

function addBreadcrumb(crumb: Omit<Breadcrumb, "timestamp">) {
  breadcrumbs.push({ ...crumb, timestamp: Date.now() });
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS);
  }
}

function sendReport(report: any) {
  pendingReports.push(report);
  if (!flushTimer) {
    flushTimer = setTimeout(flushReports, REPORT_INTERVAL_MS);
  }
}

function flushReports() {
  flushTimer = null;
  while (pendingReports.length > 0) {
    const report = pendingReports.shift();
    if (!report) break;
    try {
      const body = JSON.stringify(report);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/error-reports", blob);
      } else {
        fetch("/api/error-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  }
}

function buildReport(type: string, message: string, stack?: string, componentStack?: string) {
  return {
    type,
    message: message.slice(0, 2000),
    stack: stack?.slice(0, 5000) || null,
    componentStack: componentStack?.slice(0, 3000) || null,
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: getUserId(),
    sessionId: getSessionId(),
    breadcrumbs: [...breadcrumbs],
    metadata: {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timestamp: new Date().toISOString(),
      online: navigator.onLine,
      memory: (performance as any).memory
        ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
          }
        : null,
    },
  };
}

export function reportError(error: Error, componentStack?: string) {
  const report = buildReport(
    "react_error",
    error.message,
    error.stack,
    componentStack
  );
  sendReport(report);
}

export function initErrorTracker() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("error", (event) => {
    if (!event.error) return;
    const report = buildReport("uncaught_error", event.error.message, event.error.stack);
    sendReport(report);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason instanceof Error
      ? event.reason.message
      : String(event.reason);
    const stack = event.reason instanceof Error ? event.reason.stack : undefined;
    const report = buildReport("unhandled_rejection", message, stack);
    sendReport(report);
  });

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    addBreadcrumb({ type: "navigation", message: `Navigate to ${args[2]}` });
    return originalPushState.apply(this, args);
  };

  window.addEventListener("popstate", () => {
    addBreadcrumb({ type: "navigation", message: `Back/Forward to ${window.location.pathname}` });
  });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    const testId = target.closest("[data-testid]")?.getAttribute("data-testid");
    const text = target.textContent?.slice(0, 50) || "";
    const tag = target.tagName.toLowerCase();
    addBreadcrumb({
      type: "click",
      message: testId
        ? `Click [${testId}]`
        : `Click <${tag}>${text ? ` "${text}"` : ""}`,
    });
  }, { capture: true, passive: true });

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = init?.method || "GET";
    return originalFetch.apply(this, [input, init]).then(
      (response) => {
        if (!response.ok && response.status >= 400) {
          addBreadcrumb({
            type: "network",
            message: `${method} ${url} → ${response.status}`,
          });
          if (response.status >= 500) {
            const report = buildReport("api_error", `${method} ${url} returned ${response.status}`);
            sendReport(report);
          }
        }
        return response;
      },
      (err) => {
        addBreadcrumb({
          type: "network",
          message: `${method} ${url} → FAILED: ${err.message}`,
        });
        throw err;
      }
    );
  };

  window.addEventListener("beforeunload", () => {
    if (pendingReports.length > 0) flushReports();
  });

  addBreadcrumb({ type: "navigation", message: `Page load: ${window.location.pathname}` });
}
