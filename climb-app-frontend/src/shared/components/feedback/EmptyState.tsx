interface EmptyStateProps {
  title: string;
  body: string;
}

export default function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
