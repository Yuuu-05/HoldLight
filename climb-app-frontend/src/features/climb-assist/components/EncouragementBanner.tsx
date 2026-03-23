interface EncouragementBannerProps {
  text: string;
}

export default function EncouragementBanner({ text }: EncouragementBannerProps) {
  return <p className="success-banner assist-encouragement-banner">{text}</p>;
}
