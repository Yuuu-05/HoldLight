interface SuccessBannerProps {
  message: string;
  id?: string;
}

export default function SuccessBanner({ message, id }: SuccessBannerProps) {
  return (
    <p id={id} className="success-banner" role="status" aria-live="polite">
      {message}
    </p>
  );
}
