import { useEffect, type PropsWithChildren } from 'react';

export default function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
  }, []);

  return <>{children}</>;
}
