import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';
import { getTutorialModule, getTutorialNeighbors } from '../../../shared/constants/tutorial';
import { useTutorialProgress } from '../hooks/useTutorialProgress';

type TutorialTheme = {
  shellTop: string;
  shellBottom: string;
  cardSurface: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  rope: string;
  ropeShadow: string;
};

export type TutorialStoryArt =
  | 'route'
  | 'check'
  | 'balance'
  | 'support'
  | 'harness'
  | 'shoes'
  | 'chalk'
  | 'gear'
  | 'terms'
  | 'grade'
  | 'warmup'
  | 'shield';

export interface TutorialStoryCard {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  art: TutorialStoryArt;
  artLabel: string;
  srText: string;
}

interface TutorialPageLayoutProps {
  currentId: string;
  cards: TutorialStoryCard[];
}

const tutorialThemeMap: Record<string, TutorialTheme> = {
  safety: {
    shellTop: '#fff8f1',
    shellBottom: '#ffe8df',
    cardSurface: 'rgba(255, 252, 248, 0.92)',
    accent: '#ea8e6f',
    accentStrong: '#d66d49',
    accentSoft: 'rgba(234, 142, 111, 0.18)',
    rope: '#d68164',
    ropeShadow: 'rgba(214, 109, 73, 0.22)',
  },
  rules: {
    shellTop: '#f4fbff',
    shellBottom: '#e1f0fb',
    cardSurface: 'rgba(251, 254, 255, 0.92)',
    accent: '#72a4c8',
    accentStrong: '#4d82aa',
    accentSoft: 'rgba(114, 164, 200, 0.18)',
    rope: '#6a93bd',
    ropeShadow: 'rgba(77, 130, 170, 0.22)',
  },
  equipment: {
    shellTop: '#f3fcf7',
    shellBottom: '#dff2e6',
    cardSurface: 'rgba(249, 255, 251, 0.92)',
    accent: '#78ab88',
    accentStrong: '#4f8565',
    accentSoft: 'rgba(120, 171, 136, 0.18)',
    rope: '#679677',
    ropeShadow: 'rgba(79, 133, 101, 0.22)',
  },
  terms: {
    shellTop: '#fff9ee',
    shellBottom: '#f6ead0',
    cardSurface: 'rgba(255, 252, 245, 0.92)',
    accent: '#d8a25c',
    accentStrong: '#bb7b33',
    accentSoft: 'rgba(216, 162, 92, 0.18)',
    rope: '#c78e4d',
    ropeShadow: 'rgba(187, 123, 51, 0.22)',
  },
};

