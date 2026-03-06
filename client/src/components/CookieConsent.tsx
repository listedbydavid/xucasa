import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "xucasa-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-500"
      data-testid="cookie-consent-banner"
    >
      <div className="bg-card border-t border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                We use cookies to keep you logged in and remember your preferences.
                By continuing to use xucasa, you agree to our{" "}
                <Link
                  href="/privacy"
                  className="text-primary hover:underline font-medium"
                  data-testid="link-cookie-privacy"
                >
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link
                  href="/terms"
                  className="text-primary hover:underline font-medium"
                  data-testid="link-cookie-terms"
                >
                  Terms of Service
                </Link>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                onClick={accept}
                className="flex-1 sm:flex-none"
                data-testid="button-accept-cookies"
              >
                Accept
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismiss}
                aria-label="Dismiss cookie notice"
                data-testid="button-dismiss-cookies"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
