import { useAccessibility } from '../../../app/providers/AccessibilityProvider';

export default function LiveRegion() {
  const { liveMessage } = useAccessibility();
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" aria-relevant="additions text">
      {liveMessage}
    </div>
  );
}
