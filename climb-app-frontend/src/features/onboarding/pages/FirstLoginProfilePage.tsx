import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import GuideMascot, { type MascotPose } from '../../../shared/components/illustration/GuideMascot';
import Button from '../../../shared/components/ui/Button';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

type GuideTarget = 'assist' | 'tutorial' | 'social' | 'ready';

interface GuideStep {
  id: string;
  target: GuideTarget;
  pose: MascotPose;
  title: string;
  message: string;
}

const targetPositions: Record<GuideTarget, CSSProperties> = {
  assist: { left: '26%', top: '31%' },
  tutorial: { left: '74%', top: '31%' },
  social: { left: '26%', top: '73%' },
  ready: { left: '74%', top: '73%' },
};

export default function FirstLoginProfilePage() {
  const { user, isOnboarded, updatePreferences } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const {
    hydrated,
    speechEnabled,
    feedbackEnabled,
    highContrast,
    largeText,
    simplifiedMode,
    voiceCommandsEnabled,
    speechRate,
    speechVolume,
    fontScale,
    announce,
  } = useAccessibility();
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isZh = language === 'zh';
  const manualReplay = searchParams.has('mode');
  const returnTo = searchParams.get('returnTo') === 'profile' ? routes.profile : routes.dashboard;
  const isVisuallyImpairedUser = user?.role === 'visually_impaired';
  const accessibilitySetupCompleted = Boolean(user?.preferences?.onboarding?.accessibilitySetupCompleted);
  const shouldRedirectToVision = isVisuallyImpairedUser && !accessibilitySetupCompleted && !manualReplay;

  usePageTitle(isZh ? '新手引导' : manualReplay ? 'Replay guide' : 'Welcome guide');

  const guideSteps = useMemo<GuideStep[]>(
    () => [
      {
        id: 'assist',
        target: 'assist',
        pose: 'nod',
        title: isZh ? 'Assist' : 'Assist',
        message: isZh
          ? '点 Assist 就能开始扫描岩点和路线。'
          : 'Tap Assist to scan the wall and start the route flow.',
      },
      {
        id: 'tutorial',
        target: 'tutorial',
        pose: 'tilt',
        title: isZh ? 'Tutorial' : 'Tutorial',
        message: isZh
          ? 'Tutorial 把新手攀岩知识放在一个轻松的地方。'
          : 'Tutorial keeps beginner climbing knowledge in one calm place.',
      },
      {
        id: 'social',
        target: 'social',
        pose: 'celebrate',
        title: isZh ? 'Social' : 'Social',
        message: isZh
          ? 'Social 里有组队房间，也有志愿者支持。'
          : 'Social brings climbing rooms and volunteer support together.',
      },
      {
        id: 'ready',
        target: 'ready',
        pose: 'celebrate',
        title: isZh ? '准备好了' : 'All set',
        message: isZh
          ? '你已经认识最重要的入口了，现在可以开始体验。'
          : 'You already know the key entry points. You can start now.',
      },
    ],
    [isZh],
  );

  const currentStep = guideSteps[stepIndex] ?? guideSteps[0];
  const currentTargetPosition = targetPositions[currentStep.target];

  useEffect(() => {
    if (!hydrated || shouldRedirectToVision) return;

    const announcement = `${currentStep.title}. ${currentStep.message}`;
    announce(announcement);
    speak(announcement);
  }, [announce, currentStep.message, currentStep.title, hydrated, shouldRedirectToVision, speak]);

  async function commitCompletion(guideCompleted: boolean) {
    if (manualReplay) {
      navigate(returnTo, { replace: true });
      return;
    }

    setSubmitting(true);
    try {
      await updatePreferences({
        accessibility: {
          speechEnabled,
          feedbackEnabled,
          highContrast,
          largeText,
          simplifiedMode,
          voiceCommandsEnabled,
          speechRate,
          speechVolume,
          fontScale,
        },
        onboarding: {
          completed: true,
          guideCompleted,
          accessibilitySetupCompleted: accessibilitySetupCompleted || !isVisuallyImpairedUser,
          completedAt: new Date().toISOString(),
        },
      });

      navigate(routes.dashboard, {
        replace: true,
        state: { onboardingBypass: true },
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkipGuide() {
    await commitCompletion(false);
  }

  async function handleFinishGuide() {
    await commitCompletion(true);
  }

  function handleAdvance() {
    if (stepIndex >= guideSteps.length - 1) {
      void handleFinishGuide();
      return;
    }

    setStepIndex((current) => current + 1);
  }

  if (!user) return null;

  if (shouldRedirectToVision) {
    return <Navigate to={routes.onboardingVision} replace />;
  }

  if (isOnboarded && !manualReplay) {
    return <Navigate to={routes.dashboard} replace />;
  }

  if (!hydrated) {
    return (
      <section className="page-card onboarding-loading-card stack-md">
        <span className="eyebrow">{isZh ? '正在准备引导' : 'Preparing the guide'}</span>
        <h1>{isZh ? '我们先整理一下入口' : 'We are setting up the entry points'}</h1>
        <p>{isZh ? '请稍等片刻。' : 'One moment while your guide loads.'}</p>
      </section>
    );
  }

  const skipLabel = manualReplay
    ? (isZh ? '关闭引导' : 'Close guide')
    : (isZh ? '跳过引导' : 'Skip guide');
  const advanceLabel =
    stepIndex >= guideSteps.length - 1
      ? manualReplay
        ? (returnTo === routes.profile
          ? (isZh ? '返回资料页' : 'Return to profile')
          : (isZh ? '返回首页' : 'Return'))
        : (isZh ? '开始使用' : 'Start using the app')
      : (isZh ? '下一步' : 'Next');

  return (
    <section className="stack-lg onboarding-shell">
      <div className="page-card onboarding-guide-card">
        <header className="onboarding-guide-header">
          <div className="stack-sm">
            <span className="eyebrow">
              {manualReplay
                ? (isZh ? '重新查看引导' : 'Replay guide')
                : (isZh ? '新用户引导' : 'First-use guide')}
            </span>
            <h1>
              {isZh
                ? '跟着小猴，先认识这三个入口'
                : 'Follow the monkey through the three main entry points'}
            </h1>
            <p>
              {isZh
                ? '我们只看最重要的地方：Assist 扫描、Tutorial 学习、Social 里的组队和志愿者。'
                : 'We keep it short: Assist for scanning, Tutorial for learning, and Social for rooms plus volunteer support.'}
            </p>
          </div>

          <div className="onboarding-guide-meta">
            <span className="onboarding-step-count">
              {stepIndex + 1}/{guideSteps.length}
            </span>
            <Button variant="ghost" onClick={() => void handleSkipGuide()} disabled={submitting}>
              {skipLabel}
            </Button>
          </div>
        </header>

        <div className="onboarding-step-track" aria-label={isZh ? '引导进度' : 'Guide progress'}>
          {guideSteps.map((step, index) => (
            <span
              key={step.id}
              className={`onboarding-step-pill ${index === stepIndex ? 'is-active' : ''}`.trim()}
              aria-current={index === stepIndex ? 'step' : undefined}
            >
              {step.title}
            </span>
          ))}
        </div>

        <div className="onboarding-guide-layout">
          <div className="onboarding-guide-copy stack-lg">
            <div className="guide-speech onboarding-guide-speech" role="note" aria-live="polite">
              <GuideMascot className="guide-mascot onboarding-guide-mascot" pose={currentStep.pose} />
              <div className="stack-sm">
                <strong>{currentStep.title}</strong>
                <p>{currentStep.message}</p>
              </div>
            </div>

            <div className="onboarding-guide-footer">
              <p className="subtle-text">
                {stepIndex === guideSteps.length - 1
                  ? (manualReplay
                    ? (isZh ? '完成后会回到你刚才的页面。' : 'When you finish, you will return to where you came from.')
                    : (isZh ? '点一下就能开始使用。' : 'One more tap and you can start using the app.'))
                  : (isZh ? '每一步只讲一个重点。' : 'Each step only covers one thing.')}
              </p>

              <div className="inline-actions wrap onboarding-guide-actions">
                <Button variant="secondary" onClick={() => void handleSkipGuide()} disabled={submitting}>
                  {skipLabel}
                </Button>
                <Button onClick={handleAdvance} disabled={submitting}>
                  {advanceLabel}
                </Button>
              </div>
            </div>
          </div>

          <div className="onboarding-preview-stage" aria-hidden="true">
            <div className="onboarding-preview-topline">
              <span className="onboarding-preview-chip">{isZh ? '真实入口预览' : 'Real entry points'}</span>
              <span className="onboarding-preview-chip">{isZh ? '轻量引导' : 'Lightweight onboarding'}</span>
            </div>

            <div className="onboarding-preview-grid">
              <article className={`onboarding-target-card onboarding-target-card-assist ${currentStep.target === 'assist' ? 'is-active' : ''}`.trim()}>
                <span className="onboarding-target-kicker">Assist</span>
                <strong>{isZh ? '扫描岩点和路线' : 'Scan holds and route lines'}</strong>
                <p>{isZh ? '从这里开始最直接。' : 'This is the fastest place to start.'}</p>
              </article>

              <article className={`onboarding-target-card onboarding-target-card-tutorial ${currentStep.target === 'tutorial' ? 'is-active' : ''}`.trim()}>
                <span className="onboarding-target-kicker">Tutorial</span>
                <strong>{isZh ? '新手知识' : 'Beginner learning'}</strong>
                <p>{isZh ? '先学规则，再慢慢练。' : 'Learn the basics before you climb.'}</p>
              </article>

              <article className={`onboarding-target-card onboarding-target-card-social ${currentStep.target === 'social' ? 'is-active' : ''}`.trim()}>
                <span className="onboarding-target-kicker">Social</span>
                <strong>{isZh ? '组队房间与志愿者' : 'Rooms and volunteer help'}</strong>
                <p>{isZh ? '社区、组队和帮忙都在这里。' : 'Community, rooms, and support live together.'}</p>
              </article>

              <article className={`onboarding-target-card onboarding-target-card-ready ${currentStep.target === 'ready' ? 'is-active' : ''}`.trim()}>
                <span className="onboarding-target-kicker">{isZh ? '完成' : 'Done'}</span>
                <strong>{isZh ? '准备开始' : 'Ready to start'}</strong>
                <p>{isZh ? '现在就能进入应用。' : 'You can enter the app now.'}</p>
              </article>
            </div>

            <div className="onboarding-spotlight" style={currentTargetPosition} />
            <div className="onboarding-floating-mascot" style={currentTargetPosition}>
              <GuideMascot className="guide-mascot onboarding-preview-mascot" pose={currentStep.pose} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
