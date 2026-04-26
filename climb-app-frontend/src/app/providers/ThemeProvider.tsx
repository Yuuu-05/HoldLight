import { useEffect, type PropsWithChildren } from 'react';

export default function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.dataset.theme) {
      root.dataset.theme = 'calm';
    }
  }, []);

  return <>{children}</>;
}
