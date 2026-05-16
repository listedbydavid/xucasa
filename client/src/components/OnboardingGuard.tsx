import { useAuth } from "@/hooks/use-auth";
import { usePreview } from "@/lib/preview-context";
import { Redirect } from "wouter";
import type { ComponentType } from "react";

export function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isPreviewActive } = usePreview();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/auth" />;
  }

  if (!isPreviewActive && !user.onboardingCompleted) {
    return <Redirect to="/onboarding" />;
  }

  return <Component />;
}

export function AuthOnlyRoute({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}
