import TutorialPageLayout from '../components/TutorialPageLayout';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function EquipmentPage() {
  usePageTitle('Equipment guide');
  const { language, t } = useLanguage();

  const text =
    language === 'zh'
      ? '装备指南。新手不需要一开始就把所有装备都买齐。优先考虑合身、安全、舒适，并理解每件装备在移动和保护中的作用。'
      : `
          Equipment guide.
          Beginners do not need to buy everything at once.
          The priority is safe fit, comfort, and understanding how each item supports movement and safety.
        `;

  return (
    <TutorialPageLayout currentId="equipment" text={text}>
      <div className="page-card stack-sm">
        <h2>{t('Important beginner equipment')}</h2>
        <ul className="clean-list">
          <li>{t('Climbing shoes help your feet stay stable on small holds.')}</li>
          <li>{t('Chalk can reduce sweat and improve grip.')}</li>
          <li>{t('A harness is used in rope climbing for safety support.')}</li>
          <li>{t('Belay equipment is used by trained staff or partners in rope climbing.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('Simple preparation tips')}</h2>
        <ul className="clean-list">
          <li>{t('Rental shoes are fine for your first session.')}</li>
          <li>{t('Wear comfortable sports clothing that allows movement.')}</li>
          <li>{t('Ask staff to check harness fit if you are unsure.')}</li>
          <li>{t('Do not focus on buying gear before learning the basics.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('Beginner reminder')}</h2>
        <p>{t('Safe fit and comfort matter more than advanced equipment when you are just starting.')}</p>
      </div>
    </TutorialPageLayout>
  );
}
