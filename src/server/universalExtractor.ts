import { execFile } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execFileAsync = promisify(execFile);

export type ExtractedStreamFormat = 'hls' | 'mp4' | 'webm' | 'dash';

export interface ExtractedStreamCandidate {
  url: string;
  proxiedUrl: string;
  format: ExtractedStreamFormat;
  quality: string;
  label: string;
  referer: string;
  preferProxy: boolean;
  priority: number;
}

export interface UniversalExtractionResult {
  ok: boolean;
  inputUrl: string;
  finalUrl: string;
  kind: 'stream' | 'embed' | 'youtube' | 'unresolved';
  streams: ExtractedStreamCandidate[];
  embedUrl?: string;
  proxiedEmbedUrl?: string;
  frameBlocked?: boolean;
  cloudflareBlocked?: boolean;
  httpStatus?: number;
  posterUrl?: string;
  title?: string;
  diagnostics?: string;
  cached?: boolean;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const extractionCache = new Map<string, { expiresAt: number; data: UniversalExtractionResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

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

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    if (
      norm === '::1' ||
      norm === '::' ||
      norm.startsWith('fc') ||
      norm.startsWith('fd') ||
      norm.startsWith('fe80') ||
      norm.startsWith('::ffff:127.') ||
      norm.startsWith('::ffff:10.') ||
      norm.startsWith('::ffff:192.168.')
    ) {
      return true;
    }
    return false;
  }
  return false;
}

export function assertSafePublicHttpUrl(rawUrl: string): URL {
  let candidate = (rawUrl || '').trim();
  if (!candidate) {
    throw new Error('الرابط فارغ');
  }
  if (/<(?:iframe|embed)\b/i.test(candidate) || /\bsrc\s*=\s*["']/i.test(candidate)) {
    const srcMatch =
      candidate.match(/<(?:iframe|embed)\b[^>]*\bsrc\s*=\s*"([^"]+)"/i) ||
      candidate.match(/<(?:iframe|embed)\b[^>]*\bsrc\s*=\s*'([^']+)'/i) ||
      candidate.match(/<(?:iframe|embed)\b[^>]*\bsrc\s*=\s*([^\s>]+)/i) ||
      candidate.match(/\bsrc\s*=\s*"([^"]+)"/i) ||
      candidate.match(/\bsrc\s*=\s*'([^']+)'/i);
    if (!srcMatch?.[1]) {
      throw new Error('كود التضمين لا يحتوي على رابط src صالح');
    }
    candidate = srcMatch[1].replace(/&amp;/gi, '&').replace(/&#38;/g, '&').trim();
  }
  if (/^\/\//.test(candidate)) {
    candidate = `https:${candidate}`;
  } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate) && /^[\w.-]+\.[a-zA-Z]{2,}(\/|$)/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  const parsed = new URL(candidate);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('يجب أن يبدأ الرابط بـ http:// أو https://');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    host === 'metadata' ||
    isPrivateIp(host)
  ) {
    throw new Error('غير مسموح بالوصول إلى عناوين الشبكة الداخلية');
  }

  return parsed;
}

