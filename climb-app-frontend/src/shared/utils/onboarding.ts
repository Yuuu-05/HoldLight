import { routes } from '../constants/routes';
import type { RoleValue } from '../constants/roles';
import type { User } from '../types/user';

function shouldUseVisionOnboarding(role?: RoleValue | null, accessibilitySetupCompleted = false) {
  return role === 'visually_impaired' && !accessibilitySetupCompleted;
}

export function getOnboardingStartRoute(role?: RoleValue | null, accessibilitySetupCompleted = false) {
  return shouldUseVisionOnboarding(role, accessibilitySetupCompleted)
    ? routes.onboardingVision
    : routes.dashboard;
}

export function getOnboardingStartRouteForUser(user: User | null | undefined) {
  return getOnboardingStartRoute(user?.role, Boolean(user?.preferences?.onboarding?.accessibilitySetupCompleted));
}

export function needsVisionModeSetup(user: User | null | undefined) {
  return shouldUseVisionOnboarding(user?.role, Boolean(user?.preferences?.onboarding?.accessibilitySetupCompleted));
}
