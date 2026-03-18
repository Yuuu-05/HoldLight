import { useEffect } from 'react';
import { env } from '../../app/config/env';
import { useLanguage } from '../../app/providers/LanguageProvider';

export function usePageTitle(title: string) {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = `${t(title)} - ${env.appName}`;
  }, [t, title]);
}
