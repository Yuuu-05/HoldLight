import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import MobileActionBar from './MobileActionBar';
import SkipToContent from '../accessibility/SkipToContent';
import LiveRegion from '../accessibility/LiveRegion';

export default function AppShell() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <SkipToContent />
      <div className="app-stage">
        <div className="app-viewport">
          <Header />
          <MobileActionBar />
          <main id="main-content" className="page-shell">
            <div key={`${location.pathname}${location.search}`} className="page-transition">
              <Outlet />
            </div>
          </main>
          <BottomNav />
        </div>
      </div>
      <LiveRegion />
    </div>
  );
}
