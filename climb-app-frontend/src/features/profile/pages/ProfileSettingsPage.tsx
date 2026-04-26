import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { useSpeech } from '../../../app/providers/SpeechProvider';
import {
  ContrastIcon,
  FeedbackIcon,
  SpeechIcon,
  TextSizeIcon,
  VoiceCommandIcon,
} from '../../../shared/components/icons/AppIcons';
import Button from '../../../shared/components/ui/Button';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

interface SettingToggleProps {
  title: string;
  checked: boolean;
  onToggle: () => void;
  icon?: ReactNode;
}

interface SettingRangeProps {
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
  variant?: 'card' | 'inline';
}

interface SettingModuleCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  control?: ReactNode;
  open?: boolean;
  active?: boolean;
}

const FONT_WEIGHT_LABELS = ['Regular', 'Medium', 'Bold', 'Heavy'] as const;
const SPACING_LABELS = ['Standard', 'Comfortable', 'Relaxed', 'Wide'] as const;
const FEEDBACK_INTENSITY_LABELS = ['Standard', 'Clear', 'Strong', 'Maximum'] as const;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRate(value: number) {
  return `${value.toFixed(1)}x`;
}

function formatDiscreteValue(labels: readonly string[], value: number, t: (key: string) => string) {
  return t(labels[Math.round(value)] ?? labels[0]);
}

