import { Link } from 'react-router-dom';
import { useAccessibility } from '../../../app/providers/AccessibilityProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useCamera } from '../../../app/providers/CameraProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { ScanIcon } from '../../../shared/components/icons/AppIcons';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import '../dashboard.css';

export default function CoreDashboardPage() {
  const { simplifiedMode } = useAccessibility();
  const { user } = useAuth();
  const { requestAccess, supported } = useCamera();
  const { t } = useLanguage();

  usePageTitle('Dashboard');

  const username = user?.username?.trim() || t('Climber');
  const scanLabel = t('Start scan');
  const scanHint = t('Scan the current wall, then move into route check and voice cues.');
  const canWarmCamera = supported && (typeof window === 'undefined' || window.isSecureContext);

  const handleStartScan = () => {
    if (!canWarmCamera) return;

    void requestAccess({
      preferredFacingMode: 'environment',
      allowFallback: true,
    });
  };

  return (
    <div className="dashboard-page dashboard-page--minimal">
      <section className="dashboard-main-hero" aria-label={t('Dashboard')}>
        <div className="dashboard-main-greeting">
          <span>{t('Hi')}</span>
          <strong>{username}</strong>
        </div>

        <Link to={routes.scanWall} className="dashboard-scan-entry" aria-label={scanLabel} onClick={handleStartScan}>
          <span className="dashboard-scan-icon" aria-hidden="true">
            <ScanIcon active />
          </span>
          <span className="dashboard-scan-copy">
            <span className="dashboard-scan-label">{scanLabel}</span>
            {simplifiedMode ? null : <span className="dashboard-scan-hint">{scanHint}</span>}
          </span>
        </Link>
      </section>
    </div>
  );
}
