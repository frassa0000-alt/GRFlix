export interface YouTubeOEmbedMetadata {
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
  canonicalUrl: string;
}

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Parse a YouTube time string like "90", "90s", "1m30s", "1h2m3s" into seconds.
 */
function parseYouTubeStartTime(rawTime: string | null): number | undefined {
  if (!rawTime) return undefined;
  const trimmed = rawTime.trim().toLowerCase();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const secs = Number(trimmed);
    return Number.isFinite(secs) && secs > 0 ? secs : undefined;
  }

  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return undefined;
  const hours = Number(match[1] || 0);
  const mins = Number(match[2] || 0);
  const secs = Number(match[3] || 0);
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : undefined;
}

/**
 * Extracts a valid 11-character YouTube video ID from any YouTube URL format:
 * - youtube.com/watch?v=...
 * - m.youtube.com/watch?v=...
 * - youtu.be/...
 * - youtube.com/shorts/...
 * - youtube.com/embed/...
 * - youtube-nocookie.com/embed/...
 * - youtube.com/live/...
 * - youtube.com/v/...
 */
export function extractYouTubeVideoId(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const isYouTubeHost =
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host.endsWith('.youtube.com');

  if (!isYouTubeHost) return null;

  if (host === 'youtu.be') {
    const firstSeg = parsed.pathname.split('/').filter(Boolean)[0] || '';
    return YOUTUBE_ID_REGEX.test(firstSeg) ? firstSeg : null;
  }

  const vParam = parsed.searchParams.get('v');
  if (vParam && YOUTUBE_ID_REGEX.test(vParam)) {
    return vParam;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const [prefix, candidate] = segments;
    if (
      (prefix === 'embed' ||
        prefix === 'shorts' ||
        prefix === 'live' ||
        prefix === 'v' ||
        prefix === 'e') &&
      YOUTUBE_ID_REGEX.test(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

export function extractYouTubeStartSeconds(rawUrl?: string | null): number | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return (
      parseYouTubeStartTime(parsed.searchParams.get('t')) ||
      parseYouTubeStartTime(parsed.searchParams.get('start'))
    );
  } catch {
    return undefined;
  }
}

export function isYouTubeUrl(url?: string | null): boolean {
  return Boolean(extractYouTubeVideoId(url));
}

export function getYouTubeCanonicalUrl(urlOrId?: string | null): string | null {
  const id = extractYouTubeVideoId(urlOrId);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function getYouTubeThumbnailUrl(
  urlOrId?: string | null,
  quality: 'maxres' | 'hq' | 'mq' = 'hq'
): string | null {
  const id = extractYouTubeVideoId(urlOrId);
  if (!id) return null;
  const filename =
    quality === 'maxres'
      ? 'maxresdefault.jpg'
      : quality === 'mq'
      ? 'mqdefault.jpg'
      : 'hqdefault.jpg';
  return `https://i.ytimg.com/vi/${id}/${filename}`;
}

export function getYouTubeEmbedUrl(
  urlOrId?: string | null,
  options?: { autoplay?: boolean; startSeconds?: number }
): string | null {
  const id = extractYouTubeVideoId(urlOrId);
  if (!id) return null;

  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  });

  if (options?.autoplay) {
    params.set('autoplay', '1');
  }

  const start = options?.startSeconds ?? extractYouTubeStartSeconds(urlOrId);
  if (typeof start === 'number' && start > 0) {
    params.set('start', String(Math.floor(start)));
  }

  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

/**
 * Fetch public YouTube title, channel name, and thumbnail via CORS-enabled oEmbed API.
 */
export async function fetchYouTubeOEmbedMetadata(
  urlOrId: string
): Promise<YouTubeOEmbedMetadata | null> {
  const videoId = extractYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 7000);

  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      return {
        videoId,
        title: '',
        authorName: '',
        thumbnailUrl: fallbackThumb,
        canonicalUrl,
      };
    }
    const data = await res.json();
    return {
      videoId,
      title: typeof data?.title === 'string' ? data.title.trim() : '',
      authorName: typeof data?.author_name === 'string' ? data.author_name.trim() : '',
      thumbnailUrl:
        typeof data?.thumbnail_url === 'string' && data.thumbnail_url.trim()
          ? data.thumbnail_url.trim()
          : fallbackThumb,
      canonicalUrl,
    };
  } catch {
    return {
      videoId,
      title: '',
      authorName: '',
      thumbnailUrl: fallbackThumb,
      canonicalUrl,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoLoadedFraction: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  setPlaybackRate: (suggestedRate: number) => void;
  getAvailablePlaybackRates: () => number[];
  setPlaybackQuality: (suggestedQuality: string) => void;
  getAvailableQualityLevels: () => string[];
  getPlaybackQuality: () => string;
  destroy: () => void;
}

export interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number | undefined>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onPlaybackQualityChange?: (event: { data: string; target: YTPlayerInstance }) => void;
        onError?: (event: { data: number; target: YTPlayerInstance }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState?: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API requires a browser environment'));
  }

  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve(window.YT);
  }

  if (ytApiPromise) {
    return ytApiPromise;
  }

  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const existingPrev = window.onYouTubeIframeAPIReady;
    const timeoutId = window.setTimeout(() => {
      ytApiPromise = null;
      reject(new Error('YouTube IFrame API load timeout'));
    }, 10000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeoutId);
      if (typeof existingPrev === 'function') {
        try {
          existingPrev();
        } catch {
          // Ignore prior callback errors
        }
      }
      if (window.YT && typeof window.YT.Player === 'function') {
        resolve(window.YT);
      } else {
        ytApiPromise = null;
        reject(new Error('YouTube API failed to initialize'));
      }
    };

    const existingScript = document.querySelector(
      'script[src*="youtube.com/iframe_api"]'
    ) as HTMLScriptElement | null;

    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        window.clearTimeout(timeoutId);
        ytApiPromise = null;
        reject(new Error('Failed to load YouTube IFrame API script'));
      };
      document.head.appendChild(tag);
    } else if (window.YT && typeof window.YT.Player === 'function') {
      window.clearTimeout(timeoutId);
      resolve(window.YT);
    }
  });

  return ytApiPromise;
}

export function formatYouTubeQualityCode(code: string): string {
  switch (code) {
    case 'highres':
      return '4K / 2160p';
    case 'hd2160':
      return '4K (2160p)';
    case 'hd1440':
      return '1440p';
    case 'hd1080':
      return '1080p';
    case 'hd720':
      return '720p HD';
    case 'large':
      return '480p SD';
    case 'medium':
      return '360p';
    case 'small':
      return '240p';
    case 'tiny':
      return '144p';
    case 'auto':
      return 'تلقائي (Auto)';
    default:
      return code;
  }
}

