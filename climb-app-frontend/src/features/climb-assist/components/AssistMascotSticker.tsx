import GuideMascot from '../../../shared/components/illustration/GuideMascot';

interface AssistMascotStickerProps {
  variant?: 'observe' | 'flashlight';
  className?: string;
}

export default function AssistMascotSticker({
  variant = 'observe',
  className = '',
}: AssistMascotStickerProps) {
  return (
    <div className={`assist-mascot-sticker assist-mascot-sticker-${variant} ${className}`.trim()} aria-hidden="true">
      <span className="assist-mascot-backdrop" />
      <GuideMascot
        pose={variant === 'observe' ? 'tilt' : 'nod'}
        className="assist-mascot-character"
      />
      {variant === 'observe' ? (
        <>
          <span className="assist-mascot-scan-ring" />
          <span className="assist-mascot-scan-dot assist-mascot-scan-dot-1" />
          <span className="assist-mascot-scan-dot assist-mascot-scan-dot-2" />
        </>
      ) : (
        <>
          <span className="assist-mascot-flashlight-handle" />
          <span className="assist-mascot-flashlight-head" />
          <span className="assist-mascot-flashlight-beam" />
        </>
      )}
    </div>
  );
}
