import { Navigate, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useLanguage } from '../providers/LanguageProvider';
import { routes } from '../../shared/constants/routes';
import { getOnboardingStartRouteForUser } from '../../shared/utils/onboarding';

export default function ProtectedRoute({ children }: PropsWithChildren) {
  const { user, isAuthenticated, isOnboarded, loading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const allowOnboardingBypass = Boolean((location.state as { onboardingBypass?: boolean } | null)?.onboardingBypass);
  const isOnboardingPath = location.pathname.startsWith(routes.onboarding);

  if (loading) {
    return (
      <div className="page-shell">
        <p>{t('Loading account...')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={routes.login} replace state={{ from: location.pathname }} />;
  }

  if (!isOnboarded && !allowOnboardingBypass && !isOnboardingPath) {
    return <Navigate to={getOnboardingStartRouteForUser(user)} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
