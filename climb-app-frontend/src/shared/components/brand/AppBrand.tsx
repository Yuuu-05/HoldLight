import { Link, type To } from 'react-router-dom';
import logoSource from '../../../assets/brand/holdlight-logo-square.jpg';

type BrandSize = 'sm' | 'md' | 'lg';

interface AppBrandProps {
  to?: To;
  size?: BrandSize;
  label?: string;
  showLabel?: boolean;
  decorative?: boolean;
  className?: string;
  badgeClassName?: string;
  labelClassName?: string;
  ariaLabel?: string;
}

function joinClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(' ');
}

export default function AppBrand({
  to,
  size = 'md',
  label = 'HoldLight',
  showLabel = true,
  decorative = false,
  className,
  badgeClassName,
  labelClassName,
  ariaLabel,
}: AppBrandProps) {
  const accessibleLabel = ariaLabel ?? label;
  const brandClassName = joinClassNames(
    'app-brand',
    `app-brand--${size}`,
    !showLabel && 'app-brand--icon-only',
    className,
  );
  const imageAlt = showLabel || decorative ? '' : accessibleLabel;
  const imageAriaHidden = showLabel || decorative ? true : undefined;
  const content = (
    <>
      <span className={joinClassNames('app-brand-badge', badgeClassName)}>
        <img
          className="app-brand-image"
          src={logoSource}
          alt={imageAlt}
          aria-hidden={imageAriaHidden}
          draggable={false}
          loading="eager"
          decoding="async"
        />
      </span>
      {showLabel ? <span className={joinClassNames('app-brand-label', labelClassName)}>{label}</span> : null}
    </>
  );

  if (to) {
    return (
      <Link className={brandClassName} to={to} aria-label={!showLabel ? accessibleLabel : undefined}>
        {content}
      </Link>
    );
  }

  return <span className={brandClassName}>{content}</span>;
}
