import { createBrowserRouter } from 'react-router-dom';
import AppShell from '../shared/components/layout/AppShell';
import LandingPage from '../pages/LandingPage';
import NotFoundPage from '../pages/NotFoundPage';
import ForbiddenPage from '../pages/ForbiddenPage';
import LoadingPage from '../pages/LoadingPage';
import ServerErrorPage from '../pages/ServerErrorPage';
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import LogoutPage from '../features/auth/pages/LogoutPage';
import DashboardPage from '../features/dashboard/pages/CoreDashboardPage';
import ProfilePage from '../features/profile/pages/ProfilePage';
import ProfileSettingsPage from '../features/profile/pages/ProfileSettingsPage';
import RoleSettingsPage from '../features/profile/pages/RoleSettingsPage';
import ScanWallPage from '../features/climb-assist/pages/ScanWallPage';
import SelectDifficultyPage from '../features/climb-assist/pages/SelectDifficultyPage';
import LiveGuidancePage from '../features/climb-assist/pages/LiveGuidancePage';
import ClimbSummaryPage from '../features/climb-assist/pages/ClimbSummaryPage';
import FirstLoginProfilePage from '../features/onboarding/pages/FirstLoginProfilePage';
import ProtectedRoute from './guards/ProtectedRoute';
import GuestRoute from './guards/GuestRoute';
import { routes } from '../shared/constants/routes';

const withProtected = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'loading', element: <LoadingPage /> },
      { path: '403', element: <ForbiddenPage /> },
      {
        path: 'login',
        element: (
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        ),
      },
      {
        path: 'register',
        element: (
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        ),
      },
      { path: 'logout', element: withProtected(<LogoutPage />) },
      { path: 'onboarding', element: <ProtectedRoute><FirstLoginProfilePage /></ProtectedRoute> },
      { path: 'dashboard', element: withProtected(<DashboardPage />) },
      { path: 'profile', element: withProtected(<ProfilePage />) },
      { path: 'profile/settings', element: withProtected(<ProfileSettingsPage />) },
      { path: 'profile/role', element: withProtected(<RoleSettingsPage />) },
      { path: 'climb/scan', element: withProtected(<ScanWallPage />) },
      { path: 'climb/difficulty', element: withProtected(<SelectDifficultyPage />) },
      { path: 'climb/route', element: withProtected(<SelectDifficultyPage />) },
      { path: 'climb/live', element: withProtected(<LiveGuidancePage />) },
      { path: 'climb/summary', element: withProtected(<ClimbSummaryPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
