import { Link } from 'react-router-dom';
import SpeakButton from '../../../shared/components/accessibility/SpeakButton';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface TutorialCardProps {
  id: string;
  title: string;
  description: string;
  route: string;
  points: string[];
  readAloudText: string;
  estimatedMinutes: number;
  isCompleted?: boolean;
}

export default function TutorialCard({
  id,
  title,
  description,
  route,
  points,
  readAloudText,
  estimatedMinutes,
  isCompleted = false,
}: TutorialCardProps) {
  const { language, t } = useLanguage();
  const localizedTitle = t(title);
  const localizedDescription = t(description);
  const localizedPoints = points.map((point) => t(point));
  const localizedReadAloudText = t(readAloudText);

  return (
    <div role="article" aria-label={`${localizedTitle} tutorial card`}>
      <Card
        title={localizedTitle}
        className={`tutorial-module-card ${isCompleted ? 'tutorial-module-card-complete' : ''}`.trim()}
      >
        <div className="stack-md">
          <div className="stack-sm">
            <p>{localizedDescription}</p>
            <p className="subtle-text" aria-label={`Estimated time ${estimatedMinutes} minutes`}>
              {t('Estimated time:')} {language === 'zh' ? `${estimatedMinutes} 分钟` : `${estimatedMinutes} min`}
            </p>
            <p className="subtle-text" aria-live="polite">
              {t('Status:')} {isCompleted ? t('Completed') : t('Ready to start')}
            </p>
          </div>

          <ul className="clean-list" aria-label={`${localizedTitle} key points`}>
            {localizedPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <div className="stack-sm">
            <Link to={route} aria-label={`${t('Start learning')} ${localizedTitle}`}>
              <Button fullWidth>{isCompleted ? t('Review module') : t('Start learning')}</Button>
            </Link>

            <SpeakButton
              text={localizedReadAloudText}
              label={`${t('Read summary for')} ${localizedTitle}`}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
