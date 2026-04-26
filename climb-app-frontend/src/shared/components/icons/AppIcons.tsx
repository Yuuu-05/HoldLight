import type { SVGProps } from 'react';
import scanIconSource from '../../../assets/icons/scan-icon.png';

export interface AppIconProps extends SVGProps<SVGSVGElement> {
  active?: boolean;
  decorative?: boolean;
  title?: string;
}

interface MoodIconProps extends Omit<AppIconProps, 'active'> {
  value: 1 | 2 | 3 | 4 | 5;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function IconFrame({
  children,
  className,
  decorative = true,
  title,
  ...props
}: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={joinClassNames('climb-icon', className)}
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative ? title : undefined}
      role={!decorative ? 'img' : undefined}
      focusable="false"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {!decorative && title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const cutout = 'var(--icon-cutout, var(--bg-page, #fbfaf5))';
const navCutout = 'var(--bottom-nav-icon-cutout, var(--icon-cutout, var(--bg-page, #fbfaf5)))';

export function DashboardIcon({ active = false, className, ...props }: AppIconProps) {
  if (active) {
    return (
      <IconFrame className={joinClassNames('climb-icon-dashboard', className)} {...props}>
        <path d="M3.3 10.25 12 3.6l8.7 6.65-1.35 1.95-1.05-.78v8.08H5.7v-8.08l-1.05.78-1.35-1.95Z" fill="currentColor" />
        <path d="M8.1 11.05h3.05v3.05H8.1v-3.05ZM12.85 11.05h3.05v3.05h-3.05v-3.05ZM9.05 15.9h5.9v1.9h-5.9v-1.9Z" fill={navCutout} opacity="0.94" />
      </IconFrame>
    );
  }

  return (
    <IconFrame className={joinClassNames('climb-icon-dashboard', className)} {...props}>
      <path d="M4.1 10.45 12 4.35l7.9 6.1" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" />
      <path d="M6.25 9.55v9h11.5v-9" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" />
      <path d="M8.75 12.05h2.6v2.6h-2.6v-2.6ZM12.65 12.05h2.6v2.6h-2.6v-2.6Z" fill="currentColor" />
    </IconFrame>
  );
}

export function ScanIcon({ active = false, className, ...props }: AppIconProps) {
  return (
    <IconFrame
      className={joinClassNames('climb-icon-scan', className)}
      data-active={active ? 'true' : undefined}
      {...props}
    >
      <image
        href={scanIconSource}
        x="0"
        y="0"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid meet"
      />
    </IconFrame>
  );
}

export function ProfileIcon({ active = false, className, ...props }: AppIconProps) {
  if (active) {
    return (
      <IconFrame className={joinClassNames('climb-icon-profile', className)} {...props}>
        <path d="M5.1 4.6h10.6l3.2 3.15V19.4H5.1V4.6Z" fill="currentColor" />
        <path d="M15.7 4.6v3.15h3.2" fill="none" stroke={navCutout} strokeWidth="1.6" strokeLinejoin="miter" opacity="0.92" />
        <path d="M9.05 10.2c0-1.55 1.22-2.65 2.95-2.65s2.95 1.1 2.95 2.65c0 1.5-1.22 2.58-2.95 2.58s-2.95-1.08-2.95-2.58Z" fill={navCutout} opacity="0.94" />
        <path d="M8.25 16.7c0-1.85 1.55-3.1 3.75-3.1s3.75 1.25 3.75 3.1" stroke={navCutout} strokeWidth="2" strokeLinejoin="miter" opacity="0.94" />
      </IconFrame>
    );
  }

  return (
    <IconFrame className={joinClassNames('climb-icon-profile', className)} {...props}>
      <path d="M5.1 4.6h10.6l3.2 3.15V19.4H5.1V4.6Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" />
      <path d="M15.7 4.6v3.15h3.2" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" />
      <path d="M9.15 10.2c0-1.45 1.15-2.45 2.85-2.45s2.85 1 2.85 2.45-1.15 2.45-2.85 2.45-2.85-1-2.85-2.45Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
      <path d="M8.15 17.05c0-1.9 1.58-3.08 3.85-3.08s3.85 1.18 3.85 3.08" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function HoldIcon({ active = false, className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-hold', className)} {...props}>
      <path
        d="M5.25 9.55 9.15 4.3h6.2l3.4 4.4-1.25 7.3-4.1 3.7H7.5l-2.25-5.05v-5.1Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinejoin="miter"
      />
      <path d="M8.25 12.2h7.2M9.35 15h5" stroke={active ? cutout : 'currentColor'} strokeWidth="1.85" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function CalendarIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-calendar', className)} {...props}>
      <path d="M5 6.25h14v13.15H5V6.25Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="M8 3.7v4.5M16 3.7v4.5M5 10.1h14" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="M8.1 13h2.1v2.1H8.1V13ZM12.95 13h2.1v2.1h-2.1V13Z" fill="currentColor" />
    </IconFrame>
  );
}

export function PhotoIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-photo', className)} {...props}>
      <path d="M4.8 6.1h14.4v11.8H4.8V6.1Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="M7.1 15.7 10 11.95l2.1 2.15 2.7-3.35 2.1 4.95H7.1Z" fill="currentColor" />
      <path d="M14.9 8.55h1.7v1.7h-1.7v-1.7Z" fill="currentColor" />
    </IconFrame>
  );
}

export function GradeIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-grade', className)} {...props}>
      <path d="M5.2 6.25h13.6v11.5H5.2V6.25Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="M8.1 9.15 12 15.75l3.9-6.6" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="miter" />
      <path d="M8.2 18.95h7.6" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function ClimbTypeIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-climb-type', className)} {...props}>
      <path d="M6.2 17.7 9.5 6.25l4 4.25 4.3-2.05" stroke="currentColor" strokeWidth="2.15" strokeLinejoin="miter" />
      <path d="M7.45 16.1h3.1l-0.85 3.15H6.1l1.35-3.15ZM8.65 4.65h3.2v3.2h-3.2v-3.2ZM15.8 6.4h3.05v3.05H15.8V6.4Z" fill="currentColor" />
    </IconFrame>
  );
}

