import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthProvider';
import { getUserPreferencesApi, updateUserPreferencesApi } from '../../shared/api/users.api';
import { readStorage, storageKeys, writeStorage } from '../../shared/lib/storage';
import type { AccessibilityPreferences, SyncedAccessibilityPreferences } from '../../shared/types/preferences';

type AccessibilityContextType = {
  speechEnabled: boolean;
  feedbackEnabled: boolean;
  highContrast: boolean;
  largeText: boolean;
  simplifiedMode: boolean;
  voiceCommandsEnabled: boolean;
  speechRate: number;
  speechVolume: number;
  fontScale: number;
  fontWeightScale: number;
  readabilitySpacingScale: number;
  selectionHighlightIntensity: number;
  pressFeedbackIntensity: number;
  boldText: boolean;
  readabilitySpacing: boolean;
  strongSelectionHighlight: boolean;
  alwaysShowTextLabels: boolean;
  largerTouchTargets: boolean;
  clearPressFeedback: boolean;
  reduceMotion: boolean;
  hydrated: boolean;
  lastAnnouncement: string;
  liveMessage: string;
  toggleSpeechEnabled: () => void;
  toggleFeedbackEnabled: () => void;
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
  toggleSimplifiedMode: () => void;
  toggleVoiceCommandsEnabled: () => void;
  setSpeechEnabled: (enabled: boolean) => void;
  setFeedbackEnabled: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setLargeText: (enabled: boolean) => void;
  setSimplifiedMode: (enabled: boolean) => void;
  setVoiceCommandsEnabled: (enabled: boolean) => void;
  setSpeechRate: (rate: number) => void;
  setSpeechVolume: (volume: number) => void;
  setFontScale: (scale: number) => void;
  setFontWeightScale: (scale: number) => void;
  setReadabilitySpacingScale: (scale: number) => void;
  setSelectionHighlightIntensity: (intensity: number) => void;
  setPressFeedbackIntensity: (intensity: number) => void;
  applyVisualImpairmentPreset: () => void;
  resetAccessibilitySettings: () => void;
  setLastAnnouncement: (text: string) => void;
  announce: (text: string) => void;
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const DEFAULT_FONT_SCALE = 1;
const LARGE_TEXT_SCALE = 1.15;
const defaultSettings: AccessibilityPreferences = {
  speechEnabled: true,
  feedbackEnabled: true,
  highContrast: false,
  largeText: false,
  simplifiedMode: false,
  voiceCommandsEnabled: false,
  speechRate: 1,
  speechVolume: 1,
  fontScale: DEFAULT_FONT_SCALE,
  fontWeightScale: 0,
  readabilitySpacingScale: 0,
  selectionHighlightIntensity: 0,
  pressFeedbackIntensity: 0,
  boldText: false,
  readabilitySpacing: false,
  strongSelectionHighlight: false,
  alwaysShowTextLabels: false,
  largerTouchTargets: false,
  clearPressFeedback: false,
  reduceMotion: false,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizeSettings(settings: Partial<AccessibilityPreferences> = {}): AccessibilityPreferences {
  const merged = {
    ...defaultSettings,
    ...settings,
  };
  const fontWeightScale = clampNumber(settings.fontWeightScale, 0, 3, merged.boldText ? 2 : 0);
  const readabilitySpacingScale = clampNumber(
    settings.readabilitySpacingScale,
    0,
    3,
    merged.readabilitySpacing ? 2 : 0,
  );
  const selectionHighlightIntensity = clampNumber(
    settings.selectionHighlightIntensity,
    0,
    3,
    merged.strongSelectionHighlight ? 2 : 0,
  );
  const pressFeedbackIntensity = clampNumber(
    settings.pressFeedbackIntensity,
    0,
    3,
    merged.clearPressFeedback ? 2 : 0,
  );

  return {
    ...merged,
    speechRate: clampNumber(merged.speechRate, 0.5, 2, defaultSettings.speechRate),
    speechVolume: clampNumber(merged.speechVolume, 0.2, 1, defaultSettings.speechVolume),
    fontScale: clampNumber(merged.fontScale, DEFAULT_FONT_SCALE, 1.4, defaultSettings.fontScale),
    fontWeightScale,
    readabilitySpacingScale,
    selectionHighlightIntensity,
    pressFeedbackIntensity,
    largeText: merged.fontScale > DEFAULT_FONT_SCALE || merged.largeText,
    boldText: fontWeightScale > 0,
    readabilitySpacing: readabilitySpacingScale > 0,
    strongSelectionHighlight: selectionHighlightIntensity > 0,
    clearPressFeedback: pressFeedbackIntensity > 0,
  };
}

function getSyncedAccessibilitySettings(settings: AccessibilityPreferences): SyncedAccessibilityPreferences {
  return {
    speechEnabled: settings.speechEnabled,
    feedbackEnabled: settings.feedbackEnabled,
    highContrast: settings.highContrast,
    largeText: settings.largeText,
    simplifiedMode: settings.simplifiedMode,
    voiceCommandsEnabled: settings.voiceCommandsEnabled,
    speechRate: settings.speechRate,
    speechVolume: settings.speechVolume,
    fontScale: settings.fontScale,
  };
}

function getInitialSettings() {
  return normalizeSettings(readStorage<Partial<AccessibilityPreferences>>(storageKeys.accessibility, {}));
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isUsingDevAuth, loading } = useAuth();
  const [settings, setSettings] = useState<AccessibilityPreferences>(getInitialSettings);
  const [hydrated, setHydrated] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const announceTimeoutRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    writeStorage(storageKeys.accessibility, settings);
    const root = document.documentElement;
    const fontWeight = 700 + (settings.fontWeightScale * 80);
    const readableLineHeight = 1.55 + (settings.readabilitySpacingScale * 0.1);
    const readableGap = 0.75 + (settings.readabilitySpacingScale * 0.12);
    const highlightWidth = 2 + settings.selectionHighlightIntensity;
    const highlightGlow = 3 + (settings.selectionHighlightIntensity * 2);
    const pressTranslate = 1 + (settings.pressFeedbackIntensity * 0.5);
    const pressScale = 1 - (settings.pressFeedbackIntensity * 0.005);

    root.dataset.theme = settings.highContrast ? 'contrast' : 'calm';
    root.dataset.contrast = settings.highContrast ? 'high' : 'default';
    root.dataset.simplified = settings.simplifiedMode ? 'true' : 'false';
    root.dataset.boldText = settings.boldText ? 'true' : 'false';
    root.dataset.readabilitySpacing = settings.readabilitySpacing ? 'relaxed' : 'default';
    root.dataset.selectionHighlight = settings.strongSelectionHighlight ? 'strong' : 'default';
    root.dataset.focusHighlight = settings.strongSelectionHighlight ? 'strong' : 'default';
    root.dataset.pressFeedback = settings.clearPressFeedback ? 'clear' : 'default';
    root.dataset.touchTargets = settings.largerTouchTargets ? 'large' : 'default';
    root.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
    root.classList.toggle('theme-high-contrast', settings.highContrast);
    root.style.setProperty('--font-scale', `${settings.fontScale}`);
    root.style.setProperty('--accessibility-strong-font-weight', `${Math.round(fontWeight)}`);
    root.style.setProperty('--accessibility-readable-line-height', readableLineHeight.toFixed(2));
    root.style.setProperty('--accessibility-readable-gap', `${readableGap.toFixed(2)}rem`);
    root.style.setProperty('--accessibility-highlight-width', `${highlightWidth.toFixed(1)}px`);
    root.style.setProperty('--accessibility-highlight-offset', `${Math.max(2, settings.selectionHighlightIntensity + 1)}px`);
    root.style.setProperty('--accessibility-highlight-glow-size', `${highlightGlow.toFixed(1)}px`);
    root.style.setProperty('--accessibility-press-translate', `${pressTranslate.toFixed(1)}px`);
    root.style.setProperty('--accessibility-press-scale', pressScale.toFixed(3));
  }, [settings]);

  useEffect(
    () => () => {
      if (announceTimeoutRef.current !== null) {
        window.clearTimeout(announceTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || isUsingDevAuth) {
      hydratedRef.current = true;
      setHydrated(true);
      return;
    }

    let active = true;
    getUserPreferencesApi()
      .then((preferences) => {
        if (!active) return;
        setSettings((current) => normalizeSettings({
          ...current,
          ...preferences.accessibility,
        }));
      })
      .finally(() => {
        if (active) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isUsingDevAuth, loading]);

  const commitSettings = useCallback(
    (updater: AccessibilityPreferences | ((current: AccessibilityPreferences) => AccessibilityPreferences)) => {
      setSettings((current) => {
        const next = normalizeSettings(typeof updater === 'function' ? updater(current) : updater);
        if (hydratedRef.current && isAuthenticated && !isUsingDevAuth) {
          void updateUserPreferencesApi({ accessibility: getSyncedAccessibilitySettings(next) });
        }
        return next;
      });
    },
    [isAuthenticated, isUsingDevAuth],
  );

  const setSpeechEnabled = useCallback((enabled: boolean) => {
    commitSettings((current) => ({ ...current, speechEnabled: enabled }));
  }, [commitSettings]);

  const toggleSpeechEnabled = useCallback(() => {
    commitSettings((current) => ({ ...current, speechEnabled: !current.speechEnabled }));
  }, [commitSettings]);

  const setFeedbackEnabled = useCallback((enabled: boolean) => {
    commitSettings((current) => ({ ...current, feedbackEnabled: enabled }));
  }, [commitSettings]);

  const toggleFeedbackEnabled = useCallback(() => {
    commitSettings((current) => ({ ...current, feedbackEnabled: !current.feedbackEnabled }));
  }, [commitSettings]);

  const setHighContrast = useCallback((enabled: boolean) => {
    commitSettings((current) => ({ ...current, highContrast: enabled }));
  }, [commitSettings]);

  const toggleHighContrast = useCallback(() => {
    commitSettings((current) => ({ ...current, highContrast: !current.highContrast }));
  }, [commitSettings]);

  const setLargeText = useCallback((enabled: boolean) => {
    commitSettings((current) => ({
      ...current,
      largeText: enabled,
      fontScale: enabled ? Math.max(current.fontScale, LARGE_TEXT_SCALE) : DEFAULT_FONT_SCALE,
    }));
  }, [commitSettings]);

  const toggleLargeText = useCallback(() => {
    commitSettings((current) => {
      const nextLargeText = !current.largeText;
      return {
        ...current,
        largeText: nextLargeText,
        fontScale: nextLargeText ? Math.max(current.fontScale, LARGE_TEXT_SCALE) : DEFAULT_FONT_SCALE,
      };
    });
  }, [commitSettings]);

  const setSimplifiedMode = useCallback((enabled: boolean) => {
    commitSettings((current) => ({ ...current, simplifiedMode: enabled }));
  }, [commitSettings]);

  const toggleSimplifiedMode = useCallback(() => {
    commitSettings((current) => ({ ...current, simplifiedMode: !current.simplifiedMode }));
  }, [commitSettings]);

  const setVoiceCommandsEnabled = useCallback((enabled: boolean) => {
    commitSettings((current) => ({ ...current, voiceCommandsEnabled: enabled }));
  }, [commitSettings]);

  const toggleVoiceCommandsEnabled = useCallback(() => {
    commitSettings((current) => ({ ...current, voiceCommandsEnabled: !current.voiceCommandsEnabled }));
  }, [commitSettings]);

  const setSpeechRate = useCallback((rate: number) => {
    const safeRate = Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : 1;
    commitSettings((current) => ({ ...current, speechRate: safeRate }));
  }, [commitSettings]);

  const setSpeechVolume = useCallback((volume: number) => {
    const safeVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0.2, volume)) : 1;
    commitSettings((current) => ({ ...current, speechVolume: safeVolume }));
  }, [commitSettings]);

  const setFontScale = useCallback((scale: number) => {
    const safeScale = Number.isFinite(scale)
      ? Math.min(1.4, Math.max(DEFAULT_FONT_SCALE, scale))
      : DEFAULT_FONT_SCALE;
    commitSettings((current) => ({
      ...current,
      fontScale: safeScale,
      largeText: safeScale > DEFAULT_FONT_SCALE,
    }));
  }, [commitSettings]);

  const setFontWeightScale = useCallback((scale: number) => {
    const safeScale = Math.round(clampNumber(scale, 0, 3, 0));
    commitSettings((current) => ({
      ...current,
      fontWeightScale: safeScale,
      boldText: safeScale > 0,
    }));
  }, [commitSettings]);

  const setReadabilitySpacingScale = useCallback((scale: number) => {
    const safeScale = Math.round(clampNumber(scale, 0, 3, 0));
    commitSettings((current) => ({
      ...current,
      readabilitySpacingScale: safeScale,
      readabilitySpacing: safeScale > 0,
    }));
  }, [commitSettings]);

  const setSelectionHighlightIntensity = useCallback((intensity: number) => {
    const safeIntensity = Math.round(clampNumber(intensity, 0, 3, 0));
    commitSettings((current) => ({
      ...current,
      selectionHighlightIntensity: safeIntensity,
      strongSelectionHighlight: safeIntensity > 0,
    }));
  }, [commitSettings]);

  const setPressFeedbackIntensity = useCallback((intensity: number) => {
    const safeIntensity = Math.round(clampNumber(intensity, 0, 3, 0));
    commitSettings((current) => ({
      ...current,
      pressFeedbackIntensity: safeIntensity,
      clearPressFeedback: safeIntensity > 0,
    }));
  }, [commitSettings]);

  const applyVisualImpairmentPreset = useCallback(() => {
    commitSettings((current) => ({
      ...current,
      speechEnabled: true,
      feedbackEnabled: true,
      highContrast: true,
      largeText: true,
      voiceCommandsEnabled: true,
      speechVolume: Math.max(current.speechVolume, 0.9),
      fontScale: Math.max(current.fontScale, 1.2),
      fontWeightScale: Math.max(current.fontWeightScale, 1),
      readabilitySpacingScale: Math.max(current.readabilitySpacingScale, 1),
    }));
  }, [commitSettings]);

  const resetAccessibilitySettings = useCallback(() => {
    commitSettings(defaultSettings);
  }, [commitSettings]);

  const announce = useCallback(
    (text: string) => {
      if (!settings.feedbackEnabled || !text) {
        return;
      }

      if (announceTimeoutRef.current !== null) {
        window.clearTimeout(announceTimeoutRef.current);
      }

      setLiveMessage('');
      announceTimeoutRef.current = window.setTimeout(() => {
        setLiveMessage(text);
        announceTimeoutRef.current = null;
      }, 40);
    },
    [settings.feedbackEnabled],
  );

  const value = useMemo(
    () => ({
      speechEnabled: settings.speechEnabled,
      feedbackEnabled: settings.feedbackEnabled,
      highContrast: settings.highContrast,
      largeText: settings.largeText,
      simplifiedMode: settings.simplifiedMode,
      voiceCommandsEnabled: settings.voiceCommandsEnabled,
      speechRate: settings.speechRate,
      speechVolume: settings.speechVolume,
      fontScale: settings.fontScale,
      fontWeightScale: settings.fontWeightScale,
      readabilitySpacingScale: settings.readabilitySpacingScale,
      selectionHighlightIntensity: settings.selectionHighlightIntensity,
      pressFeedbackIntensity: settings.pressFeedbackIntensity,
      boldText: settings.boldText,
      readabilitySpacing: settings.readabilitySpacing,
      strongSelectionHighlight: settings.strongSelectionHighlight,
      alwaysShowTextLabels: settings.alwaysShowTextLabels,
      largerTouchTargets: settings.largerTouchTargets,
      clearPressFeedback: settings.clearPressFeedback,
      reduceMotion: settings.reduceMotion,
      hydrated,
      lastAnnouncement,
      liveMessage,
      toggleSpeechEnabled,
      toggleFeedbackEnabled,
      toggleHighContrast,
      toggleLargeText,
      toggleSimplifiedMode,
      toggleVoiceCommandsEnabled,
      setSpeechEnabled,
      setFeedbackEnabled,
      setHighContrast,
      setLargeText,
      setSimplifiedMode,
      setVoiceCommandsEnabled,
      setSpeechRate,
      setSpeechVolume,
      setFontScale,
      setFontWeightScale,
      setReadabilitySpacingScale,
      setSelectionHighlightIntensity,
      setPressFeedbackIntensity,
      applyVisualImpairmentPreset,
      resetAccessibilitySettings,
      setLastAnnouncement,
      announce,
    }),
    [
      announce,
      applyVisualImpairmentPreset,
      hydrated,
      lastAnnouncement,
      liveMessage,
      setFeedbackEnabled,
      setFontScale,
      setFontWeightScale,
      setHighContrast,
      setLargeText,
      setPressFeedbackIntensity,
      setReadabilitySpacingScale,
      resetAccessibilitySettings,
      setSelectionHighlightIntensity,
      setSimplifiedMode,
      setSpeechEnabled,
      setSpeechRate,
      setSpeechVolume,
      setVoiceCommandsEnabled,
      settings.alwaysShowTextLabels,
      settings.boldText,
      settings.clearPressFeedback,
      settings.feedbackEnabled,
      settings.fontScale,
      settings.fontWeightScale,
      settings.highContrast,
      settings.largeText,
      settings.largerTouchTargets,
      settings.pressFeedbackIntensity,
      settings.readabilitySpacing,
      settings.readabilitySpacingScale,
      settings.reduceMotion,
      settings.selectionHighlightIntensity,
      settings.simplifiedMode,
      settings.speechEnabled,
      settings.speechRate,
      settings.speechVolume,
      settings.strongSelectionHighlight,
      settings.voiceCommandsEnabled,
      toggleFeedbackEnabled,
      toggleHighContrast,
      toggleLargeText,
      toggleSimplifiedMode,
      toggleSpeechEnabled,
      toggleVoiceCommandsEnabled,
    ],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used inside AccessibilityProvider');
  }
  return context;
}
