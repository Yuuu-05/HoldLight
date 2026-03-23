import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';
import { tutorialModules } from '../../../shared/constants/tutorial';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useTutorialProgress } from '../hooks/useTutorialProgress';

const JOURNEY_VIEWBOX = { width: 320, height: 110 };
const JOURNEY_PATH = 'M 16 82 C 52 28, 108 24, 150 56 S 210 88, 244 34';

type ModuleVisual = {
  bg: string;
  accent: string;
  shadow: string;
  shortSummaryZh: string;
  shortSummaryEn: string;
  bubbleZh: string;
  bubbleEn: string;
};

const encouragementPhrases = {
  zh: [
    '慢慢来，你已经在往上了。',
    '今天这一小步，也算数。',
    '呼吸一下，再往前一点点。',
    '你的节奏很稳，继续。',
  ],
  en: [
    'One calm move at a time.',
    'This small step still counts.',
    'Take a breath, then keep going.',
    'Your pace is steady. Keep climbing.',
  ],
  zhComplete: [
    '全部盖章完成，真不错。',
    '今天适合轻松复习一轮。',
    '路线走通了，我们再回看一遍。',
  ],
  enComplete: [
    'All stamps collected. Nice work.',
    'A calm review lap fits today.',
    'You finished the path. One light review is ready.',
  ],
};

const moduleVisuals: Record<string, ModuleVisual> = {
  rules: {
    bg: '#f4fbff',
    accent: '#4d82aa',
    shadow: 'rgba(77, 130, 170, 0.22)',
    shortSummaryZh: '看懂起点、终点和线路节奏。',
    shortSummaryEn: 'Read starts, finishes, and route rhythm.',
    bubbleZh: '今天先学会看懂路线吧！',
    bubbleEn: 'Today we learn how to read a route.',
  },
  equipment: {
    bg: '#f3fcf7',
    accent: '#4f8565',
    shadow: 'rgba(79, 133, 101, 0.22)',
    shortSummaryZh: '认识鞋子、安全带和基础装备。',
    shortSummaryEn: 'Meet shoes, harnesses, and core gear.',
    bubbleZh: '今天我们来认识安全带吧！',
    bubbleEn: 'Today we are meeting the harness.',
  },
  terms: {
    bg: '#fff9ee',
    accent: '#bb7b33',
    shadow: 'rgba(187, 123, 51, 0.22)',
    shortSummaryZh: '先记住 hold、route 和 grade。',
    shortSummaryEn: 'Start with hold, route, and grade.',
    bubbleZh: '今天来记住几个常用术语。',
    bubbleEn: 'Today we keep a few key terms.',
  },
  safety: {
    bg: '#fff8f1',
    accent: '#d66d49',
    shadow: 'rgba(214, 109, 73, 0.22)',
    shortSummaryZh: '学会热身、检查和及时停止。',
    shortSummaryEn: 'Warm up, check the zone, and stop early.',
    bubbleZh: '先把安全感装进背包里吧。',
    bubbleEn: 'Let’s pack safety first.',
  },
};

