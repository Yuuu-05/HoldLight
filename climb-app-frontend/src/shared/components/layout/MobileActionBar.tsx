import { Link } from 'react-router-dom';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { routes } from '../../constants/routes';

export default function MobileActionBar() {
  const { t } = useLanguage();

  return (
    <div className="mobile-action-bar">
      <Link className="chip-link" to={routes.scanWall}>{t('Start scan')}</Link>
      <Link className="chip-link" to={routes.socialFeed}>{t('Community')}</Link>
      <Link className="chip-link" to={routes.tutorialHome}>{t('Tutorial')}</Link>
    </div>
  );
}
