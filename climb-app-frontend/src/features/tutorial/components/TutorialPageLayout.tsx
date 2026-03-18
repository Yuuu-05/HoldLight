import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import {
  getTutorialModule,
  getTutorialNeighbors,
  tutorialModules,
} from '../../../shared/constants/tutorial';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../../shared/constants/routes';
import Button from '../../../shared/components/ui/Button';
import ProgressChecklist from './ProgressChecklist';
import ReadAloudPanel from './ReadAloudPanel';

interface TutorialPageLayoutProps {
  currentId: string;
  text: string;
  children: React.ReactNode;
}

export default function TutorialPageLayout({
  currentId,
  text,
  children,
}: TutorialPageLayoutProps) {
  const module = getTutorialModule(currentId);
  const { previous, next, currentIndex, total } = getTutorialNeighbors(currentId);
  const { announce } = useAccessibility();
  const { speak } = useSpeech();
  const { language, t } = useLanguage();
  const localizedModule = useMemo(
    () =>
      module
        ? {
            ...module,
            title: t(module.title),
            description: t(module.description),
          }
        : null,
    [module, t],
  );
  const localizedPrevious = useMemo(
    () => (previous ? { ...previous, title: t(previous.title) } : null),
    [previous, t],
  );
  const localizedNext = useMemo(
    () => (next ? { ...next, title: t(next.title) } : null),
    [next, t],
  );
  const localizedModules = useMemo(
    () => tutorialModules.map((item) => ({ ...item, title: t(item.title) })),
    [t],
  );

  useEffect(() => {
    if (!localizedModule) {
      return;
    }

    const intro =
      language === 'zh'
        ? `${localizedModule.title}。第 ${currentIndex + 1} 步，共 ${total} 步。${localizedModule.description}`
        : `${localizedModule.title}. Step ${currentIndex + 1} of ${total}. ${localizedModule.description}`;
    announce(intro);
    speak(intro);
  }, [announce, currentIndex, language, localizedModule, speak, total]);

  if (!localizedModule) {
    return null;
  }

  return (
    <section className="page-card stack-lg" aria-labelledby={`${currentId}-title`}>
      <div className="stack-sm">
        <p className="subtle-text">{t('Beginner tutorial path')}</p>
        <h1 id={`${currentId}-title`}>{localizedModule.title}</h1>
        <p>{localizedModule.description}</p>
      </div>

      <div className="page-card stack-sm" role="status" aria-live="polite">
        <h2>{t('Current step')}</h2>
        <p>
          {language === 'zh'
            ? `第 ${currentIndex + 1} 步，共 ${total} 步。${t('Estimated time:')} ${localizedModule.estimatedMinutes} 分钟。`
            : `Step ${currentIndex + 1} of ${total}. ${t('Estimated time:')} ${localizedModule.estimatedMinutes} minutes.`}
        </p>
        <p>
          {localizedNext
            ? language === 'zh'
              ? `下一步推荐：${localizedNext.title}。`
              : `Next recommended step: ${localizedNext.title}.`
            : t('You are on the final tutorial module.')}
        </p>
      </div>

      <ReadAloudPanel text={text} />
      <ProgressChecklist currentId={currentId} />

      <div className="inline-actions wrap">
        <Link to={routes.tutorialHome}>
          <Button variant="ghost">{t('Back to tutorial hub')}</Button>
        </Link>
        {localizedPrevious ? (
          <Link to={localizedPrevious.route}>
            <Button variant="secondary">{t('Previous module')}</Button>
          </Link>
        ) : null}
        {localizedNext ? (
          <Link to={localizedNext.route}>
            <Button>{t('Next module')}</Button>
          </Link>
        ) : (
          <Link to={routes.dashboard}>
            <Button>{t('Finish and open dashboard')}</Button>
          </Link>
        )}
      </div>

      <div className="stack-md">{children}</div>

      <div className="page-card stack-sm">
        <h2>{t('Path overview')}</h2>
        <ul className="clean-list">
          {localizedModules.map((item, index) => (
            <li key={item.id}>
              {index + 1}. {item.title}
              {item.id === currentId ? (language === 'zh' ? '（当前页面）' : ' (current page)') : ''}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