export default function TutorialHomePage() {
  const { completedIds, completedCount, completionRate, isComplete, nextModule, resetProgress } =
    useTutorialProgress();
  const { announce } = useAccessibility();
  const { language, t } = useLanguage();
  const { speak, repeat } = useSpeech();
  const pathRef = useRef<SVGPathElement | null>(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [mascotPoint, setMascotPoint] = useState({ x: 7.5, y: 74 });

  usePageTitle(t('New climber tutorials'));

  const localizedModules = useMemo(
    () =>
      tutorialModules.map((module, index) => ({
        ...module,
        order: index + 1,
        title: t(module.title),
        description: t(module.description),
      })),
    [t],
  );

  const nextIndex = useMemo(
    () => tutorialModules.findIndex((module) => module.id === nextModule.id),
    [nextModule.id],
  );

  const heroModule = useMemo(
    () => localizedModules.find((module) => module.id === nextModule.id) ?? localizedModules[0],
    [localizedModules, nextModule.id],
  );

  const heroVisual = moduleVisuals[heroModule.id];
  const bubbleText = useMemo(() => {
    const pool =
      language === 'zh'
        ? isComplete
          ? [heroVisual.bubbleZh, ...encouragementPhrases.zhComplete]
          : [heroVisual.bubbleZh, ...encouragementPhrases.zh]
        : isComplete
          ? [heroVisual.bubbleEn, ...encouragementPhrases.enComplete]
          : [heroVisual.bubbleEn, ...encouragementPhrases.en];

    const index = Math.min(completedCount, pool.length - 1);
    return pool[index];
  }, [completedCount, heroVisual.bubbleEn, heroVisual.bubbleZh, isComplete, language]);

  const copy = useMemo(
    () =>
      language === 'zh'
        ? {
            greeting: 'Hi, 准备好向上攀登了吗？',
            subtitle: isComplete
              ? `你已经完成 ${tutorialModules.length} / ${tutorialModules.length} 个模块，下一次可以轻松复习一遍。`
              : `你已经完成 ${completedCount} / ${tutorialModules.length} 个模块，下一步继续沿着路线往上走。`,
            heroTag: isComplete ? 'Review Path / 复习路径' : 'Next Step / 推荐学习',
            heroTitle: isComplete
              ? `复习起点：第 1 课 ${localizedModules[0]?.title ?? heroModule.title}`
              : `第 ${heroModule.order} 课：${heroModule.title}`,
            heroBody: isComplete
              ? '四个核心模块都已经盖章完成。回到 Basecamp，再轻松走一轮。'
              : heroVisual.shortSummaryZh,
            heroMeta: isComplete
              ? '点击进入复习'
              : `${heroModule.estimatedMinutes} 分钟轻学习`,
            heroAria: isComplete
              ? '你已完成全部教程模块，点击从第一课重新开始复习'
              : `推荐下一步：第 ${heroModule.order} 课 ${heroModule.title}，点击开始学习`,
            gridTitle: '四个核心模块',
            gridHint: '像收集卡一样，把每个主题轻轻点亮。',
            completedLabel: '已完成',
            activeLabel: '推荐下一步',
            futureLabel: '稍后学习',
            bubbleText,
            journeyLabel: `学习路线：从 Basecamp 到终点旗帜。当前已完成 ${completedCount} / ${tutorialModules.length} 个模块，进度 ${completionRate}%。`,
            utilityRepeat: '重复语音介绍',
            utilityReset: '重置学习进度',
            utilityAccess: '无障碍支持',
          }
        : {
            greeting: 'Hi, ready to climb upward?',
            subtitle: isComplete
              ? `You have completed ${tutorialModules.length} of ${tutorialModules.length} modules. A gentle review lap is ready.`
              : `You have completed ${completedCount} of ${tutorialModules.length} modules. The route keeps moving upward from here.`,
            heroTag: isComplete ? 'Review Path' : 'Next Step',
            heroTitle: isComplete
              ? `Review from basecamp: Lesson 1 ${localizedModules[0]?.title ?? heroModule.title}`
              : `Lesson ${heroModule.order}: ${heroModule.title}`,
            heroBody: isComplete
              ? 'All four core modules are stamped complete. Return to basecamp and take one calm review lap.'
              : heroVisual.shortSummaryEn,
            heroMeta: isComplete ? 'Tap to review' : `${heroModule.estimatedMinutes} min micro-lesson`,
            heroAria: isComplete
              ? 'All tutorial modules are complete. Click to review from lesson one.'
              : `Recommended next step: lesson ${heroModule.order}, ${heroModule.title}. Click to start learning.`,
            gridTitle: 'Core Modules',
            gridHint: 'Treat each lesson like a collectible card in one calm learning set.',
            completedLabel: 'Completed',
            activeLabel: 'Next step',
            futureLabel: 'Later',
            bubbleText,
            journeyLabel: `Learning route from basecamp to the finish flag. ${completedCount} of ${tutorialModules.length} modules completed. Progress ${completionRate} percent.`,
            utilityRepeat: 'Repeat voice intro',
            utilityReset: 'Reset progress',
            utilityAccess: 'Accessibility support',
          },
    [
      completedCount,
      completionRate,
      bubbleText,
      heroModule.order,
      heroModule.title,
      heroVisual.shortSummaryEn,
      heroVisual.shortSummaryZh,
      isComplete,
      language,
      localizedModules,
    ],
  );

  const moduleCards = useMemo(
    () =>
      localizedModules.map((module, index) => {
        const visual = moduleVisuals[module.id];
        const isCompleted = completedIds.includes(module.id);
        const isActive = !isComplete && module.id === nextModule.id;
        const isFuture = !isComplete && index > nextIndex;
        const statusText = isCompleted
          ? copy.completedLabel
          : isActive
            ? copy.activeLabel
            : copy.futureLabel;

        const ariaLabel =
          language === 'zh'
            ? `${module.title} 模块，${statusText}。${visual.shortSummaryZh}。点击进入学习。`
            : `${module.title} module, ${statusText}. ${visual.shortSummaryEn}. Click to open.`;

        return {
          ...module,
          isCompleted,
          isActive,
          isFuture,
          statusText,
          ariaLabel,
          visual,
          summary: language === 'zh' ? visual.shortSummaryZh : visual.shortSummaryEn,
          stampLabel: language === 'zh' ? '小猴子印章' : 'Monkey stamp',
        };
      }),
    [
      completedIds,
      copy.activeLabel,
      copy.completedLabel,
      copy.futureLabel,
      isComplete,
      language,
      localizedModules,
      nextIndex,
      nextModule.id,
    ],
  );

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setAnimatedProgress(completionRate);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [completionRate]);

  useEffect(() => {
    const pathNode = pathRef.current;
    if (!pathNode) {
      return;
    }

    const totalLength = pathNode.getTotalLength();
    const point = pathNode.getPointAtLength(totalLength * Math.min(animatedProgress, 100) / 100);

    setMascotPoint({
      x: (point.x / JOURNEY_VIEWBOX.width) * 100,
      y: (point.y / JOURNEY_VIEWBOX.height) * 100,
    });
  }, [animatedProgress]);

  useEffect(() => {
    const intro =
      language === 'zh'
        ? `${copy.greeting} 你已完成 ${completedCount} / ${tutorialModules.length} 个模块。推荐下一步是第 ${heroModule.order} 课，${heroModule.title}。`
        : `${copy.greeting} You have completed ${completedCount} of ${tutorialModules.length} modules. The recommended next step is lesson ${heroModule.order}, ${heroModule.title}.`;

    announce(intro);
    speak(intro);
  }, [announce, completedCount, copy.greeting, heroModule.order, heroModule.title, language, speak]);

  return (
    <section
      className="tutorial-home-shell"
      aria-labelledby="tutorial-home-title"
      aria-describedby="tutorial-home-description tutorial-home-journey-summary"
    >
      <div className="tutorial-home-intro">
        <div className="tutorial-home-copy">
          <p className="tutorial-home-kicker">
            {language === 'zh' ? 'Tutorial Journey' : 'Tutorial Journey'}
          </p>
          <h1 id="tutorial-home-title">{copy.greeting}</h1>
          <p id="tutorial-home-description">{copy.subtitle}</p>
        </div>

        <div className="tutorial-home-journey" aria-hidden="true">
          <svg
            viewBox={`0 0 ${JOURNEY_VIEWBOX.width} ${JOURNEY_VIEWBOX.height}`}
            className="tutorial-home-journey-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d={JOURNEY_PATH} className="tutorial-home-journey-track" pathLength={100} />
            <path
              ref={pathRef}
              d={JOURNEY_PATH}
              className="tutorial-home-journey-progress"
              pathLength={100}
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100 - animatedProgress,
              }}
            />
            <g transform="translate(4 72)">
              <BasecampIcon />
            </g>
            <g transform="translate(236 10)">
              <FlagIcon />
            </g>
          </svg>

          <div
            className={`tutorial-home-journey-mascot ${mascotPoint.x > 58 ? 'is-flipped' : ''}`.trim()}
            style={{
              left: `${mascotPoint.x}%`,
              top: `${mascotPoint.y}%`,
            }}
          >
            <div className="tutorial-home-journey-avatar">
              <GuideMascot pose={isComplete ? 'celebrate' : completedCount > 0 ? 'nod' : 'tilt'} />
            </div>
            <div className="tutorial-home-journey-bubble">{copy.bubbleText}</div>
          </div>
        </div>

        <p id="tutorial-home-journey-summary" className="sr-only">
          {copy.journeyLabel}
        </p>
      </div>

      <Link to={heroModule.route} className="tutorial-home-hero-card" aria-label={copy.heroAria}>
        <div className="tutorial-home-hero-copy">
          <span className="tutorial-home-hero-tag">{copy.heroTag}</span>
          <h2>{copy.heroTitle}</h2>
          <p>{copy.heroBody}</p>
          <div className="tutorial-home-hero-meta">
            <span>{copy.heroMeta}</span>
            <span>{language === 'zh' ? `已完成 ${completedCount}/${tutorialModules.length}` : `${completedCount}/${tutorialModules.length} complete`}</span>
          </div>
        </div>

        <div className="tutorial-home-hero-play" aria-hidden="true">
          <PlayIcon />
        </div>
      </Link>

      <div className="tutorial-home-grid-head">
        <div>
          <h2>{copy.gridTitle}</h2>
          <p>{copy.gridHint}</p>
        </div>
      </div>

      <section className="tutorial-home-module-grid" aria-label={copy.gridTitle}>
        {moduleCards.map((module) => {
          const cardStyle = {
            '--tutorial-module-bg': module.visual.bg,
            '--tutorial-module-accent': module.visual.accent,
            '--tutorial-module-shadow': module.visual.shadow,
          } as CSSProperties;

          return (
            <Link
                to={module.route}
                className={`tutorial-home-module-card ${module.isCompleted ? 'is-completed' : ''} ${
                  module.isActive ? 'is-active' : ''
                } ${module.isFuture ? 'is-future' : ''}`.trim()}
                style={cardStyle}
                aria-label={module.ariaLabel}
                aria-current={module.isActive ? 'step' : undefined}
              >
                <div className="tutorial-home-module-icon" aria-hidden="true">
                  <ModuleIcon moduleId={module.id} />
                </div>

                <div className="tutorial-home-module-copy">
                  <p className="tutorial-home-module-order">
                    {language === 'zh' ? `第 ${module.order} 课` : `Lesson ${module.order}`}
                  </p>
                  <h3>{module.title}</h3>
                  <p>{module.summary}</p>
                </div>

                <span className="tutorial-home-module-status">{module.statusText}</span>
                <span className="tutorial-home-module-duration">
                  {language === 'zh' ? `${module.estimatedMinutes} 分钟` : `${module.estimatedMinutes} min`}
                </span>

                {module.isCompleted ? (
                  <span className="tutorial-home-module-stamp" aria-hidden="true">
                    <ModuleStampIcon />
                  </span>
                ) : null}

              </Link>
          );
        })}
      </section>

      <div className="tutorial-home-tools" aria-label={language === 'zh' ? '学习工具' : 'Learning tools'}>
        <button type="button" className="tutorial-home-tool" onClick={repeat}>
          {copy.utilityRepeat}
        </button>
        <button type="button" className="tutorial-home-tool" onClick={resetProgress}>
          {copy.utilityReset}
        </button>
        <Link to={routes.accessibilityHub} className="tutorial-home-tool">
          {copy.utilityAccess}
        </Link>
      </div>
    </section>
  );
}

