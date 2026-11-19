import { extractYouTubeVideoId, isYouTubeUrl } from './youtube';

export type ResolvedMediaFormat = 'youtube' | 'hls' | 'mp4' | 'webm' | 'embed';

export function buildStreamProxyUrl(targetUrl: string, referer?: string): string {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set('referer', referer);
  return `/api/stream/proxy?${params.toString()}`;
}

export function buildEmbedProxyUrl(targetUrl: string, referer?: string): string {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set('referer', referer);
  return `/api/stream/embed-proxy?${params.toString()}`;
}

export function isProxiedStreamUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith('/api/stream/proxy') || trimmed.includes('/api/stream/proxy?');
}

export function isProxiedEmbedUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith('/api/stream/embed-proxy') || trimmed.includes('/api/stream/embed-proxy?');
}

export function unwrapProxiedTargetUrl(url?: string | null): string | null {
  if (!url || !isProxiedStreamUrl(url)) return null;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
    return parsed.searchParams.get('url');
  } catch {
    return null;
  }
}

export function normalizeExternalHttpUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') || trimmed.startsWith('blob:')) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) && /^[\w.-]+\.[a-zA-Z]{2,}(\/|$)/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isExternalHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  const normalized = normalizeExternalHttpUrl(url);
  if (normalized.startsWith('/') || normalized.startsWith('blob:')) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isHlsStreamUrl(url?: string | null): boolean {
  if (!url) return false;
  const unwrapped = unwrapProxiedTargetUrl(url) || url;
  const trimmed = unwrapped.trim().toLowerCase();
  const clean = trimmed.split('?')[0];
  return (
    clean.endsWith('.m3u8') ||
    trimmed.includes('.m3u8?') ||
    trimmed.includes('.m3u8&') ||
    clean.includes('/uploads/hls/')
  );
}

export function isDashStreamUrl(url?: string | null): boolean {
  if (!url) return false;
  const unwrapped = unwrapProxiedTargetUrl(url) || url;
  const trimmed = unwrapped.trim().toLowerCase();
  const clean = trimmed.split('?')[0];
  return clean.endsWith('.mpd') || trimmed.includes('.mpd?') || trimmed.includes('.mpd&');
}

export function isDirectMediaFileUrl(url?: string | null): boolean {
  if (!url) return false;
  const unwrapped = unwrapProxiedTargetUrl(url) || url;
  const trimmed = unwrapped.trim().toLowerCase();
  const clean = trimmed.split('?')[0];
  if (
    clean.endsWith('.mp4') ||
    clean.endsWith('.m4v') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.mkv') ||
    clean.startsWith('/uploads/videos/') ||
    clean.startsWith('/uploads/variants/') ||
    trimmed.startsWith('blob:')
  ) {
    return true;
  }
  return false;
}

const KNOWN_EMBED_HOST_PATTERNS = [
  'dailymotion.com',
  'dai.ly',
  'vimeo.com',
  'player.vimeo.com',
  'drive.google.com',
  'ok.ru',
  'vk.com',
  'archive.org',
  'piped.video',
  'vidstream',
  'mycima',
  'wecima',
  'dood',
  'streamtape',
  'filemoon',
  'mixdrop',
  'mp4upload',
  'uqload',
  'vidspeed',
  'vidbom',
  'govid',
  'streamwish',
  'lulu',
  'vidhide',
  'filelions',
];

const FRAME_BLOCKED_HOST_PATTERNS = [
  'mycima',
  'wecima',
  'vk.com',
  'shahid',
  'fajer',
  'arabseed',
  'cimaclub',
  'faselhd',
  'akwam',
];

export function isLikelyFrameBlockedHost(url?: string | null): boolean {
  if (!url || isProxiedEmbedUrl(url) || isProxiedStreamUrl(url)) return false;
  try {
    const parsed = new URL(normalizeExternalHttpUrl(url));
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    return FRAME_BLOCKED_HOST_PATTERNS.some((p) => host === p || host.includes(p));
  } catch {
    return false;
  }
}

/**
 * Converts a known non-YouTube external video page link or embed URL into a clean iframe-embeddable URL.
 * Returns null if the URL appears to be a direct video stream (MP4/HLS/WebM/DASH) or proxied stream.
 */
