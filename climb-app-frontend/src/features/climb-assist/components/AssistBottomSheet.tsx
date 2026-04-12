import { useEffect, useRef, useState, type PointerEvent, type PropsWithChildren, type ReactNode } from 'react';
import Card from '../../../shared/components/ui/Card';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface AssistBottomSheetProps extends PropsWithChildren {
  title?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  collapseOffset?: number;
}

interface DragState {
  moved: boolean;
  pointerId: number;
  startOffset: number;
  startY: number;
}

export default function AssistBottomSheet({
  title,
  actions,
  className = '',
  bodyClassName = '',
  collapseOffset = 220,
  children,
}: AssistBottomSheetProps) {
  const { t } = useLanguage();
  const [entered, setEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [restOffset, setRestOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const grabberRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressToggleRef = useRef(false);

  useEffect(() => {
    restoreFocusRef.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => setEntered(true));
    const focusTimer = window.setTimeout(() => {
      const focusableElements = getFocusableElements(sheetRef.current);
      (focusableElements[0] ?? grabberRef.current)?.focus();
    }, 40);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      restoreFocusRef.current?.focus();
    };
  }, []);

  function getFocusableElements(container: HTMLElement | null) {
    if (!container) return [];

    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('aria-hidden'));
  }

  function finishDrag() {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const nextOffset = dragOffset > collapseOffset / 2 ? collapseOffset : 0;
    setRestOffset(nextOffset);
    setDragOffset(nextOffset);
    setIsDragging(false);
    suppressToggleRef.current = dragState.moved;
    dragStateRef.current = null;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    dragStateRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startOffset: restOffset,
      startY: event.clientY,
    };
    setIsDragging(true);
    setDragOffset(restOffset);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextOffset = Math.max(
      0,
      Math.min(collapseOffset, dragState.startOffset + event.clientY - dragState.startY),
    );

    dragState.moved = dragState.moved || Math.abs(nextOffset - dragState.startOffset) > 8;
    setDragOffset(nextOffset);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    finishDrag();
  }

  function handlePointerCancel() {
    finishDrag();
  }

  function handleToggle() {
    if (suppressToggleRef.current) {
      suppressToggleRef.current = false;
      return;
    }

    setRestOffset((current) => (current > 0 ? 0 : collapseOffset));
    setDragOffset((current) => (current > 0 ? 0 : collapseOffset));
  }

  const activeOffset = isDragging ? dragOffset : restOffset;

  return (
    <div
      ref={sheetRef}
      className={`assist-floating-sheet ${entered ? 'is-ready' : ''} ${isDragging ? 'is-dragging' : ''} ${restOffset > 0 ? 'is-collapsed' : 'is-expanded'}`.trim()}
    >
      <div
        className="assist-floating-sheet-surface"
        style={{
          transform: `translateY(${entered ? activeOffset : 320}px)`,
        }}
      >
        <button
          ref={grabberRef}
          type="button"
          className="assist-floating-sheet-grabber"
          aria-label={restOffset > 0 ? t('Expand route drawer') : t('Collapse route drawer')}
          aria-expanded={restOffset === 0}
          onClick={handleToggle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <span className="assist-floating-sheet-handle" />
          <span className="assist-floating-sheet-caption">{t('Drag for route details')}</span>
        </button>
        <Card
          title={title}
          actions={actions}
          className={`assist-bottom-sheet assist-floating-sheet-card ${className}`.trim()}
          bodyClassName={bodyClassName}
          role="region"
          aria-label={title ?? t('Route details')}
          tabIndex={-1}
        >
          {children}
        </Card>
      </div>
    </div>
  );
}
