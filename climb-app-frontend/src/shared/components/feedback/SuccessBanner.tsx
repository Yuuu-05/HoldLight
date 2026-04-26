interface SuccessBannerProps {
  message: string;
}

export default function SuccessBanner({ message }: SuccessBannerProps) {
  return <p className="success-banner">{message}</p>;
}
