interface ScanPermissionNoticeProps {
  supported: boolean;
  hasSecureContext?: boolean;
}

export default function ScanPermissionNotice({ supported, hasSecureContext = true }: ScanPermissionNoticeProps) {
  if (!supported) {
    return <p className="error-banner">Camera access is not available in this browser, so scanning will fall back to the built-in demo wall map.</p>;
  }

  if (!hasSecureContext) {
    return <p className="error-banner">Camera access in mobile browsers needs HTTPS or localhost. The demo wall map is still available for development and testing.</p>;
  }

  return <p className="subtle-text">Use the rear camera, keep the wall centered, and scan slowly from lower holds to higher holds for better hold recognition.</p>;
}
