import { extractYouTubeVideoId, isYouTubeUrl } from './youtube';

export type ResolvedMediaFormat = 'youtube' | 'hls' | 'mp4' | 'webm' | 'embed';

export function isHlsStreamUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  const clean = trimmed.split('?')[0];
  return (
    clean.endsWith('.m3u8') ||
    trimmed.includes('.m3u8?') ||
    clean.includes('/uploads/hls/')
  );
}

export function isDirectMediaFileUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
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

/**
 * Converts a known non-YouTube external video page link or embed URL into a clean iframe-embeddable URL.
 * Returns null if the URL appears to be a direct video stream (MP4/HLS/WebM) or unknown direct CDN stream.
 */
export function convertToUniversalEmbedUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('blob:')) return null;
  if (isYouTubeUrl(trimmed) || isHlsStreamUrl(trimmed) || isDirectMediaFileUrl(trimmed)) {
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
    return trimmed;
  }

  // Vimeo: vimeo.com/<ID> -> player.vimeo.com/video/<ID>
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    if (host === 'player.vimeo.com') return trimmed;
    const vimeoMatch = path.match(/\/(\d+)/);
    if (vimeoMatch?.[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
    return trimmed;
  }

  // Dailymotion: dailymotion.com/video/<ID> or dai.ly/<ID>
  if (host === 'dailymotion.com' || host === 'dai.ly' || host === 'geo.dailymotion.com') {
    if (path.includes('/embed/')) return trimmed;
    if (host === 'dai.ly') {
      const id = path.split('/').filter(Boolean)[0];
      if (id) return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
    }
    const dmMatch = path.match(/\/video\/([a-zA-Z0-9]+)/);
    if (dmMatch?.[1]) {
      return `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1`;
    }
    return trimmed;
  }

  // OK.ru: ok.ru/video/<ID> -> ok.ru/videoembed/<ID>
  if (host === 'ok.ru' || host === 'odnoklassniki.ru') {
    if (path.includes('/videoembed/')) return trimmed;
    const okMatch = path.match(/\/video\/(\d+)/);
    if (okMatch?.[1]) {
      return `https://ok.ru/videoembed/${okMatch[1]}?autoplay=1`;
    }
    return trimmed;
  }

  // Archive.org: archive.org/details/<ID> -> archive.org/embed/<ID>
  if (host === 'archive.org') {
    if (path.includes('/embed/')) return trimmed;
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
    return trimmed;
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
  const cleanUrl = (url || '').trim();
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
