import { useLanguage } from '../app/providers/LanguageProvider';

export default function ServerErrorPage() {
  const { t } = useLanguage();

  return (
    <section className="page-card center-card">
      <h1>{t('Something went wrong')}</h1>
      <p>{t('Try refreshing the page or returning to the dashboard.')}</p>
    </section>
  );
}
