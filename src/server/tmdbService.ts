import fs from 'fs';
import path from 'path';
import type { MediaItem, Season, VideoSourceOption } from '../types/index.ts';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const TMDB_IMAGE_PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

// Continuous automatic synchronization every 24 hours
export const TMDB_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TMDB_DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const TMDB_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const TMDB_GENRE_ID_MAP: Record<number, string> = {
  28: 'action',
  10759: 'action', // Action & Adventure
  12: 'adventure',
  16: 'anime',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'drama', // Family
  14: 'fantasy',
  36: 'history',
  27: 'horror',
  10402: 'drama',
  9648: 'crime', // Mystery
  10749: 'romance',
  878: 'sci-fi',
  10765: 'sci-fi', // Sci-Fi & Fantasy
  53: 'crime', // Thriller
  10752: 'history', // War
  10768: 'history', // War & Politics
  37: 'adventure', // Western
};

interface TmdbRawEntry {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  adult?: boolean;
}

export interface TmdbPersistenceAdapter {
  dataDir: string;
  readMovies: () => MediaItem[];
  writeMovies: (movies: MediaItem[]) => void;
  readDeletedIds: () => string[];
  appendAuditLog?: (action: string, category: string, details: string, adminEmail?: string) => void;
}

export interface TmdbSyncState {
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

interface TmdbCatalogCache {
  items: MediaItem[];
  lastSyncedAt: number;
  syncPromise: Promise<MediaItem[]> | null;
}

const catalogCache: TmdbCatalogCache = {
  items: [],
  lastSyncedAt: 0,
  syncPromise: null,
};

let persistenceAdapter: TmdbPersistenceAdapter | null = null;
let syncStateFilePath: string | null = null;

let syncState: TmdbSyncState = {
  configured: false,
  intervalMs: TMDB_SYNC_INTERVAL_MS,
  isSyncing: false,
  lastSyncAt: 0,
  nextSyncAt: 0,
  totalInDatabase: 0,
  moviesCount: 0,
  seriesCount: 0,
  episodesCount: 0,
  lastAddedCount: 0,
  lastAddedMoviesCount: 0,
  lastAddedSeriesCount: 0,
  lastUpdatedCount: 0,
  lastSkippedDuplicatesCount: 0,
  lastSkippedDeletedCount: 0,
  lastError: null,
};

const detailCache = new Map<string, { item: MediaItem; expiresAt: number }>();
const searchCache = new Map<string, { items: MediaItem[]; expiresAt: number }>();

const getTmdbApiKey = (): string => {
  return String(process.env.TMDB_API_KEY || '').trim();
};

export const isTmdbConfigured = (): boolean => getTmdbApiKey().length > 0;

const computeDatabaseCounts = (movies: MediaItem[]) => {
  let moviesCount = 0;
  let seriesCount = 0;
  let episodesCount = 0;

  for (const m of movies) {
    if (m?.type === 'series') {
      seriesCount++;
      if (Array.isArray(m.seasons)) {
        for (const sn of m.seasons) {
          episodesCount += Array.isArray(sn?.episodes) ? sn.episodes.length : 0;
        }
      }
    } else {
      moviesCount++;
    }
  }

  return {
    totalInDatabase: movies.length,
    moviesCount,
    seriesCount,
    episodesCount,
  };
};

const loadPersistedSyncState = (): void => {
  if (!syncStateFilePath || !fs.existsSync(syncStateFilePath)) return;
  try {
    const raw = fs.readFileSync(syncStateFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      syncState = {
        ...syncState,
        lastSyncAt: Number(parsed.lastSyncAt) || 0,
        nextSyncAt: Number(parsed.nextSyncAt) || 0,
        lastAddedCount: Number(parsed.lastAddedCount) || 0,
        lastAddedMoviesCount: Number(parsed.lastAddedMoviesCount) || 0,
        lastAddedSeriesCount: Number(parsed.lastAddedSeriesCount) || 0,
        lastUpdatedCount: Number(parsed.lastUpdatedCount) || 0,
        lastSkippedDuplicatesCount: Number(parsed.lastSkippedDuplicatesCount) || 0,
        lastSkippedDeletedCount: Number(parsed.lastSkippedDeletedCount) || 0,
        lastError: parsed.lastError ? String(parsed.lastError) : null,
      };
    }
  } catch {
    // ignore corrupt sync state
  }
};

const savePersistedSyncState = (): void => {
  if (!syncStateFilePath) return;
  try {
    fs.writeFileSync(syncStateFilePath, JSON.stringify(syncState, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
};

export const restoreLegacyTmdbTrailerItem = (
  item: MediaItem
): { restored: MediaItem; changed: boolean } => {
  if (!item || !String(item.id || '').startsWith('tmdb-')) {
    return { restored: item, changed: false };
  }

  const fallbackTrailer = (item.trailerUrl || '').trim();
  if (!fallbackTrailer) {
    return { restored: item, changed: false };
  }

  let changed = false;
  let nextVideoUrl = (item.videoUrl || '').trim();
  if (!nextVideoUrl) {
    nextVideoUrl = fallbackTrailer;
    changed = true;
  }

  let nextSeasons = item.seasons;
  if (Array.isArray(item.seasons) && item.seasons.length > 0) {
    let epChanged = false;
    nextSeasons = item.seasons.map((sn) => ({
      ...sn,
      episodes: (sn.episodes || []).map((ep) => {
        if (!ep?.videoUrl || !ep.videoUrl.trim()) {
          epChanged = true;
          return { ...ep, videoUrl: fallbackTrailer };
        }
        return ep;
      }),
    }));
    if (epChanged) changed = true;
  }

  const nextComingSoon = !nextVideoUrl && item.type !== 'series';
  if (item.isComingSoon !== nextComingSoon) {
    changed = true;
  }

  if (!changed) {
    return { restored: item, changed: false };
  }

  return {
    changed: true,
    restored: {
      ...item,
      videoUrl: nextVideoUrl,
      seasons: nextSeasons,
      isComingSoon: nextComingSoon,
    },
  };
};

export const configureTmdbPersistence = (adapter: TmdbPersistenceAdapter): void => {
  persistenceAdapter = adapter;
  syncStateFilePath = path.resolve(adapter.dataDir, 'tmdb-sync-state.json');
  loadPersistedSyncState();

  // Restore trailer playback for any TMDB records whose videoUrl was previously cleared
  const currentMovies = adapter.readMovies();
  let migratedCount = 0;
  const cleanedMovies = currentMovies.map((m) => {
    const { restored, changed } = restoreLegacyTmdbTrailerItem(m);
    if (changed) migratedCount++;
    return restored;
  });
  if (migratedCount > 0) {
    adapter.writeMovies(cleanedMovies);
  }

  const counts = computeDatabaseCounts(cleanedMovies);
  syncState = {
    ...syncState,
    configured: isTmdbConfigured(),
    intervalMs: TMDB_SYNC_INTERVAL_MS,
    isSyncing: false,
    ...counts,
  };
  catalogCache.items = cleanedMovies.filter((m) => String(m?.id || '').startsWith('tmdb-'));
  if (syncState.lastSyncAt > 0) {
    catalogCache.lastSyncedAt = syncState.lastSyncAt;
  }
};

const buildTmdbUrl = (endpointPath: string, params: Record<string, string | number> = {}): URL => {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is not configured on the server');
  }
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const url = new URL(`${TMDB_API_BASE}${cleanPath}`);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([k, v]) => {
    url.searchParams.set(k, String(v));
  });
  return url;
};

const fetchTmdbJson = async <T = any>(
  endpointPath: string,
  params: Record<string, string | number> = {}
): Promise<T> => {
  const url = buildTmdbUrl(endpointPath, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`TMDB HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

const mapTmdbGenres = (entry: TmdbRawEntry): string[] => {
  const mapped: string[] = [];
  const seen = new Set<string>();

  const pushGenre = (slug?: string) => {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    mapped.push(slug);
  };

  if (Array.isArray(entry.genre_ids)) {
    for (const id of entry.genre_ids) {
      pushGenre(TMDB_GENRE_ID_MAP[Number(id)]);
    }
  }

  if (Array.isArray(entry.genres)) {
    for (const g of entry.genres) {
      pushGenre(TMDB_GENRE_ID_MAP[Number(g?.id)]);
    }
  }

  if (mapped.length === 0) {
    pushGenre('drama');
  }

  return mapped;
};

const parseReleaseYear = (dateStr?: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return new Date().getFullYear();
  const match = dateStr.match(/^(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
};

const parseDateMs = (dateStr?: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return Date.now();
  const parsed = Date.parse(dateStr);
  if (!Number.isFinite(parsed)) return Date.now();
  return Math.min(parsed, Date.now());
};

const normalizeTitleKey = (raw?: string): string => {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTmdbCompositeKey = (item: Partial<MediaItem>): string | null => {
  if (item.tmdbId && (item.tmdbMediaType === 'movie' || item.tmdbMediaType === 'tv')) {
    return `${item.tmdbMediaType}:${item.tmdbId}`;
  }
  const idMatch = String(item.id || '').match(/^tmdb-(movie|tv)-(\d+)$/);
  if (idMatch) {
    return `${idMatch[1]}:${idMatch[2]}`;
  }
  return null;
};

const buildTitleYearKeys = (item: Partial<MediaItem>): string[] => {
  const kindKey = item.type === 'series' ? 'series' : 'movie';
  const yr = Number(item.year) || 0;
  const keys: string[] = [];
  const t1 = normalizeTitleKey(item.title);
  const t2 = normalizeTitleKey(item.titleAr);
  if (t1) keys.push(`${kindKey}::${t1}::${yr}`);
  if (t2 && t2 !== t1) keys.push(`${kindKey}::${t2}::${yr}`);
  return keys;
};

const mapDualLanguageEntryToMediaItem = (
  arEntry: TmdbRawEntry | undefined,
  enEntry: TmdbRawEntry | undefined,
  mediaKind: 'movie' | 'tv',
  flags: {
    isLatest?: boolean;
    isFeatured?: boolean;
    isMostWatched?: boolean;
    orderWeight?: number;
  } = {}
): MediaItem | null => {
  const base = arEntry || enEntry;
  if (!base || !base.id) return null;

  const posterPath = arEntry?.poster_path || enEntry?.poster_path;
  const backdropPath = arEntry?.backdrop_path || enEntry?.backdrop_path;
  if (!posterPath && !backdropPath) return null;

  const titleEn = (
    enEntry?.title ||
    enEntry?.name ||
    arEntry?.title ||
    arEntry?.name ||
    base.original_title ||
    base.original_name ||
    ''
  ).trim();

  const titleAr = (
    arEntry?.title ||
    arEntry?.name ||
    titleEn ||
    base.original_title ||
    base.original_name ||
    ''
  ).trim();

  if (!titleEn && !titleAr) return null;

  const description = (arEntry?.overview || enEntry?.overview || '').trim();
  const dateStr =
    arEntry?.release_date ||
    enEntry?.release_date ||
    arEntry?.first_air_date ||
    enEntry?.first_air_date ||
    '';

  const genres = mapTmdbGenres(base);
  const isAnime = genres.includes('anime') && mediaKind !== 'tv';
  const rawRating = Number(enEntry?.vote_average ?? arEntry?.vote_average ?? 0);
  const rating = Number.isFinite(rawRating) && rawRating > 0 ? Math.round(rawRating * 10) / 10 : 7.0;
  const popularity = Number(enEntry?.popularity ?? arEntry?.popularity ?? 0);
  const voteCount = Number(enEntry?.vote_count ?? arEntry?.vote_count ?? 0);

  return {
    id: `tmdb-${mediaKind}-${base.id}`,
    tmdbId: Number(base.id),
    tmdbMediaType: mediaKind,
    title: titleEn || titleAr,
    titleAr: titleAr || titleEn,
    originalTitle: base.original_title || base.original_name || titleEn,
    type: mediaKind === 'tv' ? 'series' : isAnime ? 'anime' : 'movie',
    year: parseReleaseYear(dateStr),
    rating,
    posterUrl: posterPath
      ? `${TMDB_IMAGE_POSTER_BASE}${posterPath}`
      : `${TMDB_IMAGE_BACKDROP_BASE}${backdropPath}`,
    bannerUrl: backdropPath
      ? `${TMDB_IMAGE_BACKDROP_BASE}${backdropPath}`
      : `${TMDB_IMAGE_POSTER_BASE}${posterPath}`,
    description,
    genres,
    videoUrl: '',
    videoQuality: '1080p',
    ageRating: base.adult ? '18+' : '13+',
    duration: mediaKind === 'tv' ? 'مسلسل' : '',
    isPublished: true,
    isFeatured: Boolean(flags.isFeatured),
    isLatest: Boolean(flags.isLatest),
    isMostWatched: Boolean(flags.isMostWatched),
    displayOrder: flags.orderWeight,
    viewsCount: Math.max(voteCount, Math.round(popularity * 10)),
    createdAt: parseDateMs(dateStr),
    updatedAt: Date.now(),
  };
};

const fetchDualPage = async (
  endpointPath: string,
  extraParams: Record<string, string | number> = {}
): Promise<{ ar: TmdbRawEntry[]; en: Map<number, TmdbRawEntry> }> => {
  const [arRes, enRes] = await Promise.all([
    fetchTmdbJson<{ results?: TmdbRawEntry[] }>(endpointPath, {
      ...extraParams,
      language: 'ar-SA',
    }),
    fetchTmdbJson<{ results?: TmdbRawEntry[] }>(endpointPath, {
      ...extraParams,
      language: 'en-US',
    }),
  ]);

  const enMap = new Map<number, TmdbRawEntry>();
  for (const item of enRes?.results || []) {
    if (item && item.id) enMap.set(item.id, item);
  }

  return {
    ar: Array.isArray(arRes?.results) ? arRes.results : [],
    en: enMap,
  };
};

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        await worker(items[idx]);
      } catch {
        // non-fatal individual enrichment error
      }
    }
  });
  await Promise.all(workers);
};

const mergeSeasonsPreservingCustomVideos = (
  existingSeasons: Season[] | undefined,
  freshSeasons: Season[] | undefined
): Season[] | undefined => {
  if (!freshSeasons || freshSeasons.length === 0) return existingSeasons;
  if (!existingSeasons || existingSeasons.length === 0) return freshSeasons;

  const existingEpMap = new Map<string, any>();
  for (const sn of existingSeasons) {
    for (const ep of sn.episodes || []) {
      existingEpMap.set(`${sn.seasonNumber}:${ep.episodeNumber}`, ep);
    }
  }

  return freshSeasons.map((sn) => ({
    ...sn,
    episodes: (sn.episodes || []).map((freshEp) => {
      const prev = existingEpMap.get(`${sn.seasonNumber}:${freshEp.episodeNumber}`);
      if (!prev) return freshEp;
      const prevVideo =
        (prev.videoUrl && prev.videoUrl.trim()) || freshEp.videoUrl || '';
      return {
        ...freshEp,
        ...prev,
        title: prev.title || freshEp.title,
        description: prev.description || freshEp.description,
        thumbnailUrl: prev.thumbnailUrl || freshEp.thumbnailUrl,
        duration: prev.duration || freshEp.duration,
        videoUrl: prevVideo,
      };
    }),
  }));
};

const enrichAndMergeExistingItem = (
  existing: MediaItem,
  incoming: MediaItem
): { merged: MediaItem; changed: boolean } => {
  const nextVideoUrl =
    (existing.videoUrl && existing.videoUrl.trim()) || incoming.videoUrl || existing.trailerUrl || '';

  const mergedCastDetails =
    existing.castDetails && existing.castDetails.length > 0
      ? existing.castDetails
      : incoming.castDetails;
  const mergedCast =
    existing.cast && existing.cast.length > 0 ? existing.cast : incoming.cast;
  const mergedSeasons = mergeSeasonsPreservingCustomVideos(existing.seasons, incoming.seasons);
  const existingCustomSources = Array.isArray(existing.sources) && existing.sources.length > 0
    ? existing.sources
    : undefined;
  const mergedSources =
    existingCustomSources || (incoming.sources && incoming.sources.length > 0 ? incoming.sources : undefined);

  const nextTrailerUrl = incoming.trailerUrl || existing.trailerUrl || '';
  const nextViews = Math.max(Number(existing.viewsCount) || 0, Number(incoming.viewsCount) || 0);
  const nextRating = incoming.rating > 0 ? incoming.rating : existing.rating;
  const nextDesc = existing.description?.trim() ? existing.description : incoming.description;
  const nextDirector = existing.director?.trim() ? existing.director : incoming.director;
  const nextDuration = existing.duration?.trim() ? existing.duration : incoming.duration;

  const oldEpCount = (existing.seasons || []).reduce(
    (sum, s) => sum + (s.episodes?.length || 0),
    0
  );
  const newEpCount = (mergedSeasons || []).reduce(
    (sum, s) => sum + (s.episodes?.length || 0),
    0
  );

  const changed =
    nextRating !== existing.rating ||
    nextViews !== (existing.viewsCount || 0) ||
    nextDesc !== existing.description ||
    nextDirector !== existing.director ||
    nextDuration !== existing.duration ||
    nextTrailerUrl !== (existing.trailerUrl || '') ||
    nextVideoUrl !== (existing.videoUrl || '') ||
    newEpCount !== oldEpCount ||
    (!existing.castDetails?.length && Boolean(mergedCastDetails?.length));

  return {
    changed,
    merged: {
      ...existing,
      tmdbId: existing.tmdbId || incoming.tmdbId,
      tmdbMediaType: existing.tmdbMediaType || incoming.tmdbMediaType,
      title: existing.title || incoming.title,
      titleAr: existing.titleAr || incoming.titleAr,
      description: nextDesc,
      posterUrl: existing.posterUrl || incoming.posterUrl,
      bannerUrl: existing.bannerUrl || incoming.bannerUrl,
      rating: nextRating,
      viewsCount: nextViews,
      director: nextDirector,
      duration: nextDuration,
      cast: mergedCast,
      castDetails: mergedCastDetails,
      seasons: mergedSeasons,
      sources: mergedSources,
      videoUrl: nextVideoUrl,
      trailerUrl: nextTrailerUrl || undefined,
      isComingSoon: !nextVideoUrl && existing.type !== 'series',
      isLatest: existing.isLatest || incoming.isLatest,
      isMostWatched: existing.isMostWatched || incoming.isMostWatched,
      updatedAt: changed ? Date.now() : existing.updatedAt || Date.now(),
    },
  };
};

export const syncTmdbCatalog = async (force = false): Promise<MediaItem[]> => {
  if (!isTmdbConfigured()) {
    syncState.configured = false;
    return persistenceAdapter
      ? persistenceAdapter.readMovies().filter((m) => String(m?.id || '').startsWith('tmdb-'))
      : [];
  }

  const now = Date.now();
  if (
    !force &&
    catalogCache.items.length > 0 &&
    now - catalogCache.lastSyncedAt < TMDB_SYNC_INTERVAL_MS
  ) {
    return catalogCache.items;
  }

  if (catalogCache.syncPromise) {
    return catalogCache.syncPromise;
  }

  syncState.isSyncing = true;
  syncState.configured = true;

  catalogCache.syncPromise = (async () => {
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const [
        trendingMoviesP1,
        trendingMoviesP2,
        nowPlayingMoviesP1,
        nowPlayingMoviesP2,
        popularMoviesP1,
        discoverNewMovies,
        trendingTvP1,
        trendingTvP2,
        onTheAirTvP1,
        onTheAirTvP2,
        airingTodayTvP1,
        popularTvP1,
        discoverNewTv,
      ] = await Promise.all([
        fetchDualPage('/trending/movie/week', { page: 1 }),
        fetchDualPage('/trending/movie/week', { page: 2 }),
        fetchDualPage('/movie/now_playing', { page: 1 }),
        fetchDualPage('/movie/now_playing', { page: 2 }),
        fetchDualPage('/movie/popular', { page: 1 }),
        fetchDualPage('/discover/movie', {
          sort_by: 'primary_release_date.desc',
          'primary_release_date.lte': todayIso,
          'vote_count.gte': 10,
          page: 1,
        }),
        fetchDualPage('/trending/tv/week', { page: 1 }),
        fetchDualPage('/trending/tv/week', { page: 2 }),
        fetchDualPage('/tv/on_the_air', { page: 1 }),
        fetchDualPage('/tv/on_the_air', { page: 2 }),
        fetchDualPage('/tv/airing_today', { page: 1 }),
        fetchDualPage('/tv/popular', { page: 1 }),
        fetchDualPage('/discover/tv', {
          sort_by: 'first_air_date.desc',
          'first_air_date.lte': todayIso,
          'vote_count.gte': 10,
          page: 1,
        }),
      ]);

      const discoveredMap = new Map<string, MediaItem>();

      const ingestList = (
        pair: { ar: TmdbRawEntry[]; en: Map<number, TmdbRawEntry> },
        mediaKind: 'movie' | 'tv',
        flags: {
          isLatest?: boolean;
          isFeatured?: boolean;
          isMostWatched?: boolean;
          baseOrder?: number;
        }
      ) => {
        pair.ar.forEach((arItem, idx) => {
          const enItem = pair.en.get(arItem.id);
          const mapped = mapDualLanguageEntryToMediaItem(arItem, enItem, mediaKind, {
            isLatest: flags.isLatest,
            isFeatured: flags.isFeatured && idx < 4,
            isMostWatched: flags.isMostWatched,
            orderWeight: (flags.baseOrder || 100) + idx,
          });
          if (!mapped) return;

          const existing = discoveredMap.get(mapped.id);
          if (existing) {
            discoveredMap.set(mapped.id, {
              ...existing,
              isLatest: existing.isLatest || mapped.isLatest,
              isFeatured: existing.isFeatured || mapped.isFeatured,
              isMostWatched: existing.isMostWatched || mapped.isMostWatched,
              displayOrder: Math.min(
                existing.displayOrder ?? 9999,
                mapped.displayOrder ?? 9999
              ),
            });
          } else {
            discoveredMap.set(mapped.id, mapped);
          }
        });
      };

      // Movies discovery
      ingestList(trendingMoviesP1, 'movie', {
        isFeatured: true,
        isMostWatched: true,
        baseOrder: 10,
      });
      ingestList(trendingMoviesP2, 'movie', {
        isMostWatched: true,
        baseOrder: 30,
      });
      ingestList(nowPlayingMoviesP1, 'movie', { isLatest: true, baseOrder: 40 });
      ingestList(nowPlayingMoviesP2, 'movie', { isLatest: true, baseOrder: 60 });
      ingestList(discoverNewMovies, 'movie', { isLatest: true, baseOrder: 50 });
      ingestList(popularMoviesP1, 'movie', { isMostWatched: true, baseOrder: 75 });

      // Series discovery (including airing today, on the air, newest & popular)
      ingestList(trendingTvP1, 'tv', {
        isFeatured: true,
        isMostWatched: true,
        baseOrder: 20,
      });
      ingestList(trendingTvP2, 'tv', {
        isMostWatched: true,
        baseOrder: 35,
      });
      ingestList(onTheAirTvP1, 'tv', { isLatest: true, baseOrder: 45 });
      ingestList(onTheAirTvP2, 'tv', { isLatest: true, baseOrder: 65 });
      ingestList(airingTodayTvP1, 'tv', { isLatest: true, baseOrder: 52 });
      ingestList(discoverNewTv, 'tv', { isLatest: true, baseOrder: 55 });
      ingestList(popularTvP1, 'tv', { isMostWatched: true, baseOrder: 85 });

      const discoveredItems = Array.from(discoveredMap.values());

      // Persist directly into MASHHAD database with strict duplicate prevention
      if (persistenceAdapter) {
        const existingMovies = persistenceAdapter.readMovies();
        const deletedSet = new Set(persistenceAdapter.readDeletedIds());

        const existingById = new Map<string, number>();
        const existingByTmdb = new Map<string, number>();
        const existingTitleYearSet = new Set<string>();

        const workingList = [...existingMovies];

        workingList.forEach((m, index) => {
          if (m?.id) existingById.set(m.id, index);
          const tmdbKey = extractTmdbCompositeKey(m);
          if (tmdbKey) existingByTmdb.set(tmdbKey, index);
          for (const tyk of buildTitleYearKeys(m)) {
            existingTitleYearSet.add(tyk);
          }
        });

        let addedMoviesCount = 0;
        let addedSeriesCount = 0;
        let updatedCount = 0;
        let skippedDuplicatesCount = 0;
        let skippedDeletedCount = 0;

        const newBrandItems: MediaItem[] = [];
        const updateIndices: Array<{ index: number; candidate: MediaItem }> = [];

        for (const candidate of discoveredItems) {
          if (deletedSet.has(candidate.id)) {
            skippedDeletedCount++;
            continue;
          }

          const tmdbKey = extractTmdbCompositeKey(candidate);
          const matchedIndex =
            existingById.get(candidate.id) ??
            (tmdbKey ? existingByTmdb.get(tmdbKey) : undefined);

          if (matchedIndex !== undefined) {
            updateIndices.push({ index: matchedIndex, candidate });
            skippedDuplicatesCount++;
            continue;
          }

          const tyKeys = buildTitleYearKeys(candidate);
          if (tyKeys.some((k) => existingTitleYearSet.has(k))) {
            skippedDuplicatesCount++;
            continue;
          }

          // Brand-new unique movie or series
          newBrandItems.push(candidate);
          for (const k of tyKeys) existingTitleYearSet.add(k);
          if (candidate.type === 'series') {
            addedSeriesCount++;
          } else {
            addedMoviesCount++;
          }
        }

        // Enrich brand-new series (with Season 1 episodes & trailer) and top new movies (bounded concurrency)
        const seriesToEnrich = newBrandItems.filter((i) => i.type === 'series').slice(0, 20);
        const moviesToEnrich = newBrandItems.filter((i) => i.type !== 'series').slice(0, 15);
        await runWithConcurrency([...seriesToEnrich, ...moviesToEnrich], 4, async (item) => {
          if (!item.tmdbId || !item.tmdbMediaType) return;
          const detailed = await fetchTmdbDetails(item.tmdbMediaType, String(item.tmdbId));
          if (detailed) {
            Object.assign(item, detailed, {
              id: item.id,
              isLatest: item.isLatest,
              isFeatured: item.isFeatured,
              isMostWatched: item.isMostWatched,
              displayOrder: item.displayOrder,
            });
          }
        });

        // Refresh up to 10 existing on-the-air TMDB series for new episodes cleanly
        const existingSeriesNeedingRefresh = updateIndices
          .filter(({ index, candidate }) => {
            const cur = workingList[index];
            return (
              cur?.type === 'series' &&
              candidate.isLatest &&
              cur.tmdbId &&
              (!cur.seasons?.length || Date.now() - (cur.updatedAt || 0) > 20 * 60 * 60 * 1000)
            );
          })
          .slice(0, 10);

        await runWithConcurrency(existingSeriesNeedingRefresh, 3, async ({ candidate }) => {
          if (!candidate.tmdbId) return;
          const detailed = await fetchTmdbDetails('tv', String(candidate.tmdbId));
          if (detailed) {
            Object.assign(candidate, detailed, {
              isLatest: candidate.isLatest,
              isFeatured: candidate.isFeatured,
              isMostWatched: candidate.isMostWatched,
            });
          }
        });

        for (const { index, candidate } of updateIndices) {
          const { merged, changed } = enrichAndMergeExistingItem(workingList[index], candidate);
          if (changed) {
            workingList[index] = merged;
            updatedCount++;
          }
        }

        // Place brand-new items cleanly (preserving manually uploaded pinned items at top)
        const manualPinned = workingList.filter((m) => !String(m?.id || '').startsWith('tmdb-'));
        const existingTmdbList = workingList.filter((m) => String(m?.id || '').startsWith('tmdb-'));
        const finalMovies = [...manualPinned, ...newBrandItems, ...existingTmdbList];

        const addedCount = addedMoviesCount + addedSeriesCount;
        if (addedCount > 0 || updatedCount > 0 || existingMovies.length === 0) {
          persistenceAdapter.writeMovies(finalMovies);
        }

        if (addedCount > 0 && persistenceAdapter.appendAuditLog) {
          persistenceAdapter.appendAuditLog(
            'مزامنة TMDB التلقائية',
            'media',
            `اكتشاف وإضافة ${addedCount} عمل جديد (${addedMoviesCount} فيلم، ${addedSeriesCount} مسلسل) مع منع تكرار ${skippedDuplicatesCount} عمل موجود.`,
            'TMDB Auto-Sync'
          );
        }

        const counts = computeDatabaseCounts(finalMovies);
        const completedAt = Date.now();
        syncState = {
          ...syncState,
          configured: true,
          intervalMs: TMDB_SYNC_INTERVAL_MS,
          isSyncing: false,
          lastSyncAt: completedAt,
          nextSyncAt: completedAt + TMDB_SYNC_INTERVAL_MS,
          ...counts,
          lastAddedCount: addedCount,
          lastAddedMoviesCount: addedMoviesCount,
          lastAddedSeriesCount: addedSeriesCount,
          lastUpdatedCount: updatedCount,
          lastSkippedDuplicatesCount: skippedDuplicatesCount,
          lastSkippedDeletedCount: skippedDeletedCount,
          lastError: null,
        };
        savePersistedSyncState();

        catalogCache.items = finalMovies.filter((m) => String(m?.id || '').startsWith('tmdb-'));
        catalogCache.lastSyncedAt = completedAt;
        return catalogCache.items;
      }

      if (discoveredItems.length > 0) {
        catalogCache.items = discoveredItems;
        catalogCache.lastSyncedAt = Date.now();
      }
      return catalogCache.items;
    } catch (err: any) {
      console.warn('TMDB catalog sync warning:', err?.message || 'Upstream error');
      syncState = {
        ...syncState,
        isSyncing: false,
        lastError: 'تعذر إتمام دورة المزامنة التلقائية مع TMDB حالياً',
      };
      savePersistedSyncState();
      return catalogCache.items;
    } finally {
      syncState.isSyncing = false;
      catalogCache.syncPromise = null;
    }
  })();

  return catalogCache.syncPromise;
};

export const searchTmdbMulti = async (rawQuery: string): Promise<MediaItem[]> => {
  if (!isTmdbConfigured()) return [];
  const q = String(rawQuery || '').trim().slice(0, 100);
  if (!q) return [];

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const pair = await fetchDualPage('/search/multi', {
    query: q,
    include_adult: 'false',
    page: 1,
  });

  const results: MediaItem[] = [];
  for (const arItem of pair.ar) {
    const kind = arItem.media_type === 'tv' ? 'tv' : arItem.media_type === 'movie' ? 'movie' : null;
    if (!kind) continue;
    const enItem = pair.en.get(arItem.id);
    const mapped = mapDualLanguageEntryToMediaItem(arItem, enItem, kind, {});
    if (mapped) results.push(mapped);
  }

  if (searchCache.size > 120) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(cacheKey, {
    items: results,
    expiresAt: Date.now() + TMDB_SEARCH_CACHE_TTL_MS,
  });

  return results;
};

export const fetchTmdbDetails = async (
  mediaType: 'movie' | 'tv',
  tmdbId: string
): Promise<MediaItem | null> => {
  if (!isTmdbConfigured()) return null;
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;
  if (!/^\d{1,12}$/.test(tmdbId)) return null;

  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = detailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.item;
  }

  const appendParams =
    mediaType === 'tv'
      ? 'videos,credits,content_ratings,season/1'
      : 'videos,credits,release_dates';

  const [arData, enData] = await Promise.all([
    fetchTmdbJson(`/${mediaType}/${tmdbId}`, {
      language: 'ar-SA',
      append_to_response: appendParams,
    }),
    fetchTmdbJson(`/${mediaType}/${tmdbId}`, {
      language: 'en-US',
      append_to_response: appendParams,
    }),
  ]);

  const baseMapped = mapDualLanguageEntryToMediaItem(arData, enData, mediaType, {});
  if (!baseMapped) return null;

  let duration = '';
  if (mediaType === 'movie') {
    const mins = Number(enData?.runtime || arData?.runtime || 0);
    if (mins > 0) duration = `${mins} دقيقة`;
  } else {
    const epMins = Array.isArray(enData?.episode_run_time)
      ? Number(enData.episode_run_time[0] || 0)
      : Number(enData?.last_episode_to_air?.runtime || 0);
    if (epMins > 0) duration = `${epMins} دقيقة`;
  }

  let director = '';
  if (mediaType === 'movie') {
    const crew = Array.isArray(enData?.credits?.crew) ? enData.credits.crew : [];
    const dirObj = crew.find((c: any) => c?.job === 'Director' && c?.name);
    if (dirObj?.name) director = String(dirObj.name);
  } else if (Array.isArray(enData?.created_by) && enData.created_by.length > 0) {
    director = enData.created_by
      .slice(0, 2)
      .map((c: any) => c?.name)
      .filter(Boolean)
      .join(', ');
  }

  const rawCast = Array.isArray(enData?.credits?.cast) ? enData.credits.cast : [];
  const castDetails = rawCast
    .slice(0, 12)
    .filter((c: any) => c?.name)
    .map((c: any) => ({
      name: String(c.name),
      character: c.character ? String(c.character) : undefined,
      profileUrl: c.profile_path ? `${TMDB_IMAGE_PROFILE_BASE}${c.profile_path}` : undefined,
    }));
  const cast = castDetails.map((c: any) => c.name);

  const arVideos = Array.isArray(arData?.videos?.results) ? arData.videos.results : [];
  const enVideos = Array.isArray(enData?.videos?.results) ? enData.videos.results : [];
  const allVideos = [...arVideos, ...enVideos].filter(
    (v: any) => v?.site === 'YouTube' && v?.key && /^[a-zA-Z0-9_-]{6,32}$/.test(String(v.key))
  );
  const orderedVideos = [
    ...allVideos.filter((v: any) => v.type === 'Trailer' && v.official),
    ...allVideos.filter((v: any) => v.type === 'Trailer'),
    ...allVideos.filter((v: any) => v.type === 'Teaser'),
    ...allVideos,
  ];
  const primaryTrailer = orderedVideos[0];
  const trailerUrl = primaryTrailer
    ? `https://www.youtube.com/watch?v=${primaryTrailer.key}`
    : '';
  const sources: VideoSourceOption[] = [];
  const seenKeys = new Set<string>();
  for (const vid of orderedVideos) {
    const key = String(vid.key);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    sources.push({
      id: `yt-${key}`,
      label: vid.name ? String(vid.name).slice(0, 48) : 'Official Trailer',
      url: `https://www.youtube.com/watch?v=${key}`,
      format: 'youtube',
      quality: '1080p',
      isDefault: sources.length === 0,
    });
    if (sources.length >= 3) break;
  }

  let ageRating = baseMapped.ageRating || '13+';
  if (mediaType === 'tv' && Array.isArray(enData?.content_ratings?.results)) {
    const usRating = enData.content_ratings.results.find((r: any) => r?.iso_3166_1 === 'US');
    if (usRating?.rating) ageRating = String(usRating.rating).slice(0, 12);
  } else if (mediaType === 'movie' && Array.isArray(enData?.release_dates?.results)) {
    const usRelease = enData.release_dates.results.find((r: any) => r?.iso_3166_1 === 'US');
    const cert = usRelease?.release_dates?.find((rd: any) => rd?.certification)?.certification;
    if (cert) ageRating = String(cert).slice(0, 12);
  }

  let seasons: Season[] | undefined;
  if (mediaType === 'tv' && Array.isArray(arData?.['season/1']?.episodes || enData?.['season/1']?.episodes)) {
    const arEps: any[] = arData?.['season/1']?.episodes || [];
    const enEps: any[] = enData?.['season/1']?.episodes || [];
    const enEpByNum = new Map<number, any>(enEps.map((ep) => [Number(ep.episode_number), ep]));
    const sourceEps = arEps.length > 0 ? arEps : enEps;

    const mappedEpisodes = sourceEps.slice(0, 20).map((ep: any, idx: number) => {
      const epNum = Number(ep?.episode_number) || idx + 1;
      const enEp = enEpByNum.get(epNum) || ep;
      const stillPath = ep?.still_path || enEp?.still_path;
      const runtime = Number(ep?.runtime || enEp?.runtime || 0);
      return {
        id: `tmdb-tv-${tmdbId}-s1-e${epNum}`,
        episodeNumber: epNum,
        title: String(ep?.name || enEp?.name || `الحلقة ${epNum}`),
        description: String(ep?.overview || enEp?.overview || '').trim(),
        duration: runtime > 0 ? `${runtime} دقيقة` : duration || '45 دقيقة',
        videoUrl: trailerUrl,
        thumbnailUrl: stillPath
          ? `${TMDB_IMAGE_POSTER_BASE}${stillPath}`
          : baseMapped.bannerUrl || baseMapped.posterUrl,
      };
    });

    if (mappedEpisodes.length > 0) {
      seasons = [
        {
          seasonNumber: 1,
          title: 'الموسم 1',
          episodes: mappedEpisodes,
        },
      ];
    }
  }

  const enriched: MediaItem = {
    ...baseMapped,
    duration: duration || undefined,
    director: director || undefined,
    cast,
    castDetails,
    ageRating,
    videoUrl: trailerUrl,
    trailerUrl: trailerUrl || undefined,
    sources: sources.length > 0 ? sources : undefined,
    seasons,
  };

  if (detailCache.size > 200) {
    const firstKey = detailCache.keys().next().value;
    if (firstKey) detailCache.delete(firstKey);
  }
  detailCache.set(cacheKey, {
    item: enriched,
    expiresAt: Date.now() + TMDB_DETAIL_CACHE_TTL_MS,
  });

  // Persist enriched details cleanly if item already exists in MASHHAD DB
  if (persistenceAdapter) {
    const movies = persistenceAdapter.readMovies();
    const idx = movies.findIndex((m) => m.id === enriched.id);
    if (idx !== -1) {
      const { merged, changed } = enrichAndMergeExistingItem(movies[idx], enriched);
      if (changed) {
        movies[idx] = merged;
        persistenceAdapter.writeMovies(movies);
        const counts = computeDatabaseCounts(movies);
        syncState = { ...syncState, ...counts };
        savePersistedSyncState();
      }
    }
  }

  return enriched;
};

let initialDelayTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;

export const startTmdbPeriodicSync = (): void => {
  if (!isTmdbConfigured()) return;

  if (initialDelayTimer) clearTimeout(initialDelayTimer);
  if (periodicTimer) clearInterval(periodicTimer);

  const scheduleRecurring24h = () => {
    if (periodicTimer) clearInterval(periodicTimer);
    periodicTimer = setInterval(() => {
      syncTmdbCatalog(true).catch(() => {});
    }, TMDB_SYNC_INTERVAL_MS);
    if (typeof periodicTimer.unref === 'function') {
      periodicTimer.unref();
    }
  };

  const now = Date.now();
  const hasPersistedTmdbItems = persistenceAdapter
    ? persistenceAdapter.readMovies().some((m) => String(m?.id || '').startsWith('tmdb-'))
    : false;
  const elapsed = syncState.lastSyncAt > 0 ? now - syncState.lastSyncAt : Infinity;

  if (!hasPersistedTmdbItems || elapsed >= TMDB_SYNC_INTERVAL_MS) {
    // Immediate sync when DB is unpopulated or >= 24h elapsed, then repeat every 24h
    syncTmdbCatalog(true).catch(() => {});
    scheduleRecurring24h();
  } else {
    const remainingMs = Math.max(5000, TMDB_SYNC_INTERVAL_MS - elapsed);
    syncState.nextSyncAt = now + remainingMs;
    savePersistedSyncState();
    initialDelayTimer = setTimeout(() => {
      syncTmdbCatalog(true).catch(() => {});
      scheduleRecurring24h();
    }, remainingMs);
    if (typeof initialDelayTimer.unref === 'function') {
      initialDelayTimer.unref();
    }
  }
};

export const getTmdbSyncStatus = (): TmdbSyncState => {
  const counts = persistenceAdapter
    ? computeDatabaseCounts(persistenceAdapter.readMovies())
    : {
        totalInDatabase: catalogCache.items.length,
        moviesCount: catalogCache.items.filter((m) => m.type !== 'series').length,
        seriesCount: catalogCache.items.filter((m) => m.type === 'series').length,
        episodesCount: 0,
      };
  return {
    ...syncState,
    configured: isTmdbConfigured(),
    ...counts,
  };
};
