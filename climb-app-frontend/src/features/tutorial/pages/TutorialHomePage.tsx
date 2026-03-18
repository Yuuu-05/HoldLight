import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { routes } from '../../../shared/constants/routes';
import { tutorialModules } from '../../../shared/constants/tutorial';
import MascotGuidePanel from '../../../shared/components/illustration/MascotGuidePanel';
import Button from '../../../shared/components/ui/Button';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import TutorialCard from '../components/TutorialCard';
import { useTutorialProgress } from '../hooks/useTutorialProgress';

export default function TutorialHomePage() {
  usePageTitle('New climber tutorials');
  const {
    completedIds,
    completedCount,
    completionRate,
    isComplete,
    nextModule,
    resetProgress,
  } = useTutorialProgress();
  const { announce } = useAccessibility();
  const { speak, repeat } = useSpeech();
  const { language, t } = useLanguage();

  const localizedModules = useMemo(
    () =>
      tutorialModules.map((module) => ({
        ...module,
        title: t(module.title),
        description: t(module.description),
        points: module.points.map((point) => t(point)),
      })),
    [t],
  );

  const localizedNextModule = useMemo(
    () => localizedModules.find((module) => module.id === nextModule.id) ?? localizedModules[0],
    [localizedModules, nextModule.id],
  );

  const mascotTips = useMemo(() => {
    if (isComplete) {
      return [
        { pose: 'celebrate' as const, message: t('You have completed the full beginner tutorial path.') },
        { pose: 'nod' as const, message: t('Finish the path first, then move on to assist and volunteer features.') },
      ];
    }

    return [
      { pose: completedCount > 0 ? 'nod' as const : 'tilt' as const, message: t('Learn one module at a time. You can use repeat whenever you want to hear the guidance again.') },
      { pose: 'tilt' as const, message: t('Finish the path first, then move on to assist and volunteer features.') },
    ];
  }, [completedCount, isComplete, t]);

  useEffect(() => {
    const intro =
      language === 'zh'
        ? `新手教程中心。你已完成 ${completedCount} / ${tutorialModules.length} 个模块。推荐先从 ${localizedModules[0].title} 开始。`
        : `New climber tutorial hub. ${completedCount} of ${tutorialModules.length} modules completed. The recommended first step is ${localizedModules[0].title}.`;

    announce(intro);
    speak(intro);
  }, [announce, completedCount, language, localizedModules, speak]);

  return (
    <section
      className="stack-lg tutorial-home-shell"
      aria-labelledby="tutorial-home-title"
      aria-describedby="tutorial-home-description tutorial-home-guidance"
    >
      <div className="page-card stack-lg tutorial-main-card">
        <div className="stack-sm">
          <p className="subtle-text">{t('Beginner-friendly climbing learning path')}</p>
          <h1 id="tutorial-home-title">{t('New climber tutorial hub')}</h1>
          <p id="tutorial-home-description">
            {t('Start with the basics before using climbing assistance features. This version keeps the path simple: begin with safety, continue in order, and resume from your latest progress.')}
          </p>
        </div>

        <MascotGuidePanel
          title={t('Guide mascot')}
          tips={mascotTips}
          className="sticker-card tutorial-guide-card mascot-guide-panel-compact"
        />

        <div className="page-card stack-sm tutorial-status-card" role="status" aria-live="polite">
          <h2>{t('Your progress')}</h2>
          <p>
            {language === 'zh'
              ? `已完成 ${completedCount} / ${tutorialModules.length} 个模块。进度：${completionRate}%。`
              : `Completed ${completedCount} of ${tutorialModules.length} modules. Progress: ${completionRate}%.`}
          </p>
          <p>
            {isComplete
              ? t('You have completed the full beginner tutorial path.')
              : language === 'zh'
                ? `下一推荐模块：${localizedNextModule.title}。`
                : `Next recommended module: ${localizedNextModule.title}.`}
          </p>
        </div>

        <div className="inline-actions wrap">
          <Link to={tutorialModules[0].route}>
            <Button>{t('Start recommended path')}</Button>
          </Link>
          <Link to={nextModule.route}>
            <Button variant="secondary">
              {isComplete ? t('Review tutorials again') : t('Continue where you left off')}
            </Button>
          </Link>
          <Button variant="ghost" onClick={repeat}>{t('Repeat tutorial intro')}</Button>
          <Button variant="ghost" onClick={resetProgress}>{t('Reset tutorial progress')}</Button>
          <Link to={routes.accessibilityHub}>
            <Button variant="ghost">{t('Open accessibility support')}</Button>
          </Link>
        </div>

        <div className="page-card stack-sm tutorial-guidance-card" role="note" aria-label="Tutorial page guidance">
          <h2>{t('Learning path')}</h2>
          <ul className="clean-list" id="tutorial-home-guidance">
            {localizedModules.map((module, index) => (
              <li key={module.id}>
                {language === 'zh'
                  ? `第${index + 1} 步：${module.title}${completedIds.includes(module.id) ? ' - 已完成' : ' - 尚未完成'}`
                  : `Step ${index + 1}: ${module.title}${completedIds.includes(module.id) ? ' - completed' : ' - not completed yet'}`}
              </li>
            ))}
          </ul>
        </div>

        <p className="subtle-text" aria-live="polite">
          {t('Each tutorial page includes read-aloud controls, saved progress, and a direct next-step button.')}
        </p>
      </div>

      <div className="grid-2 tutorial-module-grid" role="list" aria-label="Tutorial module list">
        {localizedModules.map((module, index) => (
          <div
            key={module.id}
            role="listitem"
            aria-label={`Tutorial module ${index + 1}: ${module.title}`}
          >
            <TutorialCard {...module} isCompleted={completedIds.includes(module.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
