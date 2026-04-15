interface ErrorStateProps {
  message: string;
  id?: string;
}

export default function ErrorState({ message, id }: ErrorStateProps) {
  return (
    <p id={id} className="error-banner" role="alert" aria-live="assertive">
      {message}
    </p>
  );
}
