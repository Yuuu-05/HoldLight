import { useLanguage } from '../../../app/providers/LanguageProvider';
import AssistMascotSticker from './AssistMascotSticker';

interface ScanPermissionNoticeProps {
  supported: boolean;
  hasSecureContext?: boolean;
}

export default function ScanPermissionNotice({ supported, hasSecureContext = true }: ScanPermissionNoticeProps) {
  const { t } = useLanguage();

  if (!supported) {
    return (
      <div className="assist-permission-notice assist-permission-notice-warning" role="note">
        <AssistMascotSticker variant="flashlight" className="assist-permission-mascot" />
        <div className="assist-permission-copy">
          <p className="assist-permission-kicker">{t('Camera unavailable')}</p>
          <p>{t('Camera access is not available in this browser. Use a supported mobile browser or upload a wall photo or video instead.')}</p>
        </div>
      </div>
    );
  }

  if (!hasSecureContext) {
    return (
      <div className="assist-permission-notice assist-permission-notice-warning" role="note">
        <AssistMascotSticker variant="flashlight" className="assist-permission-mascot" />
        <div className="assist-permission-copy">
          <p className="assist-permission-kicker">{t('HTTPS needed')}</p>
          <p>{t('Camera access in mobile browsers needs HTTPS or localhost. Publish the site over HTTPS or upload a wall photo or video instead.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assist-permission-ready" role="status" aria-live="polite">
      <p className="assist-permission-kicker">{t('Camera ready')}</p>
    </div>
  );
}
