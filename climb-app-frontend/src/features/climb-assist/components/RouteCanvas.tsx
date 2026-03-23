import type { MouseEvent } from 'react';
import type { Hold, WallMap } from '../../../shared/types/climb';

interface RouteCanvasProps {
  holds?: readonly string[];
  wallMap?: WallMap;
  backgroundImageUrl?: string;
  highlightHoldIds?: string[];
  completedHoldIds?: string[];
  currentHoldId?: string;
  selectedHoldId?: string;
  showDetectionLabels?: boolean;
  onHoldSelect?: (hold: Hold) => void;
  onCanvasSelect?: (position: { xPct: number; yPct: number }) => void;
  helperText?: string;
}

const colorMap: Record<string, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  yellow: '#eab308',
  pink: '#ec4899',
  purple: '#9333ea',
  orange: '#ea580c',
  black: '#1f2937',
  white: '#f8fafc',
  unknown: '#94a3b8',
};

export default function RouteCanvas({
  holds,
  wallMap,
  backgroundImageUrl,
  highlightHoldIds = [],
  completedHoldIds = [],
  currentHoldId,
  selectedHoldId,
  showDetectionLabels = true,
  onHoldSelect,
  onCanvasSelect,
  helperText,
}: RouteCanvasProps) {
  if (!wallMap) {
    return (
      <div className="route-canvas">
        {(holds ?? []).map((hold, index) => (
          <div key={hold} className="route-node">
            <span className="route-node-index">{index + 1}</span>
            <span>{hold}</span>
          </div>
        ))}
      </div>
    );
  }

  const highlighted = new Set(highlightHoldIds);
  const completed = new Set(completedHoldIds);
  const hasHighlights = highlightHoldIds.length > 0;

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    if (!onCanvasSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    onCanvasSelect({
      xPct: Number(xPct.toFixed(2)),
      yPct: Number(yPct.toFixed(2)),
    });
  }

  const aspectRatio = `${Math.max(1, wallMap.width)} / ${Math.max(1, wallMap.height)}`;

  return (
    <div className="stack-sm">
      <div
        className={`route-canvas assist-route-canvas ${backgroundImageUrl ? 'has-image' : 'is-empty'} ${onCanvasSelect ? 'is-clickable' : ''}`.trim()}
        onClick={onCanvasSelect ? handleCanvasClick : undefined}
        style={{
          aspectRatio,
          minHeight: '340px',
        }}
      >
        {backgroundImageUrl ? (
          <img
            src={backgroundImageUrl}
            alt="Detected climbing wall"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        ) : null}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: backgroundImageUrl ? 'rgba(20, 26, 42, 0.12)' : 'transparent',
            pointerEvents: 'none',
          }}
        />

        {wallMap.holds.map((hold) => {
          const isHighlighted = highlighted.has(hold.id);
          const isCompleted = completed.has(hold.id);
          const isCurrent = currentHoldId === hold.id;
          const isSelected = selectedHoldId === hold.id;
          const hasBox = hold.x1Pct !== undefined
            && hold.y1Pct !== undefined
            && hold.x2Pct !== undefined
            && hold.y2Pct !== undefined;
          const basePixelSize = hold.radiusPct ? hold.radiusPct * 6 : isCurrent ? 30 : 24;
          const pixelSize = isCurrent ? basePixelSize + 8 : basePixelSize;
          const boxWidthPct = hasBox ? Math.max(0.8, hold.x2Pct! - hold.x1Pct!) : 0;
          const boxHeightPct = hasBox ? Math.max(0.8, hold.y2Pct! - hold.y1Pct!) : 0;
          const holdColor = colorMap[hold.color] || colorMap.unknown;
          const borderColor = isSelected
            ? '#ff4638'
            : isHighlighted
              ? holdColor
              : backgroundImageUrl
                ? `${holdColor}dd`
                : 'rgba(15, 23, 42, 0.28)';
          const labelVisible = Boolean(backgroundImageUrl && hasBox && showDetectionLabels);
          const holdTitle = `${hold.label} (${hold.color})`;
          const holdLabel = `${hold.label}, ${hold.color}, ${Math.round(hold.confidence * 100)} percent confidence`;
          const holdStyle = {
            position: 'absolute' as const,
            left: hasBox ? `${hold.x1Pct}%` : `${hold.xPct}%`,
            top: hasBox ? `${hold.y1Pct}%` : `${hold.yPct}%`,
            width: hasBox ? `${boxWidthPct}%` : `${pixelSize}px`,
            height: hasBox ? `${boxHeightPct}%` : `${pixelSize}px`,
            marginLeft: hasBox ? '0' : `${pixelSize / -2}px`,
            marginTop: hasBox ? '0' : `${pixelSize / -2}px`,
            padding: 0,
            appearance: 'none' as const,
            WebkitAppearance: 'none' as const,
            borderRadius: hasBox ? '14px' : '999px',
            border: `${hasBox || isHighlighted || isSelected ? 3 : 1.5}px solid ${borderColor}`,
            background: hasBox
              ? (isHighlighted ? `${holdColor}22` : 'transparent')
              : holdColor,
            boxShadow: isSelected
              ? '0 0 0 6px rgba(255, 70, 56, 0.2)'
              : isCompleted
                ? '0 0 0 4px rgba(34,197,94,0.25)'
                : isCurrent
                  ? `0 0 0 5px ${holdColor}44`
                  : hasBox && backgroundImageUrl
                    ? `0 2px 10px ${holdColor}20`
                    : 'none',
            opacity: hasHighlights ? (isHighlighted ? 1 : 0.48) : 1,
            transform: isHighlighted || isSelected ? 'scale(1.03)' : 'scale(1)',
            cursor: onHoldSelect ? 'pointer' : 'default',
            backdropFilter: hasBox ? 'saturate(1.05)' : undefined,
          };

          const content = labelVisible ? (
            <div
              className="assist-route-hold-badge"
              style={{
                position: 'absolute',
                left: '6px',
                top: '6px',
                maxWidth: 'calc(100% - 12px)',
                padding: '4px 8px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.92)',
                color: '#0f172a',
                fontSize: '11px',
                fontWeight: 700,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
              }}
            >
              {hold.color} {Math.round(hold.confidence * 100)}%
            </div>
          ) : null;

          if (onHoldSelect) {
            return (
            <button
                key={hold.id}
                type="button"
                className="assist-route-hold"
                title={holdTitle}
                aria-label={holdLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  onHoldSelect(hold);
                }}
                style={holdStyle}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={hold.id} className="assist-route-hold" title={holdTitle} style={holdStyle}>
              {content}
            </div>
          );
        })}
      </div>
      <p className="subtle-text">{helperText || (backgroundImageUrl
        ? `Detection overlay view. ${wallMap.holds.length} holds are drawn on top of the original scan image.`
        : `Detected holds: ${wallMap.holds.length}. Highlighted nodes show the selected route. The bright ring marks the current target.`)}</p>
    </div>
  );
}
