import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, BookmarkPlus, Home, X, CheckCircle2, Loader2,
  RefreshCw, ShieldCheck,
} from "lucide-react";

interface AuthPromptModalProps {
  feature: "favorite" | "save-search" | "my-home";
  onClose: () => void;
}

const FEATURE_COPY = {
  favorite: {
    icon: Heart,
    headline: "Save homes you love",
    subtext: "Keep track of every property that catches your eye.",
  },
  "save-search": {
    icon: BookmarkPlus,
    headline: "Save this search",
    subtext: "Come back to exactly these filters whenever you want.",
  },
  "my-home": {
    icon: Home,
    headline: "Track your home",
    subtext: "Unlock zoning intelligence, flood data, and neighborhood insights.",
  },
};

const BENEFITS = [
  { icon: Heart,         label: "Favorite homes & revisit them anytime" },
  { icon: BookmarkPlus,  label: "Save searches with your exact filters" },
  { icon: Home,          label: "Track your own property's data" },
  { icon: ShieldCheck,   label: "Free account — no credit card needed" },
];

type Step = "wizard" | "waiting";

function openCenteredPopup(url: string, title: string, w: number, h: number) {
  const left = Math.max(0, (screen.width - w) / 2);
  const top = Math.max(0, (screen.height - h) / 2);
  return window.open(url, title, `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function AuthPromptModal({ feature, onClose }: AuthPromptModalProps) {
  const { icon: FeatureIcon, headline, subtext } = FEATURE_COPY[feature];
  const [step, setStep] = useState<Step>("wizard");
  const [authFailed, setAuthFailed] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startPolling = (popup: Window) => {
    timerRef.current = setInterval(async () => {
      if (popup.closed) {
        clearTimer();
        const res = await fetch("/api/auth/user");
        if (res.ok) {
          window.location.reload();
        } else {
          setStep("wizard");
          setAuthFailed(true);
        }
        return;
      }

      try {
        const href = popup.location.href;
        if (href && !href.includes("/api/") && href.includes(window.location.hostname)) {
          clearTimer();
          popup.close();
          window.location.reload();
        }
      } catch {
        // Still on OAuth provider (cross-origin)
      }
    }, 600);
  };

  const handleGoogleSignIn = () => {
    setAuthFailed(false);
    const popup = openCenteredPopup("/api/auth/google", "xucasa-auth", 520, 640);
    if (!popup) {
      window.location.href = "/api/auth/google";
      return;
    }
    popupRef.current = popup;
    setStep("waiting");
    startPolling(popup);
  };

  const handleResend = () => {
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    clearTimer();
    handleGoogleSignIn();
  };

  useEffect(() => () => clearTimer(), []);

  const handleClose = () => {
    clearTimer();
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    onClose();
  };

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (el) el.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
      return;
    }
    if (e.key === "Tab") {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />

      <div ref={dialogRef} className="relative bg-card rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden" tabIndex={-1}>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors z-20"
          data-testid="button-auth-prompt-close"
          aria-label="Close sign-in dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {step === "wizard" && (
          <>
            <div className="bg-primary/5 border-b border-border px-8 pt-8 pb-6 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FeatureIcon className="w-7 h-7 text-primary" />
              </div>
              <h2 id="auth-modal-title" className="font-display font-bold text-xl text-foreground">{headline}</h2>
              <p className="text-sm text-muted-foreground mt-1">{subtext}</p>
            </div>

            <div className="px-8 py-6 space-y-3">
              {authFailed && (
                <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
                  Sign-in window was closed. Try again whenever you're ready.
                </p>
              )}

              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Your free account includes
              </p>
              {BENEFITS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{label}</span>
                </div>
              ))}
            </div>

            <div className="px-8 pb-8 space-y-3">
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-border hover:border-primary/30 text-foreground py-3 rounded-xl font-semibold text-sm hover:shadow-md active:scale-[.98] transition-all"
                data-testid="button-auth-google"
              >
                <GoogleIcon className="w-5 h-5" />
                Continue with Google
              </button>
              <a
                href="/auth"
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline py-2"
                data-testid="link-auth-email"
              >
                Sign in with email
              </a>
              <button
                onClick={handleClose}
                className="w-full text-muted-foreground text-sm font-medium hover:text-foreground transition-colors py-2"
                data-testid="button-auth-prompt-dismiss"
              >
                Maybe later
              </button>
            </div>
          </>
        )}

        {step === "waiting" && (
          <div className="px-8 py-12 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="font-display font-bold text-lg text-foreground mb-2">
              Finish signing in
            </h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-xs mx-auto">
              Complete sign-in with Google in the window that just opened. This will update automatically once you're done.
            </p>
            <button
              onClick={handleResend}
              className="flex items-center gap-2 mx-auto text-sm font-bold text-primary hover:underline"
              data-testid="button-auth-reopen-popup"
            >
              <RefreshCw className="w-4 h-4" />
              Open sign-in window again
            </button>
            <button
              onClick={handleClose}
              className="block w-full text-muted-foreground text-sm font-medium hover:text-foreground transition-colors py-2 mt-6"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
