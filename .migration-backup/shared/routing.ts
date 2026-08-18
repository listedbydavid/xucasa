export interface RoutableUser {
  onboardingCompleted?: boolean | null;
  currentMode?: string | null;
  primaryIntent?: string | null;
}

export function resolveUserDestination(user: RoutableUser | null | undefined): string {
  if (!user || !user.onboardingCompleted) return "/onboarding";
  const mode = user.currentMode || user.primaryIntent;
  if (mode === "buyer" || mode === "explorer") return "/swipe";
  if (mode === "homeowner") return "/home-report";
  if (mode === "agent") return "/agent";
  if (mode === "lender") return "/dashboard";
  return "/dashboard";
}
