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
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import ProfilePage from '../features/profile/pages/ProfilePage';
import EditProfilePage from '../features/profile/pages/EditProfilePage';
import RoleSettingsPage from '../features/profile/pages/RoleSettingsPage';
import TutorialHomePage from '../features/tutorial/pages/TutorialHomePage';
import RulesPage from '../features/tutorial/pages/RulesPage';
import EquipmentPage from '../features/tutorial/pages/EquipmentPage';
import TermsPage from '../features/tutorial/pages/TermsPage';
import SafetyTipsPage from '../features/tutorial/pages/SafetyTipsPage';
import AccessibilityHubPage from '../features/accessibility/pages/AccessibilityHubPage';
import VoiceModePage from '../features/accessibility/pages/VoiceModePage';
import FocusPreviewPage from '../features/accessibility/pages/FocusPreviewPage';
import ScanWallPage from '../features/climb-assist/pages/ScanWallPage';
import SelectDifficultyPage from '../features/climb-assist/pages/SelectDifficultyPage';
import RouteRecommendationPage from '../features/climb-assist/pages/RouteRecommendationPage';
import LiveGuidancePage from '../features/climb-assist/pages/LiveGuidancePage';
import ClimbSummaryPage from '../features/climb-assist/pages/ClimbSummaryPage';
import FeedPage from '../features/social/pages/FeedPage';
import CreatePostPage from '../features/social/pages/CreatePostPage';
import PostDetailPage from '../features/social/pages/PostDetailPage';
import MyPostsPage from '../features/social/pages/MyPostsPage';
import FriendsPage from '../features/social/pages/FriendsPage';
import RoomsPage from '../features/social/pages/RoomsPage';
import RoomDetailPage from '../features/social/pages/RoomDetailPage';
import VolunteerBoardPage from '../features/volunteer/pages/VolunteerBoardPage';
import CreateVolunteerPostPage from '../features/volunteer/pages/CreateVolunteerPostPage';
import VolunteerPostDetailPage from '../features/volunteer/pages/VolunteerPostDetailPage';
import MyVolunteerSessionsPage from '../features/volunteer/pages/MyVolunteerSessionsPage';
import ContactIntentPage from '../features/volunteer/pages/ContactIntentPage';
import FirstLoginProfilePage from '../features/onboarding/pages/FirstLoginProfilePage';
import ProtectedRoute from './guards/ProtectedRoute';
import GuestRoute from './guards/GuestRoute';
import OnboardingGuard from './guards/OnboardingGuard';

const withProtected = (element: JSX.Element) => (
  <ProtectedRoute>
    <OnboardingGuard>{element}</OnboardingGuard>
  </ProtectedRoute>
);

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
      { path: 'profile/edit', element: withProtected(<EditProfilePage />) },
      { path: 'profile/role', element: withProtected(<RoleSettingsPage />) },
      { path: 'tutorial', element: withProtected(<TutorialHomePage />) },
      { path: 'tutorial/rules', element: withProtected(<RulesPage />) },
      { path: 'tutorial/equipment', element: withProtected(<EquipmentPage />) },
      { path: 'tutorial/terms', element: withProtected(<TermsPage />) },
      { path: 'tutorial/safety', element: withProtected(<SafetyTipsPage />) },
      { path: 'accessibility', element: withProtected(<AccessibilityHubPage />) },
      { path: 'accessibility/voice', element: withProtected(<VoiceModePage />) },
      { path: 'accessibility/focus-preview', element: withProtected(<FocusPreviewPage />) },
      { path: 'climb/scan', element: withProtected(<ScanWallPage />) },
      { path: 'climb/difficulty', element: withProtected(<SelectDifficultyPage />) },
      { path: 'climb/route', element: withProtected(<RouteRecommendationPage />) },
      { path: 'climb/live', element: withProtected(<LiveGuidancePage />) },
      { path: 'climb/summary', element: withProtected(<ClimbSummaryPage />) },
      { path: 'social', element: withProtected(<FeedPage />) },
      { path: 'social/new', element: withProtected(<CreatePostPage />) },
      { path: 'social/my', element: withProtected(<MyPostsPage />) },
      { path: 'social/friends', element: withProtected(<FriendsPage />) },
      { path: 'social/rooms', element: withProtected(<RoomsPage />) },
      { path: 'social/rooms/:roomId', element: withProtected(<RoomDetailPage />) },
      { path: 'social/:postId', element: withProtected(<PostDetailPage />) },
      { path: 'volunteer', element: withProtected(<VolunteerBoardPage />) },
      { path: 'volunteer/new', element: withProtected(<CreateVolunteerPostPage />) },
      { path: 'volunteer/my-sessions', element: withProtected(<MyVolunteerSessionsPage />) },
      { path: 'volunteer/contact-intent', element: withProtected(<ContactIntentPage />) },
      { path: 'volunteer/:postId', element: withProtected(<VolunteerPostDetailPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
