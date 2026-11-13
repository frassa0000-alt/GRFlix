import { WatchProgress } from '../types';

const STORAGE_KEYS = {
  FAVORITES: 'goldenflix_cinema_favorites',
  HISTORY: 'goldenflix_cinema_watch_history',
  DELETED_IDS: 'goldenflix_deleted_media_ids',
};

// Local deleted media ID tombstones (prevents deleted items from reappearing before cloud sync completes)
export const getLocalDeletedMediaIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addLocalDeletedMediaIds = (ids: string[]): void => {
  try {
    const clean = ids.map((id) => (id || '').trim()).filter(Boolean);
    if (clean.length === 0) return;
    const merged = Array.from(new Set([...getLocalDeletedMediaIds(), ...clean]));
    localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(merged));
  } catch {
    // ignore storage errors
  }
};

export const removeLocalDeletedMediaId = (id: string): void => {
  try {
    const next = getLocalDeletedMediaIds().filter((x) => x !== id);
    localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(next));
  } catch {
    // ignore
  }
};

export const removeMediaFromLocalUserData = (mediaIds: string[]): void => {
  if (!mediaIds || mediaIds.length === 0) return;
  const idSet = new Set(mediaIds);
  try {
    const favs = getFavorites();
    const nextFavs = favs.filter((id) => !idSet.has(id));
    if (nextFavs.length !== favs.length) {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(nextFavs));
    }
  } catch {
    // ignore
  }
  try {
    const hist = getWatchHistory();
    const nextHist = hist.filter((h) => !idSet.has(h.mediaId));
    if (nextHist.length !== hist.length) {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(nextHist));
    }
  } catch {
    // ignore
  }
};

// Favorites
export const getFavorites = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const toggleFavorite = (mediaId: string): string[] => {
  const current = getFavorites();
  const exists = current.includes(mediaId);
  const updated = exists ? current.filter((id) => id !== mediaId) : [mediaId, ...current];
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated));
  return updated;
};

// Watch Progress & History
export const getWatchHistory = (): WatchProgress[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveWatchProgress = (
  progress: Omit<WatchProgress, 'updatedAt' | 'percentage'>
): void => {
  try {
    const current = getWatchHistory();
    const percentage =
      progress.duration > 0
        ? Math.min(100, Math.round((progress.currentTime / progress.duration) * 100))
        : 0;

    const itemKey = `${progress.mediaId}_${progress.episodeId || 'movie'}`;
    const filtered = current.filter(
      (item) => `${item.mediaId}_${item.episodeId || 'movie'}` !== itemKey
    );

    const newEntry: WatchProgress = {
      ...progress,
      percentage,
      updatedAt: Date.now(),
    };

    const updated = [newEntry, ...filtered].slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save watch progress:', err);
  }
};

export const getMediaProgress = (
  mediaId: string,
  episodeId?: string
): WatchProgress | undefined => {
  const history = getWatchHistory();
  return history.find(
    (item) => item.mediaId === mediaId && (episodeId ? item.episodeId === episodeId : true)
  );
};

export const clearWatchHistory = (): void => {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
};
