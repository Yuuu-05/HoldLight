import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="lang-switcher" aria-label="Language switcher">
      <button
        type="button"
        className={`lang-switcher-button ${language === 'zh' ? 'active' : ''}`}
        onClick={() => setLanguage('zh')}
      >
        中
      </button>
      <button
        type="button"
        className={`lang-switcher-button ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
    </div>
  );
}
