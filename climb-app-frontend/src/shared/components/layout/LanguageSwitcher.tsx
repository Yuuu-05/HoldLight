import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="lang-switcher" role="group" aria-label={t('Language switcher')}>
      <button
        type="button"
        className={`lang-switcher-button ${language === 'zh' ? 'active' : ''}`}
        onClick={() => setLanguage('zh')}
        aria-label={t('Switch to Chinese')}
        aria-pressed={language === 'zh'}
      >
        ZH
      </button>
      <button
        type="button"
        className={`lang-switcher-button ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        aria-label={t('Switch to English')}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
    </div>
  );
}
