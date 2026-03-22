import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

const PUBLIC_PATHS = ["/", "/search", "/swipe", "/property", "/auth", "/privacy", "/terms"];

export function useOnboardingGuard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_PATHS.some(p =>
      p === "/" ? location === "/" : location.startsWith(p)
    );
    if (isPublic) return;

    if (!isAuthenticated || !user) {
      setLocation("/auth");
      return;
    }

    const isOnboarding = location.startsWith("/onboarding");
    if (!user.onboardingCompleted && !isOnboarding) {
      setLocation("/onboarding");
      return;
    }
  }, [user, isAuthenticated, isLoading, location, setLocation]);
}
