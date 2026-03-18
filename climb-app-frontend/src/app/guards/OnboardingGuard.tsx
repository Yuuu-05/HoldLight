import { Navigate, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { routes } from '../../shared/constants/routes';

export default function OnboardingGuard({ children }: PropsWithChildren) {
  const { isAuthenticated, isOnboarded } = useAuth();
  const location = useLocation();
  if (isAuthenticated && !isOnboarded && location.pathname !== routes.onboarding) {
    return <Navigate to={routes.onboarding} replace />;
  }
  return <>{children}</>;
}
