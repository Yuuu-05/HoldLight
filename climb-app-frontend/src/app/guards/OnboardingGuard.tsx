import { Navigate, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { routes } from '../../shared/constants/routes';
import { getOnboardingStartRouteForUser } from '../../shared/utils/onboarding';

export default function OnboardingGuard({ children }: PropsWithChildren) {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const location = useLocation();
  if (isAuthenticated && !isOnboarded && !location.pathname.startsWith(routes.onboarding)) {
    return <Navigate to={getOnboardingStartRouteForUser(user)} replace />;
  }
  return <>{children}</>;
}
