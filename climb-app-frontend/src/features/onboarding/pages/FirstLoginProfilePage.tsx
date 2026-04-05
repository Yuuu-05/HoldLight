import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

export default function FirstLoginProfilePage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();

  const isZh = language === 'zh';
  const wantsReplay = new URLSearchParams(location.search).has('mode');

  usePageTitle(isZh ? '新手引导' : 'Welcome guide');

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
