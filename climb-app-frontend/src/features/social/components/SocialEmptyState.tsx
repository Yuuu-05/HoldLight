import type { ReactNode } from 'react';
import GuideMascot, { type MascotPose } from '../../../shared/components/illustration/GuideMascot';

interface SocialEmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
  kicker?: string;
  pose?: MascotPose;
}

export default function SocialEmptyState({
  title,
  body,
  action,
  className = '',
  kicker = 'Cozy Basecamp',
  pose = 'tilt',
}: SocialEmptyStateProps) {
  return (
    <section className={`social-empty-state ${className}`.trim()}>
      <div className="social-empty-card">
        <div className="social-empty-copy stack-sm">
          <p className="social-eyebrow">{kicker}</p>
          <h2>{title}</h2>
          <p>{body}</p>
          {action ? <div className="social-empty-action">{action}</div> : null}
        </div>

        <div className="social-empty-art" aria-hidden="true">
          <span className="social-empty-swatch social-empty-swatch-one" />
          <span className="social-empty-swatch social-empty-swatch-two" />
          <GuideMascot className="social-empty-mascot" pose={pose} />
        </div>
      </div>
    </section>
  );
}
