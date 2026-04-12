import { useLanguage } from '../app/providers/LanguageProvider';

export default function ForbiddenPage() {
  const { t } = useLanguage();

  return (
    <section className="page-card center-card">
      <h1>{t('Access restricted')}</h1>
      <p>{t('Your current role does not have access to this page.')}</p>
    </section>
  );
}