export function GymIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-gym', className)} {...props}>
      <path d="M4.8 8.1 12 4.35l7.2 3.75v11.35H4.8V8.1Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="M8.15 19.45v-6.1h7.7v6.1M8 9.5h2.2M11 9.5h2.2M14 9.5h2.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function SettingsIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-settings', className)} {...props}>
      <path d="M5.2 7.2h7.8M16.1 7.2h2.7M5.2 12h2.7M11 12h7.8M5.2 16.8h6.15M14.45 16.8h4.35" stroke="currentColor" strokeWidth="2.05" strokeLinejoin="miter" />
      <path d="M12.95 5.35h3.15v3.7h-3.15v-3.7ZM7.9 10.15h3.1v3.7H7.9v-3.7ZM11.35 14.95h3.1v3.7h-3.1v-3.7Z" fill="currentColor" />
    </IconFrame>
  );
}

export function ArrowLeftIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-arrow-left', className)} {...props}>
      <path d="M14.6 5.2 7.8 12l6.8 6.8" stroke="currentColor" strokeWidth="2.35" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function ChevronLeftIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-chevron-left', className)} {...props}>
      <path d="M14.1 5.8 8.2 12l5.9 6.2" stroke="currentColor" strokeWidth="2.35" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function ChevronRightIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-chevron-right', className)} {...props}>
      <path d="M9.9 5.8 15.8 12l-5.9 6.2" stroke="currentColor" strokeWidth="2.35" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function SpeechIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-speech', className)} {...props}>
      <path d="M4.7 9h4.1l4.15-3.25v12.5L8.8 15H4.7V9Z" fill="currentColor" />
      <path d="M15.2 8.25c1.55 1.7 1.55 5.8 0 7.5M18.1 6.35c2.7 3.1 2.7 8.2 0 11.3" stroke="currentColor" strokeWidth="2.05" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function VoiceCommandIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-voice', className)} {...props}>
      <path d="M9 5.3 11.1 3.7h1.8L15 5.3v6.1L12.9 13h-1.8L9 11.4V5.3Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="M6.7 10.5c0 3.05 2.05 5 5.3 5s5.3-1.95 5.3-5M12 15.5v4.8M8.55 20.3h6.9" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function FeedbackIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-feedback', className)} {...props}>
      <path d="M4.6 5.8h14.8v9.4h-5.7L9.25 19v-3.8H4.6V5.8Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="m12.65 7.85-3.1 4.2h2.2l-0.7 2.25 3.4-4.35h-2.2l0.6-2.1h-0.2Z" fill="currentColor" />
    </IconFrame>
  );
}

