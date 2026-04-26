import { useLanguage } from '../app/providers/LanguageProvider';

export default function LoadingPage() {
  const { t } = useLanguage();

  return (
    <section className="page-card center-card">
      <h1>{t('Loading')}</h1>
      <p>{t('Please wait while the app prepares your session.')}</p>
    </section>
  );
}
