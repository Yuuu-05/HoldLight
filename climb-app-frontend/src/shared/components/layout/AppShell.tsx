import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import MobileActionBar from './MobileActionBar';
import SkipToContent from '../accessibility/SkipToContent';
import LiveRegion from '../accessibility/LiveRegion';
import { routes } from '../../constants/routes';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAssistImmersive = location.pathname.startsWith('/climb/');

  const handleAssistBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(routes.dashboard);
  };

  return (
    <div className={`app-shell ${isAssistImmersive ? 'app-shell-immersive' : ''}`.trim()}>
      <SkipToContent />
      <div className="app-stage">
        <div className={`app-viewport ${isAssistImmersive ? 'app-viewport-immersive' : ''}`.trim()}>
          {isAssistImmersive ? (
            <header className="assist-immersive-topbar">
              <button
                type="button"
                className="assist-immersive-back"
                onClick={handleAssistBack}
                aria-label="Back"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
                  <path
                    d="M14.5 5.5 8 12l6.5 6.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                  />
                </svg>
              </button>
            </header>
          ) : (
            <>
              <Header />
              <MobileActionBar />
            </>
          )}
          <main id="main-content" className={`page-shell ${isAssistImmersive ? 'page-shell-immersive' : ''}`.trim()}>
            <div key={`${location.pathname}${location.search}`} className="page-transition">
              <Outlet />
            </div>
          </main>
          {!isAssistImmersive ? <BottomNav /> : null}
        </div>
      </div>
      <LiveRegion />
    </div>
  );
}