export default function TutorialPageLayout({ currentId, cards }: TutorialPageLayoutProps) {
  const module = getTutorialModule(currentId);
  const { next, currentIndex: moduleIndex, total: totalModules } = getTutorialNeighbors(currentId);
  const { announce } = useAccessibility();
  const { speak, stop } = useSpeech();
  const { language, t } = useLanguage();
  const { completedIds, markCompleted } = useTutorialProgress();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showTermsNudge, setShowTermsNudge] = useState(false);

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

  const theme = tutorialThemeMap[currentId] ?? tutorialThemeMap.safety;
  const nextTitle = next ? t(next.title) : '';
  const activeCard = cards[currentCardIndex] ?? cards[0];
  const isLastCard = currentCardIndex === cards.length - 1;
  const isCompleted = completedIds.includes(currentId);

  const copy = useMemo(
    () =>
      language === 'zh'
        ? {
            backLabel: '返回教程中心',
            readLabel: '朗读当前卡片',
            stopLabel: '停止朗读',
            swipeHint: '左右滑动卡片，按自己的节奏学习。',
            keyboardHint: '也可以使用键盘左右方向键切换卡片。',
            moduleLabel: `模块 ${moduleIndex + 1} / ${totalModules}`,
            metaLabel: `${cards.length} 张卡片 · ${localizedModule?.estimatedMinutes ?? 0} 分钟`,
            cardCountLabel: `第 ${currentCardIndex + 1} 张 / 共 ${cards.length} 张`,
            regionLabel: localizedModule ? `${localizedModule.title} 横向教学卡片` : '教程卡片',
            srIntro: localizedModule
              ? `${localizedModule.title}。${localizedModule.description}。${cards.length} 张横向卡片。左右滑动卡片，按自己的节奏学习。也可以使用键盘左右方向键切换卡片。`
              : '',
            announceCard: (title: string) =>
              `第 ${currentCardIndex + 1} 张，共 ${cards.length} 张。${title}。`,
            ropeJumpLabel: (index: number, title: string) => `跳转到第 ${index + 1} 张卡片：${title}`,
            moduleSaved: '已完成本模块学习，可以继续下一步。',
            ctaLabel: nextTitle ? `完成学习，下一步：${nextTitle}` : '完成学习，获得 10 个攀岩力',
            ctaHint: nextTitle
              ? '按钮只会在最后一张卡片出现，完成这一课后继续前进。'
              : '四个核心模块都学完了，返回仪表板继续练习。',
            termsNudge: '继续滑到下一张',
          }
        : {
            backLabel: 'Back to tutorial hub',
            readLabel: 'Read the current card aloud',
            stopLabel: 'Stop reading',
            swipeHint: 'Swipe sideways and learn at your own pace.',
            keyboardHint: 'You can also use the left and right arrow keys.',
            moduleLabel: `Module ${moduleIndex + 1} / ${totalModules}`,
            metaLabel: `${cards.length} cards · ${localizedModule?.estimatedMinutes ?? 0} min`,
            cardCountLabel: `Card ${currentCardIndex + 1} of ${cards.length}`,
            regionLabel: localizedModule ? `${localizedModule.title} story cards` : 'Tutorial story cards',
            srIntro: localizedModule
              ? `${localizedModule.title}. ${localizedModule.description}. ${cards.length} horizontal cards. Swipe sideways and learn at your own pace. You can also use the left and right arrow keys.`
              : '',
            announceCard: (title: string) => `Card ${currentCardIndex + 1} of ${cards.length}. ${title}.`,
            ropeJumpLabel: (index: number, title: string) => `Jump to card ${index + 1}: ${title}`,
            moduleSaved: 'This module is marked complete and ready for the next step.',
            ctaLabel: nextTitle
              ? `Finish lesson, next: ${nextTitle}`
              : 'Complete lesson, earn 10 climbing points',
            ctaHint: nextTitle
              ? 'The primary action only appears on the final card so the flow stays focused.'
              : 'All four core modules are complete. Return to the dashboard for the next task.',
            termsNudge: 'Swipe to the next word',
          },
    [cards.length, currentCardIndex, language, localizedModule, moduleIndex, nextTitle, totalModules],
  );

  const readCurrentCard = useCallback(() => {
    if (!activeCard) {
      return;
    }

    stop();
    announce(copy.announceCard(activeCard.title));
    speak(activeCard.srText);
  }, [activeCard, announce, copy, speak, stop]);

  const stopCurrentReading = useCallback(() => {
    stop();
  }, [stop]);

  const shellStyle = useMemo(
    () =>
      ({
        '--tutorial-shell-top': theme.shellTop,
        '--tutorial-shell-bottom': theme.shellBottom,
        '--tutorial-card-surface': theme.cardSurface,
        '--tutorial-accent': theme.accent,
        '--tutorial-accent-strong': theme.accentStrong,
        '--tutorial-accent-soft': theme.accentSoft,
        '--tutorial-rope': theme.rope,
        '--tutorial-rope-shadow': theme.ropeShadow,
      }) as CSSProperties,
    [theme],
  );

  const scrollToCard = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const target = track.querySelector<HTMLElement>(`[data-card-index="${index}"]`);
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }, []);

  const handleTrackKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollToCard(Math.min(cards.length - 1, currentCardIndex + 1));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollToCard(Math.max(0, currentCardIndex - 1));
      }
    },
    [cards.length, currentCardIndex, scrollToCard],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const cardNodes = Array.from(track.querySelectorAll<HTMLElement>('[data-card-index]'));
    if (!cardNodes.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!mostVisible) {
          return;
        }

        const nextIndex = Number((mostVisible.target as HTMLElement).dataset.cardIndex ?? 0);
        if (Number.isFinite(nextIndex)) {
          setCurrentCardIndex(nextIndex);
        }
      },
      {
        root: track,
        threshold: [0.55, 0.8],
      },
    );

    cardNodes.forEach((cardNode) => observer.observe(cardNode));
    return () => observer.disconnect();
  }, [cards.length, currentId]);

  useEffect(() => {
    if (!activeCard) {
      return;
    }

    readCurrentCard();
  }, [activeCard, readCurrentCard]);

  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );

  useEffect(() => {
    if (isLastCard && !isCompleted) {
      markCompleted(currentId);
    }
  }, [currentId, isCompleted, isLastCard, markCompleted]);

  useEffect(() => {
    setShowTermsNudge(false);

    if (currentId !== 'terms' || isLastCard) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowTermsNudge(true);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentCardIndex, currentId, isLastCard]);

  if (!localizedModule || !activeCard) {
    return null;
  }

  return (
    <section
      className="tutorial-story-shell"
      style={shellStyle}
      aria-labelledby={`${currentId}-story-title`}
      aria-describedby={`${currentId}-story-intro`}
    >
      <p id={`${currentId}-story-intro`} className="sr-only">
        {copy.srIntro}
      </p>

      <header className="tutorial-story-header">
        <div className="tutorial-story-header-actions">
          <Link
            to={routes.tutorialHome}
            className="tutorial-story-icon-button"
            aria-label={copy.backLabel}
          >
            <BackIcon />
          </Link>

          <div className="tutorial-story-header-copy">
            <p className="tutorial-story-module-label">{copy.moduleLabel}</p>
            <h1 id={`${currentId}-story-title`}>{localizedModule.title}</h1>
            <div className="tutorial-story-meta">
              <span>{copy.metaLabel}</span>
              <span aria-live="polite">{copy.cardCountLabel}</span>
            </div>
          </div>

          <div className="tutorial-story-header-controls" aria-label={copy.readLabel}>
            <button
              type="button"
              className="tutorial-story-icon-button"
              aria-label={copy.readLabel}
              onClick={readCurrentCard}
            >
              <AudioIcon />
            </button>
            <button
              type="button"
              className="tutorial-story-icon-button tutorial-story-icon-button-ghost"
              aria-label={copy.stopLabel}
              onClick={stopCurrentReading}
            >
              <StopIcon />
            </button>
          </div>
        </div>

        <div className="tutorial-story-rope" aria-label={copy.cardCountLabel}>
          <div className="tutorial-story-rope-line" aria-hidden="true" />
          <div className="tutorial-story-rope-knots">
            {cards.map((card, index) => (
              <button
                key={card.id}
                type="button"
                className={`tutorial-story-knot ${index === currentCardIndex ? 'is-current' : ''} ${
                  index < currentCardIndex ? 'is-complete' : ''
                }`.trim()}
                onClick={() => scrollToCard(index)}
                aria-label={copy.ropeJumpLabel(index, card.title)}
                aria-current={index === currentCardIndex ? 'step' : undefined}
              />
            ))}
            <div
              className="tutorial-story-climber"
              style={{
                left:
                  cards.length === 1
                    ? '0%'
                    : `${(currentCardIndex / Math.max(cards.length - 1, 1)) * 100}%`,
              }}
              aria-hidden="true"
            >
              <RopeClimberIcon />
            </div>
          </div>
        </div>
      </header>

      <div className="tutorial-story-stage">
        <div
          ref={trackRef}
          className="tutorial-story-track"
          role="region"
          aria-label={copy.regionLabel}
          tabIndex={0}
          onKeyDown={handleTrackKeyDown}
        >
          {cards.map((card, index) => {
            const showNudge = currentId === 'terms' && currentCardIndex === index && showTermsNudge;
            const descriptionId = `${currentId}-${card.id}-description`;
            const srId = `${currentId}-${card.id}-sr`;

            return (
              <article
                key={card.id}
                data-card-index={index}
                className="tutorial-story-card"
                aria-labelledby={`${currentId}-${card.id}-title`}
                aria-describedby={`${descriptionId} ${srId}`}
              >
                <div className="tutorial-story-card-inner">
                  <p className="tutorial-story-eyebrow">{card.eyebrow}</p>

                  <TutorialStoryIllustration
                    art={card.art}
                    label={card.artLabel}
                    showTermsNudge={showNudge}
                    nudgeLabel={copy.termsNudge}
                  />

                  <div className="tutorial-story-card-copy">
                    <h2 id={`${currentId}-${card.id}-title`}>{card.title}</h2>
                    <p id={descriptionId}>{card.description}</p>
                    <span id={srId} className="sr-only">
                      {card.srText}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="tutorial-story-guidance">
          <p>{copy.swipeHint}</p>
          <p>{copy.keyboardHint}</p>
        </div>
      </div>

      <div
        className={`tutorial-story-footer ${isLastCard ? 'is-visible' : ''}`.trim()}
        aria-hidden={!isLastCard}
      >
        <div className="tutorial-story-footer-copy">
          <p className="tutorial-story-footer-status">{copy.moduleSaved}</p>
          <p>{copy.ctaHint}</p>
        </div>
        {isLastCard ? (
          <>
            <Link className="tutorial-story-cta" to={next ? next.route : routes.dashboard}>
              <span>{copy.ctaLabel}</span>
            </Link>
            <div className="tutorial-story-footer-mascot" aria-hidden="true">
              <GuideMascot pose="celebrate" />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function TutorialStoryIllustration({
  art,
  label,
  showTermsNudge,
  nudgeLabel,
}: {
  art: TutorialStoryArt;
  label: string;
  showTermsNudge: boolean;
  nudgeLabel: string;
}) {
  return (
    <div className="tutorial-story-art" aria-hidden="true">
      <div className={`tutorial-story-art-frame art-${art}`.trim()}>
        <svg viewBox="0 0 260 190" className="tutorial-story-art-svg" preserveAspectRatio="xMidYMid meet">
          <rect x="28" y="24" width="204" height="142" rx="30" fill="rgba(255, 255, 255, 0.68)" />
          <circle cx="74" cy="66" r="22" fill="var(--tutorial-accent-soft)" />
          <circle cx="196" cy="134" r="18" fill="var(--tutorial-accent-soft)" />

          {art === 'route' ? (
            <>
              <rect x="78" y="38" width="106" height="118" rx="20" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent)" strokeWidth="4" />
              <circle cx="100" cy="132" r="9" fill="var(--tutorial-accent-strong)" />
              <circle cx="114" cy="110" r="8" fill="var(--tutorial-accent)" />
              <circle cx="146" cy="94" r="8" fill="var(--tutorial-accent-strong)" />
              <circle cx="132" cy="68" r="8" fill="var(--tutorial-accent)" />
              <circle cx="164" cy="56" r="8" fill="var(--tutorial-accent-strong)" />
              <path d="M 100 132 C 108 116, 120 118, 128 102 C 136 86, 140 82, 148 76 C 156 70, 162 60, 164 56" fill="none" stroke="var(--tutorial-accent-strong)" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 10" />
              <path d="M 164 40 L 178 48 L 164 56 Z" fill="var(--tutorial-accent-strong)" />
            </>
          ) : null}

          {art === 'check' ? (
            <>
              <rect x="78" y="42" width="104" height="116" rx="22" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent)" strokeWidth="4" />
              <rect x="106" y="30" width="48" height="22" rx="11" fill="var(--tutorial-accent-strong)" />
              <path d="M 98 78 L 108 88 L 124 68" fill="none" stroke="var(--tutorial-accent-strong)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 98 108 L 108 118 L 124 98" fill="none" stroke="var(--tutorial-accent-strong)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 98 138 L 108 148 L 124 128" fill="none" stroke="var(--tutorial-accent-strong)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 136 78 H 164" stroke="var(--tutorial-accent)" strokeWidth="5" strokeLinecap="round" />
              <path d="M 136 108 H 168" stroke="var(--tutorial-accent)" strokeWidth="5" strokeLinecap="round" />
              <path d="M 136 138 H 160" stroke="var(--tutorial-accent)" strokeWidth="5" strokeLinecap="round" />
            </>
          ) : null}

          {art === 'balance' ? (
            <>
              <rect x="72" y="34" width="110" height="122" rx="26" fill="rgba(255, 255, 255, 0.84)" stroke="var(--tutorial-accent)" strokeWidth="4" />
              <circle cx="130" cy="66" r="12" fill="var(--tutorial-accent-strong)" />
              <path d="M 130 78 L 130 112" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 92 L 102 108" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 92 L 158 104" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 112 L 108 142" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 112 L 154 138" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <circle cx="98" cy="112" r="7" fill="var(--tutorial-accent)" />
              <circle cx="162" cy="108" r="7" fill="var(--tutorial-accent)" />
              <circle cx="108" cy="146" r="7" fill="var(--tutorial-accent)" />
            </>
          ) : null}

          {art === 'support' ? (
            <>
              <path d="M 80 56 H 158 C 172 56 182 66 182 80 V 96 C 182 110 172 120 158 120 H 120 L 102 138 V 120 H 80 C 66 120 56 110 56 96 V 80 C 56 66 66 56 80 56 Z" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent)" strokeWidth="4" />
              <circle cx="86" cy="88" r="7" fill="var(--tutorial-accent-strong)" />
              <circle cx="120" cy="88" r="7" fill="var(--tutorial-accent-strong)" />
              <circle cx="154" cy="88" r="7" fill="var(--tutorial-accent-strong)" />
              <path d="M 168 126 H 198 C 208 126 216 134 216 144 V 150 C 216 160 208 168 198 168 H 182 L 170 180 V 168 H 168 C 158 168 150 160 150 150 V 144 C 150 134 158 126 168 126 Z" fill="var(--tutorial-accent-soft)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
            </>
          ) : null}

          {art === 'harness' ? (
            <>
              <path d="M 94 68 H 166 C 176 68 184 76 184 86 V 94 C 184 104 176 112 166 112 H 94 C 84 112 76 104 76 94 V 86 C 76 76 84 68 94 68 Z" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent-strong)" strokeWidth="5" />
              <path d="M 104 112 L 90 146 C 88 152 92 158 98 158 H 120 C 126 158 130 152 128 146 L 120 112" fill="none" stroke="var(--tutorial-accent-strong)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 156 112 L 170 146 C 172 152 168 158 162 158 H 140 C 134 158 130 152 132 146 L 140 112" fill="none" stroke="var(--tutorial-accent-strong)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="118" y="82" width="24" height="18" rx="6" fill="var(--tutorial-accent)" />
            </>
          ) : null}

          {art === 'shoes' ? (
            <>
              <path d="M 78 120 C 96 98, 122 92, 144 96 C 154 98, 160 104, 166 114 C 170 122, 166 132, 156 134 L 82 134 C 72 134 70 128 78 120 Z" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
              <path d="M 116 88 C 134 66, 160 60, 182 64 C 192 66, 198 72, 204 82 C 208 90, 204 100, 194 102 L 120 102 C 110 102 108 96 116 88 Z" fill="var(--tutorial-accent-soft)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
              <path d="M 100 112 H 136" stroke="var(--tutorial-accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 8" />
              <path d="M 138 80 H 174" stroke="var(--tutorial-accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 8" />
            </>
          ) : null}

          {art === 'chalk' ? (
            <>
              <path d="M 100 72 H 160 C 168 72 174 78 174 86 V 136 C 174 146 166 154 156 154 H 104 C 94 154 86 146 86 136 V 86 C 86 78 92 72 100 72 Z" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
              <path d="M 98 72 C 102 54, 158 54, 162 72" fill="none" stroke="var(--tutorial-accent-strong)" strokeWidth="4" strokeLinecap="round" />
              <circle cx="108" cy="58" r="5" fill="var(--tutorial-accent-soft)" />
              <circle cx="130" cy="48" r="7" fill="var(--tutorial-accent-soft)" />
              <circle cx="154" cy="58" r="5" fill="var(--tutorial-accent-soft)" />
              <circle cx="130" cy="108" r="16" fill="var(--tutorial-accent-soft)" />
            </>
          ) : null}

          {art === 'gear' ? (
            <>
              <path d="M 76 54 H 184" stroke="var(--tutorial-accent-strong)" strokeWidth="5" strokeLinecap="round" />
              <path d="M 96 54 V 130" stroke="var(--tutorial-accent-strong)" strokeWidth="5" strokeLinecap="round" />
              <path d="M 164 54 V 130" stroke="var(--tutorial-accent-strong)" strokeWidth="5" strokeLinecap="round" />
              <path d="M 92 92 C 92 74, 112 66, 128 76 C 144 66, 164 74, 164 92 V 122 H 92 Z" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
              <rect x="114" y="126" width="32" height="22" rx="8" fill="var(--tutorial-accent-soft)" stroke="var(--tutorial-accent)" strokeWidth="4" />
            </>
          ) : null}

          {art === 'terms' ? (
            <>
              <rect x="64" y="58" width="58" height="40" rx="16" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent)" strokeWidth="4" />
              <rect x="102" y="100" width="64" height="42" rx="16" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
              <rect x="156" y="56" width="40" height="34" rx="14" fill="var(--tutorial-accent-soft)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
              <circle cx="92" cy="78" r="6" fill="var(--tutorial-accent-strong)" />
              <circle cx="126" cy="122" r="6" fill="var(--tutorial-accent-strong)" />
              <circle cx="152" cy="122" r="6" fill="var(--tutorial-accent-strong)" />
              <circle cx="176" cy="72" r="6" fill="var(--tutorial-accent-strong)" />
            </>
          ) : null}

          {art === 'grade' ? (
            <>
              <rect x="78" y="44" width="104" height="112" rx="24" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent)" strokeWidth="4" />
              <rect x="96" y="118" width="16" height="22" rx="8" fill="var(--tutorial-accent-soft)" />
              <rect x="120" y="96" width="16" height="44" rx="8" fill="var(--tutorial-accent)" />
              <rect x="144" y="74" width="16" height="66" rx="8" fill="var(--tutorial-accent-strong)" />
              <path d="M 94 70 H 114" stroke="var(--tutorial-accent-strong)" strokeWidth="4" strokeLinecap="round" />
              <path d="M 118 58 H 138" stroke="var(--tutorial-accent-strong)" strokeWidth="4" strokeLinecap="round" />
              <path d="M 142 46 H 162" stroke="var(--tutorial-accent-strong)" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : null}

          {art === 'warmup' ? (
            <>
              <circle cx="130" cy="68" r="12" fill="var(--tutorial-accent-strong)" />
              <path d="M 130 80 L 130 116" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 92 L 96 80" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 92 L 164 74" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 116 L 104 146" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 116 L 154 142" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 84 72 C 82 54, 100 42, 116 46" fill="none" stroke="var(--tutorial-accent)" strokeWidth="4" strokeLinecap="round" />
              <path d="M 176 58 C 190 64, 194 80, 188 94" fill="none" stroke="var(--tutorial-accent)" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : null}

          {art === 'shield' ? (
            <>
              <path d="M 130 44 L 174 60 V 100 C 174 128 154 150 130 160 C 106 150 86 128 86 100 V 60 Z" fill="rgba(255, 255, 255, 0.88)" stroke="var(--tutorial-accent-strong)" strokeWidth="4" />
              <path d="M 114 96 H 146" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <path d="M 130 80 V 112" stroke="var(--tutorial-accent-strong)" strokeWidth="7" strokeLinecap="round" />
              <circle cx="184" cy="64" r="18" fill="var(--tutorial-accent-soft)" />
            </>
          ) : null}
        </svg>

        {showTermsNudge ? (
          <div className="tutorial-story-art-nudge">
            <GuideMascot pose="tilt" />
            <span>{nudgeLabel}</span>
          </div>
        ) : null}
      </div>

      <span className="tutorial-story-art-label">{label}</span>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tutorial-story-icon" aria-hidden="true">
      <path
        d="M 14.5 5.5 L 8 12 L 14.5 18.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tutorial-story-icon" aria-hidden="true">
      <path
        d="M 6.2 14.5 V 10.2 C 6.2 7.4 8.5 5.2 11.3 5.2 H 12.7 C 15.5 5.2 17.8 7.4 17.8 10.2 V 14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 7.5 15.2 C 7.5 16.8, 8.8 18.1, 10.4 18.1 H 13.6 C 15.2 18.1, 16.5 16.8, 16.5 15.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 18 9.2 C 19.6 10.3, 20.4 11.5, 20.4 12 C 20.4 12.5, 19.6 13.7, 18 14.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tutorial-story-icon" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="3" fill="currentColor" />
    </svg>
  );
}

function RopeClimberIcon() {
  return (
    <svg viewBox="0 0 30 30" className="tutorial-story-climber-icon">
      <circle cx="15" cy="9" r="4" fill="#ffffff" />
      <path d="M 15 13 L 15 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 15 16 L 10 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 15 16 L 20 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 15 20 L 12 25" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 15 20 L 19 25" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 15 2 V 8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
