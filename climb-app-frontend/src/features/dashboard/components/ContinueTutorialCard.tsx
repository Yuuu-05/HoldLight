import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { useTutorialProgress } from '../../tutorial/hooks/useTutorialProgress';

export default function ContinueTutorialCard() {
  const { completedCount, completionRate, nextModule, isComplete } = useTutorialProgress();
  const { language, t } = useLanguage();

  return (
    <Card title={t('Continue tutorials')} className="continue-card dashboard-mini-card dashboard-mini-card-tutorial">
      <p>
        {isComplete
          ? t('You have completed the full beginner tutorial path.')
          : language === 'zh'
            ? `你已完成 ${completedCount} 个模块，继续学习 ${t(nextModule.title)}。`
            : `You completed ${completedCount} modules. Continue with ${t(nextModule.title)}.`}
      </p>
      <p className="subtle-text">{language === 'zh' ? `进度：${completionRate}%` : `Progress: ${completionRate}%`}</p>
      <Link to={isComplete ? routes.tutorialHome : nextModule.route}>
        <Button fullWidth>{isComplete ? t('Review tutorials') : t('Continue tutorial path')}</Button>
      </Link>
    </Card>
  );
}
