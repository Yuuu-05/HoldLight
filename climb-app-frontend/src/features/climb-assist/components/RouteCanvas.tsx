import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
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
  fixedAspectRatio?: number;
  holdOverlayStyle?: 'default' | 'subtle';
  highlightHoldIds?: string[];
  completedHoldIds?: string[];
  currentHoldId?: string;
  selectedHoldId?: string;
  selectedHoldIds?: string[];
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

function getContainedBox(containerWidth: number, containerHeight: number, aspectRatioValue: number) {
  const safeWidth = Math.max(0, containerWidth);
  const safeHeight = Math.max(0, containerHeight);

  if (safeWidth === 0 || safeHeight === 0 || !Number.isFinite(aspectRatioValue) || aspectRatioValue <= 0) {
    return {
      left: 0,
      top: 0,
      width: safeWidth,
      height: safeHeight,
    };
  }

  const availableRatio = safeWidth / safeHeight;

  if (availableRatio > aspectRatioValue) {
    const width = safeHeight * aspectRatioValue;
    return {
      left: (safeWidth - width) / 2,
      top: 0,
      width,
      height: safeHeight,
    };
  }

  const height = safeWidth / aspectRatioValue;
  return {
    left: 0,
    top: (safeHeight - height) / 2,
    width: safeWidth,
    height,
  };
}

