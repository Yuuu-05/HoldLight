import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function SkipToContent() {
  const { t } = useLanguage();

  return (
    <a className="skip-link" href="#main-content">
      {t('Skip to main content')}
    </a>
  );
}
