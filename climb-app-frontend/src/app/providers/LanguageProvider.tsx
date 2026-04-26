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
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'zh';
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'zh' || stored === 'en' ? stored : 'zh';
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isUsingDevAuth, loading } = useAuth();
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const hydratedRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
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
        setLanguageState(preferences.language);
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

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        if (hydratedRef.current && isAuthenticated && !isUsingDevAuth) {
          void updateUserPreferencesApi({ language: nextLanguage });
        }
      },
      toggleLanguage: () =>
        setLanguageState((current) => {
          const next = current === 'en' ? 'zh' : 'en';
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
