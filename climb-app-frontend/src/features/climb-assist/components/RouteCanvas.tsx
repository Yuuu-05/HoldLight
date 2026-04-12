import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import type { Hold, WallMap } from '../../../shared/types/climb';
import { formatHoldColor } from '../utils/localizedAssistText';

interface RouteOverlay {
  id: string;
  holdIds: string[];
  color?: string;
  emphasis?: 'primary' | 'secondary';
}

interface RouteCanvasProps {
  holds?: readonly string[];
  wallMap?: WallMap;
  backgroundImageUrl?: string;
  plainImagePreview?: boolean;
  fitContainer?: boolean;
  highlightHoldIds?: string[];
  completedHoldIds?: string[];
  currentHoldId?: string;
  selectedHoldId?: string;
  selectedHoldColor?: string;
  showDetectionLabels?: boolean;
  onHoldSelect?: (hold: Hold) => void;
  onCanvasSelect?: (position: { xPct: number; yPct: number }) => void;
  onRouteSelect?: (routeId: string) => void;
  helperText?: string;
  routeOverlays?: RouteOverlay[];
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
  plainImagePreview = false,
  fitContainer = false,
  highlightHoldIds = [],
  completedHoldIds = [],
  currentHoldId,
  selectedHoldId,
  selectedHoldColor,
  showDetectionLabels = true,
  onHoldSelect,
  onCanvasSelect,
  onRouteSelect,
  helperText,
  routeOverlays = [],
}: RouteCanvasProps) {
  const { language, t } = useLanguage();
  const fitContainerRef = useRef<HTMLDivElement>(null);
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);
  const wallWidth = Math.max(1, wallMap?.width ?? 1);
  const wallHeight = Math.max(1, wallMap?.height ?? 1);
  const aspectRatio = `${wallWidth} / ${wallHeight}`;
  const aspectRatioValue = wallWidth / wallHeight;
  const useStableOverlayPreview = plainImagePreview && Boolean(backgroundImageUrl);

  useEffect(() => {
    if (!fitContainer) {
      setFitSize(null);
      return undefined;
    }

    const wrapper = fitContainerRef.current;
    if (!wrapper) return undefined;

    const updateFitSize = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const availableRatio = rect.width / rect.height;
      const nextSize = availableRatio > aspectRatioValue
        ? {
            width: rect.height * aspectRatioValue,
            height: rect.height,
          }
        : {
            width: rect.width,
            height: rect.width / aspectRatioValue,
          };

      setFitSize((current) => {
        if (
          current &&
          Math.abs(current.width - nextSize.width) < 0.5 &&
          Math.abs(current.height - nextSize.height) < 0.5
        ) {
          return current;
        }
        return nextSize;
      });
    };

    updateFitSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFitSize);
      return () => window.removeEventListener('resize', updateFitSize);
    }

    const observer = new ResizeObserver(updateFitSize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [aspectRatioValue, fitContainer]);

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
  const holdLookup = new Map(wallMap.holds.map((hold) => [hold.id, hold]));
  const visibleRouteOverlays = routeOverlays
    .map((overlay) => {
      const points = overlay.holdIds
        .map((holdId) => holdLookup.get(holdId))
        .filter((hold): hold is Hold => Boolean(hold))
        .map((hold) => {
          const hasBox =
            hold.x1Pct !== undefined &&
            hold.y1Pct !== undefined &&
            hold.x2Pct !== undefined &&
            hold.y2Pct !== undefined;

          return {
            xPct: hasBox ? (hold.x1Pct! + hold.x2Pct!) / 2 : hold.xPct,
            yPct: hasBox ? (hold.y1Pct! + hold.y2Pct!) / 2 : hold.yPct,
          };
        });

      if (points.length < 2) return null;

      const fallbackColor =
        overlay.color ??
        holdLookup.get(overlay.holdIds[0])?.color ??
        'unknown';

      return {
        ...overlay,
        points,
        stroke: colorMap[fallbackColor] || colorMap.unknown,
      };
    })
    .filter((overlay): overlay is NonNullable<typeof overlay> => Boolean(overlay));

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

  const containerClassName = [
    'route-canvas',
    'assist-route-canvas',
    useStableOverlayPreview ? 'assist-route-canvas-preview' : '',
    fitContainer ? 'is-fit-container' : '',
    backgroundImageUrl ? 'has-image' : 'is-empty',
    onCanvasSelect ? 'is-clickable' : '',
    onRouteSelect ? 'is-route-selectable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const containerStyle = useStableOverlayPreview
    ? {
        position: 'relative' as const,
        width: fitContainer ? (fitSize ? `${fitSize.width}px` : '100%') : '100%',
        height: fitContainer && fitSize ? `${fitSize.height}px` : undefined,
        maxWidth: fitContainer ? '100%' : undefined,
        maxHeight: fitContainer ? '100%' : undefined,
        justifySelf: fitContainer ? 'center' : undefined,
        alignSelf: fitContainer ? 'center' : undefined,
        aspectRatio,
        minHeight: fitContainer ? 0 : 'var(--assist-route-canvas-min-height, 340px)',
        contain: 'paint' as const,
        isolation: 'isolate' as const,
        overflow: 'hidden' as const,
      }
    : {
        width: fitContainer ? (fitSize ? `${fitSize.width}px` : '100%') : undefined,
        height: fitContainer && fitSize ? `${fitSize.height}px` : undefined,
        maxWidth: fitContainer ? '100%' : undefined,
        maxHeight: fitContainer ? '100%' : undefined,
        justifySelf: fitContainer ? 'center' : undefined,
        alignSelf: fitContainer ? 'center' : undefined,
        aspectRatio,
        minHeight: fitContainer ? 0 : 'var(--assist-route-canvas-min-height, 340px)',
      };

  return (
    <div
      ref={fitContainerRef}
      className="stack-sm"
      style={fitContainer ? {
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height: '100%',
        minHeight: 0,
      } : undefined}
    >
      <div
        className={containerClassName}
        onClick={onCanvasSelect ? handleCanvasClick : undefined}
        style={containerStyle}
      >
        {backgroundImageUrl ? (
          <img
            src={backgroundImageUrl}
            alt={t('Detected climbing wall')}
            decoding="async"
            loading="eager"
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: useStableOverlayPreview ? 'fill' : 'cover',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        ) : null}

        {!useStableOverlayPreview ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background: backgroundImageUrl ? 'rgba(20, 26, 42, 0.12)' : 'transparent',
              pointerEvents: 'none',
            }}
          />
        ) : null}

        {visibleRouteOverlays.length ? (
          <svg
            className="assist-route-path-layer"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ pointerEvents: onRouteSelect ? 'auto' : 'none' }}
          >
            {visibleRouteOverlays.map((overlay) => {
              const points = overlay.points
                .map((point) => `${point.xPct},${point.yPct}`)
                .join(' ');
              const isPrimary = overlay.emphasis === 'primary';
              const start = overlay.points[0];
              const end = overlay.points[overlay.points.length - 1];

              return (
                <g key={overlay.id} className={`assist-route-path ${isPrimary ? 'is-primary' : 'is-secondary'}`}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.72)"
                    strokeWidth={isPrimary ? 1.85 : 1.1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isPrimary ? 0.9 : 0.46}
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke={overlay.stroke}
                    strokeWidth={isPrimary ? 1.15 : 0.72}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={isPrimary ? undefined : '1.2 1.6'}
                    opacity={isPrimary ? 0.96 : 0.72}
                  />
                  {onRouteSelect ? (
                    <polyline
                      className="assist-route-path-hit"
                      points={points}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={isPrimary ? 5.2 : 4.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pointerEvents="stroke"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRouteSelect(overlay.id);
                      }}
                    />
                  ) : null}
                  <circle
                    cx={start.xPct}
                    cy={start.yPct}
                    r={isPrimary ? 1.15 : 0.9}
                    fill="#ffffff"
                    opacity={isPrimary ? 0.96 : 0.76}
                  />
                  <circle
                    cx={start.xPct}
                    cy={start.yPct}
                    r={isPrimary ? 0.62 : 0.46}
                    fill={overlay.stroke}
                    opacity={0.98}
                  />
                  <circle
                    cx={end.xPct}
                    cy={end.yPct}
                    r={isPrimary ? 1.05 : 0.82}
                    fill={overlay.stroke}
                    opacity={isPrimary ? 0.98 : 0.82}
                  />
                </g>
              );
            })}
          </svg>
        ) : null}

        {wallMap.holds.map((hold) => {
          const isHighlighted = highlighted.has(hold.id);
          const isCompleted = completed.has(hold.id);
          const isCurrent = currentHoldId === hold.id;
          const isSelected = selectedHoldId === hold.id;

          const hasBox =
            hold.x1Pct !== undefined &&
            hold.y1Pct !== undefined &&
            hold.x2Pct !== undefined &&
            hold.y2Pct !== undefined;

          const basePixelSize = hold.radiusPct ? hold.radiusPct * 6 : isCurrent ? 30 : 24;
          const pixelSize = isCurrent ? basePixelSize + 8 : basePixelSize;
          const boxWidthPct = hasBox ? Math.max(0.8, hold.x2Pct! - hold.x1Pct!) : 0;
          const boxHeightPct = hasBox ? Math.max(0.8, hold.y2Pct! - hold.y1Pct!) : 0;
          const holdColor = colorMap[hold.color] || colorMap.unknown;
          const selectedColor = selectedHoldColor
            ? colorMap[selectedHoldColor] || selectedHoldColor
            : '#ff4638';

          const borderColor = isSelected
            ? selectedColor
            : isHighlighted
              ? holdColor
              : backgroundImageUrl
                ? `${holdColor}dd`
                : 'rgba(15, 23, 42, 0.28)';

          const labelVisible = Boolean(
            backgroundImageUrl && hasBox && showDetectionLabels && !useStableOverlayPreview,
          );

          const colorLabel = formatHoldColor(hold.color, language);
          const holdTitle = language === 'zh' ? `${hold.label}（${colorLabel}）` : `${hold.label} (${hold.color})`;
          const holdLabel = language === 'zh'
            ? `${hold.label}，${colorLabel}，置信度 ${Math.round(hold.confidence * 100)}%`
            : `${hold.label}, ${hold.color}, ${Math.round(hold.confidence * 100)} percent confidence`;

          const holdStyle = {
            position: 'absolute' as const,
            zIndex: 2,
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
              ? isSelected
                ? `${selectedColor}30`
                : isHighlighted
                ? `${holdColor}20`
                : 'transparent'
              : holdColor,
            boxShadow: isSelected
              ? `0 0 0 6px ${selectedColor}33, 0 0 0 10px rgba(255, 255, 255, 0.62)`
              : isCompleted
                ? '0 0 0 4px rgba(34, 197, 94, 0.25)'
                : isCurrent
                  ? `0 0 0 5px ${holdColor}44`
                  : hasBox && backgroundImageUrl && !useStableOverlayPreview
                    ? `0 2px 10px ${holdColor}20`
                    : 'none',
            opacity: hasHighlights ? (isHighlighted ? 1 : 0.78) : 1,
            transform: 'none',
            cursor: onHoldSelect ? 'pointer' : 'default',
            backdropFilter: undefined,
            willChange: 'auto' as const,
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
              {colorLabel} {Math.round(hold.confidence * 100)}%
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

      {helperText ? <span className="sr-only">{helperText}</span> : null}
    </div>
  );
}
