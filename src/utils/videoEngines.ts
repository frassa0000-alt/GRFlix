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

/**
 * Safely extracts a clean video/embed URL from either a plain URL or pasted <iframe>/<embed> HTML code.
 * Never returns raw HTML tags or unsafe schemes (javascript:, data:, vbscript:).
 */
export function extractEmbedInputUrl(rawInput?: string | null): string {
  const raw = (rawInput || '').trim();
  if (!raw) return '';

  let candidate = raw;
  if (/<(?:iframe|embed)\b/i.test(raw) || /\bsrc\s*=\s*["']/i.test(raw)) {
    const srcMatch =
      raw.match(/<(?:iframe|embed)\b[^>]*\bsrc\s*=\s*"([^"]+)"/i) ||
      raw.match(/<(?:iframe|embed)\b[^>]*\bsrc\s*=\s*'([^']+)'/i) ||
      raw.match(/<(?:iframe|embed)\b[^>]*\bsrc\s*=\s*([^\s>]+)/i) ||
      raw.match(/\bsrc\s*=\s*"([^"]+)"/i) ||
      raw.match(/\bsrc\s*=\s*'([^']+)'/i);
    if (!srcMatch?.[1]) {
      return '';
    }
    candidate = srcMatch[1]
      .replace(/&amp;/gi, '&')
      .replace(/&#38;/g, '&')
      .trim();
  }

  if (
    !candidate ||
    /[<>]/.test(candidate) ||
    /^(javascript|data|vbscript):/i.test(candidate)
  ) {
    return '';
  }

  if (candidate.startsWith('/') || candidate.startsWith('blob:')) {
    return candidate;
  }
  if (/^\/\//.test(candidate)) {
    return `https:${candidate}`;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate) && /^[\w.-]+\.[a-zA-Z]{2,}(\/|$)/.test(candidate)) {
    return `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return '';
  }
  return '';
}

export function normalizeExternalHttpUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/<(?:iframe|embed)\b/i.test(trimmed) || /\bsrc\s*=\s*["']/i.test(trimmed)) {
    return extractEmbedInputUrl(trimmed);
  }
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
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('blob:')) return false;
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

export function isDirectEmbedPlatformUrl(url?: string | null): boolean {
  if (!url) return false;
  if (isProxiedEmbedUrl(url)) return true;
  try {
    const parsed = new URL(normalizeExternalHttpUrl(url));
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host === 'player.vimeo.com') return true;
    if ((host === 'dailymotion.com' || host === 'geo.dailymotion.com') && path.includes('/embed/')) return true;
    if (host === 'drive.google.com' && path.includes('/preview')) return true;
    if (host === 'archive.org' && path.includes('/embed/')) return true;
    if ((host === 'ok.ru' || host === 'odnoklassniki.ru') && path.includes('/videoembed/')) return true;
    if (host === 'piped.video' && path.includes('/embed/')) return true;
    if (/\/(embed|player)\b/i.test(path)) return true;
    return false;
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
  const trimmed = normalizeExternalHttpUrl(rawUrl);
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
    parsed = new URL(trimmed);
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
    /\/(embed|videoembed|preview|player|e)\b/i.test(path) ||
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

const EXTRACTOR_MEDIA_HOST_PATTERNS = [
  'dropbox.com',
  'mega.nz',
  'mediafire.com',
  'twitch.tv',
  'streamable.com',
  'rumble.com',
  'bitchute.com',
  'terabox.com',
  '1024terabox.com',
  'pixeldrain.com',
  'gofile.io',
  'krakenfiles.com',
  'bunkr.',
];

/**
 * Returns true if the URL is an ordinary external website (e.g. cooking site, transit site, blog)
 * rather than a video file, stream manifest, YouTube link, or dedicated video embed host.
 */
export function isPlainExternalWebUrl(
  url?: string | null,
  storageType?: string
): boolean {
  if (!url || typeof url !== 'string') return false;
  if (storageType === 'youtube') return false;

  const normalized = normalizeExternalHttpUrl(url);
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('blob:')) {
    return false;
  }
  if (isProxiedStreamUrl(normalized) || isProxiedEmbedUrl(normalized)) {
    return false;
  }
  if (
    isYouTubeUrl(normalized) ||
    isHlsStreamUrl(normalized) ||
    isDashStreamUrl(normalized) ||
    isDirectMediaFileUrl(normalized) ||
    Boolean(convertToUniversalEmbedUrl(normalized))
  ) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const cleanPath = parsed.pathname.toLowerCase();
  if (/\.(mp4|m4v|webm|mov|mkv|m3u8|mpd|mp3|aac|ogg|flv|ts|avi|3gp)$/i.test(cleanPath)) {
    return false;
  }
  if (EXTRACTOR_MEDIA_HOST_PATTERNS.some((p) => host === p || host.includes(p))) {
    return false;
  }

  return true;
}

export function openExternalWebsiteUrl(url: string): void {
  const normalized = normalizeExternalHttpUrl(url);
  if (!normalized || typeof document === 'undefined') return;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    const anchor = document.createElement('a');
    anchor.href = parsed.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch {
    // ignore invalid external URL
  }
}
