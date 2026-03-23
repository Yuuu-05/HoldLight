import GuideMascot from './GuideMascot';

interface MascotStatusLoaderProps {
  title: string;
  message: string;
}

export default function MascotStatusLoader({ title, message }: MascotStatusLoaderProps) {
  return (
    <div className="mascot-loader-card">
      <div className="mascot-loader-figure">
        <GuideMascot className="guide-mascot mascot-loader-mascot" pose="celebrate" />
      </div>
      <div className="stack-sm">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
