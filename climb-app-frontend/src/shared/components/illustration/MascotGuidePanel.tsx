import { useId, useState } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import GuideMascot, { type MascotPose } from './GuideMascot';

type MascotTip = {
  message: string;
  pose: MascotPose;
};

interface MascotGuidePanelProps {
  title: string;
  tips: MascotTip[];
  className?: string;
}

export default function MascotGuidePanel({ title, tips, className = '' }: MascotGuidePanelProps) {
  const { t } = useLanguage();
  const [tipIndex, setTipIndex] = useState(0);
  const contentId = useId();
  const currentTip = tips[tipIndex] ?? tips[0];
  const hasMultipleTips = tips.length > 1;

  const cycleTip = () => {
    if (!hasMultipleTips) return;
    setTipIndex((current) => (current + 1) % tips.length);
  };

  return (
    <div className={`guide-callout-card mascot-guide-panel ${className}`.trim()} role="note" aria-labelledby={`${contentId}-title`}>
      <button
        type="button"
        className="mascot-trigger"
        onClick={cycleTip}
        aria-label={hasMultipleTips ? t('Tap the mascot for another tip.') : title}
        aria-describedby={contentId}
      >
        <GuideMascot className="guide-mascot" pose={currentTip.pose} />
      </button>
      <div className="mascot-speech stack-sm">
        <div className="mascot-speech-head">
          <strong id={`${contentId}-title`}>{title}</strong>
          {hasMultipleTips ? <span className="mascot-tap-hint">{t('Tap the mascot for another tip.')}</span> : null}
        </div>
        <p id={contentId}>{currentTip.message}</p>
      </div>
    </div>
  );
}
