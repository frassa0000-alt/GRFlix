import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Captions,
  Check,
  Clock,
  ExternalLink,
  FastForward,
  Film,
  Gauge,
  ListVideo,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Server,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { Episode, MediaItem, PlayerSettingsConfig, VideoSourceOption } from '../../types';
import { PlayerCinemaIntro } from './PlayerCinemaIntro';
import { fetchVideoStreams, VideoStreamsResponse } from '../../services/api';
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
  convertToUniversalEmbedUrl,
  getPipedMirrorEmbedUrl,
  isHlsStreamUrl,
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
  format: 'mp4' | 'hls' | 'webm' | 'youtube' | 'embed';
  qualityLabel: string;
  qualityRank: number;
  isDefault: boolean;
  engineType:
    | 'direct-mp4'
    | 'hls-adaptive'
    | 'youtube-embed'
    | 'youtube-nocookie'
    | 'universal-embed'
    | 'custom-source';
}

type ActivePanel = 'quality' | 'settings' | 'episodes' | 'servers' | null;
type SettingsTab = 'speed' | 'subtitles' | 'servers';

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

  const baseVideoUrl = activeEpisode?.videoUrl || media.videoUrl;
  const playbackSessionKey = `${media.id}::${activeEpisode?.id || 'movie'}`;
  const availableCustomSources = useMemo(
    () => activeEpisode?.sources || media.sources || [],
    [activeEpisode?.sources, media.sources]
  );

  // Pre-roll cinema intro state (plays once per movie/episode launch; never replays on pause/resume/quality switch)
  const [isPreRollIntroActive, setIsPreRollIntroActive] = useState<boolean>(true);
  const isPreRollIntroActiveRef = useRef<boolean>(true);

  // Playback & stream state
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string>(baseVideoUrl);
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('speed');
  const [resumePrompt, setResumePrompt] = useState<number | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<'forward' | 'backward' | null>(null);
  const [hoverSeek, setHoverSeek] = useState<{ time: number; percent: number } | null>(null);
  const [isProgressHovered, setIsProgressHovered] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

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

  const orderedServers = useMemo<OrderedServerItem[]>(() => {
    const rawList: Array<Omit<OrderedServerItem, 'orderNumber'>> = [];
    const seenKeys = new Set<string>();
    const normalizeUrlKey = (u: string) => u.trim().split('?')[0];

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
      const isYt = src.format === 'youtube' || isYouTubeUrl(src.url);
      if (isYt && !ytPrimaryUrl) {
        ytPrimaryUrl = src.url;
      }
      const key = `${isYt ? 'yt' : 'direct'}::${normalizeUrlKey(src.url)}`;
      if (!normalizeUrlKey(src.url) || seenKeys.has(key)) return;
      seenKeys.add(key);

      const embedUrl = !isYt ? convertToUniversalEmbedUrl(src.url) : null;
      const isHls = !isYt && !embedUrl && (src.format === 'hls' || isHlsSource(src.url));

      if (isYt) {
        rawList.push({
          id: src.id || `server-youtube-${idx}`,
          shortLabel: 'YouTube',
          label: src.label ? formatQualityLabel(src.label) : 'مشغل يوتيوب القياسي',
          url: src.url,
          format: 'youtube',
          qualityLabel: src.label ? formatQualityLabel(src.label) : '1080p',
          qualityRank: getQualityRank(src.label),
          isDefault: Boolean(src.isDefault) && rawList.length === 0,
          engineType: 'youtube-embed',
        });
        return;
      }

      const rawLabel = (src.label || '').trim();
      const explicitGr = /\bgr\b/i.test(rawLabel) || src.id === 'server-gr';
      const explicitG = !explicitGr && (/\bg\b/i.test(rawLabel) || src.id === 'server-g');

      let assignedShort = rawLabel ? formatQualityLabel(rawLabel) : '';
      let assignedId = src.id || `custom-${idx}`;

      if (explicitGr || (!hasGrServer && !explicitG)) {
        hasGrServer = true;
        assignedShort = explicitGr ? rawLabel : 'مشغل GR';
        assignedId = hasGrServer && !rawList.some((x) => x.id === 'server-gr') ? 'server-gr' : assignedId;
      } else if (explicitG || !hasGServer) {
        hasGServer = true;
        assignedShort = explicitG ? rawLabel : 'مشغل G';
        assignedId = hasGServer && !rawList.some((x) => x.id === 'server-g') ? 'server-g' : assignedId;
      }

      rawList.push({
        id: assignedId,
        shortLabel: assignedShort || 'مشغل GR',
        label: rawLabel
          ? `${assignedShort} • ${formatQualityLabel(rawLabel)}`
          : `${assignedShort} • سيرفر الموقع`,
        url: embedUrl || src.url,
        format: embedUrl ? 'embed' : isHls ? 'hls' : src.format === 'webm' ? 'webm' : 'mp4',
        qualityLabel: src.quality || (src.label ? formatQualityLabel(src.label) : 'HD'),
        qualityRank: getQualityRank(src.quality || src.label),
        isDefault: Boolean(src.isDefault) && rawList.length === 0,
        engineType: embedUrl ? 'universal-embed' : isHls ? 'hls-adaptive' : 'direct-mp4',
      });
    });

    const baseKey = normalizeUrlKey(baseVideoUrl || '');
    if (baseKey) {
      const baseIsYt = isYouTubeUrl(baseVideoUrl);
      const baseCheckKey = `${baseIsYt ? 'yt' : 'direct'}::${baseKey}`;
      if (!seenKeys.has(baseCheckKey) && !seenKeys.has(baseKey)) {
        seenKeys.add(baseCheckKey);
        const embedUrl = !baseIsYt ? convertToUniversalEmbedUrl(baseVideoUrl) : null;
        const isHls = !baseIsYt && !embedUrl && isHlsSource(baseVideoUrl);

        if (baseIsYt) {
          ytPrimaryUrl = ytPrimaryUrl || baseVideoUrl;
          rawList.unshift({
            id: 'server-youtube',
            shortLabel: 'YouTube',
            label: 'مشغل يوتيوب القياسي (YouTube)',
            url: baseVideoUrl,
            format: 'youtube',
            qualityLabel: media.videoQuality ? formatQualityLabel(media.videoQuality) : '1080p',
            qualityRank: getQualityRank(media.videoQuality),
            isDefault: !hasGrServer,
            engineType: 'youtube-embed',
          });
        } else {
          const srvId = !hasGrServer ? 'server-gr' : !hasGServer ? 'server-g' : 'server-primary';
          const shortLbl = !hasGrServer ? 'مشغل GR' : !hasGServer ? 'مشغل G' : 'الرئيسي';
          if (!hasGrServer) hasGrServer = true;
          else if (!hasGServer) hasGServer = true;
          rawList.unshift({
            id: srvId,
            shortLabel: shortLbl,
            label: `${shortLbl} • ${
              embedUrl ? 'المشغل المدمج المستقل' : isHls ? 'البث التكيفي HLS' : 'سيرفر الموقع المباشر'
            }`,
            url: embedUrl || baseVideoUrl,
            format: embedUrl ? 'embed' : isHls ? 'hls' : 'mp4',
            qualityLabel: media.videoQuality ? formatQualityLabel(media.videoQuality) : 'الأصلية',
            qualityRank: getQualityRank(media.videoQuality),
            isDefault: true,
            engineType: embedUrl ? 'universal-embed' : isHls ? 'hls-adaptive' : 'direct-mp4',
          });
        }
      }
    }

    // Ensure GoldenFlix non-YouTube / mirror players GR and G are ALWAYS available as ready fallback/switch servers
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

    // Prioritize explicit non-YouTube GR/G first if a native stream exists, otherwise keep default YouTube + GR + G
    return rawList.map((item, idx) => ({
      ...item,
      orderNumber: idx + 1,
    }));
  }, [availableCustomSources, baseVideoUrl, media.videoQuality, resolvedServerAlts, serverStreamData]);

  const resolvedActiveServer = useMemo(() => {
    const byId = orderedServers.find((s) => s.id === activeServerId);
    if (byId) return byId;
    const byUrl = orderedServers.find((s) => s.url === selectedSourceUrl);
    return byUrl || orderedServers[0] || null;
  }, [activeServerId, orderedServers, selectedSourceUrl]);

  const activeEngineType = resolvedActiveServer?.engineType;
  const universalEmbedUrl = useMemo(() => {
    if (activeEngineType === 'universal-embed') {
      return convertToUniversalEmbedUrl(selectedSourceUrl) || selectedSourceUrl;
    }
    if (!isYouTubeUrl(selectedSourceUrl) && !isHlsSource(selectedSourceUrl)) {
      return convertToUniversalEmbedUrl(selectedSourceUrl);
    }
    return null;
  }, [activeEngineType, selectedSourceUrl]);

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
    manualQualityChosenRef.current = false;
    failedServerIdsRef.current.clear();
    setFailoverNotice(null);
    setSelectedSourceUrl(baseVideoUrl);
    setActiveServerId(
      extractLocalVideoFilename(baseVideoUrl)
        ? 'server-gr'
        : isYouTubeUrl(baseVideoUrl)
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
    resumeAutoplayRef.current = false;
  }, [baseVideoUrl]);

  // Activate pre-roll cinema intro whenever a different movie or episode session begins
  useEffect(() => {
    isPreRollIntroActiveRef.current = true;
    setIsPreRollIntroActive(true);
  }, [playbackSessionKey]);

  // Immediately dismiss pre-roll intro if stream encounters a fatal loading error
  useEffect(() => {
    if (errorMessage && isPreRollIntroActiveRef.current) {
      isPreRollIntroActiveRef.current = false;
      setIsPreRollIntroActive(false);
    }
  }, [errorMessage]);

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

  // Initialize playback engine (YouTube IFrame API / YouTube-NoCookie / Universal Embed / HLS.js / Native MP4)
  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
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
              : isPreRollIntroActiveRef.current
              ? 0
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
              autoplay: isPreRollIntroActiveRef.current ? 0 : 1,
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

                if (!isPreRollIntroActiveRef.current || resumeAutoplayRef.current) {
                  resumeAutoplayRef.current = false;
                  if (typeof target.playVideo === 'function') {
                    target.playVideo();
                  }
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
    } else {
      video.src = selectedSourceUrl;
      video.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedSourceUrl, activeEngineType, isUniversalEmbedMode, isYouTubeSource, retryToken, persistProgress]);

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

  const handlePreRollComplete = useCallback(() => {
    if (!isPreRollIntroActiveRef.current) return;
    isPreRollIntroActiveRef.current = false;
    setIsPreRollIntroActive(false);
    setIsEnded(false);

    if (hasFatalErrorRef.current) return;

    if (isUniversalEmbedMode) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      setIsLoading(false);
      revealControls();
      return;
    }

    if (isYouTubeSource) {
      const yt = ytPlayerRef.current;
      setCurrentTime(0);
      resumeAutoplayRef.current = true;
      if (yt && typeof yt.playVideo === 'function') {
        try {
          if (typeof yt.seekTo === 'function') yt.seekTo(0, true);
          yt.playVideo();
          isPlayingRef.current = true;
          setIsPlaying(true);
        } catch {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      }
      revealControls();
      return;
    }

    const video = videoRef.current;
    if (video) {
      try {
        if (video.readyState >= 1) {
          video.currentTime = 0;
        }
        setCurrentTime(0);
        video.playbackRate = playbackSpeed;
        video.muted = isMuted;
        video.volume = volume;
        pendingSeekRef.current = null;
        resumeAutoplayRef.current = false;

        const playPromise = video.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              isPlayingRef.current = true;
              setIsPlaying(true);
              setIsLoading(false);
              revealControls();
            })
            .catch(() => {
              isPlayingRef.current = false;
              setIsPlaying(false);
              setIsLoading(false);
              revealControls();
            });
        }
      } catch {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setIsLoading(false);
        revealControls();
      }
    }
  }, [isMuted, isUniversalEmbedMode, isYouTubeSource, playbackSpeed, revealControls, volume]);

  const handleRetry = useCallback(() => {
    failedServerIdsRef.current.clear();
    hasFatalErrorRef.current = false;
    setErrorMessage(null);
    setFailoverNotice(null);
    setYtEmbedBlocked(false);
    setIsOffline(!navigator.onLine);
    setIsLoading(true);
    setRetryToken((prev) => prev + 1);
  }, []);

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

      if (isPreRollIntroActiveRef.current) {
        if (key === 'f') {
          e.preventDefault();
          toggleFullscreen();
        } else if (e.key === 'Escape') {
          const fsEl =
            document.fullscreenElement ||
            (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
          if (isLandscapeMode) {
            e.preventDefault();
            setIsLandscapeMode(false);
          } else if (!fsEl) {
            e.preventDefault();
            handleClosePlayer();
          }
        }
        return;
      }

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
    if (isPreRollIntroActiveRef.current) return;
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
    if (isPreRollIntroActiveRef.current) return;
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

      {/* 1. Minimal Top Bar */}
      <AnimatePresence>
        {!isPreRollIntroActive && (showControls || isUniversalEmbedMode || errorMessage || isEnded) && (
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onPointerDown={(e) => {
              e.stopPropagation();
              revealControls();
            }}
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-3 sm:px-6 pt-3 pb-8 bg-gradient-to-b from-black/85 via-black/45 to-transparent pointer-events-none"
          >
            {/* Right slot (RTL start): Back + Clean Unboxed Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1 pointer-events-auto">
              <button
                type="button"
                onClick={handleClosePlayer}
                aria-label="العودة"
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    dir="ltr"
                    className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-black/55 border border-[#F7C600]/35 text-[10px] font-black tracking-wide shrink-0"
                  >
                    <span className="text-[#F7C600]">Golden</span>
                    <span className="text-white">Flix</span>
                  </span>
                  <h2 className="text-white font-bold text-sm sm:text-base truncate leading-snug">
                    {media.titleAr || media.title}
                  </h2>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-300/80 truncate leading-tight">
                  {activeEpisode
                    ? `الموسم ${activeEpisode.seasonNumber} · الحلقة ${activeEpisode.episodeNumber}${
                        activeEpisode.title ? ` — ${activeEpisode.title}` : ''
                      }`
                    : `${media.year}${media.duration ? ` · ${media.duration}` : ''}`}
                </p>
              </div>
            </div>

            {/* Left slot (RTL end): Minimal Utility Buttons + Clean Popovers */}
            <div className="flex items-center gap-2 shrink-0 relative pointer-events-auto">
              {episodesList.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setActivePanel((prev) => (prev === 'episodes' ? null : 'episodes'))
                  }
                  aria-label="الحلقات"
                  className={`h-10 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                    activePanel === 'episodes'
                      ? 'bg-[#F7C600] text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <ListVideo className="w-4 h-4" />
                  <span className="hidden sm:inline">الحلقات</span>
                </button>
              )}

              {orderedServers.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setActivePanel((prev) => (prev === 'servers' ? null : 'servers'))
                  }
                  aria-label="تبديل المشغل"
                  className={`h-10 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                    activePanel === 'servers'
                      ? 'bg-[#F7C600] text-black'
                      : 'bg-white/10 hover:bg-white/20 text-[#F7C600]'
                  }`}
                >
                  <Server className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">
                    {resolvedActiveServer?.shortLabel || 'مشغل GR'}
                  </span>
                </button>
              )}

              {!isUniversalEmbedMode && (
                <button
                  type="button"
                  onClick={() =>
                    setActivePanel((prev) => (prev === 'quality' ? null : 'quality'))
                  }
                  aria-label="الجودة"
                  className={`h-10 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                    activePanel === 'quality'
                      ? 'bg-[#F7C600] text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="tabular-nums">{activeQualityLabel}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setActivePanel((prev) => (prev === 'settings' ? null : 'settings'))
                }
                aria-label="إعدادات المشغل"
                className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                  activePanel === 'settings'
                    ? 'bg-[#F7C600] text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Settings className="w-4.5 h-4.5" />
              </button>

              {/* Popover Panels */}
              <AnimatePresence>
                {activePanel === 'servers' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="absolute top-full left-0 mt-2.5 w-72 max-w-[calc(100vw-2rem)] bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 shadow-2xl z-50"
                  >
                    <p className="text-[11px] font-bold text-zinc-400 px-3 py-1.5">
                      سيرفرات ومشغلات العرض
                    </p>
                    <div
                      className={`space-y-1 overflow-y-auto ${
                        isLandscapeMode ? 'max-h-[calc(100vw-8.5rem)]' : 'max-h-64'
                      }`}
                    >
                      {orderedServers.map((srv) => {
                        const isActiveSrv = resolvedActiveServer?.id === srv.id;
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => switchServer(srv)}
                            className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-right text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isActiveSrv
                                ? 'bg-[#F7C600] text-black'
                                : 'text-zinc-200 hover:bg-white/10'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-bold truncate">{srv.shortLabel}</p>
                              <p
                                className={`text-[10px] truncate ${
                                  isActiveSrv ? 'text-black/75' : 'text-zinc-400'
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
                  </motion.div>
                )}

                {activePanel === 'quality' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="absolute top-full left-0 mt-2.5 w-56 max-w-[calc(100vw-2rem)] bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl z-50"
                  >
                    <p className="text-[11px] font-bold text-zinc-400 px-3 py-1.5">
                      جودة الفيديو
                    </p>
                    <div
                      className={`space-y-1 overflow-y-auto ${
                        isLandscapeMode ? 'max-h-[calc(100vw-8.5rem)]' : 'max-h-60'
                      }`}
                    >
                      {effectiveQualityOptions.map((opt) => {
                        const isProcessingOpt = opt.status === 'processing';
                        const isActiveOpt = activeQualityId === opt.id && !isProcessingOpt;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isProcessingOpt}
                            onClick={() => changeQuality(opt)}
                            className={`w-full min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                              isProcessingOpt
                                ? 'text-zinc-500 cursor-wait'
                                : isActiveOpt
                                ? 'bg-[#F7C600] text-black cursor-pointer'
                                : 'text-zinc-200 hover:bg-white/10 cursor-pointer'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isProcessingOpt && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F7C600]" />
                              )}
                              <span>
                                {opt.id === 'auto' && detectedResolution
                                  ? `تلقائي (${detectedResolution})`
                                  : isProcessingOpt
                                  ? `${opt.label} (جارٍ التجهيز)`
                                  : opt.label}
                              </span>
                            </span>
                            {isActiveOpt && <Check className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {activePanel === 'settings' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className={`absolute top-full left-0 mt-2.5 w-72 sm:w-80 max-w-[calc(100vw-2rem)] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl z-50 space-y-3 ${
                      isLandscapeMode ? 'max-h-[calc(100vw-5.5rem)]' : 'max-h-[65dvh]'
                    }`}
                  >
                    {/* Segmented Settings Tabs */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('speed')}
                        className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          settingsTab === 'speed'
                            ? 'bg-[#F7C600] text-black'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        <Gauge className="w-3.5 h-3.5" />
                        <span>السرعة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSettingsTab('subtitles')}
                        className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          settingsTab === 'subtitles'
                            ? 'bg-[#F7C600] text-black'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        <Captions className="w-3.5 h-3.5" />
                        <span>الترجمة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSettingsTab('servers')}
                        className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          settingsTab === 'servers'
                            ? 'bg-[#F7C600] text-black'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>السيرفرات</span>
                      </button>
                    </div>

                    {settingsTab === 'speed' && (
                      <div className="space-y-1">
                        {SPEED_OPTIONS.map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => changeSpeed(speed)}
                            className={`w-full min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                              playbackSpeed === speed
                                ? 'bg-[#F7C600] text-black'
                                : 'text-zinc-200 hover:bg-white/10'
                            }`}
                          >
                            <span className="tabular-nums">
                              {speed === 1 ? 'عادية (1x)' : `${speed}x`}
                            </span>
                            {playbackSpeed === speed && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    )}

                    {settingsTab === 'subtitles' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">عرض الترجمة</span>
                          <button
                            type="button"
                            onClick={() => setSubtitlesEnabled((prev) => !prev)}
                            className={`px-3 min-h-[34px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              subtitlesEnabled
                                ? 'bg-[#F7C600] text-black'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {subtitlesEnabled ? 'مفعلة' : 'متوقفة'}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full min-h-[42px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-[#F7C600] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                              className="min-w-[34px] min-h-[34px] rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {subtitleError && (
                          <p className="text-[11px] text-red-400">{subtitleError}</p>
                        )}

                        <div className="space-y-1.5">
                          <span className="text-[11px] text-zinc-400 font-semibold block">
                            حجم الخط
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {SUBTITLE_SIZES.map((sz) => (
                              <button
                                key={sz.id}
                                type="button"
                                onClick={() => setSubtitleSize(sz.id)}
                                className={`min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer ${
                                  subtitleSize === sz.id
                                    ? 'bg-[#F7C600] text-black'
                                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                                }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[11px] text-zinc-400 font-semibold block">
                            لون الخط
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {SUBTITLE_COLORS.map((col) => (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => setSubtitleColor(col.value)}
                                className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                                  subtitleColor === col.value
                                    ? 'bg-white/15 border border-[#F7C600] text-white'
                                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
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

                    {settingsTab === 'servers' && (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        {orderedServers.map((srv) => {
                          const isActiveSrv = resolvedActiveServer?.id === srv.id;
                          return (
                            <button
                              key={srv.id}
                              type="button"
                              onClick={() => switchServer(srv)}
                              className={`w-full min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                isActiveSrv
                                  ? 'bg-[#F7C600] text-black'
                                  : 'text-zinc-200 hover:bg-white/10'
                              }`}
                            >
                              <span className="truncate">
                                سيرفر {srv.orderNumber}: {srv.shortLabel}
                              </span>
                              {isActiveSrv && <Check className="w-4 h-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {activePanel === 'episodes' && episodesList.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className={`absolute top-full left-0 mt-2.5 w-72 sm:w-80 max-w-[calc(100vw-2rem)] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl z-50 ${
                      isLandscapeMode ? 'max-h-[calc(100vw-5.5rem)]' : 'max-h-[60dvh]'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-zinc-400 px-3 py-1.5">
                      الحلقات ({episodesList.length})
                    </p>
                    <div className="space-y-1">
                      {episodesList.map((ep, idx) => {
                        const isActive = idx === activeEpisodeIndex;
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => handleSelectEpisode(idx)}
                            className={`w-full min-h-[46px] px-3 py-2 rounded-xl text-right flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-[#F7C600] text-black'
                                : 'bg-white/5 hover:bg-white/10 text-zinc-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">
                                م{ep.seasonNumber} · ح{ep.episodeNumber}: {ep.title}
                              </p>
                              <p
                                className={`text-[11px] ${
                                  isActive ? 'text-black/75' : 'text-zinc-400'
                                }`}
                              >
                                {ep.duration}
                              </p>
                            </div>
                            {isActive && <Play className="w-4 h-4 fill-current shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* 2. Centered Video Stage (Zero Stretching, Cropping, or Corner Collapse) */}
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
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
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

            {/* Cover YouTube pre-play third-party center icon cleanly until actual playback begins */}
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

              if (isPreRollIntroActiveRef.current) {
                if (video.currentTime !== 0) {
                  video.currentTime = 0;
                }
                return;
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
              if (hasFatalErrorRef.current) return;
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
              showControls ? 'bottom-28 sm:bottom-32' : 'bottom-6 sm:bottom-10'
            }`}
          >
            <div
              className={`max-w-3xl px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-lg bg-black/75 backdrop-blur-sm text-center font-bold whitespace-pre-line leading-relaxed ${subtitleSizeClass}`}
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
              className={`absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center bg-black/70 backdrop-blur-md rounded-full w-20 h-20 text-[#F7C600] ${
                seekFeedback === 'forward' ? 'right-8 sm:right-16' : 'left-8 sm:left-16'
              }`}
            >
              {seekFeedback === 'forward' ? (
                <RotateCw className="w-7 h-7" />
              ) : (
                <RotateCcw className="w-7 h-7" />
              )}
              <span className="text-xs font-bold tabular-nums mt-1">
                {seekFeedback === 'forward' ? '+10 ث' : '-10 ث'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal Loading Indicator */}
        {!isPreRollIntroActive && isLoading && !errorMessage && !isEnded && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 pointer-events-none">
            <div className="w-11 h-11 sm:w-12 sm:h-12 border-[3px] border-white/20 border-t-[#F7C600] rounded-full animate-spin" />
          </div>
        )}

        {/* Resume Watch Prompt */}
        <AnimatePresence>
          {!isPreRollIntroActive && resumePrompt !== null && !errorMessage && !isEnded && (
            <div className="absolute top-16 sm:top-20 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onPointerUp={(e) => e.stopPropagation()}
                className="pointer-events-auto bg-zinc-950/90 border border-white/15 rounded-2xl p-2.5 px-3.5 shadow-2xl backdrop-blur-xl flex items-center gap-3 text-xs w-full sm:w-auto max-w-md"
              >
                <Clock className="w-4 h-4 text-[#F7C600] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    متابعة من{' '}
                    <span className="text-[#F7C600] tabular-nums">
                      {formatClockTime(resumePrompt)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resumeSavedProgress}
                  className="min-h-[34px] px-3 bg-[#F7C600] hover:bg-amber-300 text-black font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  استكمال
                </button>
                <button
                  type="button"
                  onClick={() => setResumePrompt(null)}
                  aria-label="إغلاق"
                  className="min-w-[34px] min-h-[34px] rounded-xl text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            </div>
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
              className="absolute bottom-24 sm:bottom-28 left-4 sm:left-6 z-30 min-h-[40px] px-4 rounded-full bg-white/15 hover:bg-[#F7C600] text-white hover:text-black backdrop-blur-md text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>تخطي المقدمة</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Next Episode Prompt */}
        <AnimatePresence>
          {showNextEpisodePrompt && nextEpisode && (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => handleSelectEpisode(activeEpisodeIndex + 1)}
              className="absolute bottom-24 sm:bottom-28 right-4 sm:right-6 z-30 min-h-[40px] px-4 rounded-full bg-[#F7C600] hover:bg-amber-300 text-black text-xs font-black flex items-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>الحلقة التالية</span>
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
              className="absolute top-16 sm:top-20 inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
            >
              <div className="px-3.5 py-2 rounded-full bg-zinc-950/92 border border-[#F7C600]/45 text-[#F7C600] text-xs font-bold backdrop-blur-md shadow-xl flex items-center gap-2">
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span>{failoverNotice}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GoldenFlix Center Transport Controls (Restored GoldenFlix center mark; opaque center button covers YouTube's white || pause bezel) */}
        <AnimatePresence>
          {!isUniversalEmbedMode &&
            !isPreRollIntroActive &&
            (showControls || !isPlaying) &&
            !errorMessage &&
            !isEnded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                dir="ltr"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  revealControls();
                }}
                onPointerUp={(e) => e.stopPropagation()}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-5 sm:gap-8"
              >
                <button
                  type="button"
                  onClick={skipBackward}
                  aria-label="تأخير 10 ثوانٍ"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-950/85 hover:bg-zinc-900 border border-white/20 hover:border-[#F7C600]/60 text-white backdrop-blur-md flex items-center justify-center relative active:scale-90 transition-all cursor-pointer shadow-lg"
                >
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="absolute text-[9px] font-mono font-extrabold mt-0.5">10</span>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#09090D] hover:bg-[#14141D] border-2 border-[#F7C600] text-[#F7C600] flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-[0_0_32px_rgba(0,0,0,0.95),0_0_18px_rgba(247,198,0,0.2)]"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={skipForward}
                  aria-label="تقديم 10 ثوانٍ"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-950/85 hover:bg-zinc-900 border border-white/20 hover:border-[#F7C600]/60 text-white backdrop-blur-md flex items-center justify-center relative active:scale-90 transition-all cursor-pointer shadow-lg"
                >
                  <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="absolute text-[9px] font-mono font-extrabold mt-0.5">10</span>
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
            <div className="max-w-md w-full bg-zinc-950/90 border border-white/10 rounded-3xl p-6 shadow-2xl">
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
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-[#F7C600] text-white hover:text-black font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
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
                  className="flex-1 min-h-[44px] px-4 bg-[#F7C600] hover:bg-amber-300 text-black font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
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
            <div className="max-w-md w-full bg-zinc-950/95 border border-white/10 rounded-3xl p-6 text-center shadow-2xl space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#F7C600]/15 text-[#F7C600] flex items-center justify-center mx-auto">
                <Film className="w-6 h-6" />
              </div>

              <div>
                <p className="text-xs font-bold text-[#F7C600] mb-1">
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
                    className="flex-1 min-h-[44px] px-4 bg-[#F7C600] hover:bg-amber-300 text-black font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
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
                      : 'bg-[#F7C600] hover:bg-amber-300 text-black'
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

      {/* 3. Clean Minimal Bottom Dock (Strictly Non-Overlapping Controls Row) */}
      <AnimatePresence>
        {!isUniversalEmbedMode && !isPreRollIntroActive && (showControls || errorMessage) && !isEnded && (
          <motion.footer
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onPointerDown={(e) => {
              e.stopPropagation();
              revealControls();
            }}
            onPointerUp={(e) => e.stopPropagation()}
            dir="ltr"
            className="absolute bottom-0 inset-x-0 z-30 px-3 sm:px-6 pt-8 pb-3 sm:pb-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
          >
            {/* Playback Timeline Scrubber */}
            <div
              className="relative group w-full h-7 flex items-center touch-none cursor-pointer"
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
              {hoverSeek && (
                <div
                  className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-zinc-900/95 text-white text-[11px] font-mono font-semibold tabular-nums pointer-events-none shadow-lg"
                  style={{ left: `${hoverSeek.percent}%` }}
                >
                  {formatClockTime(hoverSeek.time)}
                </div>
              )}

              {/* Visual Track */}
              <div
                className={`relative w-full bg-white/25 rounded-full overflow-hidden pointer-events-none transition-all duration-150 ${
                  isProgressHovered || isScrubbing ? 'h-1.5' : 'h-1'
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/35 rounded-full"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-[#F7C600] rounded-full"
                  style={{ width: `${progressPercent}%` }}
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

              {/* Circular Gold Scrubber Thumb */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[#F7C600] pointer-events-none transition-all duration-150 ${
                  isProgressHovered || isScrubbing
                    ? 'w-4 h-4 shadow-[0_0_12px_rgba(247,198,0,0.85)]'
                    : 'w-3 h-3 shadow-[0_0_8px_rgba(247,198,0,0.5)]'
                }`}
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            {/* Control Row: Clean Left Playback + Center-Left Time + Right Screen Actions */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 mt-1 text-white">
              {/* Playback & Volume & Timestamp Cluster */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-white hover:bg-[#F7C600] hover:text-black active:scale-90 transition-all cursor-pointer shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={skipBackward}
                  aria-label="تأخير 10 ثوانٍ"
                  className="hidden sm:flex w-10 h-10 min-w-[40px] min-h-[40px] rounded-full items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-90 transition-all relative cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-4.5 h-4.5" />
                  <span className="absolute text-[8px] font-mono font-bold mt-0.5">10</span>
                </button>

                <button
                  type="button"
                  onClick={skipForward}
                  aria-label="تقديم 10 ثوانٍ"
                  className="hidden sm:flex w-10 h-10 min-w-[40px] min-h-[40px] rounded-full items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-90 transition-all relative cursor-pointer shrink-0"
                >
                  <RotateCw className="w-4.5 h-4.5" />
                  <span className="absolute text-[8px] font-mono font-bold mt-0.5">10</span>
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                    className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5 text-red-400" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    aria-label="مستوى الصوت"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onPointerDown={revealControls}
                    onInput={(e) =>
                      handleVolumeChange(parseFloat((e.target as HTMLInputElement).value))
                    }
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="hidden md:block w-20 h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-[#F7C600]"
                  />
                </div>

                {/* Separated Clean Timestamp */}
                <div className="flex items-center gap-1 font-mono text-xs tabular-nums whitespace-nowrap pl-1 sm:pl-2 shrink-0">
                  <span className="text-white font-semibold">{formatClockTime(currentTime)}</span>
                  <span className="text-zinc-500">/</span>
                  <span className="text-zinc-400">{formatClockTime(duration)}</span>
                </div>
              </div>

              {/* Right Cluster: Dedicated Landscape Rotation & Dedicated Fullscreen */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleLandscapeOrientation}
                  aria-label={isLandscapeMode ? 'الوضع العمودي' : 'تدوير للوضع الأفقي'}
                  title={isLandscapeMode ? 'العودة للوضع العمودي' : 'تدوير الشاشة أفقياً'}
                  className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                    isLandscapeMode
                      ? 'bg-[#F7C600] text-black shadow-lg'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <RotateCw className="w-4.5 h-4.5" />
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                  title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                  className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                    isFullscreen
                      ? 'bg-[#F7C600] text-black shadow-lg'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {isFullscreen ? (
                    <Minimize className="w-4.5 h-4.5" />
                  ) : (
                    <Maximize className="w-4.5 h-4.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>

      {/* 4. GoldenFlix Pre-Roll Cinematic Intro (Plays before every movie/series/episode) */}
      {isPreRollIntroActive && !errorMessage && (
        <PlayerCinemaIntro
          key={playbackSessionKey}
          onComplete={handlePreRollComplete}
          isLandscape={isLandscapeMode}
        />
      )}
    </div>
  );
};
