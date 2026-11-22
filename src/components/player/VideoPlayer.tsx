import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import { AnimatePresence, motion } from 'motion/react';
import {
  Airplay,
  AlertCircle,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FastForward,
  Film,
  Info,
  ListVideo,
  Loader2,
  Maximize,
  Minimize,
  MoreVertical,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Server,
  Share2,
  SkipForward,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { Episode, MediaItem, PlayerSettingsConfig, VideoSourceOption } from '../../types';
import {
  ExtractedStreamCandidate,
  extractExternalStream,
  fetchVideoStreams,
  UniversalExtractionResponse,
  VideoStreamsResponse,
} from '../../services/api';
import { getMediaProgress, saveWatchProgress } from '../../services/storage';
import {
  getActiveSubtitleText,
  parseSubtitleText,
  SUBTITLE_COLORS,
  SUBTITLE_SIZES,
  SubtitleCue,
  SubtitleSizeOption,
} from '../../utils/subtitles';
import {
  extractYouTubeStartSeconds,
  extractYouTubeVideoId,
  formatYouTubeQualityCode,
  getYouTubeCanonicalUrl,
  isYouTubeUrl,
  loadYouTubeIframeApi,
  qualityRankToYouTubeCode,
  YTPlayerInstance,
} from '../../utils/youtube';
import {
  buildEmbedProxyUrl,
  buildStreamProxyUrl,
  convertToUniversalEmbedUrl,
  getPipedMirrorEmbedUrl,
  isDashStreamUrl,
  isDirectEmbedPlatformUrl,
  isDirectMediaFileUrl,
  isExternalHttpUrl,
  isHlsStreamUrl,
  isLikelyFrameBlockedHost,
  isProxiedEmbedUrl,
  isProxiedStreamUrl,
  normalizeExternalHttpUrl,
} from '../../utils/videoEngines';
import {
  formatQualityLabel,
  getQualityNumericRank,
  getSavedPreferredQuality,
  PreferredQualityPref,
  savePreferredQuality,
  sortQualityOptions,
} from '../../utils/quality';

interface VideoPlayerProps {
  media: MediaItem;
  onClose: () => void;
  playerDefaults?: PlayerSettingsConfig;
}

interface FlattenedEpisode extends Episode {
  seasonNumber: number;
  seasonTitle: string;
}

interface QualityOption {
  id: string;
  label: string;
  ytCode?: string;
  hlsLevel?: number;
  url?: string;
  status?: 'ready' | 'processing';
  rank?: number;
}

interface OrderedServerItem {
  id: string;
  orderNumber: number;
  shortLabel: string;
  label: string;
  url: string;
  format: 'mp4' | 'hls' | 'dash' | 'webm' | 'youtube' | 'embed';
  qualityLabel: string;
  qualityRank: number;
  isDefault: boolean;
  referer?: string;
  engineType:
    | 'direct-mp4'
    | 'hls-adaptive'
    | 'dash-adaptive'
    | 'youtube-embed'
    | 'youtube-nocookie'
    | 'universal-embed'
    | 'custom-source';
}

type ActivePanel =
  | 'settings'
  | 'settings_quality'
  | 'settings_speed'
  | 'settings_servers'
  | 'settings_info'
  | 'audio_subtitles'
  | 'episodes'
  | null;

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const YOUTUBE_PRESET_QUALITIES: QualityOption[] = [
  { id: 'auto', ytCode: 'auto', label: 'تلقائي', status: 'ready', rank: 0 },
  { id: 'yt-100', ytCode: 'tiny', label: '100p', status: 'ready', rank: 100 },
  { id: 'tiny', ytCode: 'tiny', label: '144p', status: 'ready', rank: 144 },
  { id: 'small', ytCode: 'small', label: '240p', status: 'ready', rank: 240 },
  { id: 'medium', ytCode: 'medium', label: '360p', status: 'ready', rank: 360 },
  { id: 'large', ytCode: 'large', label: '480p', status: 'ready', rank: 480 },
  { id: 'hd720', ytCode: 'hd720', label: '720p', status: 'ready', rank: 720 },
  { id: 'hd1080', ytCode: 'hd1080', label: '1080p', status: 'ready', rank: 1080 },
];

function extractLocalVideoFilename(url: string | undefined): string | null {
  if (!url) return null;
  const clean = url.split('?')[0].trim();
  const marker = '/uploads/videos/';
  const idx = clean.indexOf(marker);
  if (idx === -1) return null;
  const filePart = clean.slice(idx + marker.length);
  if (!filePart || filePart.includes('/')) return null;
  try {
    return decodeURIComponent(filePart);
  } catch {
    return filePart;
  }
}

function getQualityRank(labelOrUrl: string | undefined): number {
  return getQualityNumericRank(labelOrUrl);
}

function isHlsSource(url: string): boolean {
  return isHlsStreamUrl(url);
}

function isValidVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('blob:')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatClockTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '00:00';
  const total = Math.floor(secs);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ media, onClose, playerDefaults }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const seekFeedbackTimerRef = useRef<number | null>(null);
  const tapTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' | 'center' }>({
    time: 0,
    side: 'center',
  });
  const lastSavedTickRef = useRef<number>(0);
  const pendingSeekRef = useRef<number | null>(null);
  const resumeAutoplayRef = useRef<boolean>(false);
  const hasFatalErrorRef = useRef<boolean>(false);
  const showControlsRef = useRef<boolean>(true);
  const isPlayingRef = useRef<boolean>(false);
  const revealedOnPointerDownRef = useRef<boolean>(false);
  const failedServerIdsRef = useRef<Set<string>>(new Set());
  const proxyTriedUrlsRef = useRef<Set<string>>(new Set());
  const failoverTimerRef = useRef<number | null>(null);

  // Flatten series episodes if available
  const episodesList = useMemo<FlattenedEpisode[]>(() => {
    if (!media.seasons || media.seasons.length === 0) return [];
    const flattened: FlattenedEpisode[] = [];
    for (const season of media.seasons) {
      for (const ep of season.episodes || []) {
        if (ep.videoUrl) {
          flattened.push({
            ...ep,
            seasonNumber: season.seasonNumber,
            seasonTitle: season.title || `الموسم ${season.seasonNumber}`,
          });
        }
      }
    }
    return flattened;
  }, [media.seasons]);

  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState<number>(() => {
    if (episodesList.length === 0) return -1;
    const recent = getMediaProgress(media.id);
    if (recent?.episodeId) {
      const idx = episodesList.findIndex((e) => e.id === recent.episodeId);
      if (idx >= 0) return idx;
    }
    return 0;
  });

  const activeEpisode =
    activeEpisodeIndex >= 0 && activeEpisodeIndex < episodesList.length
      ? episodesList[activeEpisodeIndex]
      : null;

  const nextEpisode =
    activeEpisodeIndex >= 0 && activeEpisodeIndex < episodesList.length - 1
      ? episodesList[activeEpisodeIndex + 1]
      : null;

  const baseVideoUrl =
    normalizeExternalHttpUrl(activeEpisode?.videoUrl || media.videoUrl) ||
    activeEpisode?.videoUrl ||
    media.videoUrl;
  const playbackSessionKey = `${media.id}::${activeEpisode?.id || 'movie'}`;
  const availableCustomSources = useMemo(
    () => activeEpisode?.sources || media.sources || [],
    [activeEpisode?.sources, media.sources]
  );

  // Playback & stream state
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string>(() =>
    normalizeExternalHttpUrl(baseVideoUrl)
  );
  const [activeServerId, setActiveServerId] = useState<string>(() =>
    extractLocalVideoFilename(baseVideoUrl)
      ? 'server-gr'
      : isYouTubeUrl(baseVideoUrl)
      ? 'server-youtube'
      : 'server-gr'
  );
  const [serverStreamData, setServerStreamData] = useState<VideoStreamsResponse | null>(null);
  const [resolvedServerAlts, setResolvedServerAlts] = useState<
    Array<{ label: string; url: string; format: string }>
  >([]);
  const [extractedByUrl, setExtractedByUrl] = useState<Record<string, UniversalExtractionResponse>>({});
  const [pendingExtractionUrls, setPendingExtractionUrls] = useState<Record<string, boolean>>({});
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
  const [ytQualityOptions, setYtQualityOptions] = useState<QualityOption[]>([]);
  const [activeYtQualityId, setActiveYtQualityId] = useState<string>('auto');
  const [ytEmbedBlocked, setYtEmbedBlocked] = useState<boolean>(false);
  const [ytHasStartedPlaying, setYtHasStartedPlaying] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLandscapeMode, setIsLandscapeMode] = useState<boolean>(false);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => ({
    width:
      typeof window !== 'undefined'
        ? window.visualViewport?.width || window.innerWidth
        : 1280,
    height:
      typeof window !== 'undefined'
        ? window.visualViewport?.height || window.innerHeight
        : 720,
  }));
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(playerDefaults?.defaultSpeed || 1);
  const [isEnded, setIsEnded] = useState<boolean>(false);

  // Quality & loading state
  const [preferredQualityPref, setPreferredQualityPref] = useState<PreferredQualityPref | null>(() => {
    const saved = getSavedPreferredQuality();
    if (saved) return saved;
    const adminDefault = (playerDefaults?.defaultQuality || '').trim();
    if (
      adminDefault &&
      !adminDefault.toLowerCase().includes('auto') &&
      !adminDefault.includes('تلقائي')
    ) {
      const rank = getQualityNumericRank(adminDefault);
      if (rank > 0 && rank < 5000) {
        return { id: `${rank}p`, label: `${rank}p`, rank };
      }
    }
    return null;
  });
  const preferredQualityRef = useRef<PreferredQualityPref | null>(preferredQualityPref);
  const manualQualityChosenRef = useRef<boolean>(false);
  const [hlsQualityOptions, setHlsQualityOptions] = useState<QualityOption[]>([]);
  const [activeHlsQualityId, setActiveHlsQualityId] = useState<string>('auto');
  const [detectedResolution, setDetectedResolution] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState<number>(0);

  // HUD & Popover state
  const [showControls, setShowControls] = useState<boolean>(true);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [selectedSeasonTab, setSelectedSeasonTab] = useState<number>(() => {
    const initialSeason = episodesList[activeEpisodeIndex]?.seasonNumber;
    return initialSeason || media.seasons?.[0]?.seasonNumber || 1;
  });
  const [resumePrompt, setResumePrompt] = useState<number | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<'forward' | 'backward' | null>(null);
  const [hoverSeek, setHoverSeek] = useState<{ time: number; percent: number } | null>(null);
  const [isProgressHovered, setIsProgressHovered] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const [hudToast, setHudToast] = useState<string | null>(null);
  const hudToastTimerRef = useRef<number | null>(null);

  // Subtitles state
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleFileName, setSubtitleFileName] = useState<string | null>(null);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleSize, setSubtitleSize] = useState<SubtitleSizeOption>(
    playerDefaults?.defaultSubtitleSize || 'md'
  );
  const [subtitleColor, setSubtitleColor] = useState<string>(
    playerDefaults?.defaultSubtitleColor || '#ffffff'
  );

  const localVideoFilename = useMemo(() => {
    const primaryLocal = extractLocalVideoFilename(baseVideoUrl);
    if (primaryLocal) return primaryLocal;
    for (const src of availableCustomSources) {
      const localFromSrc = extractLocalVideoFilename(src?.url);
      if (localFromSrc) return localFromSrc;
    }
    return null;
  }, [baseVideoUrl, availableCustomSources]);

  // Discover uploaded multi-engine server streams
  useEffect(() => {
    if (!localVideoFilename) {
      setServerStreamData(null);
      return;
    }

    let cancelled = false;
    let pollTimer: number | null = null;

    const loadStreams = async () => {
      const data = await fetchVideoStreams(localVideoFilename);
      if (cancelled) return;
      if (data) {
        setServerStreamData(data);
        if (data.processing) {
          pollTimer = window.setTimeout(loadStreams, 2500);
        }
      }
    };

    void loadStreams();

    return () => {
      cancelled = true;
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [localVideoFilename, retryToken]);

  // Query server for any non-YouTube stored alternatives (GR / G streams) matching this media or episode
  useEffect(() => {
    let cancelled = false;
    setResolvedServerAlts([]);
    const params = new URLSearchParams({ mediaId: media.id });
    if (activeEpisode?.id) params.set('episodeId', activeEpisode.id);
    if (baseVideoUrl) params.set('url', baseVideoUrl);

    fetch(`/api/stream/resolve?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.alternatives)) {
          setResolvedServerAlts(data.alternatives);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [media.id, activeEpisode?.id, baseVideoUrl]);

  // Universal deep extraction for any external http(s) non-YouTube URL so ANY platform link plays in GoldenFlix's real player
  const externalCandidatesToExtract = useMemo(() => {
    const rawUrls = [
      baseVideoUrl,
      ...availableCustomSources.map((s) => s?.url || ''),
      ...resolvedServerAlts.map((s) => s?.url || ''),
    ];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawUrls) {
      const norm = normalizeExternalHttpUrl(raw);
      if (
        !norm ||
        seen.has(norm) ||
        !isExternalHttpUrl(norm) ||
        isYouTubeUrl(norm) ||
        isProxiedStreamUrl(norm) ||
        isProxiedEmbedUrl(norm)
      ) {
        continue;
      }
      seen.add(norm);
      unique.push(norm);
    }
    return unique.slice(0, 5);
  }, [availableCustomSources, baseVideoUrl, resolvedServerAlts]);

  useEffect(() => {
    const toFetch = externalCandidatesToExtract.filter((u) => !extractedByUrl[u]);
    if (toFetch.length === 0) return;

    let cancelled = false;
    setPendingExtractionUrls((prev) => {
      const next = { ...prev };
      toFetch.forEach((u) => {
        next[u] = true;
      });
      return next;
    });

    toFetch.forEach((targetUrl) => {
      void extractExternalStream(targetUrl)
        .then((res) => {
          if (cancelled) return;
          if (res) {
            setExtractedByUrl((prev) => ({ ...prev, [targetUrl]: res }));
          } else {
            setExtractedByUrl((prev) => ({
              ...prev,
              [targetUrl]: {
                ok: false,
                inputUrl: targetUrl,
                finalUrl: targetUrl,
                kind: 'unresolved',
                streams: [],
              },
            }));
          }
        })
        .finally(() => {
          if (cancelled) return;
          setPendingExtractionUrls((prev) => {
            const next = { ...prev };
            delete next[targetUrl];
            return next;
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, [externalCandidatesToExtract, retryToken]);

  const orderedServers = useMemo<OrderedServerItem[]>(() => {
    const rawList: Array<Omit<OrderedServerItem, 'orderNumber'>> = [];
    const seenKeys = new Set<string>();
    const normalizeUrlKey = (u: string) => u.trim();

    let hasGrServer = false;
    let hasGServer = false;
    let ytPrimaryUrl: string | null = isYouTubeUrl(baseVideoUrl) ? baseVideoUrl : null;

    if (serverStreamData?.exists && serverStreamData.servers.length > 0) {
      serverStreamData.servers.forEach((srv, idx) => {
        const key = normalizeUrlKey(srv.url);
        if (!key || seenKeys.has(key)) return;
        seenKeys.add(key);
        const isFirst = idx === 0;
        if (isFirst) hasGrServer = true;
        else hasGServer = true;
        rawList.push({
          id: srv.id,
          shortLabel: srv.shortLabel || (isFirst ? 'مشغل GR' : 'مشغل G'),
          label: srv.label,
          url: srv.url,
          format: srv.format,
          qualityLabel:
            srv.format === 'hls'
              ? 'HLS تكيفي'
              : serverStreamData.sourceHeight
              ? `${serverStreamData.sourceHeight}p`
              : media.videoQuality
              ? formatQualityLabel(media.videoQuality)
              : 'أصلي',
          qualityRank: srv.format === 'hls' ? 1400 : serverStreamData.sourceHeight || 1080,
          isDefault: srv.isDefault,
          engineType: srv.format === 'hls' ? 'hls-adaptive' : 'direct-mp4',
        });
      });
    }

    const pushExternalSourceWithExtraction = (
      rawUrl: string,
      opts: {
        idPrefix: string;
        shortLabel?: string;
        rawLabel?: string;
        declaredFormat?: string;
        quality?: string;
        isDefault?: boolean;
        preferInsertFront?: boolean;
      }
    ) => {
      const normalized = normalizeExternalHttpUrl(rawUrl);
      if (!normalized) return;

      const isYt = opts.declaredFormat === 'youtube' || isYouTubeUrl(normalized);
      if (isYt) {
        ytPrimaryUrl = ytPrimaryUrl || normalized;
        const key = `yt::${normalized}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        const entry: Omit<OrderedServerItem, 'orderNumber'> = {
          id: opts.idPrefix,
          shortLabel: 'YouTube',
          label: opts.rawLabel ? formatQualityLabel(opts.rawLabel) : 'مشغل يوتيوب القياسي (YouTube)',
          url: normalized,
          format: 'youtube',
          qualityLabel: opts.quality || (opts.rawLabel ? formatQualityLabel(opts.rawLabel) : '1080p'),
          qualityRank: getQualityRank(opts.quality || opts.rawLabel),
          isDefault: Boolean(opts.isDefault) && !hasGrServer,
          engineType: 'youtube-embed',
        };
        if (opts.preferInsertFront) rawList.unshift(entry);
        else rawList.push(entry);
        return;
      }

      const extraction = extractedByUrl[normalized];
      const extractedStreams: ExtractedStreamCandidate[] = extraction?.streams || [];

      const assignServerIdentity = (fallbackShort: string) => {
        const rawLbl = (opts.rawLabel || '').trim();
        const explicitGr = /\bgr\b/i.test(rawLbl) || opts.idPrefix === 'server-gr';
        const explicitG = !explicitGr && (/\bg\b/i.test(rawLbl) || opts.idPrefix === 'server-g');

        let assignedShort = fallbackShort || (rawLbl ? formatQualityLabel(rawLbl) : '');
        let assignedId = opts.idPrefix;

        if (explicitGr || (!hasGrServer && !explicitG)) {
          hasGrServer = true;
          assignedShort = explicitGr ? rawLbl : 'مشغل GR';
          if (!rawList.some((x) => x.id === 'server-gr')) assignedId = 'server-gr';
        } else if (explicitG || !hasGServer) {
          hasGServer = true;
          assignedShort = explicitG ? rawLbl : 'مشغل G';
          if (!rawList.some((x) => x.id === 'server-g')) assignedId = 'server-g';
        }
        return { assignedId, assignedShort };
      };

      // Case A: Extractor uncovered real playable media streams (HLS / MP4 / WebM / DASH) -> ALWAYS play in GoldenFlix's real player!
      if (extractedStreams.length > 0) {
        const insertedEntries: Array<Omit<OrderedServerItem, 'orderNumber'>> = [];

        extractedStreams.slice(0, 4).forEach((cand, cIdx) => {
          const primaryUrl = cand.preferProxy ? cand.proxiedUrl : cand.url;
          const secondaryUrl = cand.preferProxy ? cand.url : cand.proxiedUrl;

          const engineType: OrderedServerItem['engineType'] =
            cand.format === 'hls'
              ? 'hls-adaptive'
              : cand.format === 'dash'
              ? 'dash-adaptive'
              : 'direct-mp4';

          const { assignedId, assignedShort } = assignServerIdentity(
            cIdx === 0 ? 'مشغل GR' : cIdx === 1 ? 'مشغل G' : `جودة ${cand.quality}`
          );

          if (!seenKeys.has(primaryUrl)) {
            seenKeys.add(primaryUrl);
            insertedEntries.push({
              id: cIdx === 0 ? assignedId : `${opts.idPrefix}-ext-${cIdx}`,
              shortLabel: assignedShort,
              label: `${assignedShort} • ${cand.label}${cand.preferProxy ? ' (بث مباشر محمي)' : ''}`,
              url: primaryUrl,
              format: cand.format,
              qualityLabel: cand.quality,
              qualityRank: getQualityRank(cand.quality),
              isDefault: Boolean(opts.isDefault) && cIdx === 0,
              referer: cand.referer,
              engineType,
            });
          }

          // Add opposite (proxy/direct) mirror for the top stream so automatic failover stays inside real <video> player
          if (cIdx === 0 && secondaryUrl && !seenKeys.has(secondaryUrl)) {
            seenKeys.add(secondaryUrl);
            const altIdentity = assignServerIdentity(cand.preferProxy ? 'المباشر' : 'مشغل G');
            insertedEntries.push({
              id: altIdentity.assignedId === assignedId ? `${opts.idPrefix}-mirror` : altIdentity.assignedId,
              shortLabel: altIdentity.assignedShort,
              label: `${altIdentity.assignedShort} • ${
                cand.preferProxy ? 'اتصال مباشر من المصدر' : 'سيرفر تجاوز الحجب Proxy'
              }`,
              url: secondaryUrl,
              format: cand.format,
              qualityLabel: cand.quality,
              qualityRank: getQualityRank(cand.quality),
              isDefault: false,
              referer: cand.referer,
              engineType,
            });
          }
        });

        // Optional embed backup ONLY at the very end in case all direct/proxy streams fail
        if (extraction?.proxiedEmbedUrl && !seenKeys.has(extraction.proxiedEmbedUrl)) {
          seenKeys.add(extraction.proxiedEmbedUrl);
          insertedEntries.push({
            id: `${opts.idPrefix}-embed-fallback`,
            shortLabel: 'مشغل بديل',
            label: 'المشغل البديل • عرض الصفحة المدمجة',
            url: extraction.proxiedEmbedUrl,
            format: 'embed',
            qualityLabel: 'Auto',
            qualityRank: 100,
            isDefault: false,
            engineType: 'universal-embed',
          });
        }

        if (opts.preferInsertFront) {
          rawList.unshift(...insertedEntries);
        } else {
          rawList.push(...insertedEntries);
        }
        return;
      }

      // Case B: Extraction returned embed fallback (no raw .m3u8/.mp4 found on page)
      if (extraction && extraction.kind === 'embed' && (extraction.embedUrl || extraction.proxiedEmbedUrl)) {
        const directEmbed = convertToUniversalEmbedUrl(extraction.embedUrl || normalized) || extraction.embedUrl;
        const mustUseProxyFirst =
          Boolean(extraction.frameBlocked) ||
          Boolean(extraction.cloudflareBlocked) ||
          isLikelyFrameBlockedHost(directEmbed || normalized);
        const proxiedEmbed =
          extraction.proxiedEmbedUrl ||
          (directEmbed ? buildEmbedProxyUrl(directEmbed, normalized) : buildEmbedProxyUrl(normalized));

        if (mustUseProxyFirst && proxiedEmbed) {
          const { assignedId, assignedShort } = assignServerIdentity('مشغل GR');
          if (!seenKeys.has(proxiedEmbed)) {
            seenKeys.add(proxiedEmbed);
            const item: Omit<OrderedServerItem, 'orderNumber'> = {
              id: assignedId,
              shortLabel: assignedShort,
              label: `${assignedShort} • مشغل كسر الحظر (Proxy Embed)`,
              url: proxiedEmbed,
              format: 'embed',
              qualityLabel: opts.quality || 'HD',
              qualityRank: getQualityRank(opts.quality),
              isDefault: Boolean(opts.isDefault),
              engineType: 'universal-embed',
            };
            if (opts.preferInsertFront) rawList.unshift(item);
            else rawList.push(item);
          }

          if (directEmbed && !seenKeys.has(directEmbed)) {
            seenKeys.add(directEmbed);
            const alt = assignServerIdentity('مشغل G');
            rawList.push({
              id: alt.assignedId === assignedId ? `${opts.idPrefix}-direct-embed` : alt.assignedId,
              shortLabel: alt.assignedShort,
              label: `${alt.assignedShort} • المشغل المدمج التلقائي`,
              url: directEmbed,
              format: 'embed',
              qualityLabel: 'HD',
              qualityRank: 720,
              isDefault: false,
              engineType: 'universal-embed',
            });
          }
          return;
        }

        const { assignedId, assignedShort } = assignServerIdentity('مشغل GR');

        if (directEmbed && !seenKeys.has(directEmbed)) {
          seenKeys.add(directEmbed);
          const item: Omit<OrderedServerItem, 'orderNumber'> = {
            id: assignedId,
            shortLabel: assignedShort,
            label: `${assignedShort} • المشغل المدمج التلقائي`,
            url: directEmbed,
            format: 'embed',
            qualityLabel: opts.quality || 'HD',
            qualityRank: getQualityRank(opts.quality),
            isDefault: Boolean(opts.isDefault),
            engineType: 'universal-embed',
          };
          if (opts.preferInsertFront) rawList.unshift(item);
          else rawList.push(item);
        }

        if (proxiedEmbed && !seenKeys.has(proxiedEmbed)) {
          seenKeys.add(proxiedEmbed);
          const alt = assignServerIdentity('مشغل G');
          rawList.push({
            id: alt.assignedId === assignedId ? `${opts.idPrefix}-proxy-embed` : alt.assignedId,
            shortLabel: alt.assignedShort,
            label: `${alt.assignedShort} • مشغل كسر الحظر (Proxy Embed)`,
            url: proxiedEmbed,
            format: 'embed',
            qualityLabel: 'HD',
            qualityRank: 720,
            isDefault: false,
            engineType: 'universal-embed',
          });
        }
        return;
      }

      // Case C: Pre-extraction or direct URL fallback
      const rawEmbedUrl = convertToUniversalEmbedUrl(normalized);
      const embedUrl =
        rawEmbedUrl && isLikelyFrameBlockedHost(rawEmbedUrl)
          ? buildEmbedProxyUrl(rawEmbedUrl, normalized)
          : rawEmbedUrl;
      const isHls = !embedUrl && (opts.declaredFormat === 'hls' || isHlsStreamUrl(normalized));
      const isDash = !embedUrl && isDashStreamUrl(normalized);
      const targetUrl =
        embedUrl ||
        (isLikelyFrameBlockedHost(normalized) ? buildEmbedProxyUrl(normalized) : normalized);
      if (seenKeys.has(targetUrl)) return;
      seenKeys.add(targetUrl);

      const { assignedId, assignedShort } = assignServerIdentity(opts.rawLabel || 'مشغل GR');
      const entry: Omit<OrderedServerItem, 'orderNumber'> = {
        id: assignedId,
        shortLabel: assignedShort,
        label: opts.rawLabel
          ? `${assignedShort} • ${formatQualityLabel(opts.rawLabel)}`
          : `${assignedShort} • ${
              isProxiedEmbedUrl(targetUrl)
                ? 'مشغل كسر الحظر (Proxy Embed)'
                : embedUrl
                ? 'المشغل المدمج المستقل'
                : isHls
                ? 'البث التكيفي HLS'
                : isDash
                ? 'البث التكيفي DASH'
                : 'سيرفر الموقع المباشر'
            }`,
        url: targetUrl,
        format: embedUrl || isProxiedEmbedUrl(targetUrl) ? 'embed' : isHls ? 'hls' : isDash ? 'dash' : opts.declaredFormat === 'webm' ? 'webm' : 'mp4',
        qualityLabel: opts.quality || (opts.rawLabel ? formatQualityLabel(opts.rawLabel) : 'الأصلية'),
        qualityRank: getQualityRank(opts.quality || opts.rawLabel),
        isDefault: Boolean(opts.isDefault),
        engineType:
          embedUrl || isProxiedEmbedUrl(targetUrl)
            ? 'universal-embed'
            : isHls
            ? 'hls-adaptive'
            : isDash
            ? 'dash-adaptive'
            : 'direct-mp4',
      };
      if (opts.preferInsertFront) rawList.unshift(entry);
      else rawList.push(entry);

      if (
        extraction &&
        !embedUrl &&
        !isHls &&
        !isDash &&
        !isDirectMediaFileUrl(normalized) &&
        isExternalHttpUrl(normalized)
      ) {
        const lastResortEmbed = extraction.proxiedEmbedUrl || buildEmbedProxyUrl(normalized);
        if (!seenKeys.has(lastResortEmbed)) {
          seenKeys.add(lastResortEmbed);
          rawList.push({
            id: `${opts.idPrefix}-forced-embed`,
            shortLabel: 'مشغل بديل',
            label: 'المشغل البديل • عرض الصفحة المدمجة',
            url: lastResortEmbed,
            format: 'embed',
            qualityLabel: 'Auto',
            qualityRank: 100,
            isDefault: false,
            engineType: 'universal-embed',
          });
        }
      }
    };

    const mergedCustomSources: VideoSourceOption[] = [
      ...availableCustomSources,
      ...resolvedServerAlts.map((alt, i) => ({
        id: `resolved-${i}`,
        label: alt.label,
        url: alt.url,
        format: alt.format,
        isDefault: false,
      })),
    ];

    const sortedCustom = [...mergedCustomSources]
      .filter((s) => Boolean(s?.url))
      .sort((a, b) => {
        if (Boolean(a.isDefault) !== Boolean(b.isDefault)) {
          return a.isDefault ? -1 : 1;
        }
        return getQualityRank(b.label) - getQualityRank(a.label);
      });

    sortedCustom.forEach((src, idx) => {
      pushExternalSourceWithExtraction(src.url, {
        idPrefix: src.id || `custom-${idx}`,
        rawLabel: src.label,
        declaredFormat: src.format,
        quality: src.quality,
        isDefault: Boolean(src.isDefault) && rawList.length === 0,
      });
    });

    if (baseVideoUrl && baseVideoUrl.trim()) {
      pushExternalSourceWithExtraction(baseVideoUrl, {
        idPrefix: isYouTubeUrl(baseVideoUrl) ? 'server-youtube' : 'server-primary',
        declaredFormat: isYouTubeUrl(baseVideoUrl) ? 'youtube' : undefined,
        quality: media.videoQuality,
        isDefault: rawList.length === 0,
        preferInsertFront: rawList.length === 0,
      });
    }

    // Ensure GoldenFlix non-YouTube / mirror players GR and G are ALWAYS available as ready fallback/switch servers for YouTube
    if (ytPrimaryUrl) {
      if (!hasGrServer) {
        hasGrServer = true;
        rawList.push({
          id: 'server-gr',
          shortLabel: 'مشغل GR',
          label: 'مشغل GR • مشغل الموقع الآمن (خارج صفحة يوتيوب)',
          url: ytPrimaryUrl,
          format: 'youtube',
          qualityLabel: '1080p HD',
          qualityRank: 1080,
          isDefault: false,
          engineType: 'youtube-nocookie',
        });
      }

      if (!hasGServer) {
        const pipedUrl = getPipedMirrorEmbedUrl(ytPrimaryUrl, true);
        if (pipedUrl) {
          hasGServer = true;
          rawList.push({
            id: 'server-g',
            shortLabel: 'مشغل G',
            label: 'مشغل G • السيرفر الاحتياطي المستقل (غير يوتيوب)',
            url: pipedUrl,
            format: 'embed',
            qualityLabel: 'HD',
            qualityRank: 900,
            isDefault: false,
            engineType: 'universal-embed',
          });
        }
      }
    }

    return rawList.map((item, idx) => ({
      ...item,
      orderNumber: idx + 1,
    }));
  }, [availableCustomSources, baseVideoUrl, extractedByUrl, media.videoQuality, resolvedServerAlts, serverStreamData]);

  const resolvedActiveServer = useMemo(() => {
    const byId = orderedServers.find((s) => s.id === activeServerId);
    if (byId) return byId;
    const byUrl = orderedServers.find((s) => s.url === selectedSourceUrl);
    return byUrl || orderedServers[0] || null;
  }, [activeServerId, orderedServers, selectedSourceUrl]);

  // Sync selectedSourceUrl automatically when universal extractor resolves a real stream for the active server
  useEffect(() => {
    if (
      resolvedActiveServer?.url &&
      resolvedActiveServer.url !== selectedSourceUrl &&
      !isProxiedStreamUrl(selectedSourceUrl)
    ) {
      setSelectedSourceUrl(resolvedActiveServer.url);
    }
  }, [resolvedActiveServer?.url, selectedSourceUrl]);

  const activeNormalizedSource = useMemo(
    () => normalizeExternalHttpUrl(baseVideoUrl || selectedSourceUrl),
    [baseVideoUrl, selectedSourceUrl]
  );

  const isWaitingForExtraction = useMemo(() => {
    if (!activeNormalizedSource) return false;
    if (!pendingExtractionUrls[activeNormalizedSource]) return false;
    // Direct media files and direct embed platforms (Vimeo, Dailymotion, Drive preview) start immediately without stalling
    if (
      isDirectMediaFileUrl(selectedSourceUrl) ||
      isHlsStreamUrl(selectedSourceUrl) ||
      isDashStreamUrl(selectedSourceUrl) ||
      isDirectEmbedPlatformUrl(selectedSourceUrl)
    ) {
      return false;
    }
    return isExternalHttpUrl(selectedSourceUrl) && !isYouTubeUrl(selectedSourceUrl);
  }, [activeNormalizedSource, pendingExtractionUrls, selectedSourceUrl]);

  const activeEngineType = resolvedActiveServer?.engineType;
  const universalEmbedUrl = useMemo(() => {
    if (isWaitingForExtraction) return null;
    if (isProxiedStreamUrl(selectedSourceUrl)) return null;
    if (isProxiedEmbedUrl(selectedSourceUrl)) return selectedSourceUrl;
    if (activeEngineType === 'universal-embed') {
      const converted = convertToUniversalEmbedUrl(selectedSourceUrl) || selectedSourceUrl;
      const ext = extractedByUrl[normalizeExternalHttpUrl(selectedSourceUrl)];
      if (ext?.frameBlocked || isLikelyFrameBlockedHost(converted)) {
        return ext?.proxiedEmbedUrl || buildEmbedProxyUrl(converted, baseVideoUrl);
      }
      return converted;
    }
    if (
      !isYouTubeUrl(selectedSourceUrl) &&
      !isHlsStreamUrl(selectedSourceUrl) &&
      !isDashStreamUrl(selectedSourceUrl) &&
      !isDirectMediaFileUrl(selectedSourceUrl)
    ) {
      const ext = extractedByUrl[normalizeExternalHttpUrl(selectedSourceUrl)];
      if (ext && ext.streams.length > 0) return null;
      const converted = convertToUniversalEmbedUrl(selectedSourceUrl);
      if (converted && (ext?.frameBlocked || isLikelyFrameBlockedHost(converted))) {
        return ext?.proxiedEmbedUrl || buildEmbedProxyUrl(converted, baseVideoUrl);
      }
      return converted;
    }
    return null;
  }, [activeEngineType, baseVideoUrl, extractedByUrl, isWaitingForExtraction, selectedSourceUrl]);

  // Listen for runtime stream extraction or Cloudflare challenge bridge events from /api/stream/embed-proxy
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'goldenflix-extracted-stream' && typeof data.url === 'string') {
        const streamUrl = data.url.trim();
        if (/^https?:\/\//i.test(streamUrl)) {
          const proxied = buildStreamProxyUrl(streamUrl, typeof data.referer === 'string' ? data.referer : undefined);
          hasFatalErrorRef.current = false;
          setErrorMessage(null);
          setSelectedSourceUrl(proxied);
        }
      } else if (data.type === 'goldenflix-embed-status' && data.status === 'cloudflare-blocked') {
        // Automatically fail over to an alternate working server if available (skipping direct frame-blocked copy)
        const currentSrvId = resolvedActiveServer?.id || activeServerId;
        const altValid = orderedServers.find(
          (s) =>
            s.id !== currentSrvId &&
            !failedServerIdsRef.current.has(s.id) &&
            !isLikelyFrameBlockedHost(s.url)
        );
        if (altValid) {
          attemptAutomaticFailoverRef.current('المصدر محمي بتحقق أمان مباشر');
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [activeServerId, orderedServers, resolvedActiveServer?.id]);

  const isUniversalEmbedMode = Boolean(universalEmbedUrl);
  const isYouTubeSource = useMemo(
    () =>
      !isUniversalEmbedMode &&
      (activeEngineType === 'youtube-embed' ||
        activeEngineType === 'youtube-nocookie' ||
        isYouTubeUrl(selectedSourceUrl)),
    [activeEngineType, isUniversalEmbedMode, selectedSourceUrl]
  );

  useEffect(() => {
    preferredQualityRef.current = preferredQualityPref;
  }, [preferredQualityPref]);

  // Apply preferred rendition on local uploaded multi-quality videos automatically once ready
  useEffect(() => {
    if (manualQualityChosenRef.current) return;
    const pref = preferredQualityPref;
    if (!pref || pref.rank <= 0) return;
    if (!serverStreamData?.exists || !serverStreamData.qualities.length) return;
    if (isYouTubeUrl(selectedSourceUrl) || isHlsSource(selectedSourceUrl)) return;

    const readyQualities = serverStreamData.qualities.filter(
      (q) => q.status === 'ready' && q.url && typeof q.height === 'number'
    );
    if (readyQualities.length === 0) return;

    const exact = readyQualities.find((q) => q.height === pref.rank);
    const closest =
      exact ||
      [...readyQualities].sort(
        (a, b) => Math.abs((a.height || 0) - pref.rank) - Math.abs((b.height || 0) - pref.rank)
      )[0];

    if (closest?.url && closest.url !== selectedSourceUrl) {
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        pendingSeekRef.current = video.currentTime;
        resumeAutoplayRef.current = !video.paused;
      }
      setSelectedSourceUrl(closest.url);
    }
  }, [preferredQualityPref, selectedSourceUrl, serverStreamData]);

  // Sync source state when episode/media changes
  useEffect(() => {
    const cleanBaseUrl = normalizeExternalHttpUrl(baseVideoUrl);
    manualQualityChosenRef.current = false;
    failedServerIdsRef.current.clear();
    proxyTriedUrlsRef.current.clear();
    setFailoverNotice(null);
    setSelectedSourceUrl(cleanBaseUrl);
    setActiveServerId(
      extractLocalVideoFilename(cleanBaseUrl)
        ? 'server-gr'
        : isYouTubeUrl(cleanBaseUrl)
        ? 'server-youtube'
        : 'server-gr'
    );
    setHlsQualityOptions([]);
    setActiveHlsQualityId('auto');
    setYtQualityOptions([]);
    setActiveYtQualityId('auto');
    setYtEmbedBlocked(false);
    setYtHasStartedPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedTime(0);
    setIsEnded(false);
    setErrorMessage(null);
    hasFatalErrorRef.current = false;
    setActivePanel(null);
    setDetectedResolution(null);
    pendingSeekRef.current = null;
    resumeAutoplayRef.current = true;
  }, [baseVideoUrl]);

  // Lock body scroll while player is mounted
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Network listeners
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setIsLoading(false);
      if (!videoRef.current || videoRef.current.readyState < 3) {
        hasFatalErrorRef.current = true;
        setErrorMessage('انقطع الاتصال بالإنترنت. تحقق من اتصال الشبكة ثم أعد المحاولة.');
      }
    };
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Resume saved progress prompt
  useEffect(() => {
    const prev = getMediaProgress(media.id, activeEpisode?.id);
    if (prev && prev.currentTime > 5 && prev.duration - prev.currentTime > 15) {
      setResumePrompt(prev.currentTime);
    } else {
      setResumePrompt(null);
    }
  }, [media.id, activeEpisode?.id]);

  // Remote subtitle loader
  useEffect(() => {
    const remoteSubUrl = activeEpisode?.subtitleUrl || media.subtitleUrl;
    if (!remoteSubUrl) return;

    let cancelled = false;
    fetch(remoteSubUrl)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Failed to load subtitle'))))
      .then((text) => {
        if (cancelled) return;
        const parsed = parseSubtitleText(text);
        if (parsed.length > 0) {
          setSubtitleCues(parsed);
          setSubtitleFileName(remoteSubUrl.split('/').pop() || 'ترجمة مرفقة');
          setSubtitleError(null);
          setSubtitlesEnabled(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeEpisode?.subtitleUrl, media.subtitleUrl]);

  // Fullscreen, viewport, stage ResizeObserver & physical orientation listeners
  useEffect(() => {
    const updateViewportSize = () => {
      const w = window.visualViewport?.width || window.innerWidth;
      const h = window.visualViewport?.height || window.innerHeight;
      setViewportSize({ width: w, height: h });
      // Prevent double rotation if device physically rotated into landscape
      if (w > h) {
        setIsLandscapeMode(false);
      }
    };

    const handleFsChange = () => {
      const fsActive = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(fsActive);
      if (!fsActive && screen.orientation && 'unlock' in screen.orientation) {
        try {
          screen.orientation.unlock();
        } catch {
          // Browsers without orientation lock ignore safely
        }
      }
      updateViewportSize();
    };

    updateViewportSize();

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    window.addEventListener('resize', updateViewportSize);
    window.addEventListener('orientationchange', updateViewportSize);
    window.visualViewport?.addEventListener('resize', updateViewportSize);

    let observer: ResizeObserver | null = null;
    if (stageRef.current && typeof ResizeObserver !== 'undefined') {
      const syncStage = () => {
        if (!stageRef.current) return;
        const nextW = stageRef.current.clientWidth;
        const nextH = stageRef.current.clientHeight;
        if (nextW > 0 && nextH > 0) {
          setStageSize((prev) =>
            prev.width === nextW && prev.height === nextH
              ? prev
              : { width: nextW, height: nextH }
          );
        }
      };
      syncStage();
      observer = new ResizeObserver(syncStage);
      observer.observe(stageRef.current);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('resize', updateViewportSize);
      window.removeEventListener('orientationchange', updateViewportSize);
      window.visualViewport?.removeEventListener('resize', updateViewportSize);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  const isPlayerCurrentlyPlaying = useCallback(() => {
    if (!isPlayingRef.current) return false;
    if (isYouTubeSource) {
      return ytPlayerRef.current?.getPlayerState?.() === 1;
    }
    return Boolean(videoRef.current && !videoRef.current.paused);
  }, [isYouTubeSource]);

  const scheduleControlsHide = useCallback(() => {
    clearControlsTimer();
    if (
      !isPlayerCurrentlyPlaying() ||
      activePanel ||
      errorMessage ||
      isEnded ||
      isScrubbing ||
      isProgressHovered
    ) {
      return;
    }

    controlsTimerRef.current = window.setTimeout(() => {
      if (
        isPlayerCurrentlyPlaying() &&
        !activePanel &&
        !errorMessage &&
        !isEnded &&
        !isScrubbing &&
        !isProgressHovered
      ) {
        showControlsRef.current = false;
        setShowControls(false);
      }
    }, 5000);
  }, [
    activePanel,
    clearControlsTimer,
    errorMessage,
    isEnded,
    isPlayerCurrentlyPlaying,
    isProgressHovered,
    isScrubbing,
  ]);

  const revealControls = useCallback(() => {
    showControlsRef.current = true;
    setShowControls(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    if (
      activePanel ||
      errorMessage ||
      isEnded ||
      !isPlaying ||
      isScrubbing ||
      isProgressHovered
    ) {
      clearControlsTimer();
      showControlsRef.current = true;
      setShowControls(true);
    } else {
      scheduleControlsHide();
    }
    return clearControlsTimer;
  }, [
    activePanel,
    clearControlsTimer,
    errorMessage,
    isEnded,
    isPlaying,
    isProgressHovered,
    isScrubbing,
    scheduleControlsHide,
  ]);

  const persistProgress = useCallback(
    (time: number, total: number) => {
      if (time > 5 && total > 0 && !hasFatalErrorRef.current) {
        saveWatchProgress({
          mediaId: media.id,
          episodeId: activeEpisode?.id,
          seasonNumber: activeEpisode?.seasonNumber,
          currentTime: time,
          duration: total,
        });
      }
    },
    [media.id, activeEpisode?.id, activeEpisode?.seasonNumber]
  );

  const triggerFailoverToNextServer = useCallback(
    (reason?: string): boolean => {
      if (!navigator.onLine) return false;
      const currentSrvId = resolvedActiveServer?.id || activeServerId;
      if (currentSrvId) {
        failedServerIdsRef.current.add(currentSrvId);
      }

      const priorityOrder = (srv: OrderedServerItem) => {
        if (srv.id === 'server-gr' || srv.shortLabel.includes('GR')) return 0;
        if (srv.id === 'server-g' || srv.shortLabel.includes('G')) return 1;
        return 2;
      };

      const nextServer = [...orderedServers]
        .filter((srv) => srv.id !== currentSrvId && !failedServerIdsRef.current.has(srv.id))
        .sort((a, b) => priorityOrder(a) - priorityOrder(b))[0];

      if (!nextServer) {
        return false;
      }

      const activeTime = isYouTubeSource
        ? ytPlayerRef.current?.getCurrentTime?.() || currentTime || 0
        : videoRef.current?.currentTime || currentTime || 0;

      if (activeTime > 0) {
        pendingSeekRef.current = activeTime;
      }
      resumeAutoplayRef.current = true;
      hasFatalErrorRef.current = false;
      setErrorMessage(null);
      setYtEmbedBlocked(false);
      setIsLoading(nextServer.engineType !== 'universal-embed');
      setActiveServerId(nextServer.id);
      setSelectedSourceUrl(nextServer.url);
      setFailoverNotice(
        reason
          ? `${reason} — تم التحويل تلقائياً إلى ${nextServer.shortLabel}`
          : `تم التحويل تلقائياً إلى ${nextServer.shortLabel}`
      );
      if (failoverTimerRef.current) {
        window.clearTimeout(failoverTimerRef.current);
      }
      failoverTimerRef.current = window.setTimeout(() => {
        setFailoverNotice(null);
      }, 4500);
      return true;
    },
    [activeServerId, currentTime, isYouTubeSource, orderedServers, resolvedActiveServer?.id]
  );

  const attemptAutomaticFailoverRef = useRef(triggerFailoverToNextServer);
  useEffect(() => {
    attemptAutomaticFailoverRef.current = triggerFailoverToNextServer;
  }, [triggerFailoverToNextServer]);

  const trySwitchCurrentStreamToProxy = useCallback(
    (reason?: string): boolean => {
      if (!navigator.onLine) return false;
      const currentUrl = selectedSourceUrl;
      if (
        !currentUrl ||
        isProxiedStreamUrl(currentUrl) ||
        isProxiedEmbedUrl(currentUrl) ||
        !isExternalHttpUrl(currentUrl) ||
        proxyTriedUrlsRef.current.has(currentUrl)
      ) {
        return false;
      }

      proxyTriedUrlsRef.current.add(currentUrl);
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        pendingSeekRef.current = video.currentTime;
      }
      resumeAutoplayRef.current = true;
      hasFatalErrorRef.current = false;
      setErrorMessage(null);
      setIsLoading(true);
      const proxied = buildStreamProxyUrl(currentUrl, resolvedActiveServer?.referer);
      setSelectedSourceUrl(proxied);
      setFailoverNotice(
        reason
          ? `${reason} — تم تفعيل البروكسي الداخلي لتشغيل الفيلم`
          : 'تم تفعيل البروكسي الداخلي لتجاوز قيود المصدر'
      );
      if (failoverTimerRef.current) {
        window.clearTimeout(failoverTimerRef.current);
      }
      failoverTimerRef.current = window.setTimeout(() => {
        setFailoverNotice(null);
      }, 4000);
      return true;
    },
    [resolvedActiveServer?.referer, selectedSourceUrl]
  );

  const trySwitchCurrentStreamToProxyRef = useRef(trySwitchCurrentStreamToProxy);
  useEffect(() => {
    trySwitchCurrentStreamToProxyRef.current = trySwitchCurrentStreamToProxy;
  }, [trySwitchCurrentStreamToProxy]);

  // Initialize playback engine (YouTube IFrame API / YouTube-NoCookie / Universal Embed / HLS.js / DASH.js / Native MP4)
  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (dashRef.current) {
      try {
        dashRef.current.reset();
      } catch {
        // Ignore DASH cleanup errors
      }
      dashRef.current = null;
    }

    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.destroy();
      } catch {
        // Ignore cleanup errors
      }
      ytPlayerRef.current = null;
    }
    if (ytHostRef.current) {
      ytHostRef.current.innerHTML = '';
    }

    hasFatalErrorRef.current = false;
    setErrorMessage(null);
    setYtEmbedBlocked(false);
    setYtHasStartedPlaying(false);
    setIsEnded(false);

    if (!navigator.onLine) {
      hasFatalErrorRef.current = true;
      setIsLoading(false);
      setErrorMessage('لا يوجد اتصال بالإنترنت. تأكد من اتصالك بالشبكة ثم أعد المحاولة.');
      return;
    }

    if (isWaitingForExtraction) {
      setIsLoading(true);
      setHlsQualityOptions([]);
      setYtQualityOptions([]);
      return;
    }

    if (isUniversalEmbedMode) {
      setIsLoading(false);
      setIsPlaying(true);
      setHlsQualityOptions([]);
      setYtQualityOptions([]);
      return;
    }

    if (isYouTubeSource && isYouTubeUrl(selectedSourceUrl)) {
      const videoId = extractYouTubeVideoId(selectedSourceUrl);
      if (!videoId) {
        hasFatalErrorRef.current = true;
        setIsLoading(false);
        setErrorMessage('رابط يوتيوب غير صالح أو تعذر استخراج معرف الفيديو.');
        return;
      }

      let cancelled = false;
      let progressTimer: number | null = null;
      let ytReadyReceived = false;
      let rawYtPlayer: YTPlayerInstance | null = null;
      const ytBootWatchdog = window.setTimeout(() => {
        if (cancelled || ytReadyReceived || hasFatalErrorRef.current) return;
        const switched = attemptAutomaticFailoverRef.current('تأخر استجابة مشغل يوتيوب');
        if (!switched) {
          hasFatalErrorRef.current = true;
          setIsLoading(false);
          setErrorMessage('تعذر الاتصال بخادم يوتيوب. يمكنك المحاولة مجدداً أو اختيار مشغل آخر.');
        }
      }, 9000);

      const savedPref = preferredQualityRef.current;
      const initialYtOptionId =
        savedPref && savedPref.rank > 0
          ? savedPref.rank <= 100
            ? 'yt-100'
            : qualityRankToYouTubeCode(savedPref.rank)
          : 'auto';
      const initialYtCode =
        initialYtOptionId === 'auto' ? 'auto' : qualityRankToYouTubeCode(initialYtOptionId);

      setIsLoading(true);
      setIsPlaying(false);
      setHlsQualityOptions([]);
      setYtQualityOptions(YOUTUBE_PRESET_QUALITIES);
      setActiveYtQualityId(initialYtOptionId);

      const syncYouTubeQualities = (target: YTPlayerInstance) => {
        const rawLevels = target.getAvailableQualityLevels?.() || [];
        const uniqueByRank = new Map<number, QualityOption>();

        if (rawLevels.length > 0) {
          // Include low-bandwidth 100p preset (maps to YouTube 'tiny') + all reported levels
          const hasTinyOrLower = rawLevels.some((lvl) =>
            ['tiny', 'small', 'medium'].includes(lvl)
          );
          if (hasTinyOrLower) {
            uniqueByRank.set(100, {
              id: 'yt-100',
              ytCode: 'tiny',
              label: '100p',
              status: 'ready',
              rank: 100,
            });
          }

          rawLevels
            .filter((lvl) => lvl && lvl !== 'auto' && lvl !== 'unknown')
            .forEach((lvl) => {
              const label = formatYouTubeQualityCode(lvl);
              const rank = getQualityNumericRank(lvl);
              if (rank > 0 && !uniqueByRank.has(rank)) {
                uniqueByRank.set(rank, {
                  id: lvl,
                  ytCode: lvl,
                  label,
                  status: 'ready',
                  rank,
                });
              }
            });

          const sorted = sortQualityOptions<QualityOption>([
            { id: 'auto', ytCode: 'auto', label: 'تلقائي', status: 'ready', rank: 0 },
            ...Array.from(uniqueByRank.values()),
          ]);
          setYtQualityOptions(sorted);
        } else {
          setYtQualityOptions(YOUTUBE_PRESET_QUALITIES);
        }
      };

      loadYouTubeIframeApi()
        .then((YT) => {
          if (cancelled || !ytHostRef.current) return;
          ytHostRef.current.innerHTML = '';
          const mountNode = document.createElement('div');
          mountNode.style.width = '100%';
          mountNode.style.height = '100%';
          ytHostRef.current.appendChild(mountNode);

          const startSeconds =
            pendingSeekRef.current !== null
              ? pendingSeekRef.current
              : extractYouTubeStartSeconds(selectedSourceUrl);

          const enforceYoutubeIframeStyle = () => {
            const iframeEl = ytHostRef.current?.querySelector('iframe');
            if (iframeEl) {
              iframeEl.style.position = 'absolute';
              iframeEl.style.top = '0';
              iframeEl.style.left = '0';
              iframeEl.style.width = '100%';
              iframeEl.style.height = '100%';
              iframeEl.style.display = 'block';
              iframeEl.style.border = '0';
            }
          };

          const ytEmbedHost =
            activeEngineType === 'youtube-nocookie'
              ? 'https://www.youtube-nocookie.com'
              : 'https://www.youtube.com';

          const player = new YT.Player(mountNode, {
            videoId,
            host: ytEmbedHost,
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              origin: typeof window !== 'undefined' ? window.location.origin : undefined,
              ...(initialYtCode !== 'auto' ? { vq: initialYtCode } : {}),
              ...(typeof startSeconds === 'number' && startSeconds > 0
                ? { start: Math.floor(startSeconds) }
                : {}),
            },
            events: {
              onReady: ({ target }) => {
                if (cancelled) return;
                ytReadyReceived = true;
                window.clearTimeout(ytBootWatchdog);
                ytPlayerRef.current = target;
                enforceYoutubeIframeStyle();
                setIsLoading(false);

                const dur =
                  typeof target.getDuration === 'function' ? target.getDuration() || 0 : 0;
                if (dur > 0) setDuration(dur);

                if (typeof target.setVolume === 'function') {
                  target.setVolume(isMuted ? 0 : Math.round(volume * 100));
                }
                if (isMuted && typeof target.mute === 'function') target.mute();
                else if (!isMuted && typeof target.unMute === 'function') target.unMute();

                if (playbackSpeed !== 1 && typeof target.setPlaybackRate === 'function') {
                  target.setPlaybackRate(playbackSpeed);
                }

                syncYouTubeQualities(target);

                if (initialYtCode !== 'auto') {
                  if (typeof target.setPlaybackQualityRange === 'function') {
                    target.setPlaybackQualityRange(initialYtCode, initialYtCode);
                  }
                  if (typeof target.setPlaybackQuality === 'function') {
                    target.setPlaybackQuality(initialYtCode);
                  }
                }

                if (pendingSeekRef.current !== null && typeof target.seekTo === 'function') {
                  target.seekTo(pendingSeekRef.current, true);
                  pendingSeekRef.current = null;
                }

                resumeAutoplayRef.current = false;
                if (typeof target.playVideo === 'function') {
                  target.playVideo();
                }

                progressTimer = window.setInterval(() => {
                  const p = ytPlayerRef.current;
                  if (!p || hasFatalErrorRef.current) return;
                  const now = Number(
                    typeof p.getCurrentTime === 'function' ? p.getCurrentTime() || 0 : 0
                  );
                  const total = Number(
                    typeof p.getDuration === 'function' ? p.getDuration() || 0 : 0
                  );
                  const loadedFrac = Number(
                    typeof p.getVideoLoadedFraction === 'function'
                      ? p.getVideoLoadedFraction() || 0
                      : 0
                  );
                  if (Number.isFinite(now)) setCurrentTime(now);
                  if (Number.isFinite(total) && total > 0) {
                    setDuration(total);
                    setBufferedTime(Math.min(total, loadedFrac * total));
                  }
                  const wallNow = Date.now();
                  if (wallNow - lastSavedTickRef.current >= 2000 && total > 0) {
                    lastSavedTickRef.current = wallNow;
                    persistProgress(now, total);
                  }
                }, 250);
              },
              onStateChange: ({ data, target }) => {
                if (cancelled) return;
                if (ytPlayerRef.current !== target && typeof target?.playVideo === 'function') {
                  ytPlayerRef.current = target;
                }
                if (data === 1) {
                  setIsLoading(false);
                  setIsPlaying(true);
                  setYtHasStartedPlaying(true);
                  setIsEnded(false);
                  const dur =
                    typeof target.getDuration === 'function' ? target.getDuration() || 0 : 0;
                  if (dur > 0) setDuration(dur);
                  syncYouTubeQualities(target);
                  const currentQ =
                    typeof target.getPlaybackQuality === 'function'
                      ? target.getPlaybackQuality()
                      : undefined;
                  if (currentQ && currentQ !== 'unknown') {
                    setDetectedResolution(formatYouTubeQualityCode(currentQ));
                  }
                } else if (data === 2) {
                  setIsLoading(false);
                  setIsPlaying(false);
                } else if (data === 3) {
                  setIsLoading(true);
                } else if (data === 0) {
                  setIsLoading(false);
                  setIsPlaying(false);
                  setIsEnded(true);
                  const dur =
                    (typeof target.getDuration === 'function' ? target.getDuration() : 0) ||
                    duration;
                  persistProgress(dur, dur);
                } else if (data === 5 || data === -1) {
                  setIsLoading(false);
                }
              },
              onPlaybackQualityChange: ({ data }) => {
                if (!cancelled && data && data !== 'unknown') {
                  setDetectedResolution(formatYouTubeQualityCode(data));
                }
              },
              onError: ({ data }) => {
                if (cancelled) return;
                window.clearTimeout(ytBootWatchdog);
                const reasonText =
                  data === 101 || data === 150
                    ? 'مشغل يوتيوب محجوب لهذا الفيديو'
                    : 'توقف مشغل يوتيوب عن الاستجابة';
                if (attemptAutomaticFailoverRef.current(reasonText)) {
                  return;
                }
                hasFatalErrorRef.current = true;
                setIsLoading(false);
                setIsPlaying(false);
                if (data === 101 || data === 150) {
                  setYtEmbedBlocked(true);
                  setErrorMessage(
                    'ناشر هذا الفيديو يمنع تشغيله داخل المشغلات المضمّنة. يمكنك فتحه مباشرة على يوتيوب أو تجربة مشغل GR / مشغل G.'
                  );
                } else if (data === 2 || data === 100) {
                  setErrorMessage('رابط يوتيوب غير صالح أو أن الفيديو لم يعد متاحاً.');
                } else {
                  setErrorMessage('تعذر تشغيل فيديو يوتيوب داخل المتصفح الحالي.');
                }
              },
            },
          });
          rawYtPlayer = player;
          enforceYoutubeIframeStyle();
          if (typeof player?.playVideo === 'function') {
            ytPlayerRef.current = player;
          }
        })
        .catch(() => {
          if (cancelled) return;
          window.clearTimeout(ytBootWatchdog);
          if (attemptAutomaticFailoverRef.current('صفحة يوتيوب غير متاحة')) {
            return;
          }
          hasFatalErrorRef.current = true;
          setIsLoading(false);
          setErrorMessage('تعذر تجهيز مشغل يوتيوب. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.');
        });

      return () => {
        cancelled = true;
        window.clearTimeout(ytBootWatchdog);
        if (progressTimer !== null) {
          window.clearInterval(progressTimer);
        }
        const activeInstance = ytPlayerRef.current || rawYtPlayer;
        if (activeInstance && typeof activeInstance.destroy === 'function') {
          try {
            activeInstance.destroy();
          } catch {
            // Ignore cleanup errors
          }
        }
        ytPlayerRef.current = null;
        if (ytHostRef.current) {
          ytHostRef.current.innerHTML = '';
        }
      };
    }

    const video = videoRef.current;
    if (!video) return;

    if (!isValidVideoUrl(selectedSourceUrl)) {
      hasFatalErrorRef.current = true;
      setIsLoading(false);
      setErrorMessage('رابط الفيديو غير صالح أو غير متوفر حالياً.');
      return;
    }

    setIsLoading(true);
    setHlsQualityOptions([]);
    setActiveHlsQualityId('auto');

    const hlsSource = isHlsSource(selectedSourceUrl);

    if (hlsSource) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          capLevelToPlayerSize: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1,
        });
        hlsRef.current = hls;

        let recoveredMediaOnce = false;

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          const levels = data.levels || [];
          const uniqueMap = new Map<string, QualityOption>();
          levels.forEach((lvl, idx) => {
            const label = lvl.height
              ? `${lvl.height}p`
              : `${Math.round((lvl.bitrate || 0) / 1000)} kbps`;
            if (!uniqueMap.has(label)) {
              uniqueMap.set(label, {
                id: `hls-${idx}`,
                label,
                hlsLevel: idx,
                status: 'ready',
                rank: lvl.height || getQualityRank(label),
              });
            }
          });

          const sortedLevels = sortQualityOptions<QualityOption>([
            { id: 'auto', label: 'تلقائي', hlsLevel: -1, status: 'ready', rank: 0 },
            ...Array.from(uniqueMap.values()),
          ]);

          setHlsQualityOptions(sortedLevels);

          const pref = preferredQualityRef.current;
          if (pref && pref.rank > 0) {
            const concreteLevels = sortedLevels.filter((o) => typeof o.hlsLevel === 'number' && o.hlsLevel >= 0);
            const exact = concreteLevels.find((o) => o.rank === pref.rank);
            const closest =
              exact ||
              [...concreteLevels].sort(
                (a, b) => Math.abs((a.rank || 0) - pref.rank) - Math.abs((b.rank || 0) - pref.rank)
              )[0];
            if (closest && typeof closest.hlsLevel === 'number') {
              hls.currentLevel = closest.hlsLevel;
              hls.nextLevel = closest.hlsLevel;
              setActiveHlsQualityId(closest.id);
              return;
            }
          }

          setActiveHlsQualityId('auto');
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const lvl = hls.levels[data.level];
          if (lvl?.height) {
            setDetectedResolution(`${lvl.height}p`);
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredMediaOnce) {
            recoveredMediaOnce = true;
            hls.recoverMediaError();
            return;
          }

          if (trySwitchCurrentStreamToProxyRef.current('تجاوز قيود البث التكيفي')) {
            hls.destroy();
            hlsRef.current = null;
            return;
          }

          if (attemptAutomaticFailoverRef.current('تعذر تحميل البث التكيفي')) {
            hls.destroy();
            hlsRef.current = null;
            return;
          }

          hasFatalErrorRef.current = true;
          hls.destroy();
          hlsRef.current = null;
          setIsLoading(false);
          setIsPlaying(false);

          if (!navigator.onLine || data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setErrorMessage('تعذر الاتصال بخادم البث. تحقق من الإنترنت أو صلاحية رابط HLS.');
          } else {
            setErrorMessage('تعذر تشغيل بث الفيديو (HLS) في المتصفح الحالي.');
          }
        });

        hls.loadSource(selectedSourceUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = selectedSourceUrl;
        video.load();
      } else {
        hasFatalErrorRef.current = true;
        setIsLoading(false);
        setErrorMessage('المتصفح الحالي لا يدعم تشغيل بث HLS (.m3u8).');
      }
    } else if (isDashStreamUrl(selectedSourceUrl)) {
      let cancelledDash = false;
      try {
        const dashPlayer = dashjs.MediaPlayer().create();
        dashRef.current = dashPlayer;
        dashPlayer.initialize(
          video,
          selectedSourceUrl,
          true
        );
        dashPlayer.on(dashjs.MediaPlayer.events?.ERROR || 'error', () => {
          if (cancelledDash) return;
          if (trySwitchCurrentStreamToProxyRef.current('تجاوز قيود بث DASH')) {
            return;
          }
          if (attemptAutomaticFailoverRef.current('تعذر تحميل بث DASH')) {
            return;
          }
          hasFatalErrorRef.current = true;
          setIsLoading(false);
          setIsPlaying(false);
          setErrorMessage('تعذر تشغيل بث DASH (.mpd) في المتصفح الحالي.');
        });
      } catch {
        video.src = selectedSourceUrl;
        video.load();
      }
      return () => {
        cancelledDash = true;
        if (dashRef.current) {
          try {
            dashRef.current.reset();
          } catch {
            // Ignore cleanup errors
          }
          dashRef.current = null;
        }
      };
    } else {
      video.src = selectedSourceUrl;
      video.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (dashRef.current) {
        try {
          dashRef.current.reset();
        } catch {
          // Ignore cleanup errors
        }
        dashRef.current = null;
      }
    };
  }, [
    selectedSourceUrl,
    activeEngineType,
    isWaitingForExtraction,
    isUniversalEmbedMode,
    isYouTubeSource,
    retryToken,
    persistProgress,
  ]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || hasFatalErrorRef.current) return;

    const now = video.currentTime;
    const total = video.duration || 0;
    setCurrentTime(now);
    setDuration(total);

    if (video.buffered.length > 0) {
      setBufferedTime(video.buffered.end(video.buffered.length - 1));
    }

    const wallNow = Date.now();
    if (wallNow - lastSavedTickRef.current >= 2000) {
      lastSavedTickRef.current = wallNow;
      persistProgress(now, total);
    }
  }, [persistProgress]);

  const togglePlay = useCallback(() => {
    if (hasFatalErrorRef.current) return;

    if (isYouTubeSource) {
      const yt = ytPlayerRef.current;
      if (!yt || typeof yt.playVideo !== 'function' || typeof yt.pauseVideo !== 'function') {
        resumeAutoplayRef.current = true;
        setIsLoading(true);
        revealControls();
        return;
      }
      if (isEnded) {
        if (typeof yt.seekTo === 'function') yt.seekTo(0, true);
        setIsEnded(false);
        yt.playVideo();
        isPlayingRef.current = true;
        setIsPlaying(true);
        revealControls();
        return;
      }
      const state = typeof yt.getPlayerState === 'function' ? yt.getPlayerState() : -1;
      if (state === 1) {
        yt.pauseVideo();
        isPlayingRef.current = false;
        setIsPlaying(false);
        const nowPos = typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() || currentTime : currentTime;
        const totDur = typeof yt.getDuration === 'function' ? yt.getDuration() || duration : duration;
        persistProgress(nowPos, totDur);
      } else {
        yt.playVideo();
        isPlayingRef.current = true;
        setIsPlaying(true);
      }
      revealControls();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (isEnded) {
      video.currentTime = 0;
      setIsEnded(false);
      isPlayingRef.current = true;
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      revealControls();
      return;
    }

    if (video.paused) {
      isPlayingRef.current = true;
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
      persistProgress(video.currentTime, video.duration || 0);
    }
    revealControls();
  }, [currentTime, duration, isEnded, isYouTubeSource, persistProgress, revealControls]);

  const handleSeek = useCallback(
    (newTime: number) => {
      if (hasFatalErrorRef.current) return;

      if (isYouTubeSource) {
        const yt = ytPlayerRef.current;
        if (!yt || typeof yt.seekTo !== 'function') {
          pendingSeekRef.current = Math.max(0, newTime);
          revealControls();
          return;
        }
        const maxDuration =
          (typeof yt.getDuration === 'function' ? yt.getDuration() : 0) || duration || 0;
        const clamped = Math.max(0, Math.min(newTime, maxDuration));
        yt.seekTo(clamped, true);
        setCurrentTime(clamped);
        if (isEnded && clamped < maxDuration - 0.5) setIsEnded(false);
        revealControls();
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      const maxDuration = video.duration || duration || 0;
      const clamped = Math.max(0, Math.min(newTime, maxDuration));
      video.currentTime = clamped;
      setCurrentTime(clamped);
      if (isEnded && clamped < maxDuration - 0.5) setIsEnded(false);
      revealControls();
    },
    [duration, isEnded, isYouTubeSource, revealControls]
  );

  const triggerSeekFeedback = useCallback((direction: 'forward' | 'backward') => {
    setSeekFeedback(direction);
    if (seekFeedbackTimerRef.current) {
      window.clearTimeout(seekFeedbackTimerRef.current);
    }
    seekFeedbackTimerRef.current = window.setTimeout(() => {
      setSeekFeedback(null);
    }, 520);
  }, []);

  const skipForward = useCallback(() => {
    const base = isYouTubeSource
      ? (typeof ytPlayerRef.current?.getCurrentTime === 'function'
          ? ytPlayerRef.current.getCurrentTime()
          : currentTime) ?? currentTime
      : videoRef.current
      ? videoRef.current.currentTime
      : currentTime;
    handleSeek(base + 10);
    triggerSeekFeedback('forward');
  }, [currentTime, handleSeek, isYouTubeSource, triggerSeekFeedback]);

  const skipBackward = useCallback(() => {
    const base = isYouTubeSource
      ? (typeof ytPlayerRef.current?.getCurrentTime === 'function'
          ? ytPlayerRef.current.getCurrentTime()
          : currentTime) ?? currentTime
      : videoRef.current
      ? videoRef.current.currentTime
      : currentTime;
    handleSeek(base - 10);
    triggerSeekFeedback('backward');
  }, [currentTime, handleSeek, isYouTubeSource, triggerSeekFeedback]);

  const handleVolumeChange = useCallback(
    (newVol: number) => {
      const clamped = Math.max(0, Math.min(1, newVol));
      if (isYouTubeSource) {
        const yt = ytPlayerRef.current;
        if (yt) {
          if (typeof yt.setVolume === 'function') yt.setVolume(Math.round(clamped * 100));
          if (clamped === 0 && typeof yt.mute === 'function') yt.mute();
          else if (clamped > 0 && typeof yt.unMute === 'function') yt.unMute();
        }
        setVolume(clamped);
        setIsMuted(clamped === 0);
        revealControls();
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.volume = clamped;
      video.muted = clamped === 0;
      setVolume(clamped);
      setIsMuted(clamped === 0);
      revealControls();
    },
    [isYouTubeSource, revealControls]
  );

  const toggleMute = useCallback(() => {
    if (isYouTubeSource) {
      const yt = ytPlayerRef.current;
      if (isMuted) {
        const restored = volume > 0.05 ? volume : 0.8;
        if (typeof yt?.unMute === 'function') yt.unMute();
        if (typeof yt?.setVolume === 'function') yt.setVolume(Math.round(restored * 100));
        setVolume(restored);
        setIsMuted(false);
      } else {
        if (typeof yt?.mute === 'function') yt.mute();
        setIsMuted(true);
      }
      revealControls();
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (isMuted || video.muted) {
      const restored = volume > 0.05 ? volume : 0.8;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
    revealControls();
  }, [isMuted, isYouTubeSource, revealControls, volume]);

  // Dedicated Screen Orientation (Landscape Rotation Toggle)
  const toggleLandscapeOrientation = useCallback(() => {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
      unlock?: () => void;
    };
    const container = containerRef.current;

    if (!isLandscapeMode) {
      const isPortrait =
        typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
      if (isPortrait) {
        setIsLandscapeMode(true);
        if (!document.fullscreenElement && container?.requestFullscreen) {
          container
            .requestFullscreen()
            .then(() => {
              setIsFullscreen(true);
              if (orientation?.lock) {
                orientation
                  .lock('landscape')
                  .then(() => setIsLandscapeMode(false))
                  .catch(() => {});
              }
            })
            .catch(() => {});
        } else if (document.fullscreenElement && orientation?.lock) {
          orientation
            .lock('landscape')
            .then(() => setIsLandscapeMode(false))
            .catch(() => {});
        }
      } else if (!document.fullscreenElement && container?.requestFullscreen) {
        container
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {});
      }
    } else {
      setIsLandscapeMode(false);
      if (orientation?.unlock) {
        try {
          orientation.unlock();
        } catch {
          // Ignore unlock failure
        }
      }
    }
    revealControls();
  }, [isLandscapeMode, revealControls]);

  // Dedicated Fullscreen Toggle with Automatic Landscape Lock Attempt
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    }) | null;

    const fsElement =
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;

    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
    };

    if (!fsElement) {
      if (container?.requestFullscreen) {
        container
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            if (orientation?.lock) {
              orientation
                .lock('landscape')
                .then(() => setIsLandscapeMode(false))
                .catch(() => {});
            }
          })
          .catch(() => {
            if (!isYouTubeSource && video?.webkitEnterFullscreen) {
              video.webkitEnterFullscreen();
            }
          });
      } else if (!isYouTubeSource && video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
      }
    } else {
      setIsLandscapeMode(false);
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
    revealControls();
  }, [isYouTubeSource, revealControls]);

  const showHudToast = useCallback((msg: string) => {
    setHudToast(msg);
    if (hudToastTimerRef.current) {
      window.clearTimeout(hudToastTimerRef.current);
    }
    hudToastTimerRef.current = window.setTimeout(() => {
      setHudToast(null);
    }, 2400);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnterPip = () => setIsPipActive(true);
    const onLeavePip = () => setIsPipActive(false);
    video.addEventListener('enterpictureinpicture', onEnterPip);
    video.addEventListener('leavepictureinpicture', onLeavePip);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPip);
      video.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, [selectedSourceUrl]);

  const togglePictureInPicture = useCallback(async () => {
    revealControls();
    if (isUniversalEmbedMode || isYouTubeSource) {
      toggleFullscreen();
      showHudToast('وضع ملء الشاشة نشط لهذا المصدر');
      return;
    }
    const video = videoRef.current as (HTMLVideoElement & {
      webkitSetPresentationMode?: (mode: string) => void;
      webkitPresentationMode?: string;
    }) | null;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
        setIsPipActive(true);
      } else if (typeof video.webkitSetPresentationMode === 'function') {
        const nextMode = video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
        video.webkitSetPresentationMode(nextMode);
        setIsPipActive(nextMode === 'picture-in-picture');
      } else {
        toggleFullscreen();
      }
    } catch {
      showHudToast('وضع نافذة ضمن نافذة غير متاح في هذا المتصفح');
    }
  }, [isUniversalEmbedMode, isYouTubeSource, revealControls, showHudToast, toggleFullscreen]);

  const handleShareMedia = useCallback(async () => {
    revealControls();
    const shareTitle = `${media.titleAr || media.title} — MASHHAD`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: shareTitle,
          text: media.description || shareTitle,
          url: shareUrl,
        });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showHudToast('تم نسخ رابط المشاهدة');
      }
    } catch {
      // User dismissed share sheet
    }
  }, [media.description, media.title, media.titleAr, revealControls, showHudToast]);

  const changeSpeed = useCallback(
    (speed: number) => {
      if (isYouTubeSource) {
        ytPlayerRef.current?.setPlaybackRate?.(speed);
      } else if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      setPlaybackSpeed(speed);
      revealControls();
    },
    [isYouTubeSource, revealControls]
  );

  const changeQuality = useCallback(
    (option: QualityOption) => {
      if (option.status === 'processing') return;

      manualQualityChosenRef.current = true;
      const numericRank =
        option.id === 'auto'
          ? 0
          : typeof option.rank === 'number' && option.rank > 0
          ? option.rank
          : getQualityNumericRank(option.label);
      const nextPref: PreferredQualityPref = {
        id: option.id,
        label: option.label,
        rank: numericRank,
      };
      setPreferredQualityPref(nextPref);
      savePreferredQuality(nextPref);

      if (isYouTubeSource) {
        const yt = ytPlayerRef.current;
        const targetYtCode = option.ytCode || qualityRankToYouTubeCode(option.id);
        setActiveYtQualityId(option.id);
        if (option.id === 'auto') {
          setDetectedResolution(null);
          if (yt) {
            yt.setPlaybackQualityRange?.('tiny', 'highres');
            yt.setPlaybackQuality?.('auto');
          }
        } else {
          setDetectedResolution(option.label);
          if (yt) {
            yt.setPlaybackQualityRange?.(targetYtCode, targetYtCode);
            yt.setPlaybackQuality?.(targetYtCode);
            const videoId = extractYouTubeVideoId(selectedSourceUrl);
            const curTime = yt.getCurrentTime?.() || currentTime || 0;
            if (videoId) {
              if (isPlayingRef.current && typeof yt.loadVideoById === 'function') {
                yt.loadVideoById({
                  videoId,
                  startSeconds: curTime,
                  suggestedQuality: targetYtCode,
                });
              } else if (!isPlayingRef.current && typeof yt.cueVideoById === 'function') {
                yt.cueVideoById({
                  videoId,
                  startSeconds: curTime,
                  suggestedQuality: targetYtCode,
                });
              }
            }
          }
        }
        setActivePanel(null);
        revealControls();
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      if (typeof option.hlsLevel === 'number' && hlsRef.current) {
        hlsRef.current.currentLevel = option.hlsLevel;
        hlsRef.current.nextLevel = option.hlsLevel;
        setActiveHlsQualityId(option.id);
        if (option.id === 'auto') {
          setDetectedResolution(null);
        } else {
          setDetectedResolution(option.label);
        }
        setActivePanel(null);
        revealControls();
        return;
      }

      if (option.url && option.url !== selectedSourceUrl) {
        pendingSeekRef.current = video.currentTime;
        resumeAutoplayRef.current = !video.paused;
        setDetectedResolution(option.label);
        setSelectedSourceUrl(option.url);
      }

      setActivePanel(null);
      revealControls();
    },
    [currentTime, isYouTubeSource, revealControls, selectedSourceUrl]
  );

  const switchServer = useCallback(
    (srv: OrderedServerItem) => {
      const video = videoRef.current;
      const activeTime = isYouTubeSource
        ? ytPlayerRef.current?.getCurrentTime?.() || currentTime || 0
        : video?.currentTime || currentTime || 0;
      hasFatalErrorRef.current = false;
      setErrorMessage(null);
      setYtEmbedBlocked(false);
      setActiveServerId(srv.id);
      if (srv.url !== selectedSourceUrl || srv.engineType !== activeEngineType) {
        pendingSeekRef.current = activeTime > 0 ? activeTime : null;
        resumeAutoplayRef.current = true;
        setSelectedSourceUrl(srv.url);
      }
      setActivePanel(null);
      revealControls();
    },
    [activeEngineType, currentTime, isYouTubeSource, revealControls, selectedSourceUrl]
  );

  const handleSelectEpisode = useCallback(
    (index: number) => {
      if (index < 0 || index >= episodesList.length) return;
      setActiveEpisodeIndex(index);
      setActivePanel(null);
      setIsEnded(false);
      resumeAutoplayRef.current = true;
    },
    [episodesList.length]
  );

  const handleRetry = useCallback(() => {
    failedServerIdsRef.current.clear();
    proxyTriedUrlsRef.current.clear();
    if (activeNormalizedSource) {
      setExtractedByUrl((prev) => {
        const next = { ...prev };
        delete next[activeNormalizedSource];
        return next;
      });
    }
    hasFatalErrorRef.current = false;
    setErrorMessage(null);
    setFailoverNotice(null);
    setYtEmbedBlocked(false);
    setIsOffline(!navigator.onLine);
    setIsLoading(true);
    setRetryToken((prev) => prev + 1);
  }, [activeNormalizedSource]);

  const handleClosePlayer = useCallback(() => {
    if (isYouTubeSource && ytPlayerRef.current) {
      const now = ytPlayerRef.current.getCurrentTime?.() || 0;
      const total = ytPlayerRef.current.getDuration?.() || 0;
      persistProgress(now, total);
      try {
        ytPlayerRef.current.stopVideo?.();
      } catch {
        // Ignore stop cleanup errors
      }
    } else {
      const video = videoRef.current;
      if (video) {
        persistProgress(video.currentTime, video.duration || 0);
        video.pause();
      }
    }

    if (screen.orientation && 'unlock' in screen.orientation) {
      try {
        screen.orientation.unlock();
      } catch {
        // Ignore unlock errors
      }
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [isYouTubeSource, onClose, persistProgress]);

  const resumeSavedProgress = useCallback(() => {
    if (resumePrompt === null) return;
    if (isYouTubeSource) {
      const yt = ytPlayerRef.current;
      if (!yt || typeof yt.playVideo !== 'function') {
        pendingSeekRef.current = resumePrompt;
        resumeAutoplayRef.current = true;
        setCurrentTime(resumePrompt);
        setResumePrompt(null);
        revealControls();
        return;
      }
      if (typeof yt.seekTo === 'function') yt.seekTo(resumePrompt, true);
      setCurrentTime(resumePrompt);
      setResumePrompt(null);
      yt.playVideo();
      setIsPlaying(true);
      revealControls();
      return;
    }

    const video = videoRef.current;
    if (video) {
      video.currentTime = resumePrompt;
      setCurrentTime(resumePrompt);
      setResumePrompt(null);
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      revealControls();
    }
  }, [isYouTubeSource, resumePrompt, revealControls]);

  const handleSubtitleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const cues = parseSubtitleText(text);
      if (cues.length === 0) {
        setSubtitleError('تعذر قراءة الترجمة. تأكد من أن الملف بصيغة SRT أو VTT صالحة.');
        return;
      }
      setSubtitleCues(cues);
      setSubtitleFileName(file.name);
      setSubtitleError(null);
      setSubtitlesEnabled(true);
    } catch {
      setSubtitleError('حدث خطأ أثناء قراءة ملف الترجمة.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range'))
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (e.code === 'Space' || key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' || key === 'l') {
        e.preventDefault();
        skipForward();
      } else if (e.key === 'ArrowLeft' || key === 'j') {
        e.preventDefault();
        skipBackward();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange((isMuted ? 0 : volume) + 0.1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange((isMuted ? 0 : volume) - 0.1);
      } else if (key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (key === 'c') {
        e.preventDefault();
        setSubtitlesEnabled((prev) => !prev);
        revealControls();
      } else if (e.key === 'Escape') {
        const fsEl =
          document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
        if (activePanel) {
          e.preventDefault();
          setActivePanel(null);
        } else if (isLandscapeMode) {
          e.preventDefault();
          setIsLandscapeMode(false);
        } else if (!fsEl) {
          e.preventDefault();
          handleClosePlayer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePanel,
    handleClosePlayer,
    handleVolumeChange,
    isLandscapeMode,
    isMuted,
    revealControls,
    skipBackward,
    skipForward,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    volume,
  ]);

  // Viewport pointer down/up gesture handler (respects 90° landscape rotation & pause lock)
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePanel || errorMessage || isEnded) {
      revealedOnPointerDownRef.current = false;
      return;
    }

    if (!isPlayingRef.current) {
      revealedOnPointerDownRef.current = true;
      revealControls();
      return;
    }

    if (!showControlsRef.current) {
      revealedOnPointerDownRef.current = true;
      revealControls();
      return;
    }

    revealedOnPointerDownRef.current = false;
    if (e.pointerType !== 'touch') {
      scheduleControlsHide();
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePanel) {
      setActivePanel(null);
      revealControls();
      return;
    }

    if (errorMessage || isEnded) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = isLandscapeMode
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;
    const side: 'left' | 'right' | 'center' =
      relX < 0.35 ? 'left' : relX > 0.65 ? 'right' : 'center';

    if (e.pointerType === 'touch') {
      const now = Date.now();
      const isDoubleTap =
        now - lastTapRef.current.time < 280 &&
        lastTapRef.current.side === side &&
        side !== 'center';

      if (isDoubleTap) {
        if (tapTimerRef.current) {
          window.clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        lastTapRef.current = { time: 0, side: 'center' };
        if (side === 'right') skipForward();
        else skipBackward();
        return;
      }

      lastTapRef.current = { time: now, side };
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
      }

      if (!isPlayingRef.current) {
        revealControls();
        return;
      }

      if (revealedOnPointerDownRef.current) {
        revealedOnPointerDownRef.current = false;
        revealControls();
        return;
      }

      tapTimerRef.current = window.setTimeout(() => {
        if (!isPlayingRef.current) {
          revealControls();
          return;
        }
        clearControlsTimer();
        showControlsRef.current = false;
        setShowControls(false);
      }, 240);
    } else {
      if (e.detail === 2) {
        if (tapTimerRef.current) {
          window.clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        toggleFullscreen();
        revealControls();
        return;
      }

      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
      }
      tapTimerRef.current = window.setTimeout(() => {
        tapTimerRef.current = null;
        togglePlay();
      }, 210);
    }
  };

  // Intro & subtitles computed values
  const introStart = activeEpisode?.introStart ?? media.introStart;
  const introEnd = activeEpisode?.introEnd ?? media.introEnd;
  const canSkipIntro =
    typeof introStart === 'number' &&
    typeof introEnd === 'number' &&
    introEnd > introStart &&
    currentTime >= introStart &&
    currentTime < introEnd;

  const activeSubtitleText = useMemo(() => {
    if (!subtitlesEnabled || subtitleCues.length === 0) return '';
    return getActiveSubtitleText(subtitleCues, currentTime);
  }, [subtitlesEnabled, subtitleCues, currentTime]);

  const subtitleSizeClass =
    SUBTITLE_SIZES.find((s) => s.id === subtitleSize)?.className || 'text-sm sm:text-lg';

  const effectiveQualityOptions = useMemo<QualityOption[]>(() => {
    if (isYouTubeSource) {
      return sortQualityOptions(
        ytQualityOptions.length > 0 ? ytQualityOptions : YOUTUBE_PRESET_QUALITIES
      );
    }

    if (isHlsSource(selectedSourceUrl)) {
      if (hlsQualityOptions.length > 0) return sortQualityOptions(hlsQualityOptions);
      return [{ id: 'auto', label: 'تلقائي', hlsLevel: -1, status: 'ready', rank: 0 }];
    }

    if (
      resolvedActiveServer?.engineType === 'direct-mp4' &&
      serverStreamData?.exists &&
      serverStreamData.qualities.length > 0 &&
      (serverStreamData.qualities.length > 1 || availableCustomSources.length <= 1)
    ) {
      return sortQualityOptions(
        serverStreamData.qualities.map((q) => ({
          id: q.id,
          label: formatQualityLabel(q.label),
          url: q.url,
          status: q.status,
          rank: q.height || getQualityRank(q.label),
        }))
      );
    }

    if (availableCustomSources.length > 1) {
      return sortQualityOptions(
        availableCustomSources.map((src, index) => ({
          id: `src-${index}`,
          label: formatQualityLabel(src.label),
          url: src.url,
          status: 'ready' as const,
          rank: getQualityRank(src.label),
        }))
      );
    }

    return [
      {
        id: 'source',
        label:
          detectedResolution ||
          (media.videoQuality ? formatQualityLabel(media.videoQuality) : 'الأصلية'),
        url: selectedSourceUrl,
        status: 'ready',
        rank: getQualityRank(detectedResolution || media.videoQuality),
      },
    ];
  }, [
    availableCustomSources,
    detectedResolution,
    hlsQualityOptions,
    isYouTubeSource,
    media.videoQuality,
    resolvedActiveServer?.engineType,
    selectedSourceUrl,
    serverStreamData,
    ytQualityOptions,
  ]);

  const activeQualityId = useMemo(() => {
    if (isYouTubeSource) return activeYtQualityId;
    if (isHlsSource(selectedSourceUrl)) return activeHlsQualityId;
    const matched = effectiveQualityOptions.find((q) => q.url && q.url === selectedSourceUrl);
    return matched?.id || effectiveQualityOptions[0]?.id || 'source';
  }, [activeHlsQualityId, activeYtQualityId, effectiveQualityOptions, isYouTubeSource, selectedSourceUrl]);

  const activeQualityLabel = useMemo(() => {
    const matched = effectiveQualityOptions.find((q) => q.id === activeQualityId);
    if (matched) {
      if (matched.id === 'auto') {
        return detectedResolution || 'تلقائي';
      }
      return matched.label;
    }
    const raw = detectedResolution || media.videoQuality;
    return raw ? formatQualityLabel(raw) : 'تلقائي';
  }, [activeQualityId, detectedResolution, effectiveQualityOptions, media.videoQuality]);

  const showNextEpisodePrompt =
    Boolean(nextEpisode) && !isEnded && !errorMessage && duration > 60 && duration - currentTime <= 25;

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedTime / duration) * 100) : 0;

  // Timeline scrub pointer ratio helper supporting both normal & 90° rotated landscape coordinates
  const getTimelineRatio = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      const raw = isLandscapeMode
        ? (clientY - rect.top) / rect.height
        : (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, raw));
    },
    [isLandscapeMode]
  );

  const activeStageWidth =
    stageSize.width > 0
      ? stageSize.width
      : isLandscapeMode
      ? viewportSize.height
      : viewportSize.width;
  const activeStageHeight =
    stageSize.height > 0
      ? stageSize.height
      : isLandscapeMode
      ? viewportSize.width
      : viewportSize.height;
  const ytTargetAspect = 16 / 9;
  let ytFittedWidth = activeStageWidth;
  let ytFittedHeight = activeStageWidth / ytTargetAspect;
  if (ytFittedHeight > activeStageHeight) {
    ytFittedHeight = activeStageHeight;
    ytFittedWidth = activeStageHeight * ytTargetAspect;
  }

  const activeFormatBadge = useMemo(() => {
    if (isYouTubeSource) return 'YouTube';
    if (isUniversalEmbedMode) return 'Embed';
    if (isHlsSource(selectedSourceUrl)) return 'HLS';
    if (isDashStreamUrl(selectedSourceUrl)) return 'DASH';
    if (resolvedActiveServer?.format === 'webm') return 'WebM';
    return 'MP4';
  }, [isUniversalEmbedMode, isYouTubeSource, resolvedActiveServer?.format, selectedSourceUrl]);

  const playerHeaderSubtitle = useMemo(() => {
    if (activeEpisode) {
      return `الموسم ${activeEpisode.seasonNumber}، الحلقة ${activeEpisode.episodeNumber}`;
    }
    if (media.title && media.title !== (media.titleAr || media.title)) {
      return media.title;
    }
    return `${media.year}${media.duration ? ` · ${media.duration}` : ''}`;
  }, [activeEpisode, media.duration, media.title, media.titleAr, media.year]);

  const seasonTabs = useMemo(() => {
    const unique = new Set<number>();
    episodesList.forEach((ep) => unique.add(ep.seasonNumber));
    const arr = Array.from(unique).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [1];
  }, [episodesList]);

  const filteredSeasonEpisodes = useMemo(() => {
    return episodesList.filter((ep) => ep.seasonNumber === selectedSeasonTab);
  }, [episodesList, selectedSeasonTab]);

  return (
    <div
      ref={containerRef}
      dir="rtl"
      style={
        isLandscapeMode
          ? {
              position: 'fixed',
              top: '50%',
              left: '50%',
              width: `${viewportSize.height}px`,
              height: `${viewportSize.width}px`,
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center center',
            }
          : {
              position: 'fixed',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '100%',
              transform: 'translate(-50%, -50%) rotate(0deg)',
              transformOrigin: 'center center',
            }
      }
      className={`z-50 bg-black overflow-hidden select-none font-sans transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        !showControls && isPlaying && !errorMessage && !isEnded ? 'cursor-none' : ''
      }`}
      onPointerMove={(e) => {
        if (e.pointerType !== 'touch') {
          revealControls();
        }
      }}
    >
      {/* Hidden subtitle file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        onChange={handleSubtitleFileUpload}
        className="hidden"
      />

      {/* 1. Minimal Sleek Top Bar: [<] Centered Title + Season/Episode [Cast/FS] [⋮] */}
      <AnimatePresence>
        {activePanel !== 'episodes' &&
          (showControls || isUniversalEmbedMode || errorMessage || isEnded) && (
            <motion.header
              dir="ltr"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onPointerDown={(e) => {
                e.stopPropagation();
                revealControls();
              }}
              onPointerUp={(e) => e.stopPropagation()}
              className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-3.5 sm:px-7 pt-3.5 sm:pt-5 pb-8 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none"
            >
              {/* Top-Left: Clean Minimal Back Chevron */}
              <div className="flex items-center gap-1 pointer-events-auto shrink-0 min-w-[68px]">
                <button
                  type="button"
                  onClick={handleClosePlayer}
                  aria-label="إغلاق المشغل"
                  className="w-10 h-10 rounded-full text-white/95 hover:text-white hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[2]" />
                </button>
              </div>

              {/* Top-Center: 2-Line Centered Title Stack */}
              <div className="min-w-0 flex-1 text-center px-2">
                <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                  {media.titleAr || media.title}
                </h2>
                <p className="text-[11px] sm:text-xs font-medium text-white/65 leading-tight mt-0.5 truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                  {playerHeaderSubtitle}
                </p>
              </div>

              {/* Top-Right: Cast/Screen Icon + Settings (⋮) */}
              <div className="flex items-center justify-end gap-0.5 pointer-events-auto shrink-0 min-w-[68px]">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                  title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                    isFullscreen
                      ? 'text-white bg-white/15'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Airplay className="w-[19px] h-[19px] stroke-[1.9]" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePanel((prev) =>
                      prev && prev.startsWith('settings') ? null : 'settings'
                    )
                  }
                  aria-label="الإعدادات"
                  title="الإعدادات"
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                    activePanel?.startsWith('settings')
                      ? 'text-white bg-white/15'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <MoreVertical className="w-[19px] h-[19px] stroke-[2]" />
                </button>
              </div>
            </motion.header>
          )}
      </AnimatePresence>

      {/* 2. Centered Video Stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 w-full h-full flex items-center justify-center bg-black overflow-hidden"
        onPointerDown={handleViewportPointerDown}
        onPointerUp={handleViewportPointerUp}
      >
        {isUniversalEmbedMode && universalEmbedUrl ? (
          <div
            className="relative w-full h-full bg-black pt-14"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <iframe
              key={`${resolvedActiveServer?.id || 'embed'}::${universalEmbedUrl}::${retryToken}`}
              src={universalEmbedUrl}
              title={media.titleAr || media.title}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media *; clipboard-write"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setIsLoading(false)}
              className="w-full h-full border-0 bg-black"
            />
          </div>
        ) : isYouTubeSource ? (
          <div
            className="relative shrink-0 bg-black overflow-hidden"
            style={{
              width: `${Math.max(1, Math.round(ytFittedWidth))}px`,
              height: `${Math.max(1, Math.round(ytFittedHeight))}px`,
            }}
          >
            <div
              ref={ytHostRef}
              className="absolute inset-x-0 pointer-events-none"
              style={{
                top: '-68px',
                bottom: '-68px',
              }}
            />

            {!ytHasStartedPlaying && !errorMessage && (
              <div className="absolute inset-0 z-10 bg-black pointer-events-none flex items-center justify-center">
                {(activeEpisode?.thumbnailUrl || media.bannerUrl || media.posterUrl) && (
                  <img
                    src={activeEpisode?.thumbnailUrl || media.bannerUrl || media.posterUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-contain opacity-85"
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <video
            ref={videoRef}
            controlsList="nodownload"
            className="w-full h-full max-w-full max-h-full object-contain block"
            playsInline
            preload="auto"
            poster={activeEpisode?.thumbnailUrl || media.bannerUrl || media.posterUrl}
            onLoadStart={() => {
              if (!hasFatalErrorRef.current) setIsLoading(true);
            }}
            onLoadedMetadata={() => {
              const video = videoRef.current;
              if (!video || hasFatalErrorRef.current) return;

              setDuration(video.duration || 0);
              if (video.videoHeight) {
                setDetectedResolution(`${video.videoHeight}p`);
              }

              if (pendingSeekRef.current !== null) {
                video.currentTime = pendingSeekRef.current;
                pendingSeekRef.current = null;
              }

              if (resumeAutoplayRef.current || video.currentTime === 0) {
                resumeAutoplayRef.current = false;
                video.play().then(() => setIsPlaying(true)).catch(() => {});
              }
            }}
            onCanPlay={() => setIsLoading(false)}
            onLoadedData={() => setIsLoading(false)}
            onWaiting={() => {
              if (!hasFatalErrorRef.current) setIsLoading(true);
            }}
            onPlaying={() => {
              setIsLoading(false);
              setIsPlaying(true);
              setIsEnded(false);
            }}
            onPlay={() => {
              setIsPlaying(true);
              setIsEnded(false);
            }}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              const video = videoRef.current;
              setIsPlaying(false);
              setIsLoading(false);
              if (!hasFatalErrorRef.current) {
                setIsEnded(true);
                if (video) {
                  persistProgress(video.duration || currentTime, video.duration || duration);
                }
              }
            }}
            onError={() => {
              if (hasFatalErrorRef.current || isWaitingForExtraction) return;
              if (trySwitchCurrentStreamToProxyRef.current('تجاوز حماية السيرفر')) {
                return;
              }
              if (attemptAutomaticFailoverRef.current('تعذر تشغيل السيرفر الحالي')) {
                return;
              }
              hasFatalErrorRef.current = true;
              setIsLoading(false);
              setIsPlaying(false);

              const code = videoRef.current?.error?.code;
              if (!navigator.onLine) {
                setErrorMessage('انقطع الاتصال بالإنترنت. تحقق من الشبكة ثم اضغط إعادة المحاولة.');
              } else if (code === 2) {
                setErrorMessage('تعذر تحميل البث بسبب خطأ في الشبكة.');
              } else if (code === 3) {
                setErrorMessage('تعذر فك ترميز الفيديو. قد يكون الملف غير مدعوم.');
              } else if (code === 4) {
                setErrorMessage('رابط الفيديو غير صالح أو غير مدعوم في هذا المتصفح.');
              } else {
                setErrorMessage('تعذر تشغيل الفيديو أو أنه لم يعد متوفراً.');
              }
            }}
          />
        )}

        {/* Subtitles Overlay */}
        {activeSubtitleText && !errorMessage && !isEnded && (
          <div
            className={`absolute inset-x-4 z-20 pointer-events-none flex justify-center transition-all duration-200 ${
              showControls ? 'bottom-32 sm:bottom-36' : 'bottom-6 sm:bottom-10'
            }`}
          >
            <div
              className={`max-w-3xl px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-black/70 backdrop-blur-md text-center font-bold whitespace-pre-line leading-relaxed ${subtitleSizeClass}`}
              style={{ color: subtitleColor, textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
            >
              {activeSubtitleText}
            </div>
          </div>
        )}

        {/* Double-Tap Seek Feedback */}
        <AnimatePresence>
          {seekFeedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.16 }}
              className={`absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center rounded-full w-20 h-20 bg-black/55 backdrop-blur-md text-white ${
                seekFeedback === 'forward' ? 'right-8 sm:right-16' : 'left-8 sm:left-16'
              }`}
            >
              {seekFeedback === 'forward' ? (
                <RotateCw className="w-7 h-7" />
              ) : (
                <RotateCcw className="w-7 h-7" />
              )}
              <span className="text-xs font-bold tabular-nums mt-1">
                {seekFeedback === 'forward' ? '+10s' : '-10s'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal Loading Indicator */}
        {isLoading && !errorMessage && !isEnded && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/35 pointer-events-none">
            <div className="w-11 h-11 sm:w-12 sm:h-12 border-[3px] border-white/25 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Subtle HUD Toast */}
        <AnimatePresence>
          {hudToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-16 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
            >
              <div className="px-4 py-1.5 rounded-full bg-[#18181b]/95 border border-white/15 text-xs font-semibold text-white shadow-xl">
                {hudToast}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resume Prompt Banner when returning mid-way */}
        <AnimatePresence>
          {resumePrompt !== null && !errorMessage && !isEnded && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={resumeSavedProgress}
              className="absolute bottom-28 sm:bottom-32 left-4 sm:left-7 z-30 min-h-[36px] px-3.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold flex items-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>متابعة من {formatClockTime(resumePrompt)}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Skip Intro Button */}
        <AnimatePresence>
          {canSkipIntro && !errorMessage && !isEnded && (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => handleSeek(introEnd as number)}
              className="absolute bottom-28 sm:bottom-32 right-4 sm:right-7 z-30 min-h-[36px] px-4 rounded-full bg-[#18181b]/90 hover:bg-white text-white hover:text-black border border-white/20 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>تخطي المقدمة</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Automatic Failover Notice */}
        <AnimatePresence>
          {failoverNotice && !errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-16 inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
            >
              <div className="px-3.5 py-1.5 rounded-full bg-[#18181b]/90 border border-white/15 text-white text-xs font-semibold flex items-center gap-2">
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span>{failoverNotice}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal Center Transport Controls: (↺10)  ▶ / ||  (↻10) */}
        <AnimatePresence>
          {!isUniversalEmbedMode &&
            !activePanel &&
            (showControls || !isPlaying) &&
            !errorMessage &&
            !isEnded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                dir="ltr"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  revealControls();
                }}
                onPointerUp={(e) => e.stopPropagation()}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-8 sm:gap-14"
              >
                <button
                  type="button"
                  onClick={skipBackward}
                  aria-label="تأخير 10 ثوانٍ"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white/90 hover:text-white hover:bg-white/10 flex items-center justify-center relative active:scale-90 transition-all cursor-pointer drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
                >
                  <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.75]" />
                  <span className="absolute text-[9.5px] sm:text-[10.5px] font-bold tabular-nums mt-0.5">
                    10
                  </span>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
                    isYouTubeSource && !isPlaying
                      ? 'bg-black/65 backdrop-blur-md shadow-2xl'
                      : 'hover:bg-white/10 drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10 sm:w-12 sm:h-12 fill-white text-white" />
                  ) : (
                    <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-white text-white ml-1" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={skipForward}
                  aria-label="تقديم 10 ثوانٍ"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white/90 hover:text-white hover:bg-white/10 flex items-center justify-center relative active:scale-90 transition-all cursor-pointer drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
                >
                  <RotateCw className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.75]" />
                  <span className="absolute text-[9.5px] sm:text-[10.5px] font-bold tabular-nums mt-0.5">
                    10
                  </span>
                </button>
              </motion.div>
            )}
        </AnimatePresence>

        {/* Offline Banner */}
        {isOffline && !errorMessage && (
          <div className="absolute top-16 right-4 z-30 px-3 py-1.5 rounded-full bg-red-950/90 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2 backdrop-blur-md">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>انقطع الاتصال بالإنترنت</span>
          </div>
        )}

        {/* Error Screen */}
        {errorMessage && (
          <div
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute inset-0 z-40 bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-md w-full bg-[#161618]/95 border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-4">
                {isOffline ? <WifiOff className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-white font-bold text-base sm:text-lg mb-2">
                {isOffline ? 'لا يوجد اتصال بالإنترنت' : 'تعذر تشغيل الفيديو'}
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mb-5 leading-relaxed">
                {errorMessage}
              </p>

              {orderedServers.length > 1 && (
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {orderedServers
                    .filter((s) => s.id !== resolvedActiveServer?.id)
                    .map((altSrv) => (
                      <button
                        key={altSrv.id}
                        type="button"
                        onClick={() => switchServer(altSrv)}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>تشغيل عبر {altSrv.shortLabel}</span>
                      </button>
                    ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                {ytEmbedBlocked && getYouTubeCanonicalUrl(selectedSourceUrl) && (
                  <a
                    href={getYouTubeCanonicalUrl(selectedSourceUrl) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[44px] px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>فتح في يوتيوب</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex-1 min-h-[44px] px-4 bg-white hover:bg-zinc-200 text-black font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </button>
                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="flex-1 min-h-[44px] px-4 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End of Playback Screen */}
        {isEnded && !errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex items-center justify-center p-5"
          >
            <div className="max-w-md w-full bg-[#161618]/95 border border-white/10 rounded-3xl p-6 text-center shadow-2xl space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto">
                <Film className="w-6 h-6" />
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-300 mb-1">
                  {nextEpisode ? 'انتهت الحلقة' : 'انتهى العرض'}
                </p>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {media.titleAr || media.title}
                </h3>
                {activeEpisode && (
                  <p className="text-xs text-zinc-400 mt-1">
                    الموسم {activeEpisode.seasonNumber} · الحلقة {activeEpisode.episodeNumber}:{' '}
                    {activeEpisode.title}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                {nextEpisode && (
                  <button
                    type="button"
                    onClick={() => handleSelectEpisode(activeEpisodeIndex + 1)}
                    className="flex-1 min-h-[44px] px-4 bg-white hover:bg-zinc-200 text-black font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>الحلقة التالية</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isYouTubeSource) {
                      const yt = ytPlayerRef.current;
                      setIsEnded(false);
                      if (!yt || typeof yt.playVideo !== 'function') {
                        pendingSeekRef.current = 0;
                        resumeAutoplayRef.current = true;
                        return;
                      }
                      if (typeof yt.seekTo === 'function') yt.seekTo(0, true);
                      yt.playVideo();
                      setIsPlaying(true);
                      return;
                    }
                    const video = videoRef.current;
                    if (!video) return;
                    setIsEnded(false);
                    video.currentTime = 0;
                    video.play().then(() => setIsPlaying(true)).catch(() => {});
                  }}
                  className={`flex-1 min-h-[44px] px-4 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                    nextEpisode
                      ? 'bg-white/10 hover:bg-white/15 text-white'
                      : 'bg-white hover:bg-zinc-200 text-black'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة المشاهدة</span>
                </button>

                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="min-h-[44px] px-4 bg-white/10 hover:bg-white/15 text-zinc-200 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 3. Centered Settings & Audio/Subtitles Floating Card Modal (Matches Phone 3 in Reference) */}
      <AnimatePresence>
        {activePanel &&
          activePanel !== 'episodes' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                revealControls();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget) {
                  setActivePanel(null);
                }
              }}
              className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
            >
              <motion.div
                dir="rtl"
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[340px] bg-[#161618]/96 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden text-white"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.08]">
                  {activePanel.startsWith('settings_') ? (
                    <button
                      type="button"
                      onClick={() => setActivePanel('settings')}
                      aria-label="رجوع"
                      className="w-7 h-7 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="w-7" />
                  )}

                  <span className="text-sm font-bold text-white">
                    {activePanel === 'settings'
                      ? 'الإعدادات'
                      : activePanel === 'settings_quality'
                      ? 'الجودة'
                      : activePanel === 'settings_speed'
                      ? 'سرعة التشغيل'
                      : activePanel === 'settings_servers'
                      ? `السيرفرات (${activeFormatBadge})`
                      : activePanel === 'settings_info'
                      ? 'تفاصيل العمل'
                      : 'الصوت والترجمة'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setActivePanel(null)}
                    aria-label="إغلاق"
                    className="w-7 h-7 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Settings Menu (Matches Reference Card Rows) */}
                {activePanel === 'settings' && (
                  <div className="divide-y divide-white/[0.06] py-1">
                    <button
                      type="button"
                      onClick={() => setActivePanel('settings_quality')}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3">
                        <SlidersHorizontal className="w-[18px] h-[18px] text-zinc-300 shrink-0" />
                        <span className="text-[13px] font-medium text-white">الجودة</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <span>{activeQualityLabel}</span>
                        <ChevronLeft className="w-4 h-4 text-zinc-500" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePanel('settings_speed')}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3">
                        <FastForward className="w-[18px] h-[18px] text-zinc-300 shrink-0" />
                        <span className="text-[13px] font-medium text-white">السرعة</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <span>{playbackSpeed === 1 ? 'عادي' : `${playbackSpeed}x`}</span>
                        <ChevronLeft className="w-4 h-4 text-zinc-500" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePanel('settings_servers')}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3">
                        <Server className="w-[18px] h-[18px] text-zinc-300 shrink-0" />
                        <span className="text-[13px] font-medium text-white">السيرفرات</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 max-w-[140px]">
                        <span className="truncate">
                          {resolvedActiveServer?.shortLabel || activeFormatBadge}
                        </span>
                        <ChevronLeft className="w-4 h-4 text-zinc-500 shrink-0" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={toggleLandscapeOrientation}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3">
                        <RotateCw className="w-[18px] h-[18px] text-zinc-300 shrink-0" />
                        <span className="text-[13px] font-medium text-white">تدوير الشاشة</span>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {isLandscapeMode ? 'أفقي' : 'تلقائي'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={togglePictureInPicture}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3">
                        <PictureInPicture2 className="w-[18px] h-[18px] text-zinc-300 shrink-0" />
                        <span className="text-[13px] font-medium text-white">نافذة عائمة (PiP)</span>
                      </div>
                      <span className="text-xs text-zinc-400">{isPipActive ? 'مفعلة' : 'إيقاف'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePanel('settings_info')}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3">
                        <Info className="w-[18px] h-[18px] text-zinc-300 shrink-0" />
                        <span className="text-[13px] font-medium text-white">معلومات العرض</span>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-zinc-500" />
                    </button>
                  </div>
                )}

                {/* Quality Sub-View */}
                {activePanel === 'settings_quality' && (
                  <div className="p-3 space-y-1.5 max-h-[50vh] overflow-y-auto no-scrollbar">
                    {effectiveQualityOptions.map((opt) => {
                      const isProcessingOpt = opt.status === 'processing';
                      const isActiveOpt = activeQualityId === opt.id && !isProcessingOpt;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isProcessingOpt}
                          onClick={() => {
                            changeQuality(opt);
                            setActivePanel(null);
                          }}
                          className={`w-full min-h-[42px] px-3.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                            isProcessingOpt
                              ? 'text-zinc-500 bg-white/5 cursor-wait'
                              : isActiveOpt
                              ? 'bg-white text-black cursor-pointer'
                              : 'bg-white/[0.05] text-zinc-200 hover:bg-white/10 cursor-pointer'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {isProcessingOpt && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{opt.id === 'auto' ? 'تلقائي' : opt.label}</span>
                          </span>
                          {isActiveOpt && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Speed Sub-View */}
                {activePanel === 'settings_speed' && (
                  <div className="p-3 space-y-1.5 max-h-[50vh] overflow-y-auto no-scrollbar">
                    {SPEED_OPTIONS.map((speed) => {
                      const isActiveSpeed = playbackSpeed === speed;
                      return (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => {
                            changeSpeed(speed);
                            setActivePanel(null);
                          }}
                          className={`w-full min-h-[42px] px-3.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            isActiveSpeed
                              ? 'bg-white text-black'
                              : 'bg-white/[0.05] text-zinc-200 hover:bg-white/10'
                          }`}
                        >
                          <span className="tabular-nums">
                            {speed === 1 ? 'عادي (1x)' : `${speed}x`}
                          </span>
                          {isActiveSpeed && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Servers Sub-View */}
                {activePanel === 'settings_servers' && (
                  <div className="p-3 space-y-1.5 max-h-[50vh] overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-white/[0.04] rounded-xl px-3 py-2 mb-1">
                      <span>
                        الصيغة: <strong className="text-white">{activeFormatBadge}</strong>
                      </span>
                      <span>
                        الدقة: <strong className="text-white">{activeQualityLabel}</strong>
                      </span>
                    </div>
                    {orderedServers.map((srv) => {
                      const isActiveSrv = resolvedActiveServer?.id === srv.id;
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => {
                            switchServer(srv);
                            setActivePanel(null);
                          }}
                          className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-right text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isActiveSrv
                              ? 'bg-white text-black'
                              : 'bg-white/[0.05] text-zinc-200 hover:bg-white/10'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold truncate">{srv.shortLabel}</p>
                            <p
                              className={`text-[10px] truncate ${
                                isActiveSrv ? 'text-black/70' : 'text-zinc-400'
                              }`}
                            >
                              {srv.label}
                            </p>
                          </div>
                          {isActiveSrv && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Info Sub-View */}
                {activePanel === 'settings_info' && (
                  <div className="p-4 space-y-3 text-xs max-h-[55vh] overflow-y-auto no-scrollbar">
                    <div className="flex items-start gap-3">
                      {(media.posterUrl || media.bannerUrl) && (
                        <img
                          src={media.posterUrl || media.bannerUrl}
                          alt={media.titleAr || media.title}
                          referrerPolicy="no-referrer"
                          className="w-14 h-20 rounded-xl object-cover shrink-0 border border-white/10"
                        />
                      )}
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-bold text-sm text-white truncate">
                          {media.titleAr || media.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                          <span>{media.year}</span>
                          {media.duration && (
                            <>
                              <span>·</span>
                              <span>{media.duration}</span>
                            </>
                          )}
                          {media.rating > 0 && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5 text-amber-300">
                                <Star className="w-3 h-3 fill-current" />
                                {media.rating.toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>
                        {media.genres?.length > 0 && (
                          <p className="text-[11px] text-zinc-400 truncate">
                            {media.genres.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {media.description && (
                      <p className="text-zinc-300 leading-relaxed">{media.description}</p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        handleShareMedia();
                        setActivePanel(null);
                      }}
                      className="w-full min-h-[40px] rounded-xl bg-white/[0.08] hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>مشاركة رابط المشاهدة</span>
                    </button>
                  </div>
                )}

                {/* Audio, Volume & Subtitles Modal */}
                {activePanel === 'audio_subtitles' && (
                  <div className="p-4 space-y-3.5 max-h-[58vh] overflow-y-auto no-scrollbar">
                    {/* Volume Slider */}
                    {!isUniversalEmbedMode && (
                      <div className="space-y-1.5 pb-3 border-b border-white/[0.07]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300 font-medium">مستوى الصوت</span>
                          <button
                            type="button"
                            onClick={toggleMute}
                            className="inline-flex items-center gap-1 text-zinc-300 hover:text-white cursor-pointer"
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX className="w-3.5 h-3.5" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                            <span className="tabular-nums font-mono">
                              {Math.round((isMuted ? 0 : volume) * 100)}%
                            </span>
                          </button>
                        </div>
                        <input
                          type="range"
                          dir="ltr"
                          aria-label="مستوى الصوت"
                          min={0}
                          max={1}
                          step={0.02}
                          value={isMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-full accent-white cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Quick Server / Audio Switcher */}
                    {orderedServers.length > 1 && (
                      <div className="space-y-1.5 pb-3 border-b border-white/[0.07]">
                        <span className="text-[11px] text-zinc-400 block">المسار / السيرفر</span>
                        <div className="flex flex-wrap gap-1.5">
                          {orderedServers.map((srv) => {
                            const active = resolvedActiveServer?.id === srv.id;
                            return (
                              <button
                                key={srv.id}
                                type="button"
                                onClick={() => switchServer(srv)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-white text-black'
                                    : 'bg-white/[0.08] text-zinc-200 hover:bg-white/15'
                                }`}
                              >
                                {srv.shortLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Subtitles Toggle & Upload */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-200">عرض الترجمة</span>
                      <button
                        type="button"
                        onClick={() => setSubtitlesEnabled((prev) => !prev)}
                        className={`px-3.5 min-h-[30px] rounded-full text-xs font-bold transition-colors cursor-pointer ${
                          subtitlesEnabled
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-zinc-300'
                        }`}
                      >
                        {subtitlesEnabled ? 'مفعلة' : 'متوقفة'}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full min-h-[38px] px-3 rounded-xl bg-white/[0.08] hover:bg-white/15 border border-dashed border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>اختيار ملف ترجمة (SRT / VTT)</span>
                    </button>

                    {subtitleFileName && (
                      <div className="flex items-center justify-between gap-2 bg-white/5 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-white truncate">
                            {subtitleFileName}
                          </p>
                          <p className="text-[10px] text-zinc-400 tabular-nums">
                            {subtitleCues.length} سطر
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSubtitleCues([]);
                            setSubtitleFileName(null);
                            setSubtitleError(null);
                          }}
                          aria-label="إزالة ملف الترجمة"
                          className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {subtitleError && <p className="text-[11px] text-red-400">{subtitleError}</p>}

                    <div className="space-y-1.5">
                      <span className="text-[11px] text-zinc-400 block">حجم الخط</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SUBTITLE_SIZES.map((sz) => (
                          <button
                            key={sz.id}
                            type="button"
                            onClick={() => setSubtitleSize(sz.id)}
                            className={`min-h-[32px] rounded-lg text-xs font-semibold cursor-pointer ${
                              subtitleSize === sz.id
                                ? 'bg-white text-black'
                                : 'bg-white/[0.08] text-zinc-200 hover:bg-white/15'
                            }`}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] text-zinc-400 block">لون الخط</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SUBTITLE_COLORS.map((col) => (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => setSubtitleColor(col.value)}
                            className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                              subtitleColor === col.value
                                ? 'bg-white/20 border border-white text-white'
                                : 'bg-white/[0.08] text-zinc-300 hover:bg-white/15'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: col.value }}
                            />
                            <span>{col.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* 4. Full-Screen Dark "المواسم والحلقات" View (Matches Phone 2 in Reference) */}
      <AnimatePresence>
        {activePanel === 'episodes' && episodesList.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute inset-0 z-40 bg-[#0d0d0f]/96 backdrop-blur-2xl flex flex-col text-white"
          >
            {/* Header */}
            <div
              dir="ltr"
              className="flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6 pb-3"
            >
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label="رجوع"
                className="w-10 h-10 rounded-full hover:bg-white/10 text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <h3 className="text-sm sm:text-base font-bold text-white">المواسم والحلقات</h3>

              <span className="w-10" />
            </div>

            {/* Season Pills */}
            <div
              dir="rtl"
              className="flex items-center gap-2 px-5 sm:px-10 py-2 overflow-x-auto no-scrollbar"
            >
              {seasonTabs.map((seasonNum) => {
                const isSelected = selectedSeasonTab === seasonNum;
                return (
                  <button
                    key={seasonNum}
                    type="button"
                    onClick={() => setSelectedSeasonTab(seasonNum)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black'
                        : 'bg-white/[0.08] text-zinc-300 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    الموسم {seasonNum}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Episodes Rows */}
            <div
              dir="rtl"
              className="flex-1 overflow-y-auto no-scrollbar px-5 sm:px-10 py-3 space-y-3"
            >
              {filteredSeasonEpisodes.map((ep) => {
                const globalIndex = episodesList.findIndex((item) => item.id === ep.id);
                const isActive = globalIndex === activeEpisodeIndex;
                const thumb =
                  ep.thumbnailUrl || media.bannerUrl || media.posterUrl || '';

                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      if (globalIndex >= 0) {
                        handleSelectEpisode(globalIndex);
                      }
                      setActivePanel(null);
                    }}
                    className={`w-full rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-3.5 text-right transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white/[0.12] border border-white/20'
                        : 'hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-32 sm:w-44 aspect-video rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                        {thumb && (
                          <img
                            src={thumb}
                            alt={ep.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                        {isActive && (
                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                            <Play className="w-6 h-6 fill-white text-white" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <p className="text-xs sm:text-sm font-bold text-white truncate">
                          {ep.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          • الحلقة {ep.episodeNumber}
                          {ep.duration ? ` · ${ep.duration}` : ''}
                        </p>
                        {ep.description && (
                          <p className="hidden sm:block text-[11px] text-zinc-500 line-clamp-1">
                            {ep.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 pl-2 text-zinc-400">
                      {isActive ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Minimal Bottom Dock: Timestamps + Thin White Line & Dot + Action Links */}
      <AnimatePresence>
        {!isUniversalEmbedMode &&
          activePanel !== 'episodes' &&
          (showControls || errorMessage) &&
          !isEnded && (
            <motion.footer
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onPointerDown={(e) => {
                e.stopPropagation();
                revealControls();
              }}
              onPointerUp={(e) => e.stopPropagation()}
              dir="ltr"
              className="absolute bottom-0 inset-x-0 z-30 px-4 sm:px-7 pt-12 pb-3.5 sm:pb-5 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
            >
              {/* Time Readouts Above Scrubber Ends */}
              <div className="flex items-center justify-between text-[11px] font-medium text-white/85 tabular-nums mb-1">
                <span>{formatClockTime(currentTime)}</span>
                <span>{formatClockTime(duration)}</span>
              </div>

              {/* Scrubber Bar with Floating Thumbnail Preview Card (Matches Phone 4 in Reference) */}
              <div
                className="relative group w-full h-6 flex items-center touch-none cursor-pointer"
                onMouseEnter={() => {
                  setIsProgressHovered(true);
                  revealControls();
                }}
                onMouseMove={(e) => {
                  setIsProgressHovered(true);
                  if (!duration) return;
                  const ratio = getTimelineRatio(
                    e.clientX,
                    e.clientY,
                    e.currentTarget.getBoundingClientRect()
                  );
                  setHoverSeek({ time: ratio * duration, percent: ratio * 100 });
                }}
                onMouseLeave={() => {
                  setIsProgressHovered(false);
                  setHoverSeek(null);
                  scheduleControlsHide();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (!duration) return;
                  setIsScrubbing(true);
                  revealControls();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  const ratio = getTimelineRatio(
                    e.clientX,
                    e.clientY,
                    e.currentTarget.getBoundingClientRect()
                  );
                  setHoverSeek({ time: ratio * duration, percent: ratio * 100 });
                  handleSeek(ratio * duration);
                }}
                onPointerMove={(e) => {
                  if (!isScrubbing || !duration) return;
                  const ratio = getTimelineRatio(
                    e.clientX,
                    e.clientY,
                    e.currentTarget.getBoundingClientRect()
                  );
                  setHoverSeek({ time: ratio * duration, percent: ratio * 100 });
                  handleSeek(ratio * duration);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  setIsScrubbing(false);
                  setHoverSeek(null);
                  revealControls();
                }}
              >
                {/* Floating Scrub Thumbnail Preview Card */}
                {hoverSeek && (
                  <div
                    className="absolute bottom-8 -translate-x-1/2 pointer-events-none z-40 flex flex-col items-center"
                    style={{
                      left: `${Math.min(88, Math.max(12, hoverSeek.percent))}%`,
                    }}
                  >
                    <div className="relative w-32 sm:w-40 aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/25 shadow-[0_12px_32px_rgba(0,0,0,0.85)]">
                      {(activeEpisode?.thumbnailUrl || media.bannerUrl || media.posterUrl) && (
                        <img
                          src={activeEpisode?.thumbnailUrl || media.bannerUrl || media.posterUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1 text-center">
                        <span className="text-[11px] font-bold text-white tabular-nums font-mono">
                          {formatClockTime(hoverSeek.time)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ultra-thin Track + Crisp White Progress + Glowing White Thumb Dot */}
                <div
                  className={`relative w-full bg-white/25 rounded-full pointer-events-none transition-all duration-150 ${
                    isProgressHovered || isScrubbing ? 'h-[4px]' : 'h-[2.5px]'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
                    style={{ width: `${bufferedPercent}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-white rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)] transition-transform ${
                      isProgressHovered || isScrubbing ? 'w-3.5 h-3.5 scale-110' : 'w-2.5 h-2.5'
                    }`}
                    style={{ left: `${progressPercent}%` }}
                  />
                </div>

                <input
                  type="range"
                  aria-label="شريط التقديم"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="sr-only"
                />
              </div>

              {/* Bottom Action Row Matching Reference Screenshot */}
              <div className="flex items-center justify-between gap-3 mt-1.5">
                <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() =>
                      setActivePanel((prev) =>
                        prev === 'audio_subtitles' ? null : 'audio_subtitles'
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white whitespace-nowrap py-1 cursor-pointer transition-colors"
                  >
                    <AudioLines className="w-4 h-4 shrink-0" />
                    <span>الصوت والترجمة</span>
                  </button>

                  {episodesList.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeEpisode?.seasonNumber) {
                          setSelectedSeasonTab(activeEpisode.seasonNumber);
                        }
                        setActivePanel((prev) => (prev === 'episodes' ? null : 'episodes'));
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white whitespace-nowrap py-1 cursor-pointer transition-colors"
                    >
                      <ListVideo className="w-4 h-4 shrink-0" />
                      <span>المواسم والحلقات</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActivePanel('settings_servers')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white whitespace-nowrap py-1 cursor-pointer transition-colors"
                    >
                      <Server className="w-4 h-4 shrink-0" />
                      <span>السيرفرات ({activeFormatBadge})</span>
                    </button>
                  )}
                </div>

                {nextEpisode ? (
                  <button
                    type="button"
                    onClick={() => handleSelectEpisode(activeEpisodeIndex + 1)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white whitespace-nowrap py-1 cursor-pointer transition-colors shrink-0"
                  >
                    <SkipForward className="w-4 h-4 shrink-0" />
                    <span>الحلقة التالية</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActivePanel('settings_info')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white whitespace-nowrap py-1 cursor-pointer transition-colors shrink-0"
                  >
                    <Info className="w-4 h-4 shrink-0" />
                    <span>تفاصيل العمل</span>
                  </button>
                )}
              </div>
            </motion.footer>
          )}
      </AnimatePresence>
    </div>
  );
};
