import { Link } from 'react-router-dom';
import { useLanguage } from '../app/providers/LanguageProvider';
import { routes } from '../shared/constants/routes';

export default function NotFoundPage() {
  const { t } = useLanguage();

  return (
    <section className="page-card center-card">
      <h1>{t('Page not found')}</h1>
      <p>{t('The page you requested does not exist.')}</p>
      <Link className="text-link" to={routes.home}>{t('Go back home')}</Link>
    </section>
  );
}
