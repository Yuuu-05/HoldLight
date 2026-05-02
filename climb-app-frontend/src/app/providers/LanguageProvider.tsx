import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { getUserPreferencesApi, updateUserPreferencesApi } from '../../shared/api/users.api';
import { translations, type Language } from '../../shared/i18n/translations';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const LANGUAGE_STORAGE_KEY = 'climbAppLanguage';
const LANGUAGE_SELECTION_STORAGE_KEY = 'climbAppLanguageSelected';
const DEFAULT_LANGUAGE: Language = 'en';
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function isSupportedLanguage(language: string | null): language is Language {
  return language === 'zh' || language === 'en';
}

function getExplicitStoredLanguage(): Language | null {
  if (typeof window === 'undefined') return null;

  const hasExplicitSelection = window.localStorage.getItem(LANGUAGE_SELECTION_STORAGE_KEY) === 'true';
  if (!hasExplicitSelection) return null;

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguage(stored) ? stored : null;
}

function persistLanguage(language: Language, explicitSelection = false) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  if (explicitSelection) {
    window.localStorage.setItem(LANGUAGE_SELECTION_STORAGE_KEY, 'true');
  }
}

function getInitialLanguage(): Language {
  return getExplicitStoredLanguage() ?? DEFAULT_LANGUAGE;
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isUsingDevAuth, loading } = useAuth();
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const hydratedRef = useRef(false);

  useEffect(() => {
    persistLanguage(language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

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
        const explicitStoredLanguage = getExplicitStoredLanguage();
        const nextLanguage = explicitStoredLanguage ?? DEFAULT_LANGUAGE;
        setLanguageState(nextLanguage);
        if (preferences.language !== nextLanguage) {
          void updateUserPreferencesApi({ language: nextLanguage });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          hydratedRef.current = true;
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isUsingDevAuth, loading]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        persistLanguage(nextLanguage, true);
        setLanguageState(nextLanguage);
        if (hydratedRef.current && isAuthenticated && !isUsingDevAuth) {
          void updateUserPreferencesApi({ language: nextLanguage });
        }
      },
      toggleLanguage: () =>
        setLanguageState((current) => {
          const next = current === 'en' ? 'zh' : 'en';
          persistLanguage(next, true);
          if (hydratedRef.current && isAuthenticated && !isUsingDevAuth) {
            void updateUserPreferencesApi({ language: next });
          }
          return next;
        }),
      t: (key: string) => translations[language][key as keyof (typeof translations)[typeof language]] ?? key,
    }),
    [isAuthenticated, isUsingDevAuth, language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}