export function extractYouTubeVideoIdServer(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') {
      id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      if (parsed.pathname === '/watch') {
        id = parsed.searchParams.get('v') || '';
      } else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live', 'v'].includes(parts[0] || '')) {
          id = parts[1] || '';
        }
      }
    }
    id = id.split(/[?#&/]/)[0];
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function detectStreamFormatFromUrlOrType(
  url: string,
  contentType = ''
): ExtractedStreamFormat | null {
  const ct = contentType.toLowerCase();
  const cleanUrl = url.split('#')[0].toLowerCase();
  const pathOnly = cleanUrl.split('?')[0];

  if (
    ct.includes('mpegurl') ||
    ct.includes('x-mpegurl') ||
    pathOnly.endsWith('.m3u8') ||
    /\.m3u8([?&#]|$)/i.test(cleanUrl) ||
    cleanUrl.includes('mime=application%2fx-mpegurl')
  ) {
    return 'hls';
  }
  if (ct.includes('dash+xml') || pathOnly.endsWith('.mpd') || /\.mpd([?&#]|$)/i.test(cleanUrl)) {
    return 'dash';
  }
  if (ct.includes('video/webm') || pathOnly.endsWith('.webm') || /\.webm([?&#]|$)/i.test(cleanUrl)) {
    return 'webm';
  }
  if (
    ct.startsWith('video/') ||
    ct === 'application/mp4' ||
    pathOnly.endsWith('.mp4') ||
    pathOnly.endsWith('.m4v') ||
    pathOnly.endsWith('.mov') ||
    pathOnly.endsWith('.mkv') ||
    /\.(mp4|m4v|mov|mkv)([?&#]|$)/i.test(cleanUrl) ||
    cleanUrl.includes('mime=video%2f') ||
    cleanUrl.includes('mime=video/')
  ) {
    return 'mp4';
  }
  return null;
}

function unescapeMatchedUrl(raw: string): string {
  let out = raw.trim();
  out = out
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\u003F/gi, '?')
    .replace(/\\u003A/gi, ':')
    .replace(/\\x2f/gi, '/')
    .replace(/\\x3a/gi, ':')
    .replace(/\\x26/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

  out = out.replace(/^['"`]+|['"`]+$/g, '').trim();
  return out;
}

function resolveMaybeRelativeUrl(raw: string, baseUrl: string): string | null {
  const cleaned = unescapeMatchedUrl(raw);
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:') || cleaned.startsWith('javascript:')) {
    return null;
  }
  try {
    const resolved = new URL(cleaned, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    assertSafePublicHttpUrl(resolved.href);
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Unpacks Dean Edwards JavaScript packer blocks:
 * eval(function(p,a,c,k,e,d){...}('payload',radix,count,'sym|tab'.split('|'),0,{}))
 * without executing dynamic code.
 */
function unpackDeanEdwardsBlocks(html: string): string[] {
  const unpackedOutputs: string[] = [];
  const packerRegex =
    /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)\s*\{[\s\S]{20,400}?\}\s*\(\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])((?:\\.|(?!\5)[\s\S])*)\5\s*\.split\s*\(\s*['"]\|['"]\s*\)/g;

  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = packerRegex.exec(html)) !== null && count < 12) {
    count += 1;
    try {
      const payloadRaw = match[2]
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      const radix = Math.max(2, Math.min(62, parseInt(match[3], 10)));
      const symCount = parseInt(match[4], 10);
      const symTab = match[6].split('|');

      const encodeBase = (c: number): string => {
        const first = c < radix ? '' : encodeBase(Math.floor(c / radix));
        const rem = c % radix;
        const digit = rem > 35 ? String.fromCharCode(rem + 29) : rem.toString(36);
        return first + digit;
      };

      const lookup = new Map<string, string>();
      for (let i = symCount - 1; i >= 0; i -= 1) {
        const token = encodeBase(i);
        const replacement = symTab[i] || token;
        lookup.set(token, replacement);
      }

      const unpacked = payloadRaw.replace(/\b\w+\b/g, (word) => lookup.get(word) ?? word);
      if (unpacked) {
        unpackedOutputs.push(unpacked);
      }
    } catch {
      // Ignore malformed packer blocks
    }
  }

  return unpackedOutputs;
}

function decodeBase64Snippets(text: string): string[] {
  const decoded: string[] = [];
  const b64Regex = /(?:atob\s*\(\s*['"]|data-src=["']|file:\s*['"])([A-Za-z0-9+/=]{24,500})['"]/g;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = b64Regex.exec(text)) !== null && n < 20) {
    n += 1;
    try {
      const str = Buffer.from(m[1], 'base64').toString('utf8');
      if (str.includes('http') || str.includes('.m3u8') || str.includes('.mp4')) {
        decoded.push(str);
      }
    } catch {
      // Ignore invalid base64
    }
  }
  return decoded;
}

function guessQualityLabel(url: string, contextText = ''): string {
  const combined = `${url} ${contextText}`.toLowerCase();
  if (/(2160|4k|uhd)/i.test(combined)) return '4K UHD';
  if (/(1440|2k)/i.test(combined)) return '1440p';
  if (/1080/i.test(combined)) return '1080p Full HD';
  if (/720/i.test(combined)) return '720p HD';
  if (/480/i.test(combined)) return '480p';
  if (/360/i.test(combined)) return '360p';
  if (/240/i.test(combined)) return '240p';
  return 'HD';
}

function qualityScore(label: string, format: ExtractedStreamFormat): number {
  let score = format === 'hls' ? 500 : format === 'mp4' ? 450 : format === 'webm' ? 350 : 300;
  if (label.includes('4K')) score += 216;
  else if (label.includes('1440')) score += 144;
  else if (label.includes('1080')) score += 108;
  else if (label.includes('720')) score += 72;
  else if (label.includes('480')) score += 48;
  else if (label.includes('360')) score += 36;
  return score;
}

async function fetchWithTimeout(
  targetUrl: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<globalThis.Response> {
  const { timeoutMs = 12000, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(targetUrl, {
      ...rest,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const MOBILE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

function buildBrowserHeaders(
  _targetUrl: string,
  referer?: string,
  cookieHeader?: string,
  userAgent: string = DEFAULT_USER_AGENT
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,video/webm,video/mp4,application/vnd.apple.mpegurl,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'cross-site' : 'none',
    'Cache-Control': 'no-cache',
  };
  if (referer) headers['Referer'] = referer;
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  return headers;
}

function isFrameBlockingHeaders(res: globalThis.Response): boolean {
  const xfo = (res.headers.get('x-frame-options') || '').trim().toUpperCase();
  if (xfo.includes('DENY') || xfo.includes('SAMEORIGIN')) {
    return true;
  }
  const csp = (res.headers.get('content-security-policy') || '').toLowerCase();
  if (csp.includes('frame-ancestors')) {
    const match = csp.match(/frame-ancestors\s+([^;]+)/);
    const val = (match?.[1] || '').trim();
    if (val && val !== '*') {
      return true;
    }
  }
  return false;
}

function isCloudflareChallengeResponse(res: globalThis.Response, bodySnippet = ''): boolean {
  const cfMitigated = (res.headers.get('cf-mitigated') || '').toLowerCase();
  if (cfMitigated.includes('challenge')) return true;
  if (res.status === 403 || res.status === 503) {
    const lower = bodySnippet.toLowerCase();
    if (
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('_cf_chl_opt') ||
      lower.includes('<title>just a moment...</title>') ||
      lower.includes('enable javascript and cookies to continue')
    ) {
      return true;
    }
  }
  return false;
}

function extractCookiesFromResponse(res: globalThis.Response): string {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === 'function') {
    const rawCookies = anyHeaders.getSetCookie();
    return rawCookies
      .map((c) => c.split(';')[0]?.trim())
      .filter(Boolean)
      .join('; ');
  }
  const single = res.headers.get('set-cookie');
  if (!single) return '';
  return single
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

function parseMetaTitleAndPoster(html: string, baseUrl: string): { title?: string; posterUrl?: string } {
  const titleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const posterMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
    html.match(/<video[^>]+poster=["']([^"']+)["']/i);

  const posterUrl = posterMatch?.[1] ? resolveMaybeRelativeUrl(posterMatch[1], baseUrl) || undefined : undefined;
  const title = titleMatch?.[1] ? titleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() : undefined;
  return { title, posterUrl };
}

function collectStreamsFromTextBlob(
  text: string,
  baseUrl: string,
  refererUrl: string,
  addCandidate: (
    rawUrl: string,
    hintFormat?: ExtractedStreamFormat | null,
    hintQuality?: string,
    preferProxy?: boolean,
    bonusPriority?: number
  ) => void
) {
  const expandedChunks = [text, ...unpackDeanEdwardsBlocks(text), ...decodeBase64Snippets(text)];
  const combined = expandedChunks.join('\n');

  // 1. Meta tags (og:video / twitter:player:stream)
  const metaRegex =
    /<meta[^>]+(?:property|name)=["'](?:og:video(?::url|:secure_url)?|twitter:player:stream)["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:video(?::url|:secure_url)?|twitter:player:stream)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(combined)) !== null) {
    const u = m[1] || m[2];
    if (u) {
      const fmt = detectStreamFormatFromUrlOrType(u);
      if (fmt) addCandidate(u, fmt, undefined, true, 90);
    }
  }

  // 2. HTML <video> & <source> tags
  const sourceTagRegex = /<(?:video|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = sourceTagRegex.exec(combined)) !== null) {
    const tag = m[0];
    const src = m[1];
    const typeAttr = tag.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const labelAttr = tag.match(/\b(?:label|size|res|data-quality)\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const fmt = detectStreamFormatFromUrlOrType(src, typeAttr) || 'mp4';
    addCandidate(src, fmt, labelAttr || guessQualityLabel(src, tag), true, 120);
  }

  // 3. JSON-LD contentUrl
  const jsonLdRegex = /"contentUrl"\s*:\s*"([^"]+)"/gi;
  while ((m = jsonLdRegex.exec(combined)) !== null) {
    const u = unescapeMatchedUrl(m[1]);
    const fmt = detectStreamFormatFromUrlOrType(u) || 'mp4';
    addCandidate(u, fmt, guessQualityLabel(u), true, 100);
  }

  // 4. Player JS configs (file, src, source, hlsUrl, mp4Url, streamUrl, videoUrl, playbackUrl)
  const configKeyRegex =
    /(?:["']?(?:file|src|source|hls|hlsUrl|mp4|mp4Url|stream|streamUrl|videoUrl|video_url|playbackUrl|url|ondemandHls|ondemandDash|hd_src|sd_src|browser_native_hd_url|browser_native_sd_url)["']?\s*[:=]\s*["'])((?:https?:\\?\/\\?\/|\/)[^"'\s<>]{8,1200})["']/gi;
  while ((m = configKeyRegex.exec(combined)) !== null) {
    const rawUrl = unescapeMatchedUrl(m[1]);
    const fmt = detectStreamFormatFromUrlOrType(rawUrl);
    if (fmt) {
      addCandidate(rawUrl, fmt, guessQualityLabel(rawUrl, m[0]), true, 110);
    }
  }

  // 5. Generic URL regex scanning for .m3u8, .mpd, .mp4, .webm, .mkv, .mov
  const streamUrlRegex =
    /((?:https?:(?:\\\/\\\/|\/\/)|\\\/\\\/|\/\/)[^\s"'`<>\\)]+?\.(?:m3u8|mpd|mp4|webm|mkv|mov)(?:[^\s"'`<>]*))/gi;
  while ((m = streamUrlRegex.exec(combined)) !== null) {
    const candidate = unescapeMatchedUrl(m[1]);
    if (
      candidate.includes('.js') &&
      !candidate.includes('.m3u8') &&
      !candidate.includes('.mp4')
    ) {
      continue;
    }
    const fmt = detectStreamFormatFromUrlOrType(candidate);
    if (fmt) {
      addCandidate(candidate, fmt, guessQualityLabel(candidate), true, 70);
    }
  }

  // Also check relative .m3u8 / .mp4 references like "/hls/master.m3u8" or "video.mp4?token=..."
  const relStreamRegex = /["'](\/?[a-zA-Z0-9_./-]+\.(?:m3u8|mpd|mp4|webm)(?:\?[^"'<>\s]*)?)["']/gi;
  while ((m = relStreamRegex.exec(combined)) !== null) {
    const rel = unescapeMatchedUrl(m[1]);
    if (rel.length < 6 || rel.startsWith('//')) continue;
    const abs = resolveMaybeRelativeUrl(rel, baseUrl);
    if (abs) {
      const fmt = detectStreamFormatFromUrlOrType(abs);
      if (fmt) addCandidate(abs, fmt, guessQualityLabel(abs), true, 65);
    }
  }

  void refererUrl;
}

function collectIframeUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (raw?: string) => {
    if (!raw) return;
    const abs = resolveMaybeRelativeUrl(raw, baseUrl);
    if (!abs || seen.has(abs)) return;
    const lower = abs.toLowerCase();
    // Skip obvious ad/analytics/social tracking iframes
    if (
      /googletagmanager|doubleclick|googlesyndication|facebook\.com\/plugins|platform\.twitter|recaptcha|cloudflareinsights|disqus|chatango|histats|yandex\.ru\/metrika/.test(
        lower
      )
    ) {
      return;
    }
    seen.add(abs);
    urls.push(abs);
  };

  const iframeRegex = /<(?:iframe|embed)\b[^>]*\b(?:src|data-src|data-lazy-src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = iframeRegex.exec(html)) !== null) {
    add(m[1]);
  }

  const embedMetaRegex =
    /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  while ((m = embedMetaRegex.exec(html)) !== null) {
    add(m[1]);
  }

  const jsonEmbedRegex = /"embedUrl"\s*:\s*"([^"]+)"/gi;
  while ((m = jsonEmbedRegex.exec(html)) !== null) {
    add(m[1]);
  }

  return urls.slice(0, 8);
}

async function tryKnownPlatformExtractor(
  parsedUrl: URL,
  addCandidate: (
    rawUrl: string,
    hintFormat?: ExtractedStreamFormat | null,
    hintQuality?: string,
    preferProxy?: boolean,
    bonusPriority?: number
  ) => void
): Promise<{
  handledDirect?: boolean;
  canonicalTargetUrl?: string;
  embedFallbackUrl?: string;
  title?: string;
  posterUrl?: string;
}> {
  const host = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase();
  const path = parsedUrl.pathname;

  // 1. Dropbox: switch dl=0 to raw=1 direct download stream
  if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
    const direct = new URL(parsedUrl.href);
    direct.searchParams.delete('dl');
    direct.searchParams.set('raw', '1');
    addCandidate(direct.href, 'mp4', 'الأصلية', true, 180);
    return { handledDirect: true };
  }

  // 2. Google Drive: try extracting direct download URL (uc?export=download) + preview embed fallback
  if (host === 'drive.google.com') {
    const match = path.match(/\/file\/d\/([^/]+)/);
    const fileId = match?.[1] || parsedUrl.searchParams.get('id');
    if (fileId) {
      const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      try {
        const ucUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(fileId)}`;
        const headRes = await fetchWithTimeout(ucUrl, {
          method: 'GET',
          headers: {
            ...buildBrowserHeaders(ucUrl, 'https://drive.google.com/'),
            Range: 'bytes=0-1023',
          },
          redirect: 'follow',
          timeoutMs: 9000,
        });
        const ct = (headRes.headers.get('content-type') || '').toLowerCase();
        if (ct.startsWith('video/') || ct === 'application/octet-stream') {
          addCandidate(headRes.url || ucUrl, 'mp4', 'Google Drive HD', true, 180);
          return { embedFallbackUrl: previewUrl };
        }
        const html = await headRes.text();
        // Parse confirm form / download URL from Google Drive interstitial
        const confirmAction = html.match(/action=["'](https:\/\/drive\.usercontent\.google\.com\/download[^"']*)["']/i)?.[1];
        const uuidVal = html.match(/name=["']uuid["'][^>]*value=["']([^"']+)["']/i)?.[1];
        if (confirmAction) {
          const dlUrl = new URL(unescapeMatchedUrl(confirmAction));
          dlUrl.searchParams.set('id', fileId);
          dlUrl.searchParams.set('export', 'download');
          dlUrl.searchParams.set('confirm', 't');
          if (uuidVal) dlUrl.searchParams.set('uuid', uuidVal);
          addCandidate(dlUrl.href, 'mp4', 'Google Drive HD', true, 180);
        }
      } catch {
        // Fallback cleanly to preview embed
      }
      return { embedFallbackUrl: previewUrl };
    }
  }

  // 3. Archive.org metadata API -> direct MP4/OGV/HLS files
  if (host === 'archive.org') {
    const idMatch = path.match(/\/(?:details|embed)\/([^/?#]+)/);
    if (idMatch?.[1]) {
      const itemId = idMatch[1];
      const embedUrl = `https://archive.org/embed/${itemId}?autoplay=1`;
      try {
        const metaRes = await fetchWithTimeout(`https://archive.org/metadata/${encodeURIComponent(itemId)}`, {
          headers: buildBrowserHeaders(parsedUrl.href),
          timeoutMs: 9000,
        });
        if (metaRes.ok) {
          const meta: any = await metaRes.json();
          const files = Array.isArray(meta?.files) ? meta.files : [];
          const videoFiles = files.filter((f: any) => /\.(mp4|m4v|webm|mkv)$/i.test(String(f?.name || '')));
          for (const vf of videoFiles.slice(0, 6)) {
            const fileUrl = `https://archive.org/download/${encodeURIComponent(itemId)}/${encodeURIComponent(vf.name).replace(/%2F/g, '/')}`;
            const fmt = detectStreamFormatFromUrlOrType(fileUrl) || 'mp4';
            const q = vf.height ? `${vf.height}p` : guessQualityLabel(vf.name);
            addCandidate(fileUrl, fmt, q, false, 160);
          }
          return {
            embedFallbackUrl: embedUrl,
            title: meta?.metadata?.title ? String(meta.metadata.title) : undefined,
          };
        }
      } catch {
        // Ignore API failure, fallback to HTML crawl
      }
      return { embedFallbackUrl: embedUrl };
    }
  }

  // 4. Vimeo: config API -> progressive MP4 + HLS
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const idMatch = path.match(/\/(?:video\/)?(\d+)/);
    if (idMatch?.[1]) {
      const vimeoId = idMatch[1];
      const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
      const configUrl = `https://player.vimeo.com/video/${vimeoId}/config`;
      try {
        const cfgRes = await fetchWithTimeout(configUrl, {
          headers: buildBrowserHeaders(configUrl, 'https://vimeo.com/'),
          timeoutMs: 9000,
        });
        if (cfgRes.ok) {
          const cfg: any = await cfgRes.json();
          const progressive = cfg?.request?.files?.progressive;
          if (Array.isArray(progressive)) {
            for (const p of progressive) {
              if (p?.url) {
                addCandidate(p.url, 'mp4', p.quality || `${p.height || 720}p`, false, 175);
              }
            }
          }
          const hlsCdns = cfg?.request?.files?.hls?.cdns;
          if (hlsCdns && typeof hlsCdns === 'object') {
            for (const cdn of Object.values(hlsCdns) as any[]) {
              if (cdn?.url) {
                addCandidate(cdn.url, 'hls', 'HLS تكيفي', true, 185);
              }
            }
          }
          return {
            embedFallbackUrl: embedUrl,
            title: cfg?.video?.title,
            posterUrl: cfg?.video?.thumbs?.['1280'] || cfg?.video?.thumbs?.['640'],
          };
        }
      } catch {
        // Ignore config error
      }
      return { embedFallbackUrl: embedUrl };
    }
  }

  // 5. Dailymotion: player metadata API -> HLS .m3u8
  if (host === 'dailymotion.com' || host === 'dai.ly' || host === 'geo.dailymotion.com') {
    let dmId = '';
    if (host === 'dai.ly') {
      dmId = path.split('/').filter(Boolean)[0] || '';
    } else {
      dmId = path.match(/\/video\/([a-zA-Z0-9]+)/)?.[1] || '';
    }
    if (dmId) {
      const embedUrl = `https://www.dailymotion.com/embed/video/${dmId}?autoplay=1`;
      const metaUrl = `https://www.dailymotion.com/player/metadata/video/${dmId}`;
      try {
        const dmRes = await fetchWithTimeout(metaUrl, {
          headers: buildBrowserHeaders(metaUrl, 'https://www.dailymotion.com/'),
          timeoutMs: 9000,
        });
        if (dmRes.ok) {
          const dm: any = await dmRes.json();
          const autoQuals = dm?.qualities?.auto;
          if (Array.isArray(autoQuals)) {
            for (const item of autoQuals) {
              if (item?.url) {
                addCandidate(item.url, 'hls', 'HLS تكيفي', true, 185);
              }
            }
          }
          return {
            embedFallbackUrl: embedUrl,
            title: dm?.title,
            posterUrl: dm?.poster_url || dm?.posters?.['720'],
          };
        }
      } catch {
        // Ignore Dailymotion metadata error
      }
      return { embedFallbackUrl: embedUrl };
    }
  }

  // 6. OK.ru: embed HTML contains flashvars metadata JSON with HLS & MP4 links
  if (host === 'ok.ru' || host === 'odnoklassniki.ru') {
    const okId = path.match(/\/video(?:embed)?\/(\d+)/)?.[1];
    if (okId) {
      const embedUrl = `https://ok.ru/videoembed/${okId}`;
      return { canonicalTargetUrl: embedUrl, embedFallbackUrl: `${embedUrl}?autoplay=1` };
    }
  }

  // 7. MediaFire: direct download button href on page
  if (host === 'mediafire.com' || host.endsWith('.mediafire.com')) {
    try {
      const mfRes = await fetchWithTimeout(parsedUrl.href, {
        headers: buildBrowserHeaders(parsedUrl.href),
        timeoutMs: 10000,
      });
      if (mfRes.ok) {
        const html = await mfRes.text();
        const dlMatch =
          html.match(/id=["']downloadButton["'][^>]+href=["'](https:\/\/[^"']+)["']/i) ||
          html.match(/href=["'](https:\/\/download\d+\.mediafire\.com\/[^"']+)["']/i);
        if (dlMatch?.[1]) {
          const fmt = detectStreamFormatFromUrlOrType(dlMatch[1]) || 'mp4';
          addCandidate(dlMatch[1], fmt, 'MediaFire HD', true, 180);
          return { handledDirect: true };
        }
      }
    } catch {
      // Ignore error
    }
  }

  // 8. Streamtape token URL reconstruction
  if (host.includes('streamtape')) {
    try {
      const stRes = await fetchWithTimeout(parsedUrl.href, {
        headers: buildBrowserHeaders(parsedUrl.href),
        timeoutMs: 10000,
      });
      if (stRes.ok) {
        const html = await stRes.text();
        const tokenMatch = html.match(/getElementById\(['"](?:robot|no)?robotlink['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*\(['"]([^'"]+)['"]\)\.substring\((\d+)\)/i);
        if (tokenMatch) {
          const part1 = tokenMatch[1];
          const part2 = tokenMatch[2].substring(parseInt(tokenMatch[3], 10));
          const constructed = `https:${part1}${part2}&stream=1`;
          addCandidate(constructed, 'mp4', 'Streamtape HD', true, 175);
        }
      }
    } catch {
      // Ignore error
    }
  }

  return {};
}

async function tryYtDlpFallback(url: string): Promise<ExtractedStreamCandidate[]> {
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['--no-playlist', '--no-warnings', '-f', 'best[ext=mp4]/best', '-g', url],
      { timeout: 12000 }
    );
    const lines = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http'));
    return lines.map((streamUrl, idx) => {
      const fmt = detectStreamFormatFromUrlOrType(streamUrl) || 'mp4';
      const quality = guessQualityLabel(streamUrl);
      return {
        url: streamUrl,
        proxiedUrl: buildStreamProxyUrl(streamUrl, url),
        format: fmt,
        quality,
        label: idx === 0 ? `مستخرج (${quality})` : `جودة بديلة (${quality})`,
        referer: url,
        preferProxy: true,
        priority: 170 - idx * 5,
      };
    });
  } catch {
    return [];
  }
}

export async function extractUniversalVideoStreams(
  rawUrl: string,
  options?: { referer?: string; forceFresh?: boolean }
): Promise<UniversalExtractionResult> {
  const parsedInitial = assertSafePublicHttpUrl(rawUrl);
  const inputUrl = parsedInitial.href;

  if (!options?.forceFresh) {
    const cached = extractionCache.get(inputUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, cached: true };
    }
  }

  const candidateMap = new Map<string, ExtractedStreamCandidate>();
  const addCandidate = (
    candidateRawUrl: string,
    hintFormat?: ExtractedStreamFormat | null,
    hintQuality?: string,
    preferProxy = true,
    bonusPriority = 0,
    refererOverride?: string
  ) => {
    const resolved = resolveMaybeRelativeUrl(candidateRawUrl, refererOverride || inputUrl);
    if (!resolved) return;
    if (extractYouTubeVideoIdServer(resolved)) return;

    const format = hintFormat || detectStreamFormatFromUrlOrType(resolved) || 'mp4';
    const quality = hintQuality || guessQualityLabel(resolved);
    const referer = refererOverride || inputUrl;
    const priority = qualityScore(quality, format) + bonusPriority;

    const existing = candidateMap.get(resolved);
    if (!existing || priority > existing.priority) {
      candidateMap.set(resolved, {
        url: resolved,
        proxiedUrl: buildStreamProxyUrl(resolved, referer),
        format,
        quality,
        label: `${format.toUpperCase()} • ${quality}`,
        referer,
        preferProxy,
        priority,
      });
    }
  };

  // Fast-path: if URL itself explicitly points to .m3u8 / .mp4 / .webm / .mpd, verify via lightweight probe
  const explicitExtFormat = detectStreamFormatFromUrlOrType(inputUrl);

  let finalUrl = inputUrl;
  let pageTitle: string | undefined;
  let pagePoster: string | undefined;
  let embedFallbackUrl: string | undefined;
  let frameBlocked = false;
  let cloudflareBlocked = false;
  let httpStatus: number | undefined;
  let diagnostics = '';

  const ytId = extractYouTubeVideoIdServer(inputUrl);
  if (ytId) {
    const result: UniversalExtractionResult = {
      ok: true,
      inputUrl,
      finalUrl: inputUrl,
      kind: 'youtube',
      streams: [],
      diagnostics: 'YouTube source',
    };
    extractionCache.set(inputUrl, { expiresAt: Date.now() + CACHE_TTL_MS, data: result });
    return result;
  }

  // Try host-specific APIs / extractors first
  const hostHints = await tryKnownPlatformExtractor(parsedInitial, (u, fmt, q, pProxy, prio) =>
    addCandidate(u, fmt, q, pProxy, prio, inputUrl)
  );
  if (hostHints.title) pageTitle = hostHints.title;
  if (hostHints.posterUrl) pagePoster = hostHints.posterUrl;
  if (hostHints.embedFallbackUrl) embedFallbackUrl = hostHints.embedFallbackUrl;

  const crawlQueue: Array<{ url: string; referer: string; depth: number; cookies?: string }> = [];
  const visitedPages = new Set<string>();

  if (!hostHints.handledDirect && candidateMap.size === 0) {
    crawlQueue.push({
      url: hostHints.canonicalTargetUrl || inputUrl,
      referer: options?.referer || '',
      depth: 0,
    });
  } else if (hostHints.canonicalTargetUrl) {
    crawlQueue.push({
      url: hostHints.canonicalTargetUrl,
      referer: options?.referer || '',
      depth: 0,
    });
  }

  while (crawlQueue.length > 0 && visitedPages.size < 8) {
    const item = crawlQueue.shift()!;
    if (visitedPages.has(item.url)) continue;
    visitedPages.add(item.url);

    try {
      const targetParsed = assertSafePublicHttpUrl(item.url);
      let res = await fetchWithTimeout(targetParsed.href, {
        method: 'GET',
        headers: {
          ...buildBrowserHeaders(targetParsed.href, item.referer, item.cookies),
          ...(explicitExtFormat ? { Range: 'bytes=0-2047' } : {}),
        },
        redirect: 'follow',
        timeoutMs: 11000,
      });

      // Retry with Mobile Safari UA & bare navigation headers if 403/401 returned
      if ((res.status === 403 || res.status === 401) && !explicitExtFormat) {
        if (isFrameBlockingHeaders(res)) frameBlocked = true;
        await res.body?.cancel().catch(() => {});
        res = await fetchWithTimeout(targetParsed.href, {
          method: 'GET',
          headers: buildBrowserHeaders(targetParsed.href, '', item.cookies, MOBILE_SAFARI_UA),
          redirect: 'follow',
          timeoutMs: 11000,
        });
      }

      if (item.depth === 0) {
        httpStatus = res.status;
      }
      if (isFrameBlockingHeaders(res)) {
        frameBlocked = true;
      }

      const resolvedFinal = res.url || targetParsed.href;
      if (item.depth === 0) finalUrl = resolvedFinal;

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const acao = (res.headers.get('access-control-allow-origin') || '').trim();
      const corsOpen = acao === '*';
      const nextCookies = [item.cookies, extractCookiesFromResponse(res)].filter(Boolean).join('; ');

      const detectedFmt = detectStreamFormatFromUrlOrType(resolvedFinal, ct);

      // Direct media binary stream or playlist
      if (
        ct.startsWith('video/') ||
        ct.includes('mpegurl') ||
        ct.includes('dash+xml') ||
        ct === 'application/octet-stream' ||
        (explicitExtFormat && !ct.includes('text/html'))
      ) {
        const fmt = detectedFmt || explicitExtFormat || 'mp4';
        const preferProxy = !corsOpen || Boolean(options?.referer);
        addCandidate(resolvedFinal, fmt, guessQualityLabel(resolvedFinal), preferProxy, 200, item.referer || targetParsed.origin + '/');
        try {
          await res.body?.cancel();
        } catch {
          // ignore
        }
        break;
      }

      // Otherwise parse HTML/text
      if (ct.includes('text/') || ct.includes('json') || ct.includes('javascript') || !ct) {
        const html = (await res.text()).slice(0, 1_500_000);
        if (isCloudflareChallengeResponse(res, html)) {
          cloudflareBlocked = true;
          frameBlocked = true;
          if (!diagnostics) {
            diagnostics = 'المصدر محمي بتحقق Cloudflare ويمنع التضمين المباشر (X-Frame-Options)';
          }
          continue;
        }

        const meta = parseMetaTitleAndPoster(html, resolvedFinal);
        if (!pageTitle && meta.title) pageTitle = meta.title;
        if (!pagePoster && meta.posterUrl) pagePoster = meta.posterUrl;

        // Parse OK.ru flashvars metadata JSON inside data-options if present
        if (resolvedFinal.includes('ok.ru')) {
          const dataOptionsMatch = html.match(/data-options="([^"]+)"/i);
          if (dataOptionsMatch?.[1]) {
            try {
              const decodedOpts = dataOptionsMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
              const parsedOpts = JSON.parse(decodedOpts);
              const metaStr = parsedOpts?.flashvars?.metadata;
              if (typeof metaStr === 'string') {
                const metaJson = JSON.parse(metaStr);
                if (metaJson.hlsManifestUrl) {
                  addCandidate(metaJson.hlsManifestUrl, 'hls', 'HLS تكيفي', true, 190, resolvedFinal);
                }
                if (metaJson.ondemandHls) {
                  addCandidate(metaJson.ondemandHls, 'hls', 'HLS تكيفي', true, 190, resolvedFinal);
                }
                if (Array.isArray(metaJson.videos)) {
                  for (const v of metaJson.videos) {
                    if (v?.url) {
                      addCandidate(v.url, 'mp4', String(v.name || 'HD').toUpperCase(), true, 165, resolvedFinal);
                    }
                  }
                }
              }
            } catch {
              // ignore JSON parse issues
            }
          }
        }

        collectStreamsFromTextBlob(html, resolvedFinal, item.referer, (u, fmt, q, pProxy, prio) =>
          addCandidate(u, fmt, q, pProxy, prio, resolvedFinal)
        );

        // Crawl nested iframes up to depth 2 if no stream extracted yet
        if (item.depth < 2) {
          const iframeUrls = collectIframeUrls(html, resolvedFinal);
          for (const frameUrl of iframeUrls) {
            if (!embedFallbackUrl) {
              embedFallbackUrl = frameUrl;
            }
            if (!visitedPages.has(frameUrl)) {
              crawlQueue.push({
                url: frameUrl,
                referer: resolvedFinal,
                depth: item.depth + 1,
                cookies: nextCookies,
              });
            }
          }
        }

        // If we found streams at this depth, we can stop deeper iframe recursion
        if (candidateMap.size > 0 && item.depth > 0) {
          break;
        }
      } else {
        try {
          await res.body?.cancel();
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      diagnostics = err?.name === 'AbortError' ? 'Timeout fetching external page' : err?.message || '';
    }
  }

  // Optional yt-dlp extraction if available and still no streams found
  if (candidateMap.size === 0 && !cloudflareBlocked) {
    const ytDlpCandidates = await tryYtDlpFallback(inputUrl);
    for (const c of ytDlpCandidates) {
      candidateMap.set(c.url, c);
    }
  }

  const streams = Array.from(candidateMap.values()).sort((a, b) => b.priority - a.priority);

  // If URL had explicit video extension but fetch failed (e.g. strict hotlink/geo/timeout), still provide proxy candidate!
  if (streams.length === 0 && explicitExtFormat) {
    streams.push({
      url: inputUrl,
      proxiedUrl: buildStreamProxyUrl(inputUrl, options?.referer || parsedInitial.origin + '/'),
      format: explicitExtFormat,
      quality: guessQualityLabel(inputUrl),
      label: `${explicitExtFormat.toUpperCase()} • ${guessQualityLabel(inputUrl)}`,
      referer: options?.referer || parsedInitial.origin + '/',
      preferProxy: true,
      priority: 100,
    });
  }

  let kind: UniversalExtractionResult['kind'] = 'unresolved';
  if (streams.length > 0) {
    kind = 'stream';
  } else if (embedFallbackUrl || !explicitExtFormat) {
    kind = 'embed';
  }

  const effectiveEmbed = embedFallbackUrl || finalUrl || inputUrl;
  const result: UniversalExtractionResult = {
    ok: streams.length > 0 || kind === 'embed',
    inputUrl,
    finalUrl,
    kind,
    streams,
    embedUrl: effectiveEmbed,
    proxiedEmbedUrl: buildEmbedProxyUrl(effectiveEmbed, inputUrl),
    frameBlocked: frameBlocked || undefined,
    cloudflareBlocked: cloudflareBlocked || undefined,
    httpStatus,
    posterUrl: pagePoster,
    title: pageTitle,
    diagnostics: diagnostics || undefined,
  };

  if (result.streams.length > 0 || (result.embedUrl && !cloudflareBlocked)) {
    extractionCache.set(inputUrl, { expiresAt: Date.now() + CACHE_TTL_MS, data: result });
  }

  return result;
}
