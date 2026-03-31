import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import GuideMascot, { type MascotPose } from '../../../shared/components/illustration/GuideMascot';
import Button from '../../../shared/components/ui/Button';

interface DashboardGuideCardProps {
  autoOpen: boolean;
  onAutoOpenHandled?: () => void;
}

interface GuideStep {
  id: string;
  badge: string;
  title: string;
  message: string;
  helper: string;
  pose: MascotPose;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="dashboard-guide-toggle-icon" aria-hidden="true">
      <path
        d={expanded ? 'M 5 12 L 10 7 L 15 12' : 'M 7 5 L 12 10 L 7 15'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DashboardGuideCard({
  autoOpen,
  onAutoOpenHandled,
}: DashboardGuideCardProps) {
  const { user, updatePreferences } = useAuth();
  const { language } = useLanguage();
  const { announce } = useAccessibility();
  const { speak, stop } = useSpeech();
  const [expanded, setExpanded] = useState(autoOpen);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const previousAutoOpenRef = useRef(autoOpen);

  const isZh = language === 'zh';
  const hasSeenGuide = Boolean(user?.preferences?.onboarding?.guideCompleted);

  const steps = useMemo<GuideStep[]>(
    () =>
      isZh
        ? [
            {
              id: 'dashboard',
              badge: '首页总览',
              title: '先看 dashboard，今天该做什么会放在最前面。',
              message: '顶部会把今天最重要的动作、教程进度和快捷入口放在一起，不用到处找。',
              helper: '先从这里扫一眼，再决定是继续教程、去扫描，还是去社交区。',
              pose: 'nod',
            },
            {
              id: 'tutorial',
              badge: 'Tutorial',
              title: 'Tutorial 适合先熟悉安全、规则、装备和基础术语。',
              message: '如果你刚开始接触攀岩，先把教程走完，再去尝试更复杂的功能会更稳。',
              helper: '教程页现在有固定卡片、上下张按钮和完成提示，可以按顺序慢慢看。',
              pose: 'tilt',
            },
            {
              id: 'assist',
              badge: 'Assist',
              title: '准备好了再打开 Assist，去试墙面扫描和路线提示。',
              message: 'Assist 会把扫描入口、路线建议和实时提示放在一条更轻量的流程里。',
              helper: '不用一开始就用它，等你对基础内容更熟一点再进入就行。',
              pose: 'celebrate',
            },
            {
              id: 'social',
              badge: 'Social + A11y',
              title: 'Social、志愿帮助和无障碍设置都可以之后再进。',
              message: 'Social 里有帖子、房间和帮助信息，Accessibility hub 可以随时再打开调语音、对比度和大字。',
              helper: '这张引导卡之后也会留在 dashboard，想复习入口时点一下就能重新看。',
              pose: 'idle',
            },
          ]
        : [
            {
              id: 'dashboard',
              badge: 'Dashboard',
              title: 'Start here. The dashboard keeps today’s main actions up front.',
              message: 'Your top task, tutorial progress, and quick entries stay together so the first screen feels simpler.',
              helper: 'Look here first, then decide whether you want tutorials, scan assist, or social features.',
              pose: 'nod',
            },
            {
              id: 'tutorial',
              badge: 'Tutorial',
              title: 'Tutorial is the calm place to learn safety, rules, gear, and core terms.',
              message: 'If climbing still feels new, finishing the tutorial path first will make the rest of the app easier.',
              helper: 'The lesson pages now keep fixed-size cards, clear next-card buttons, and a stronger completion state.',
              pose: 'tilt',
            },
            {
              id: 'assist',
              badge: 'Assist',
              title: 'Open Assist when you feel ready to try scanning and route guidance.',
              message: 'Assist groups wall scan, route suggestions, and live hint flows into one lighter path.',
              helper: 'You do not need to use it on day one. Come back when the basics feel more familiar.',
              pose: 'celebrate',
            },
            {
              id: 'social',
              badge: 'Social + A11y',
              title: 'Social, volunteer help, and accessibility settings can all wait until you need them.',
              message: 'Social holds posts, rooms, and support entry points. Accessibility hub lets you tune voice, contrast, and text later.',
              helper: 'This guide stays in the dashboard, so you can reopen it here any time.',
              pose: 'idle',
            },
          ],
    [isZh],
  );

  const currentStep = steps[stepIndex] ?? steps[0];
  const isLastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    if (autoOpen && !previousAutoOpenRef.current) {
      setExpanded(true);
      setStepIndex(0);
    }

    previousAutoOpenRef.current = autoOpen;
  }, [autoOpen]);

  useEffect(() => {
    if (!expanded) {
      stop();
      return;
    }

    const message = `${currentStep.title} ${currentStep.message}`;
    announce(message);
    speak(message);

    return () => {
      stop();
    };
  }, [announce, currentStep.message, currentStep.title, expanded, speak, stop]);

