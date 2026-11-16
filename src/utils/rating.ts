export const generateRandomRating = (min = 6.3, max = 9.6): number => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const value = Math.round((min + Math.random() * (max - min)) * 10) / 10;
    if (value !== 8.5 && value !== 8.8) {
      return value;
    }
  }
  return 8.7;
};

const hashString = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * Returns the item's star rating. If the stored rating is missing or matches
 * legacy uniform defaults (8.5 / 8.8), deterministically derives a varied,
 * realistic rating in [6.4, 9.5] from the item's identity so cards and details
 * never look identical across movies or series.
 */
export const getEffectiveMediaRating = (item: {
  id?: string;
  title?: string;
  titleAr?: string;
  type?: string;
  year?: number;
  rating?: number;
}): number => {
  const numeric = Number(item?.rating);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : 0;

  if (rounded > 0 && rounded !== 8.5 && rounded !== 8.8) {
    return Math.min(10, Math.max(1, rounded));
  }

  const seed = `${item?.id || ''}|${item?.titleAr || ''}|${item?.title || ''}|${item?.type || ''}|${item?.year || ''}`;
  const hash = hashString(seed || 'goldenflix');
  // 32 discrete steps from 6.4 to 9.5 (step 0.1)
  const step = hash % 32;
  return Math.round((6.4 + step * 0.1) * 10) / 10;
};
