import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

export default function FirstLoginProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const wantsReplay = new URLSearchParams(location.search).has('mode');

  usePageTitle(t('Welcome guide'));

  if (!user) {
    return null;
  }

  return (
    <Navigate
      to={`${routes.dashboard}${wantsReplay ? '?guide=replay' : ''}`}
      replace
    />
  );
}