export default function ProfileSettingsPage() {
  usePageTitle('Settings');
  const { t } = useLanguage();
  const { user, updateProfile } = useAuth();
  const { speak } = useSpeech();
  const accessibility = useAccessibility();
  const [username, setUsername] = useState(user?.username ?? '');
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? '');
  }, [user?.username]);

  const isLowVisionPresetActive = useMemo(
    () => (
      accessibility.speechEnabled
      && accessibility.voiceCommandsEnabled
      && accessibility.highContrast
      && accessibility.fontScale >= 1.2
      && accessibility.fontWeightScale >= 1
      && accessibility.readabilitySpacingScale >= 1
    ),
    [
      accessibility.fontScale,
      accessibility.fontWeightScale,
      accessibility.highContrast,
      accessibility.readabilitySpacingScale,
      accessibility.speechEnabled,
      accessibility.voiceCommandsEnabled,
    ],
  );

  function report(message: string) {
    accessibility.announce(message);
  }

  function toggleSetting(label: string, current: boolean, setter: (enabled: boolean) => void) {
    const next = !current;
    setter(next);
    report(`${label} ${next ? t('is on') : t('is off')}`);
  }

  function toggleFontModule() {
    const enabled = accessibility.largeText || accessibility.boldText;
    if (enabled) {
      accessibility.setFontScale(1);
      accessibility.setFontWeightScale(0);
    } else {
      accessibility.setLargeText(true);
    }
    report(`${t('Font')} ${enabled ? t('is off') : t('is on')}`);
  }

  function toggleSpacingModule() {
    const enabled = accessibility.readabilitySpacingScale > 0;
    accessibility.setReadabilitySpacingScale(enabled ? 0 : 1);
    report(`${t('Spacing')} ${enabled ? t('is off') : t('is on')}`);
  }

  function updateRange(
    label: string,
    value: number,
    setter: (value: number) => void,
    formatter: (value: number) => string,
  ) {
    setter(value);
    report(`${label}: ${formatter(value)}`);
  }

  function applyRecommendedSetup() {
    accessibility.applyVisualImpairmentPreset();
    report(t('Applied recommended low-vision setup.'));
  }

  function resetToDefaultSettings() {
    accessibility.resetAccessibilitySettings();
    report(t('Restored default settings.'));
  }

  function previewVoice() {
    const message = t('Voice preview: guidance will use this speed and volume.');
    report(message);
    speak(message);
  }

  async function handleSaveUsername() {
    const nextUsername = username.trim();

    if (!nextUsername) return;

    setSavingUsername(true);
    try {
      await updateProfile({ username: nextUsername });
      setUsername(nextUsername);
      report(t('Username saved.'));
    } finally {
      setSavingUsername(false);
    }
  }

  if (!user) return null;

  return (
    <section className="profile-settings-page" aria-labelledby="profile-settings-heading">
      <header className="profile-settings-hero">
        <div className="profile-settings-hero-copy">
          <span className="profile-settings-kicker">{t('Settings')}</span>
          <h1 id="profile-settings-heading">{t('Accessibility settings')}</h1>
          <p>{t('Customize speech, reading, contrast, and interface density for climbing guidance.')}</p>
        </div>
      </header>

      <section className="profile-settings-section profile-settings-account" aria-labelledby="profile-settings-account-heading">
        <div className="profile-settings-section-head">
          <h2 id="profile-settings-account-heading">{t('Account details')}</h2>
          <p>{t('Only your username is kept in profile settings.')}</p>
        </div>

        <form
          className="profile-name-form profile-setting-card"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveUsername();
          }}
        >
          <label className="field">
            <span className="field-label">{t('Username')}</span>
            <input
              className="field-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <Button type="submit" disabled={savingUsername || !username.trim()}>
            {savingUsername ? t('Saving...') : t('Save changes')}
          </Button>
        </form>
      </section>

      <section
        className={`profile-settings-preset ${isLowVisionPresetActive ? 'is-active' : ''}`.trim()}
        aria-labelledby="profile-settings-preset-heading"
      >
        <div>
          <h2 id="profile-settings-preset-heading">
            {isLowVisionPresetActive ? t('Reset to default settings') : t('Recommended low-vision setup')}
          </h2>
          <p>
            {isLowVisionPresetActive
              ? t('Turn off high contrast and font adjustments while restoring the default guidance settings.')
              : t('Turns on spoken guidance, voice commands, high contrast, and larger font settings in one step.')}
          </p>
        </div>
        <Button
          variant={isLowVisionPresetActive ? 'secondary' : 'primary'}
          onClick={isLowVisionPresetActive ? resetToDefaultSettings : applyRecommendedSetup}
        >
          {isLowVisionPresetActive ? t('Reset to default settings') : t('Apply recommended setup')}
        </Button>
      </section>

      <section className="profile-settings-section" aria-labelledby="profile-settings-voice-heading">
        <div className="profile-settings-section-head">
          <h2 id="profile-settings-voice-heading">{t('Voice and feedback')}</h2>
          <p>{t('Control spoken guidance, command listening, and action feedback.')}</p>
        </div>

        <div className="profile-settings-grid">
          <div className="profile-setting-cluster">
            <SettingToggle
              title={t('Spoken guidance')}
              checked={accessibility.speechEnabled}
              onToggle={() => toggleSetting(t('Spoken guidance'), accessibility.speechEnabled, accessibility.setSpeechEnabled)}
              icon={<SpeechIcon />}
            />
            <SettingChildren open={accessibility.speechEnabled}>
              <div className="profile-setting-children-stack">
                <SettingRange
                  title={t('Speech rate')}
                  value={accessibility.speechRate}
                  min={0.5}
                  max={2}
                  step={0.1}
                  formatValue={formatRate}
                  onChange={(value) => updateRange(t('Speech rate'), value, accessibility.setSpeechRate, formatRate)}
                  className="profile-setting-child-card"
                />
                <SettingRange
                  title={t('Voice volume')}
                  value={accessibility.speechVolume}
                  min={0.2}
                  max={1}
                  step={0.05}
                  formatValue={formatPercent}
                  onChange={(value) => updateRange(t('Voice volume'), value, accessibility.setSpeechVolume, formatPercent)}
                  className="profile-setting-child-card"
                />
                <div className="profile-setting-card profile-setting-preview-card profile-setting-child-card">
                  <div>
                    <strong>{t('Preview voice')}</strong>
                  </div>
                  <Button onClick={previewVoice}>
                    {t('Preview voice')}
                  </Button>
                </div>
              </div>
            </SettingChildren>
          </div>
          <SettingToggle
            title={t('Voice commands')}
            checked={accessibility.voiceCommandsEnabled}
            onToggle={() => toggleSetting(t('Voice commands'), accessibility.voiceCommandsEnabled, accessibility.setVoiceCommandsEnabled)}
            icon={<VoiceCommandIcon />}
          />
          <SettingModuleCard
            title={t('Operation feedback')}
            icon={<FeedbackIcon />}
            active={accessibility.feedbackEnabled}
            open={accessibility.feedbackEnabled}
            control={(
              <SettingInlineSwitch
                checked={accessibility.feedbackEnabled}
                onToggle={() => toggleSetting(t('Operation feedback'), accessibility.feedbackEnabled, accessibility.setFeedbackEnabled)}
                turnOnLabel={t('Turn on operation feedback')}
                turnOffLabel={t('Turn off operation feedback')}
              />
            )}
          >
            <SettingRange
              variant="inline"
              title={t('Highlight strength')}
              value={accessibility.selectionHighlightIntensity}
              min={0}
              max={3}
              step={1}
              formatValue={(value) => formatDiscreteValue(FEEDBACK_INTENSITY_LABELS, value, t)}
              onChange={(value) => updateRange(
                t('Highlight strength'),
                value,
                accessibility.setSelectionHighlightIntensity,
                (nextValue) => formatDiscreteValue(FEEDBACK_INTENSITY_LABELS, nextValue, t),
              )}
            />
            <SettingRange
              variant="inline"
              title={t('Press feedback strength')}
              value={accessibility.pressFeedbackIntensity}
              min={0}
              max={3}
              step={1}
              formatValue={(value) => formatDiscreteValue(FEEDBACK_INTENSITY_LABELS, value, t)}
              onChange={(value) => updateRange(
                t('Press feedback strength'),
                value,
                accessibility.setPressFeedbackIntensity,
                (nextValue) => formatDiscreteValue(FEEDBACK_INTENSITY_LABELS, nextValue, t),
              )}
            />
          </SettingModuleCard>
        </div>
      </section>

      <section className="profile-settings-section" aria-labelledby="profile-settings-reading-heading">
        <div className="profile-settings-section-head">
          <h2 id="profile-settings-reading-heading">{t('Reading and visibility')}</h2>
          <p>{t('Tune text, contrast, and page density for low-vision use.')}</p>
        </div>

        <div className="profile-settings-grid">
          <SettingToggle
            title={t('High contrast mode')}
            checked={accessibility.highContrast}
            onToggle={() => toggleSetting(t('High contrast mode'), accessibility.highContrast, accessibility.setHighContrast)}
            icon={<ContrastIcon />}
          />

          <SettingModuleCard
            title={t('Font')}
            icon={<TextSizeIcon />}
            active={accessibility.largeText || accessibility.boldText}
            open={accessibility.largeText || accessibility.boldText}
            control={(
              <SettingInlineSwitch
                checked={accessibility.largeText || accessibility.boldText}
                onToggle={toggleFontModule}
                turnOnLabel={t('Turn on large text')}
                turnOffLabel={t('Turn off large text')}
              />
            )}
          >
            <SettingRange
              variant="inline"
              title={t('Font size')}
              value={accessibility.fontScale}
              min={1}
              max={1.4}
              step={0.05}
              formatValue={formatPercent}
              onChange={(value) => updateRange(t('Font size'), value, accessibility.setFontScale, formatPercent)}
            />
            <SettingRange
              variant="inline"
              title={t('Font weight')}
              value={accessibility.fontWeightScale}
              min={0}
              max={3}
              step={1}
              formatValue={(value) => formatDiscreteValue(FONT_WEIGHT_LABELS, value, t)}
              onChange={(value) => updateRange(
                t('Font weight'),
                value,
                accessibility.setFontWeightScale,
                (nextValue) => formatDiscreteValue(FONT_WEIGHT_LABELS, nextValue, t),
              )}
            />
          </SettingModuleCard>

          <SettingModuleCard
            title={t('Spacing')}
            icon={<SpacingIcon />}
            active={accessibility.readabilitySpacingScale > 0}
            open={accessibility.readabilitySpacingScale > 0}
            control={(
              <SettingInlineSwitch
                checked={accessibility.readabilitySpacingScale > 0}
                onToggle={toggleSpacingModule}
                turnOnLabel={t('Spacing')}
                turnOffLabel={t('Spacing')}
              />
            )}
          >
            <SettingRange
              variant="inline"
              title={t('Reading spacing')}
              value={accessibility.readabilitySpacingScale}
              min={0}
              max={3}
              step={1}
              formatValue={(value) => formatDiscreteValue(SPACING_LABELS, value, t)}
              onChange={(value) => updateRange(
                t('Reading spacing'),
                value,
                accessibility.setReadabilitySpacingScale,
                (nextValue) => formatDiscreteValue(SPACING_LABELS, nextValue, t),
              )}
            />
          </SettingModuleCard>
        </div>
      </section>
    </section>
  );
}

