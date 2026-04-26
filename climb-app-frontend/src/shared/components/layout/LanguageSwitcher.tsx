import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="lang-switcher" aria-label={t('Language switcher')}>
      <button
        type="button"
        className={`lang-switcher-button ${language === 'zh' ? 'active' : ''}`}
        onClick={() => setLanguage('zh')}
        aria-label={t('Switch to Chinese')}
      >
        中
      </button>
      <button
        type="button"
        className={`lang-switcher-button ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        aria-label={t('Switch to English')}
      >
        {language === 'zh' ? '英' : 'EN'}
      </button>
    </div>
  );
}
