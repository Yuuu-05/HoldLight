import { useEffect } from 'react';
import { tutorialModules } from '../../../shared/constants/tutorial';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useTutorialProgress } from '../hooks/useTutorialProgress';

interface ProgressChecklistProps {
  currentId: string;
}

export default function ProgressChecklist({ currentId }: ProgressChecklistProps) {
  const { completedCount, markCompleted } = useTutorialProgress();
  const { language, t } = useLanguage();

  useEffect(() => {
    markCompleted(currentId);
  }, [currentId, markCompleted]);

  return (
    <p className="subtle-text" aria-live="polite">
      {language === 'zh'
        ? `${t('Tutorial progress saved.')} 已完成 ${completedCount} / ${tutorialModules.length} 个模块。`
        : `${t('Tutorial progress saved.')} Completed modules: ${completedCount} of ${tutorialModules.length}.`}
    </p>
  );
}
