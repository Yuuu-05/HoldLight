import TutorialPageLayout from '../components/TutorialPageLayout';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function TermsPage() {
  usePageTitle('Climbing terms');
  const { language, t } = useLanguage();

  const text =
    language === 'zh'
      ? '攀岩术语。本页会介绍抓点、线路、难度等级、起始点、终点点位和保护等常见术语。理解这些词后，新手会更容易听懂指导并跟上流程。'
      : `
          Climbing terms.
          This page introduces important climbing words such as hold, route, grade, start hold, finish hold, and belay.
          Understanding these terms makes it easier for beginners to follow guidance and instructions.
        `;

  return (
    <TutorialPageLayout currentId="terms" text={text}>
      <div className="page-card stack-sm">
        <h2>{t('Key climbing words')}</h2>
        <ul className="clean-list">
          <li><strong>{t('Hold')}</strong>: {t('a grip or foothold on the wall.')}</li>
          <li><strong>{t('Route')}</strong>: {t('a planned climbing path.')}</li>
          <li><strong>{t('Grade')}</strong>: {t('the difficulty level of a route.')}</li>
          <li><strong>{t('Start hold')}</strong>: {t('where the climber begins.')}</li>
          <li><strong>{t('Finish hold')}</strong>: {t('where the route ends.')}</li>
          <li><strong>{t('Belay')}</strong>: {t('rope safety support used in rope climbing.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('Why these words matter')}</h2>
        <ul className="clean-list">
          <li>{t('They help you follow route instructions more clearly.')}</li>
          <li>{t('They make it easier to understand staff guidance.')}</li>
          <li>{t('They reduce confusion when learning a new wall.')}</li>
          <li>{t('They improve communication with volunteers and partners.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('Beginner reminder')}</h2>
        <p>{t('You do not need to memorise everything at once. Start with a few key words and learn more as you practise.')}</p>
      </div>
    </TutorialPageLayout>
  );
}