function SettingToggle({ title, checked, onToggle, icon }: SettingToggleProps) {
  return (
    <button
      type="button"
      className={`profile-setting-card profile-setting-toggle ${checked ? 'is-on' : ''}`.trim()}
      aria-pressed={checked}
      onClick={onToggle}
    >
      {icon ? <span className="profile-setting-icon" aria-hidden="true">{icon}</span> : null}
      <span className="profile-setting-toggle-copy">
        <strong>{title}</strong>
      </span>
      <span className="profile-setting-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

function SettingModuleCard({ title, icon, children, control, open, active }: SettingModuleCardProps) {
  return (
    <article className={`profile-setting-card profile-setting-module-card ${active ? 'is-on' : ''}`.trim()}>
      <div className="profile-setting-module-head">
        <span className="profile-setting-icon" aria-hidden="true">{icon}</span>
        <span className="profile-setting-module-copy">
          <strong>{title}</strong>
        </span>
        {control ? <span className="profile-setting-module-control">{control}</span> : null}
      </div>
      {typeof open === 'boolean' ? (
        <SettingChildren open={open}>
          <div className="profile-setting-slider-list">
            {children}
          </div>
        </SettingChildren>
      ) : (
        <div className="profile-setting-slider-list">
          {children}
        </div>
      )}
    </article>
  );
}

function SettingInlineSwitch({
  checked,
  onToggle,
  turnOnLabel,
  turnOffLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  turnOnLabel: string;
  turnOffLabel: string;
}) {
  return (
    <button
      type="button"
      className={`profile-setting-inline-switch ${checked ? 'is-on' : ''}`.trim()}
      aria-pressed={checked}
      aria-label={checked ? turnOffLabel : turnOnLabel}
      onClick={onToggle}
    >
      <span className="profile-setting-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

function SettingRange({
  title,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
  className,
  variant = 'card',
}: SettingRangeProps) {
  const rangeClassName = variant === 'inline'
    ? `profile-setting-slider ${className ?? ''}`.trim()
    : `profile-setting-card profile-setting-range ${className ?? ''}`.trim();

  return (
    <label className={rangeClassName}>
      <span className="profile-setting-range-head">
        <span>
          <strong>{title}</strong>
        </span>
        <output>{formatValue(value)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SpacingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="climb-icon climb-icon-spacing"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.2 5.4h11.6M6.2 10h11.6M6.2 14.6h11.6M6.2 19.2h11.6" strokeWidth="2.05" />
      <path d="M3.9 6.9v-3M3.9 8.4v3.1M3.9 13.1v3M3.9 17.7v3" strokeWidth="1.85" />
    </svg>
  );
}

function SettingChildren({ open, children }: { open: boolean; children: ReactNode }) {
  const [shouldRender, setShouldRender] = useState(open);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  if (!shouldRender && !open) return null;

  return (
    <div className={`profile-setting-children ${open ? 'is-open' : ''}`.trim()} aria-hidden={!open}>
      <div className="profile-setting-children-inner">
        {children}
      </div>
    </div>
  );
}
