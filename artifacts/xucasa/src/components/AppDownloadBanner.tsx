import { useState, useEffect } from "react";
import { X, Smartphone } from "lucide-react";

export function AppDownloadBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed recently (30 days)
    const dismissedAt = localStorage.getItem("xucasa_app_banner_dismissed");
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) return;
    }

    // Hide in Expo/Native webviews or standalone
    if (
      navigator.userAgent.includes("Expo") ||
      (window as any).ReactNativeWebView ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      (window.navigator as any).standalone
    ) {
      return;
    }

    // Only show on mobile browsers
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Show after 8 seconds
    const timer = setTimeout(() => setIsVisible(true), 8000);

    // Or after 300px scroll
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
        window.removeEventListener("scroll", handleScroll);
        clearTimeout(timer);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("xucasa_app_banner_dismissed", Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-card border-t border-border p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-full duration-500 pb-[env(safe-area-inset-bottom)]">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-2 text-muted-foreground hover:bg-muted rounded-full"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground flex-shrink-0 shadow-inner">
          <Smartphone className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm text-foreground">Get the xucasa app</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Faster search, instant notifications.</p>
        </div>
        <a 
          href="https://apps.apple.com/app/id0000000000"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-bold active:scale-95 transition-transform"
        >
          Open App
        </a>
      </div>
    </div>
  );
}
