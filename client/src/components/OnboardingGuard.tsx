import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

const PUBLIC_PATHS = ["/", "/search", "/swipe", "/property", "/auth", "/privacy", "/terms", "/buyers", "/sell", "/home-report", "/onboarding"];

export function useOnboardingGuard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    if (user.onboardingCompleted) return;

    const isPublic = PUBLIC_PATHS.some(p =>
      p === "/" ? location === "/" : location.startsWith(p)
    );
    if (isPublic) return;

    setLocation("/onboarding");
  }, [user, isAuthenticated, isLoading, location, setLocation]);
}
