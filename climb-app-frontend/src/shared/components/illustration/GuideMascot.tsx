export type MascotPose = 'idle' | 'tilt' | 'nod' | 'celebrate';

interface GuideMascotProps {
  className?: string;
  pose?: MascotPose;
}

export default function GuideMascot({ className = '', pose = 'idle' }: GuideMascotProps) {
  const stroke = '#2c1e16';
  const orange = '#ff6b00';
  const yellow = '#ffd13b';
  const cheek = '#ff8b7a';
  const headbandRed = '#ff3333';

  return (
    <svg
      viewBox="0 0 240 260"
      className={`guide-mascot-svg guide-mascot-pose-${pose} ${className}`.trim()}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <ellipse cx="120" cy="245" rx="45" ry="8" fill="rgba(44, 30, 22, 0.12)" />

      <g className="guide-mascot-tail">
        <path d="M 140 180 Q 160 190 165 175 Q 170 160 180 165" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 140 180 Q 160 190 165 175 Q 170 160 180 165" fill="none" stroke={orange} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g className="guide-mascot-arms">
        <path d="M 85 160 Q 55 180 75 200" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 85 160 Q 55 180 75 200" fill="none" stroke={orange} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 155 160 Q 185 180 165 200" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 155 160 Q 185 180 165 200" fill="none" stroke={orange} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g className="guide-mascot-legs">
        <path d="M 100 200 Q 90 220 90 230" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 100 200 Q 90 220 90 230" fill="none" stroke={orange} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 140 200 Q 150 220 150 230" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 140 200 Q 150 220 150 230" fill="none" stroke={orange} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g className="guide-mascot-body">
        <ellipse cx="120" cy="170" rx="40" ry="45" fill={orange} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="120" cy="175" rx="25" ry="30" fill={yellow} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />

        <g transform="translate(85, 175) rotate(-15)">
          <path d="M 0 0 C -5 15, -5 25, 5 30 C 15 25, 15 15, 10 0 Z" fill="#e8e4df" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="5" cy="0" rx="8" ry="3" fill="#fff" stroke={stroke} strokeWidth="3" />
          <circle cx="2" cy="-5" r="3" fill="#fff" opacity="0.8" />
          <circle cx="7" cy="-3" r="2" fill="#fff" opacity="0.6" />
        </g>
      </g>

      <g className="guide-mascot-head">
        <circle cx="40" cy="100" r="22" fill={orange} stroke={stroke} strokeWidth="3" />
        <circle cx="200" cy="100" r="22" fill={orange} stroke={stroke} strokeWidth="3" />
        <circle cx="40" cy="100" r="10" fill={yellow} stroke={stroke} strokeWidth="3" />
        <circle cx="200" cy="100" r="10" fill={yellow} stroke={stroke} strokeWidth="3" />

        <ellipse cx="120" cy="95" rx="75" ry="55" fill={orange} stroke={stroke} strokeWidth="3" />
        <path
          d="M 120 142 C 80 142, 55 120, 55 95 C 55 70, 80 55, 100 65 C 110 70, 115 78, 120 82 C 125 78, 130 70, 140 65 C 160 55, 185 70, 185 95 C 185 120, 160 142, 120 142 Z"
          fill={yellow}
          stroke={stroke}
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <path d="M 188 58 Q 210 50 220 65" fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" />
        <path d="M 188 58 Q 210 50 220 65" fill="none" stroke={headbandRed} strokeWidth="3" strokeLinecap="round" />
        <path d="M 188 62 Q 200 70 205 85" fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" />
        <path d="M 188 62 Q 200 70 205 85" fill="none" stroke={headbandRed} strokeWidth="3" strokeLinecap="round" />
        <circle cx="188" cy="60" r="5" fill={headbandRed} stroke={stroke} strokeWidth="3" />

        <path d="M 50 75 Q 120 50 190 75 L 188 60 Q 120 35 52 60 Z" fill={headbandRed} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />

        <g transform="translate(120, 55) rotate(2)" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -22 -2 C -26 -2, -26 4, -22 4" />
          <path d="M -16 -3 L -16 4 L -12 4" />
          <path d="M -8 -2 L -8 4" />
          <path d="M -4 4 L -4 -2 L -1 2 L 2 -2 L 2 4" />
          <path d="M 6 -3 L 6 4 M 6 -3 C 10 -3, 10 0, 6 0 C 11 0, 11 4, 6 4" />
        </g>

        <circle cx="85" cy="115" r="10" fill={cheek} opacity="0.9" />
        <circle cx="155" cy="115" r="10" fill={cheek} opacity="0.9" />
        <path d="M 98 100 Q 100 100 102 100" fill="none" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M 138 100 Q 140 100 142 100" fill="none" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M 118 107 Q 120 107 122 107" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M 115 117 Q 120 122 125 117" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