function ModuleIcon({ moduleId }: { moduleId: string }) {
  if (moduleId === 'rules') {
    return (
      <svg viewBox="0 0 64 64" className="tutorial-home-module-icon-svg">
        <path d="M 16 28 C 16 20, 21 16, 29 16 H 35 C 43 16, 48 20, 48 28 C 48 36, 43 40, 35 40 H 29 C 21 40, 16 36, 16 28 Z" fill="none" stroke="currentColor" strokeWidth="3.2" />
        <path d="M 26 40 L 24 50" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M 38 40 L 40 50" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M 29 24 H 35" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="31" cy="28" r="2.8" fill="currentColor" />
        <path d="M 44 20 C 49 22, 52 25, 54 30" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 46 26 C 50 28, 52 31, 53 35" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (moduleId === 'equipment') {
    return (
      <svg viewBox="0 0 64 64" className="tutorial-home-module-icon-svg">
        <path d="M 20 16 C 28 12, 36 12, 44 16 C 50 20, 52 28, 48 34 L 41 44 C 37 50, 27 50, 23 44 L 16 34 C 12 28, 14 20, 20 16 Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M 24 24 C 28 20, 36 20, 40 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M 24 38 C 28 42, 36 42, 40 38" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="32" cy="32" r="5" fill="currentColor" />
      </svg>
    );
  }

  if (moduleId === 'terms') {
    return (
      <svg viewBox="0 0 64 64" className="tutorial-home-module-icon-svg">
        <path d="M 12 18 H 34 C 40 18 44 22 44 28 V 30 C 44 36 40 40 34 40 H 24 L 16 48 V 40 H 12 C 6 40 2 36 2 30 V 28 C 2 22 6 18 12 18 Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M 28 28 H 52 C 58 28 62 32 62 38 V 40 C 62 46 58 50 52 50 H 44 V 56 L 36 50 H 28 C 22 50 18 46 18 40 V 38 C 18 32 22 28 28 28 Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
        <circle cx="22" cy="28" r="2.4" fill="currentColor" />
        <circle cx="36" cy="40" r="2.4" fill="currentColor" />
      </svg>
    );
  }

  return (
      <svg viewBox="0 0 64 64" className="tutorial-home-module-icon-svg">
      <path d="M 32 10 C 27 16, 21 18, 16 22 V 34 C 16 45, 23 52, 32 56 C 41 52, 48 45, 48 34 V 22 C 43 18, 37 16, 32 10 Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M 18 31 C 22 27, 27 27, 30 31" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M 34 31 C 37 27, 42 27, 46 31" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M 24 37 C 27 43, 37 43, 40 37" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
  );
}

function ModuleStampIcon() {
  return (
    <svg viewBox="0 0 40 40" className="tutorial-home-module-stamp-icon" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="rgba(255, 255, 255, 0.96)" />
      <circle cx="14" cy="14" r="4" fill="#efb06e" />
      <circle cx="26" cy="14" r="4" fill="#efb06e" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#d87c4d" strokeWidth="2.2" />
      <path d="M 16 22 C 18 26, 22 26, 24 22" fill="none" stroke="#d87c4d" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 18 18 H 18.1" fill="none" stroke="#d87c4d" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M 22 18 H 22.1" fill="none" stroke="#d87c4d" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function BasecampIcon() {
  return (
    <svg viewBox="0 0 28 28" className="tutorial-home-journey-pin">
      <path d="M 4 22 L 10 12 L 16 22 Z" fill="#d99b62" />
      <path d="M 10 12 L 18 22 L 24 22 L 16 12 Z" fill="#f0c08a" />
      <path d="M 14 6 V 12" stroke="#7b5a3a" strokeWidth="2" strokeLinecap="round" />
      <path d="M 14 6 H 22 L 19 10 H 14 Z" fill="#ef8a57" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 28 28" className="tutorial-home-journey-pin">
      <path d="M 8 24 V 6" stroke="#7b5a3a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M 10 7 H 22 L 18 12 L 22 17 H 10 Z" fill="#ef8a57" />
      <circle cx="8" cy="24" r="3" fill="#d3a349" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tutorial-home-play-icon">
      <path d="M 8 6.5 L 18 12 L 8 17.5 Z" fill="currentColor" />
    </svg>
  );
}
