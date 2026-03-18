import { useAccessibility } from '../../../app/providers/AccessibilityProvider';

export default function LiveRegion() {
  const { liveMessage } = useAccessibility();
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {liveMessage}
    </div>
  );
}
