import TutorialPageLayout from '../components/TutorialPageLayout';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useLanguage } from '../../../app/providers/LanguageProvider';

export default function RulesPage() {
  usePageTitle('Climbing rules');
  const { language, t } = useLanguage();

  const text =
    language === 'zh'
      ? '攀岩规则。线路是岩墙上的既定攀爬路径。新手应先学会识别起始点和终点点位，并从更简单的线路开始，把注意力放在平衡、移动和控制上。'
      : `
          Climbing rules.
          A climbing route is a planned path on the wall.
          Beginners should learn how to identify start holds and finish holds.
          It is safer to begin with easier routes and focus on balance, movement, and control.
        `;

  return (
    <TutorialPageLayout currentId="rules" text={text}>
      <div className="page-card stack-sm">
        <h2>{t('Basic route structure')}</h2>
        <ul className="clean-list">
          <li>{t('A route is a planned path from the start to the finish.')}</li>
          <li>{t('The start hold is where the climber begins.')}</li>
          <li>{t('The finish hold marks the end of the route.')}</li>
          <li>{t('Follow the marked holds for the selected route.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('How beginners should start')}</h2>
        <ul className="clean-list">
          <li>{t('Choose easier routes first.')}</li>
          <li>{t('Move slowly and keep your body balanced.')}</li>
          <li>{t('Use your feet carefully instead of pulling only with your arms.')}</li>
          <li>{t('Stop and ask for help if you feel unsure.')}</li>
        </ul>
      </div>

      <div className="page-card stack-sm">
        <h2>{t('Beginner reminder')}</h2>
        <p>{t('The goal of your first sessions is not speed or height. Focus on understanding the wall, following the route, and moving safely.')}</p>
      </div>
    </TutorialPageLayout>
  );
}
