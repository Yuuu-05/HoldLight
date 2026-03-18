export function getUserInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'CT';

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();

  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toUpperCase();
}