export default function RouteCanvas({
  holds,
  wallMap,
  backgroundImageUrl,
  plainImagePreview = false,
  fitContainer = false,
  fixedAspectRatio,
  holdOverlayStyle = 'default',
  highlightHoldIds = [],
  completedHoldIds = [],
  currentHoldId,
  selectedHoldId,
  selectedHoldIds = [],
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);
  const [contentBox, setContentBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [previewAspectRatioValue, setPreviewAspectRatioValue] = useState<number | null>(null);
  const wallWidth = Math.max(1, wallMap?.width ?? 1);
  const wallHeight = Math.max(1, wallMap?.height ?? 1);
  const aspectRatioValue = wallWidth / wallHeight;
  const useStableOverlayPreview = plainImagePreview && Boolean(backgroundImageUrl);
  const fixedAspectRatioValue = fixedAspectRatio && Number.isFinite(fixedAspectRatio) && fixedAspectRatio > 0
    ? fixedAspectRatio
    : null;
  const effectiveAspectRatioValue = fixedAspectRatioValue ?? (useStableOverlayPreview && previewAspectRatioValue
    ? previewAspectRatioValue
    : aspectRatioValue);

  useEffect(() => {
    if (!useStableOverlayPreview || !backgroundImageUrl) {
      setPreviewAspectRatioValue(null);
      return undefined;
    }

    let cancelled = false;
    const image = new Image();

    const updateAspectRatio = () => {
      if (cancelled) return;

      const naturalWidth = Math.max(1, image.naturalWidth || wallWidth);
      const naturalHeight = Math.max(1, image.naturalHeight || wallHeight);
      const nextAspectRatioValue = naturalWidth / naturalHeight;

      setPreviewAspectRatioValue((current) => {
        if (current && Math.abs(current - nextAspectRatioValue) < 0.001) {
          return current;
        }
        return nextAspectRatioValue;
      });
    };

    const clearAspectRatio = () => {
      if (!cancelled) {
        setPreviewAspectRatioValue(null);
      }
    };

    image.addEventListener('load', updateAspectRatio);
    image.addEventListener('error', clearAspectRatio);
    image.src = backgroundImageUrl;

    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      updateAspectRatio();
    }

    return () => {
      cancelled = true;
      image.removeEventListener('load', updateAspectRatio);
      image.removeEventListener('error', clearAspectRatio);
    };
  }, [backgroundImageUrl, useStableOverlayPreview, wallHeight, wallWidth]);

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

      const nextSize = getContainedBox(rect.width, rect.height, effectiveAspectRatioValue);

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
  }, [effectiveAspectRatioValue, fitContainer]);

  useEffect(() => {
    if (!backgroundImageUrl) {
      setContentBox(null);
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const updateContentBox = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const nextBox = getContainedBox(rect.width, rect.height, effectiveAspectRatioValue);

      setContentBox((current) => {
        if (
          current &&
          Math.abs(current.left - nextBox.left) < 0.5 &&
          Math.abs(current.top - nextBox.top) < 0.5 &&
          Math.abs(current.width - nextBox.width) < 0.5 &&
          Math.abs(current.height - nextBox.height) < 0.5
        ) {
          return current;
        }
        return nextBox;
      });
    };

    updateContentBox();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateContentBox);
      return () => window.removeEventListener('resize', updateContentBox);
    }

    const observer = new ResizeObserver(updateContentBox);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [backgroundImageUrl, effectiveAspectRatioValue]);

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
  const selected = new Set([
    ...selectedHoldIds,
    ...(selectedHoldId ? [selectedHoldId] : []),
  ]);
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
    const activeBox = contentBox ?? {
      left: 0,
      top: 0,
      width: rect.width,
      height: rect.height,
    };
    const localX = event.clientX - rect.left - activeBox.left;
    const localY = event.clientY - rect.top - activeBox.top;

    if (localX < 0 || localY < 0 || localX > activeBox.width || localY > activeBox.height) {
      return;
    }

    const xPct = Math.max(0, Math.min(100, (localX / activeBox.width) * 100));
    const yPct = Math.max(0, Math.min(100, (localY / activeBox.height) * 100));
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
        alignSelf: fitContainer ? 'start' : undefined,
        aspectRatio: effectiveAspectRatioValue,
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
        alignSelf: fitContainer ? 'start' : undefined,
        aspectRatio: effectiveAspectRatioValue,
        minHeight: fitContainer ? 0 : 'var(--assist-route-canvas-min-height, 340px)',
      };

  const contentLayerStyle: CSSProperties = contentBox
    ? {
        position: 'absolute',
        left: `${contentBox.left}px`,
        top: `${contentBox.top}px`,
        width: `${contentBox.width}px`,
        height: `${contentBox.height}px`,
        overflow: 'hidden',
        borderRadius: 'inherit',
      }
    : {
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        borderRadius: 'inherit',
      };

  return (
    <div
      ref={fitContainerRef}
      className="stack-sm"
      style={fitContainer ? {
        display: 'grid',
        justifyItems: 'center',
        alignItems: 'start',
        width: '100%',
        height: '100%',
        minHeight: 0,
      } : undefined}
    >
      <div
        ref={canvasRef}
        className={containerClassName}
        onClick={onCanvasSelect ? handleCanvasClick : undefined}
        style={containerStyle}
      >
        <div className="assist-route-canvas-content" style={contentLayerStyle}>
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
                objectFit: 'contain',
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
          const isSelected = selected.has(hold.id);

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
            : holdColor;
          const useSubtleHoldOverlay = holdOverlayStyle === 'subtle' && Boolean(backgroundImageUrl);
          const boxMinSidePct = hasBox ? Math.min(boxWidthPct, boxHeightPct) : 0;
          const baseBorderWidth = useSubtleHoldOverlay
            ? hasBox
              ? Math.min(2.45, Math.max(1.45, boxMinSidePct * 0.26))
              : 1.6
            : hasBox || isHighlighted || isSelected
              ? 3
              : 1.5;
          const borderWidth = useSubtleHoldOverlay
            ? isSelected
              ? baseBorderWidth + 0.65
              : isHighlighted
                ? baseBorderWidth + 0.35
                : baseBorderWidth
            : baseBorderWidth;

          const borderColor = isSelected
            ? selectedColor
            : isHighlighted
              ? holdColor
              : backgroundImageUrl
                ? `${holdColor}dd`
                : 'rgba(15, 23, 42, 0.28)';
          const overlayFill = hasBox
            ? isSelected
              ? useSubtleHoldOverlay
                ? `${selectedColor}18`
                : `${selectedColor}30`
              : isHighlighted
                ? useSubtleHoldOverlay
                  ? `${holdColor}10`
                  : `${holdColor}20`
                : 'transparent'
            : useSubtleHoldOverlay
              ? isSelected
                ? `${selectedColor}14`
                : isHighlighted
                  ? `${holdColor}0d`
                  : 'transparent'
              : holdColor;

          const labelVisible = Boolean(
            backgroundImageUrl && hasBox && showDetectionLabels && !useStableOverlayPreview,
          );

          const colorLabel = formatHoldColor(hold.color, language);
          const holdTitle = language === 'zh' ? `${hold.label}（${colorLabel}）` : `${hold.label} (${hold.color})`;
          const holdLabel = language === 'zh'
            ? `${hold.label}，${colorLabel}，置信度 ${Math.round(hold.confidence * 100)}%`
            : `${hold.label}, ${hold.color}, ${Math.round(hold.confidence * 100)} percent confidence`;

          const localizedHoldTitle = language === 'zh' ? `${hold.label}（${colorLabel}）` : `${hold.label} (${hold.color})`;
          const localizedHoldLabel = language === 'zh'
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
            border: `${borderWidth}px solid ${borderColor}`,
            background: overlayFill,
            boxShadow: isSelected
              ? useSubtleHoldOverlay
                ? `0 0 0 2px rgba(255, 255, 255, 0.78), 0 0 0 5px ${selectedColor}55, 0 0 18px ${selectedColor}cc, 0 0 34px ${selectedColor}66`
                : `0 0 0 4px rgba(255, 255, 255, 0.82), 0 0 0 8px ${selectedColor}58, 0 0 22px ${selectedColor}d0, 0 0 42px ${selectedColor}70`
              : isCompleted
                ? useSubtleHoldOverlay
                  ? '0 0 0 3px rgba(34, 197, 94, 0.18)'
                  : '0 0 0 4px rgba(34, 197, 94, 0.25)'
                : isCurrent
                  ? useSubtleHoldOverlay
                    ? `0 0 0 3px ${holdColor}22`
                    : `0 0 0 5px ${holdColor}44`
                  : hasBox && backgroundImageUrl && !useStableOverlayPreview
                    ? `0 2px 10px ${holdColor}20`
                    : 'none',
            opacity: hasHighlights ? (isHighlighted ? 1 : 0.78) : 1,
            transform: isSelected ? 'scale(1.035)' : 'none',
            cursor: onHoldSelect ? 'pointer' : 'default',
            backdropFilter: undefined,
            filter: isSelected ? 'saturate(1.18) brightness(1.08)' : undefined,
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
                  title={localizedHoldTitle}
                  aria-label={localizedHoldLabel}
                  aria-pressed={isSelected}
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
              <div key={hold.id} className="assist-route-hold" title={localizedHoldTitle} style={holdStyle}>
                {content}
              </div>
            );
        })}
        </div>
      </div>

      {helperText ? <span className="sr-only">{helperText}</span> : null}
    </div>
  );
}
