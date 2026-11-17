/**
 * Video quality normalization, numeric ranking, strict ordering, and user preference storage.
 */

export const STANDARD_QUALITY_HEIGHTS = [100, 144, 240, 360, 480, 720, 1080, 1440, 2160] as const;

export const PREFERRED_QUALITY_STORAGE_KEY = 'goldenflix_preferred_quality';

export interface PreferredQualityPref {
  id: string;
  label: string;
  rank: number;
}

export function formatQualityLabel(quality?: string | null): string {
  const raw = (quality || '').trim();
  if (!raw) return 'تلقائي';
  const cleaned = raw
    .replace(/\bfull\s*hd\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || 'تلقائي';
}

export function getQualityNumericRank(labelOrCode?: string | null): number {
  const s = (labelOrCode || '').trim().toLowerCase();
  if (!s) return 0;

  if (s === 'auto' || s.includes('تلقائي') || s.includes('auto')) return 0;
  if (s === 'tiny' || s === 'yt-144') return 144;
  if (s === 'small') return 240;
  if (s === 'medium') return 360;
  if (s === 'large') return 480;
  if (s === 'hd720') return 720;
  if (s === 'hd1080') return 1080;
  if (s === 'hd1440') return 1440;
  if (s === 'hd2160' || s === 'highres') return 2160;

  const numMatch = s.match(/(?:^|[^\d])(2160|1440|1080|720|480|360|240|144|100|\d{3,4})\s*p?(?:$|[^\d])/);
  if (numMatch?.[1]) {
    const parsed = Number(numMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  if (s.includes('4k') || s.includes('uhd')) return 2160;
  if (s.includes('2k') || s.includes('qhd')) return 1440;
  if (s.includes('fhd')) return 1080;
  if (s.includes('hd')) return 720;
  if (s.includes('sd')) return 480;
  if (s.includes('أصلي') || s.includes('original')) return 9999;

  return 5000;
}

/**
 * Sorts quality options cleanly:
 * 1) "تلقائي (Auto)" always at the top
 * 2) Numerical resolutions strictly ordered ascending (100p -> 144p -> 240p -> 360p -> 480p -> 720p -> 1080p -> ...)
 */
export function sortQualityOptions<T extends { id: string; label: string; rank?: number }>(
  options: T[]
): T[] {
  return [...options].sort((a, b) => {
    const isAutoA = a.id === 'auto' || a.label.includes('تلقائي');
    const isAutoB = b.id === 'auto' || b.label.includes('تلقائي');
    if (isAutoA !== isAutoB) return isAutoA ? -1 : 1;

    const rankA = typeof a.rank === 'number' && a.rank > 0 ? a.rank : getQualityNumericRank(a.label);
    const rankB = typeof b.rank === 'number' && b.rank > 0 ? b.rank : getQualityNumericRank(b.label);
    if (rankA !== rankB) return rankA - rankB;
    return a.label.localeCompare(b.label, 'en');
  });
}

export function getSavedPreferredQuality(): PreferredQualityPref | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFERRED_QUALITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.rank === 'number') {
      return {
        id: parsed.id,
        label: typeof parsed.label === 'string' ? parsed.label : `${parsed.rank}p`,
        rank: parsed.rank,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function savePreferredQuality(pref: PreferredQualityPref): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFERRED_QUALITY_STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // Ignore storage quota errors
  }
}
