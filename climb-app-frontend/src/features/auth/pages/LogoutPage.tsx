import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';

export default function LogoutPage() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    logout().finally(() => navigate(routes.home, { replace: true }));
  }, [logout, navigate]);

  return (
    <section className="page-card center-card">
      <h1>{t('Logging out')}</h1>
      <p>{t('Please wait...')}</p>
    </section>
  );
}
