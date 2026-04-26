import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import SkipToContent from '../accessibility/SkipToContent';
import LiveRegion from '../accessibility/LiveRegion';
import { routes } from '../../constants/routes';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAssistImmersive = location.pathname.startsWith('/climb/');
  const showHeaderRoutes = new Set([
    routes.home,
    routes.dashboard,
    routes.profileSettings,
    routes.roleSettings,
  ]);
  const showHeader = showHeaderRoutes.has(location.pathname);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    let frameId = 0;

    const syncViewportVars = () => {
      const visualViewport = window.visualViewport;
      const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      const viewportWidth = Math.round(visualViewport?.width ?? window.innerWidth);
      const offsetTop = Math.max(0, Math.round(visualViewport?.offsetTop ?? 0));
      const offsetLeft = Math.max(0, Math.round(visualViewport?.offsetLeft ?? 0));
      const keyboardInset = Math.max(0, Math.round(window.innerHeight - viewportHeight - offsetTop));

      root.style.setProperty('--app-visual-viewport-height', `${viewportHeight}px`);
      root.style.setProperty('--app-visual-viewport-width', `${viewportWidth}px`);
      root.style.setProperty('--app-visual-viewport-offset-top', `${offsetTop}px`);
      root.style.setProperty('--app-visual-viewport-offset-left', `${offsetLeft}px`);
      root.style.setProperty('--app-keyboard-inset', `${keyboardInset}px`);
    };

    const scheduleSync = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncViewportVars);
    };

    syncViewportVars();

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('orientationchange', scheduleSync);
    window.addEventListener('pageshow', scheduleSync);
    visualViewport?.addEventListener('resize', scheduleSync);
    visualViewport?.addEventListener('scroll', scheduleSync);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('orientationchange', scheduleSync);
      window.removeEventListener('pageshow', scheduleSync);
      visualViewport?.removeEventListener('resize', scheduleSync);
      visualViewport?.removeEventListener('scroll', scheduleSync);
    };
  }, []);

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
        <div
          className={`app-viewport ${isAssistImmersive ? 'app-viewport-immersive' : ''} ${showHeader ? '' : 'app-viewport-headerless'}`.trim()}
        >
          {showHeader ? (
            <Header
              variant={isAssistImmersive ? 'assist' : 'default'}
              onBack={isAssistImmersive ? handleAssistBack : undefined}
            />
          ) : null}
          <main
            id="main-content"
            className={`page-shell ${isAssistImmersive ? 'page-shell-immersive' : ''} ${showHeader ? '' : 'page-shell-headerless'}`.trim()}
          >
            <div key={`${location.pathname}${location.search}`} className="page-transition">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <LiveRegion />
    </div>
  );
}
