import { useState, useEffect } from "react";
import { X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "xucasa-install-dismissed";
const DISMISS_DAYS = 30;

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOSSafari() || isStandalone()) return;

    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const diffDays = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < DISMISS_DAYS) return;
    }

    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] animate-in slide-in-from-bottom duration-500 safe-bottom"
      data-testid="install-prompt-banner"
    >
      <div className="bg-card border-t border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-md shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm text-foreground mb-1" data-testid="text-install-title">
                Add xucasa to your Home Screen
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5 flex-wrap">
                  <span>1. Tap the</span>
                  <Share className="w-3.5 h-3.5 inline-block text-foreground" aria-hidden="true" />
                  <span>Share button in Safari</span>
                </p>
                <p>2. Scroll down and tap <span className="font-medium text-foreground">Add to Home Screen</span></p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              data-testid="button-dismiss-install"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
