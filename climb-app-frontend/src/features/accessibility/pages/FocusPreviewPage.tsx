import { useEffect, useRef, useState } from 'react';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import Button from '../../../shared/components/ui/Button';

const focusItems = [
  {
    id: 'scan',
    title: 'Start scan button',
    description: 'Open the wall scanning flow to prepare climbing guidance.',
  },
  {
    id: 'tutorial',
    title: 'Tutorial card',
    description: 'Open the beginner tutorial modules and learn basic climbing knowledge.',
  },
  {
    id: 'settings',
    title: 'Accessibility settings button',
    description: 'Change contrast, text size, and spoken feedback options.',
  },
  {
    id: 'repeat',
    title: 'Repeat hint button',
    description: 'Read the previous hint again for the user.',
  },
];

export default function FocusPreviewPage() {
  usePageTitle('Focus preview');
  const { language, t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const { speak } = useSpeech();
  const { announce } = useAccessibility();

  useEffect(() => {
    const intro = t('This page simulates a VoiceOver-style focus flow. Each focused item announces its purpose so the user always knows where they are and what the current element does.');
    announce(intro);
    speak(intro);
  }, [announce, speak, t]);

  useEffect(() => {
    const currentItem = focusItems[currentIndex];
    const message = `${t(currentItem.title)}. ${t(currentItem.description)}`;
    itemRefs.current[currentIndex]?.focus();
    announce(message);
    speak(message);
  }, [announce, currentIndex, speak, t]);

  const goPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? focusItems.length - 1 : prev - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev === focusItems.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="stack-lg">
      <div className="page-card stack-lg">
        <div className="stack-sm">
          <p className="subtle-text">{t('Accessibility demo')}</p>
          <h1>{t('Focus preview')}</h1>
          <p>{t('This page simulates a VoiceOver-style focus flow. Each focused item announces its purpose so the user always knows where they are and what the current element does.')}</p>
        </div>

        <div className="page-card stack-sm" aria-live="polite">
          <h2>{t('Current focus')}</h2>
          <p>
            {t('Item')} {currentIndex + 1} / {focusItems.length}
          </p>
          <p>
            <strong>{t(focusItems[currentIndex].title)}</strong>
          </p>
          <p>{t(focusItems[currentIndex].description)}</p>
        </div>

        <div className="stack-sm">
          <Button variant="secondary" onClick={goPrevious}>
            {t('Previous item')}
          </Button>
          <Button variant="secondary" onClick={goNext}>
            {t('Next item')}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              speak(`${t(focusItems[currentIndex].title)}. ${t(focusItems[currentIndex].description)}`)
            }
          >
            {t('Repeat current focus')}
          </Button>
        </div>

        <div className="stack-md" role="list" aria-label={t('Focusable preview items')}>
          {focusItems.map((item, index) => {
            const isActive = index === currentIndex;

            return (
              <div
                key={item.id}
                role="listitem"
                className="page-card stack-sm"
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                tabIndex={-1}
                aria-current={isActive ? 'true' : undefined}
                style={{
                  outline: isActive ? '3px solid var(--primary)' : '1px solid var(--border)',
                  background: isActive ? 'var(--surface-muted)' : 'var(--surface)',
                }}
              >
                <h2>{t(item.title)}</h2>
                <p>{t(item.description)}</p>
                <Button
                  variant={isActive ? 'primary' : 'secondary'}
                  onClick={() => setCurrentIndex(index)}
                  aria-pressed={isActive}
                >
                  {isActive ? t('Currently focused') : t('Focus this item')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