  async function persistGuideSeen() {
    setSaving(true);

    try {
      await updatePreferences({
        onboarding: {
          completed: true,
          guideCompleted: true,
          accessibilitySetupCompleted:
            user?.preferences?.onboarding?.accessibilitySetupCompleted ?? user?.role !== 'visually_impaired',
          completedAt: new Date().toISOString(),
        },
      });
    } finally {
      setSaving(false);
    }
  }

  async function closeGuide() {
    setExpanded(false);
    setStepIndex(0);
    onAutoOpenHandled?.();

    if (!hasSeenGuide) {
      await persistGuideSeen();
    }
  }

  async function handleSkip() {
    await closeGuide();
  }

  async function handleFinish() {
    await closeGuide();
  }

  function handleOpen() {
    setExpanded(true);
    setStepIndex(0);
    onAutoOpenHandled?.();
  }

  function handleCollapse() {
    stop();
    setExpanded(false);
    onAutoOpenHandled?.();
  }

  function moveToStep(nextIndex: number) {
    startTransition(() => {
      setStepIndex(nextIndex);
    });
  }

  const copy = isZh
    ? {
        kicker: hasSeenGuide ? 'Dashboard 指南' : '第一次进入',
        skip: '跳过',
        previous: '上一条',
        next: '下一条',
        finish: '开始使用',
        welcome: '小猴先带你看一眼主要功能入口。',
        progressLabel: '引导进度',
        open: '展开引导',
        collapse: '收起引导',
      }
    : {
        kicker: hasSeenGuide ? 'Dashboard guide' : 'First visit',
        skip: 'Skip',
        previous: 'Previous',
        next: 'Next',
        finish: 'Start using the app',
        welcome: 'The monkey keeps the main feature entry points in one short guide.',
        progressLabel: 'Guide progress',
        open: 'Open guide',
        collapse: 'Collapse guide',
      };

  if (!expanded) {
    return (
      <section
        className="dashboard-guide-card dashboard-guide-card--collapsed"
        aria-label={isZh ? 'dashboard 新手引导' : 'Dashboard first-use guide'}
      >
        <button
          type="button"
          className="dashboard-guide-toggle-button"
          onClick={handleOpen}
          aria-expanded={expanded}
          aria-label={`${copy.kicker}. ${copy.open}`}
          title={copy.open}
        >
          <span className="dashboard-guide-toggle-kicker">{copy.kicker}</span>
          <span className="dashboard-guide-toggle-label">{copy.open}</span>
          <ChevronIcon expanded={expanded} />
        </button>
      </section>
    );
  }

  return (
    <section
      className="dashboard-guide-card dashboard-guide-card--expanded"
      aria-label={isZh ? 'dashboard 新手引导' : 'Dashboard first-use guide'}
    >
      <div className="dashboard-guide-card-head">
        <div className="dashboard-guide-card-copy">
          <span className="dashboard-section-kicker">{copy.kicker}</span>
          <p className="dashboard-guide-intro">{copy.welcome}</p>
        </div>

        <div className="dashboard-guide-card-controls">
          <button
            type="button"
            className="dashboard-guide-collapse-button"
            onClick={handleCollapse}
            aria-expanded={expanded}
            aria-label={copy.collapse}
            title={copy.collapse}
          >
            <ChevronIcon expanded={expanded} />
          </button>
          <Button variant="ghost" onClick={() => void handleSkip()} disabled={saving}>
            {copy.skip}
          </Button>
        </div>
      </div>

      <div className="dashboard-guide-stage">
        <div
          className="dashboard-guide-mascot-panel"
          style={{ '--guide-accent': stepIndex % 2 === 0 ? '#f3a83d' : '#6ea4cf' } as CSSProperties}
          aria-hidden="true"
        >
          <GuideMascot className="guide-mascot dashboard-guide-mascot" pose={currentStep.pose} />
        </div>

        <div className="dashboard-guide-dialog" role="status" aria-live="polite" aria-atomic="true">
          <div className="dashboard-guide-dialog-meta">
            <span className="dashboard-guide-badge">{currentStep.badge}</span>
            <span className="dashboard-guide-step-count">
              {stepIndex + 1}/{steps.length}
            </span>
          </div>
          <div key={currentStep.id} className="dashboard-guide-dialog-body">
            <h2>{currentStep.title}</h2>
            <p>{currentStep.message}</p>
            <p className="dashboard-guide-helper">{currentStep.helper}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-guide-progress" aria-label={copy.progressLabel}>
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={`dashboard-guide-pill ${index === stepIndex ? 'is-active' : ''}`.trim()}
            aria-current={index === stepIndex ? 'step' : undefined}
            onClick={() => moveToStep(index)}
          >
            {step.badge}
          </button>
        ))}
      </div>

      <div className="dashboard-guide-actions">
        <Button
          variant="secondary"
          onClick={() => moveToStep(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
        >
          {copy.previous}
        </Button>

        <Button
          onClick={() =>
            isLastStep
              ? void handleFinish()
              : moveToStep(Math.min(steps.length - 1, stepIndex + 1))
          }
          disabled={saving}
        >
          {isLastStep ? copy.finish : copy.next}
        </Button>
      </div>
    </section>
  );
}
