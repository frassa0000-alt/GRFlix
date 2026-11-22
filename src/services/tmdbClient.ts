import { MediaItem } from '../types';

export interface TmdbSyncStatusInfo {
  configured: boolean;
  intervalMs: number;
  isSyncing: boolean;
  lastSyncAt: number;
  nextSyncAt: number;
  totalInDatabase: number;
  moviesCount: number;
  seriesCount: number;
  episodesCount: number;
  lastAddedCount: number;
  lastAddedMoviesCount: number;
  lastAddedSeriesCount: number;
  lastUpdatedCount: number;
  lastSkippedDuplicatesCount: number;
  lastSkippedDeletedCount: number;
  lastError: string | null;
}

export const isTmdbMediaItem = (item: Partial<MediaItem> | null | undefined): boolean => {
  if (!item?.id) return false;
  return item.id.startsWith('tmdb-movie-') || item.id.startsWith('tmdb-tv-');
};

export const extractTmdbIdentity = (
  item: Partial<MediaItem> | null | undefined
): { mediaType: 'movie' | 'tv'; tmdbId: string } | null => {
  if (!item?.id) return null;
  const match = item.id.match(/^tmdb-(movie|tv)-(\d+)$/);
  if (match) {
    return {
      mediaType: match[1] as 'movie' | 'tv',
      tmdbId: match[2],
    };
  }
  if (item.tmdbId && (item.tmdbMediaType === 'movie' || item.tmdbMediaType === 'tv')) {
    return {
      mediaType: item.tmdbMediaType,
      tmdbId: String(item.tmdbId),
    };
  }
  return null;
};

export const fetchTmdbCatalog = async (): Promise<MediaItem[]> => {
  try {
    const res = await fetch('/api/tmdb/catalog');
    if (!res.ok) return [];
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return [];
    const data = JSON.parse(text);
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
};

export const fetchTmdbSyncStatus = async (): Promise<TmdbSyncStatusInfo | null> => {
  try {
    const res = await fetch('/api/tmdb/sync-status');
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text) as TmdbSyncStatusInfo;
  } catch {
    return null;
  }
};

export const triggerAdminTmdbSync = async (
  token: string
): Promise<{ success: boolean; itemsCount: number; status: TmdbSyncStatusInfo } | null> => {
  try {
    const res = await fetch('/api/admin/tmdb/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const searchTmdbCatalog = async (
  query: string,
  signal?: AbortSignal
): Promise<MediaItem[]> => {
  const clean = query.trim();
  if (!clean) return [];
  try {
    const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(clean)}`, { signal });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return [];
    const data = JSON.parse(text);
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
    return [];
  }
};

const clientDetailsCache = new Map<string, MediaItem>();

export const fetchTmdbMediaDetails = async (
  item: MediaItem,
  signal?: AbortSignal
): Promise<MediaItem | null> => {
  const ident = extractTmdbIdentity(item);
  if (!ident) return null;

  const cacheKey = `${ident.mediaType}:${ident.tmdbId}`;
  const cached = clientDetailsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `/api/tmdb/details/${encodeURIComponent(ident.mediaType)}/${encodeURIComponent(ident.tmdbId)}`,
      { signal }
    );
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    const data = JSON.parse(text);
    if (data?.item) {
      clientDetailsCache.set(cacheKey, data.item);
      return data.item as MediaItem;
    }
    return null;
  } catch {
    return null;
  }
};