export function ContrastIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-contrast', className)} {...props}>
      <path d="M12 4.4c4.25 0 7.6 3.35 7.6 7.6s-3.35 7.6-7.6 7.6S4.4 16.25 4.4 12 7.75 4.4 12 4.4Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      <path d="M12 4.4v15.2c4.25 0 7.6-3.35 7.6-7.6S16.25 4.4 12 4.4Z" fill="currentColor" />
    </IconFrame>
  );
}

export function TextSizeIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-text-size', className)} {...props}>
      <path d="M4.7 6.2h8.1M8.75 6.2v11.6M6.2 17.8h5.1M13.2 10.1h6.1M16.25 10.1v7.7M14.35 17.8h3.8" stroke="currentColor" strokeWidth="2.05" strokeLinejoin="miter" />
      <path d="M5.95 13.1h5.6M14.35 14.55h3.8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function SimplifiedIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-simplified', className)} {...props}>
      <path d="M5 5.3h6.05v6.05H5V5.3ZM12.95 5.3H19v6.05h-6.05V5.3ZM5 13.25h14v5.45H5v-5.45Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
      <path d="M7.2 15.95h5.3" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function ReduceMotionIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-reduce-motion', className)} {...props}>
      <path d="M5.7 12c0-3.75 2.55-6.45 6.3-6.45 2.6 0 4.65 1.2 5.65 3.15M18.3 12c0 3.75-2.55 6.45-6.3 6.45-2.6 0-4.65-1.2-5.65-3.15" stroke="currentColor" strokeWidth="2.05" strokeLinejoin="miter" />
      <path d="M15.35 5.15h3.05V8.2M8.65 18.85H5.6V15.8" stroke="currentColor" strokeWidth="2.05" strokeLinejoin="miter" />
      <path d="M9.4 8.7h2.05v6.6H9.4V8.7ZM12.55 8.7h2.05v6.6h-2.05V8.7Z" fill="currentColor" />
    </IconFrame>
  );
}

export function FocusIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-focus', className)} {...props}>
      <path d="M8.2 4.8H4.8v3.4M15.8 4.8h3.4v3.4M8.2 19.2H4.8v-3.4M15.8 19.2h3.4v-3.4" stroke="currentColor" strokeWidth="2.15" strokeLinejoin="miter" />
      <path d="M9.15 9.15h5.7v5.7h-5.7v-5.7Z" fill="currentColor" />
    </IconFrame>
  );
}

export function FontIcon({ className, ...props }: AppIconProps) {
  return (
    <IconFrame className={joinClassNames('climb-icon-font', className)} {...props}>
      <path d="M4.8 18.8 9.15 5.2h2.75l4.35 13.6M6.55 14h7.95" stroke="currentColor" strokeWidth="2.05" strokeLinejoin="miter" />
      <path d="M15.2 12.1h4M17.2 12.1v6.7M15.65 18.8h3.1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
    </IconFrame>
  );
}

export function MoodIcon({ value, className, ...props }: MoodIconProps) {
  const mouthPath = {
    1: 'M8.15 16.4c1.55-1.45 6.15-1.45 7.7 0',
    2: 'M8.35 16.15c1.55-0.95 5.75-0.95 7.3 0',
    3: 'M8.45 15.45h7.1',
    4: 'M8.35 14.6c1.55 1.35 5.75 1.35 7.3 0',
    5: 'M8.15 13.95c1.55 2.15 6.15 2.15 7.7 0',
  }[value];

  return (
    <IconFrame className={joinClassNames('climb-icon-mood', `climb-icon-mood-${value}`, className)} {...props}>
      <path d="M5.4 7.35 8.15 4.65h7.7l2.75 2.7v8.9l-3.05 3.1h-7.1l-3.05-3.1v-8.9Z" fill="currentColor" />
      {value <= 2 ? (
        <>
          <path d="M8.45 10.55 10.4 9.5M15.55 10.55 13.6 9.5" stroke={cutout} strokeWidth="1.55" strokeLinejoin="miter" />
          <path d={mouthPath} stroke={cutout} strokeWidth="1.55" strokeLinejoin="miter" />
        </>
      ) : (
        <>
          <path d="M8.65 9.8h1.85v1.85H8.65V9.8ZM13.5 9.8h1.85v1.85H13.5V9.8Z" fill={cutout} />
          <path d={mouthPath} stroke={cutout} strokeWidth="1.55" strokeLinejoin="miter" />
        </>
      )}
    </IconFrame>
  );
}
