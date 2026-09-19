/**
 * The one or two letters an avatar falls back to when there's no photo.
 * "Diyan Brahma" → "DB", "Ripun" → "RI", "" → "?".
 *
 * Lived as a private copy in four components before this; keep new avatars on
 * this one so a name renders the same everywhere.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first || !last) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}
