import { useState, useEffect, useRef } from "react";
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

export function AuthPromptModal({ feature, onClose }: AuthPromptModalProps) {
  const { icon: FeatureIcon, headline, subtext } = FEATURE_COPY[feature];
  const [step, setStep] = useState<Step>("wizard");
  const [authFailed, setAuthFailed] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // Poll for popup completion
  const startPolling = (popup: Window) => {
    timerRef.current = setInterval(async () => {
      // Popup was closed by the user without completing auth
      if (popup.closed) {
        clearTimer();
        // Check if auth succeeded anyway (e.g. they finished before closing)
        const res = await fetch("/api/auth/user");
        if (res.ok) {
          window.location.reload();
        } else {
          setStep("wizard");
          setAuthFailed(true);
        }
        return;
      }

      // Check if popup landed back on our domain (auth finished, redirected to "/")
      try {
        const href = popup.location.href;
        if (href && !href.includes("/api/") && href.includes(window.location.hostname)) {
          clearTimer();
          popup.close();
          window.location.reload();
        }
      } catch {
        // Still on the OAuth provider (cross-origin) — keep waiting
      }
    }, 600);
  };

  const handleSignIn = () => {
    setAuthFailed(false);
    const popup = openCenteredPopup("/api/login", "xucasa-auth", 520, 640);
    if (!popup) {
      // Popup blocked — fall back to redirect
      window.location.href = "/api/login";
      return;
    }
    popupRef.current = popup;
    setStep("waiting");
    startPolling(popup);
  };

  const handleResend = () => {
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    clearTimer();
    handleSignIn();
  };

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), []);

  const handleClose = () => {
    clearTimer();
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-card rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors z-20"
          data-testid="button-auth-prompt-close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── WIZARD STEP ── */}
        {step === "wizard" && (
          <>
            {/* Header band */}
            <div className="bg-primary/5 border-b border-border px-8 pt-8 pb-6 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FeatureIcon className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display font-bold text-xl text-foreground">{headline}</h2>
              <p className="text-sm text-muted-foreground mt-1">{subtext}</p>
            </div>

            {/* Benefits */}
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

            {/* CTA */}
            <div className="px-8 pb-8 space-y-3">
              <button
                onClick={handleSignIn}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-[.98] transition-all"
                data-testid="button-auth-prompt-login"
              >
                Create free account
              </button>
              <button
                onClick={handleClose}
                className="w-full text-muted-foreground text-sm font-medium hover:text-foreground transition-colors py-2"
                data-testid="button-auth-prompt-dismiss"
              >
                Maybe later
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button onClick={handleSignIn} className="text-primary font-bold hover:underline">
                  Sign in
                </button>
              </p>
            </div>
          </>
        )}

        {/* ── WAITING STEP ── */}
        {step === "waiting" && (
          <div className="px-8 py-12 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="font-display font-bold text-lg text-foreground mb-2">
              Finish signing in
            </h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-xs mx-auto">
              Complete sign-in in the window that just opened. This will update automatically once you're done.
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
