import type { CSSProperties, HTMLAttributes, PropsWithChildren } from 'react';

interface CardProps extends PropsWithChildren, Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
}

export default function Card({
  title,
  actions,
  className = '',
  bodyClassName = '',
  children,
  style,
  ...props
}: CardProps) {
  return (
    <section className={`card ${className}`.trim()} style={style} {...props}>
      {(title || actions) && (
        <header className="card-header">
          {title ? <h2 className="card-title">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
