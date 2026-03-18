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
import type { AccessibilityPreferences } from '../../shared/types/preferences';

type AccessibilityContextType = {
  speechEnabled: boolean;
  feedbackEnabled: boolean;
  highContrast: boolean;
  largeText: boolean;
  simplifiedMode: boolean;
  voiceCommandsEnabled: boolean;
  speechRate: number;
  fontScale: number;
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
  setFontScale: (scale: number) => void;
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
  fontScale: DEFAULT_FONT_SCALE,
};

function getInitialSettings() {
  return readStorage<AccessibilityPreferences>(storageKeys.accessibility, defaultSettings);
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isUsingDevAuth, loading } = useAuth();
  const [settings, setSettings] = useState<AccessibilityPreferences>(getInitialSettings);
  const [lastAnnouncement, setLastAnnouncement] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const announceTimeoutRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    writeStorage(storageKeys.accessibility, settings);
    const root = document.documentElement;
    root.dataset.contrast = settings.highContrast ? 'high' : 'default';
    root.dataset.simplified = settings.simplifiedMode ? 'true' : 'false';
    root.style.setProperty('--font-scale', `${settings.fontScale}`);
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
      return;
    }

    let active = true;
    getUserPreferencesApi()
      .then((preferences) => {
        if (!active) return;
        setSettings({
          ...defaultSettings,
          ...preferences.accessibility,
        });
      })
      .finally(() => {
        if (active) {
          hydratedRef.current = true;
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isUsingDevAuth, loading]);

  const commitSettings = useCallback(
    (updater: AccessibilityPreferences | ((current: AccessibilityPreferences) => AccessibilityPreferences)) => {
      setSettings((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        if (hydratedRef.current && isAuthenticated && !isUsingDevAuth) {
          void updateUserPreferencesApi({ accessibility: next });
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
      fontScale: settings.fontScale,
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
      setFontScale,
      setLastAnnouncement,
      announce,
    }),
    [
      announce,
      lastAnnouncement,
      liveMessage,
      setFeedbackEnabled,
      setFontScale,
      setHighContrast,
      setLargeText,
      setSimplifiedMode,
      setSpeechEnabled,
      setSpeechRate,
      setVoiceCommandsEnabled,
      settings.feedbackEnabled,
      settings.fontScale,
      settings.highContrast,
      settings.largeText,
      settings.simplifiedMode,
      settings.speechEnabled,
      settings.speechRate,
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