export function convertToUniversalEmbedUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (isProxiedEmbedUrl(trimmed)) return trimmed;
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('blob:') || isProxiedStreamUrl(trimmed)) {
    return null;
  }
  if (
    isYouTubeUrl(trimmed) ||
    isHlsStreamUrl(trimmed) ||
    isDashStreamUrl(trimmed) ||
    isDirectMediaFileUrl(trimmed)
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizeExternalHttpUrl(trimmed));
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const path = parsed.pathname;

  // Google Drive: /file/d/<ID>/view -> /file/d/<ID>/preview
  if (host === 'drive.google.com') {
    const driveMatch = path.match(/\/file\/d\/([^/]+)/);
    if (driveMatch?.[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    const idParam = parsed.searchParams.get('id');
    if (idParam) {
      return `https://drive.google.com/file/d/${idParam}/preview`;
    }
    return parsed.href;
  }

  // Vimeo: vimeo.com/<ID> -> player.vimeo.com/video/<ID>
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    if (host === 'player.vimeo.com') return parsed.href;
    const vimeoMatch = path.match(/\/(\d+)/);
    if (vimeoMatch?.[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
    return parsed.href;
  }

  // Dailymotion: dailymotion.com/video/<ID> or dai.ly/<ID>
  if (host === 'dailymotion.com' || host === 'dai.ly' || host === 'geo.dailymotion.com') {
    if (path.includes('/embed/')) return parsed.href;
    if (host === 'dai.ly') {
      const id = path.split('/').filter(Boolean)[0];
      if (id) return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
    }
    const dmMatch = path.match(/\/video\/([a-zA-Z0-9]+)/);
    if (dmMatch?.[1]) {
      return `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1`;
    }
    return parsed.href;
  }

  // OK.ru: ok.ru/video/<ID> -> ok.ru/videoembed/<ID>
  if (host === 'ok.ru' || host === 'odnoklassniki.ru') {
    if (path.includes('/videoembed/')) return parsed.href;
    const okMatch = path.match(/\/video\/(\d+)/);
    if (okMatch?.[1]) {
      return `https://ok.ru/videoembed/${okMatch[1]}?autoplay=1`;
    }
    return parsed.href;
  }

  // Archive.org: archive.org/details/<ID> -> archive.org/embed/<ID>
  if (host === 'archive.org') {
    if (path.includes('/embed/')) return parsed.href;
    const archMatch = path.match(/\/details\/([^/]+)/);
    if (archMatch?.[1]) {
      return `https://archive.org/embed/${archMatch[1]}?autoplay=1`;
    }
  }

  // Known embed hostnames or explicit embed path patterns
  const isKnownHost = KNOWN_EMBED_HOST_PATTERNS.some(
    (pattern) => host === pattern || host.includes(pattern)
  );
  const hasEmbedPath =
    /\/(embed|videoembed|preview|e)\b/i.test(path) ||
    parsed.searchParams.has('embed');

  if (isKnownHost || hasEmbedPath) {
    return parsed.href;
  }

  return null;
}

export function isUniversalEmbedUrl(url?: string | null): boolean {
  return Boolean(convertToUniversalEmbedUrl(url));
}

export function resolveMediaFormat(
  url?: string | null,
  declaredFormat?: string
): ResolvedMediaFormat {
  const cleanUrl = normalizeExternalHttpUrl(url);
  if (declaredFormat === 'youtube' || isYouTubeUrl(cleanUrl)) return 'youtube';
  if (declaredFormat === 'hls' || isHlsStreamUrl(cleanUrl)) return 'hls';
  if (declaredFormat === 'embed' || isUniversalEmbedUrl(cleanUrl)) return 'embed';
  if (declaredFormat === 'webm' || cleanUrl.split('?')[0].toLowerCase().endsWith('.webm')) {
    return 'webm';
  }
  return 'mp4';
}

export function getPipedMirrorEmbedUrl(
  youtubeUrlOrId?: string | null,
  autoplay = true
): string | null {
  const id = extractYouTubeVideoId(youtubeUrlOrId);
  if (!id) return null;
  return `https://piped.video/embed/${id}${autoplay ? '?autoplay=1' : ''}`;
}
