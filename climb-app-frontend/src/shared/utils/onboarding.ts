import { routes } from '../constants/routes';
import type { RoleValue } from '../constants/roles';
import type { User } from '../types/user';

export function getOnboardingStartRoute(_role?: RoleValue | null, _accessibilitySetupCompleted = false) {
  return routes.dashboard;
}

export function getOnboardingStartRouteForUser(user: User | null | undefined) {
  return getOnboardingStartRoute(user?.role, Boolean(user?.preferences?.onboarding?.accessibilitySetupCompleted));
}

export function needsVisionModeSetup(_user: User | null | undefined) {
  return false;
}
