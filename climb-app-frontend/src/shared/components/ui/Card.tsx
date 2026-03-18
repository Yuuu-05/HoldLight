import type { PropsWithChildren } from 'react';

interface CardProps extends PropsWithChildren {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
}

export default function Card({ title, actions, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions) && (
        <header className="card-header">
          {title ? <h2 className="card-title">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
