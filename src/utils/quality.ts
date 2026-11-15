/**
 * Cleans and normalizes video quality badges across the platform without "Full HD" text.
 */
export function formatQualityLabel(quality?: string | null): string {
  const raw = (quality || '').trim();
  if (!raw) return '1080p';
  const cleaned = raw
    .replace(/\bfull\s*hd\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || '1080p';
}
