import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';

import ThemeProvider from './app/providers/ThemeProvider';
import QueryProvider from './app/providers/QueryProvider';
import AuthProvider from './app/providers/AuthProvider';
import SpeechProvider from './app/providers/SpeechProvider';
import CameraProvider from './app/providers/CameraProvider';
import { AccessibilityProvider } from './app/providers/AccessibilityProvider';
import LanguageProvider from './app/providers/LanguageProvider';

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <LanguageProvider>
            <AccessibilityProvider>
              <SpeechProvider>
                <CameraProvider>
                  <RouterProvider router={router} />
                </CameraProvider>
              </SpeechProvider>
            </AccessibilityProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
