import TutorialPageLayout from '../components/TutorialPageLayout';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function SafetyTipsPage() {
  usePageTitle('Safety tips');
  const { language, t } = useLanguage();

  const text =
    language === 'zh'
      ? '安全提示。对每位新手来说，安全都应该放在第一位。请先检查攀爬区域，听从工作人员指导，攀爬前充分热身；如果出现疼痛、恐惧或明显不适，请立刻停止。'
      : `
          Safety tips.
          Safety comes first for every beginner.
          Check the climbing area, follow staff guidance, warm up before climbing, and stop if you feel pain or fear.
        `;

  return (
    <TutorialPageLayout currentId="safety" text={text}>
      <div className="page-card stack-sm">
        <h2>{t('Before you start')}</h2>
        <ul className="clean-list">
          <li>{t('Warm up your hands, shoulders, and legs.')}</li>
          <li>{t('Check that the climbing area is clear and safe.')}</li>
          <li>{t('Wear suitable shoes and comfortable clothing.')}</li>
          <li>{t('Ask for help if you do not understand the route or equipment.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('During climbing')}</h2>
        <ul className="clean-list">
          <li>{t('Move slowly and keep three points of contact when possible.')}</li>
          <li>{t('Do not rush because speed can increase mistakes.')}</li>
          <li>{t('Listen to staff, volunteers, or guidance prompts carefully.')}</li>
          <li>{t('Stop immediately if you feel unsafe, dizzy, or in pain.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('Important reminder')}</h2>
        <p>{t('Climbing should feel controlled and supported. Safety is always more important than reaching the top quickly.')}</p>
      </div>
    </TutorialPageLayout>
  );
}
