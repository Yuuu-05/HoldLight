import AssistMascotSticker from './AssistMascotSticker';

interface ScanPermissionNoticeProps {
  supported: boolean;
  hasSecureContext?: boolean;
}

export default function ScanPermissionNotice({ supported, hasSecureContext = true }: ScanPermissionNoticeProps) {
  if (!supported) {
    return (
      <div className="assist-permission-notice assist-permission-notice-warning" role="note">
        <AssistMascotSticker variant="flashlight" className="assist-permission-mascot" />
        <div className="assist-permission-copy">
          <p className="assist-permission-kicker">Camera unavailable</p>
          <p>Camera access is not available in this browser, so scanning will fall back to the built-in demo wall map.</p>
        </div>
      </div>
    );
  }

  if (!hasSecureContext) {
    return (
      <div className="assist-permission-notice assist-permission-notice-warning" role="note">
        <AssistMascotSticker variant="flashlight" className="assist-permission-mascot" />
        <div className="assist-permission-copy">
          <p className="assist-permission-kicker">HTTPS needed</p>
          <p>Camera access in mobile browsers needs HTTPS or localhost. The demo wall map is still available for development and testing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assist-permission-notice assist-permission-notice-ok" role="note">
      <div className="assist-permission-copy">
        <p className="assist-permission-kicker">Camera ready</p>
        <p>Use the rear camera, keep the wall centered, and scan slowly from lower holds to higher holds for better hold recognition.</p>
      </div>
    </div>
  );
}
