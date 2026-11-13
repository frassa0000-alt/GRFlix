import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Captions,
  Check,
  Clock,
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
  SlidersHorizontal,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { Episode, MediaItem, PlayerSettingsConfig } from '../../types';
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
  format: 'mp4' | 'hls' | 'webm';
  qualityLabel: string;
  qualityRank: number;
  isDefault: boolean;
  engineType: 'direct-mp4' | 'hls-adaptive' | 'custom-source';
}

type ActivePopover = 'speed' | 'quality' | 'subtitles' | 'episodes' | null;

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

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
  const s = (labelOrUrl || '').toLowerCase();
  if (s.includes('2160') || s.includes('4k')) return 2160;
  if (s.includes('1440') || s.includes('2k')) return 1440;
  if (s.includes('1080') || s.includes('full hd') || s.includes('fhd')) return 1080;
  if (s.includes('720') || s.includes('hd')) return 720;
  if (s.includes('480') || s.includes('sd')) return 480;
  if (s.includes('360')) return 360;
  if (s.includes('240')) return 240;
  if (s.includes('auto') || s.includes('تلقائي') || s.includes('hls')) return 1500;
  return 900;
}

function isHlsSource(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.m3u8') || url.toLowerCase().includes('.m3u8?');
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
  const containerRef = useRef<HTMLDivElement>(null);
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
  const availableCustomSources = useMemo(
    () => activeEpisode?.sources || media.sources || [],
    [activeEpisode?.sources, media.sources]
  );

  // Core playback state
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string>(baseVideoUrl);
  const [activeServerId, setActiveServerId] = useState<string>('server-direct-mp4');
  const [serverStreamData, setServerStreamData] = useState<VideoStreamsResponse | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(
    playerDefaults?.defaultSpeed || 1
  );
  const [isEnded, setIsEnded] = useState<boolean>(false);

  // Quality & buffering state
  const [hlsQualityOptions, setHlsQualityOptions] = useState<QualityOption[]>([]);
  const [activeHlsQualityId, setActiveHlsQualityId] = useState<string>('auto');
  const [detectedResolution, setDetectedResolution] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState<number>(0);

  // Interactive HUD & UI overlays
  const [showControls, setShowControls] = useState<boolean>(true);
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [resumePrompt, setResumePrompt] = useState<number | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<'forward' | 'backward' | null>(null);
  const [hoverSeek, setHoverSeek] = useState<{ time: number; percent: number } | null>(null);
  const [isProgressHovered, setIsProgressHovered] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  // Subtitle state
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

  // Discover real server engines (MP4 Range + HLS Adaptive) & poll while background qualities encode
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

  // Keep selected source synced when episode/media changes
  useEffect(() => {
    setSelectedSourceUrl(baseVideoUrl);
    setActiveServerId(
      extractLocalVideoFilename(baseVideoUrl) ? 'server-direct-mp4' : 'custom-0'
    );
    setHlsQualityOptions([]);
    setActiveHlsQualityId('auto');
    setCurrentTime(0);
    setDuration(0);
    setBufferedTime(0);
    setIsEnded(false);
    setErrorMessage(null);
    hasFatalErrorRef.current = false;
    setActivePopover(null);
    setDetectedResolution(null);
    pendingSeekRef.current = null;
    resumeAutoplayRef.current = false;
  }, [baseVideoUrl]);

  // Lock body scroll while player is mounted
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Network online/offline listeners
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setIsLoading(false);
      if (!videoRef.current || videoRef.current.readyState < 3) {
        hasFatalErrorRef.current = true;
        setErrorMessage('انقطع الاتصال بالإنترنت. تحقق من اتصال الشبكة ثم اضغط إعادة المحاولة.');
      }
    };
    const handleOnline = () => {
      setIsOffline(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Load saved watch progress prompt for current movie/episode
  useEffect(() => {
    const prev = getMediaProgress(media.id, activeEpisode?.id);
    if (prev && prev.currentTime > 5 && prev.duration - prev.currentTime > 15) {
      setResumePrompt(prev.currentTime);
    } else {
      setResumePrompt(null);
    }
  }, [media.id, activeEpisode?.id]);

  // Load remote subtitle URL if attached to episode or media item
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
      .catch(() => {
        // Silent fallback if no external remote subtitle is reachable
      });

    return () => {
      cancelled = true;
    };
  }, [activeEpisode?.subtitleUrl, media.subtitleUrl]);

  // Fullscreen state listeners + orientation cleanup
  useEffect(() => {
    const handleFsChange = () => {
      const fsActive = Boolean(
        document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(fsActive);
      if (!fsActive && screen.orientation && 'unlock' in screen.orientation) {
        try {
          screen.orientation.unlock();
        } catch {
          // Ignore browsers without orientation lock permission
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsTimer();
    controlsTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (
        video &&
        !video.paused &&
        !activePopover &&
        !errorMessage &&
        !isEnded &&
        !isScrubbing &&
        !isProgressHovered
      ) {
        setShowControls(false);
      }
    }, 3200);
  }, [activePopover, clearControlsTimer, errorMessage, isEnded, isProgressHovered, isScrubbing]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    if (activePopover || errorMessage || isEnded || !isPlaying || isScrubbing || isProgressHovered) {
      clearControlsTimer();
      setShowControls(true);
    } else {
      scheduleControlsHide();
    }
    return clearControlsTimer;
  }, [
    activePopover,
    clearControlsTimer,
    errorMessage,
    isEnded,
    isPlaying,
    isProgressHovered,
    isScrubbing,
    scheduleControlsHide,
  ]);

  // Initialize playback engine (HLS.js or native MP4 progressive streaming)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Clean up any prior HLS instance first
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    hasFatalErrorRef.current = false;
    setErrorMessage(null);
    setIsEnded(false);

    if (!navigator.onLine) {
      hasFatalErrorRef.current = true;
      setIsLoading(false);
      setErrorMessage('لا يوجد اتصال بالإنترنت. تأكد من اتصالك بالشبكة ثم أعد المحاولة.');
      return;
    }

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

          const sortedLevels = Array.from(uniqueMap.values()).sort((a, b) => {
            return (b.rank || 0) - (a.rank || 0);
          });

          setHlsQualityOptions([
            { id: 'auto', label: 'تلقائي (Auto)', hlsLevel: -1, status: 'ready', rank: 9999 },
            ...sortedLevels,
          ]);
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

          // Stop retries immediately to prevent error loops
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
  }, [selectedSourceUrl, retryToken]);

  // Persist current watch progress helper
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
    const video = videoRef.current;
    if (!video || hasFatalErrorRef.current) return;

    if (isEnded) {
      video.currentTime = 0;
      setIsEnded(false);
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      revealControls();
      return;
    }

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      persistProgress(video.currentTime, video.duration || 0);
    }
    revealControls();
  }, [isEnded, persistProgress, revealControls]);

  const handleSeek = useCallback(
    (newTime: number) => {
      const video = videoRef.current;
      if (!video || hasFatalErrorRef.current) return;
      const maxDuration = video.duration || duration || 0;
      const clamped = Math.max(0, Math.min(newTime, maxDuration));
      video.currentTime = clamped;
      setCurrentTime(clamped);
      if (isEnded && clamped < maxDuration - 0.5) {
        setIsEnded(false);
      }
      revealControls();
    },
    [duration, isEnded, revealControls]
  );

  const triggerSeekFeedback = useCallback((direction: 'forward' | 'backward') => {
    setSeekFeedback(direction);
    if (seekFeedbackTimerRef.current) {
      window.clearTimeout(seekFeedbackTimerRef.current);
    }
    seekFeedbackTimerRef.current = window.setTimeout(() => {
      setSeekFeedback(null);
    }, 550);
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    const base = video ? video.currentTime : currentTime;
    handleSeek(base + 10);
    triggerSeekFeedback('forward');
  }, [currentTime, handleSeek, triggerSeekFeedback]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    const base = video ? video.currentTime : currentTime;
    handleSeek(base - 10);
    triggerSeekFeedback('backward');
  }, [currentTime, handleSeek, triggerSeekFeedback]);

  const handleVolumeChange = useCallback(
    (newVol: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(1, newVol));
      video.volume = clamped;
      video.muted = clamped === 0;
      setVolume(clamped);
      setIsMuted(clamped === 0);
      revealControls();
    },
    [revealControls]
  );

  const toggleMute = useCallback(() => {
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
  }, [isMuted, revealControls, volume]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    }) | null;

    const fsElement =
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;

    if (!fsElement) {
      if (container?.requestFullscreen) {
        container
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            const orientation = screen.orientation as ScreenOrientation & {
              lock?: (mode: string) => Promise<void>;
            };
            if (orientation?.lock) {
              orientation.lock('landscape').catch(() => {});
            }
          })
          .catch(() => {
            if (video?.webkitEnterFullscreen) {
              video.webkitEnterFullscreen();
              setIsFullscreen(true);
            }
          });
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
    revealControls();
  }, [revealControls]);

  const changeSpeed = useCallback(
    (speed: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
      setActivePopover(null);
      revealControls();
    },
    [revealControls]
  );

  const changeQuality = useCallback(
    (option: QualityOption) => {
      if (option.status === 'processing') return;
      const video = videoRef.current;
      if (!video) return;

      if (typeof option.hlsLevel === 'number' && hlsRef.current) {
        hlsRef.current.currentLevel = option.hlsLevel;
        setActiveHlsQualityId(option.id);
        setActivePopover(null);
        revealControls();
        return;
      }

      if (option.url && option.url !== selectedSourceUrl) {
        pendingSeekRef.current = video.currentTime;
        resumeAutoplayRef.current = !video.paused;
        setSelectedSourceUrl(option.url);
      }

      setActivePopover(null);
      revealControls();
    },
    [revealControls, selectedSourceUrl]
  );

  const switchServer = useCallback(
    (srv: OrderedServerItem) => {
      const video = videoRef.current;
      setActiveServerId(srv.id);
      if (video && srv.url !== selectedSourceUrl) {
        pendingSeekRef.current = video.currentTime;
        resumeAutoplayRef.current = !video.paused;
        setSelectedSourceUrl(srv.url);
      } else if (!video && srv.url !== selectedSourceUrl) {
        setSelectedSourceUrl(srv.url);
      }
      setActivePopover(null);
      revealControls();
    },
    [revealControls, selectedSourceUrl]
  );

  const handleSelectEpisode = useCallback((index: number) => {
    if (index < 0 || index >= episodesList.length) return;
    setActiveEpisodeIndex(index);
    setActivePopover(null);
    setIsEnded(false);
    resumeAutoplayRef.current = true;
  }, [episodesList.length]);

  const handleRetry = useCallback(() => {
    hasFatalErrorRef.current = false;
    setErrorMessage(null);
    setIsOffline(!navigator.onLine);
    setIsLoading(true);
    setRetryToken((prev) => prev + 1);
  }, []);

  const handleClosePlayer = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      persistProgress(video.currentTime, video.duration || 0);
      video.pause();
    }
    onClose();
  }, [onClose, persistProgress]);

  const resumeSavedProgress = useCallback(() => {
    const video = videoRef.current;
    if (resumePrompt !== null && video) {
      video.currentTime = resumePrompt;
      setCurrentTime(resumePrompt);
      setResumePrompt(null);
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      revealControls();
    }
  }, [resumePrompt, revealControls]);

  // Subtitle file loader (.srt / .vtt)
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

  // Keyboard shortcuts for desktop playback control
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
        if (activePopover) {
          e.preventDefault();
          setActivePopover(null);
        } else if (!fsEl) {
          e.preventDefault();
          handleClosePlayer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePopover,
    handleClosePlayer,
    handleVolumeChange,
    isMuted,
    revealControls,
    skipBackward,
    skipForward,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    volume,
  ]);

  // Video viewport tap/click gesture handler (Touch double-tap seek vs desktop click play)
  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePopover) {
      setActivePopover(null);
      return;
    }

    if (errorMessage || isEnded) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
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
        if (side === 'right') {
          skipForward();
        } else {
          skipBackward();
        }
        return;
      }

      lastTapRef.current = { time: now, side };
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
      }
      tapTimerRef.current = window.setTimeout(() => {
        setShowControls((prev) => {
          const next = !prev;
          if (next) scheduleControlsHide();
          return next;
        });
      }, 240);
    } else {
      if (e.detail === 2) {
        toggleFullscreen();
      } else {
        togglePlay();
      }
    }
  };

  // Intro & Subtitle computed values
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

  const orderedServers = useMemo<OrderedServerItem[]>(() => {
    const rawList: Array<Omit<OrderedServerItem, 'orderNumber'>> = [];
    const seenUrls = new Set<string>();

    const normalizeUrlKey = (u: string) => u.trim().split('?')[0];

    // 1. Add real local multi-engine streams when playing an uploaded server file
    if (serverStreamData?.exists && serverStreamData.servers.length > 0) {
      for (const srv of serverStreamData.servers) {
        const key = normalizeUrlKey(srv.url);
        if (!key || seenUrls.has(key)) continue;
        seenUrls.add(key);
        rawList.push({
          id: srv.id,
          shortLabel: srv.shortLabel,
          label: srv.label,
          url: srv.url,
          format: srv.format,
          qualityLabel:
            srv.format === 'hls'
              ? 'HLS تكيفي'
              : serverStreamData.sourceHeight
              ? `${serverStreamData.sourceHeight}p`
              : media.videoQuality || 'أصلي',
          qualityRank: srv.format === 'hls' ? 1400 : serverStreamData.sourceHeight || 1080,
          isDefault: srv.isDefault,
          engineType: srv.format === 'hls' ? 'hls-adaptive' : 'direct-mp4',
        });
      }
    }

    // 2. Append any custom/configured playback sources cleanly ordered (Default first, then highest quality)
    const sortedCustom = [...availableCustomSources]
      .filter((s) => Boolean(s?.url))
      .sort((a, b) => {
        if (Boolean(a.isDefault) !== Boolean(b.isDefault)) {
          return a.isDefault ? -1 : 1;
        }
        return getQualityRank(b.label) - getQualityRank(a.label);
      });

    sortedCustom.forEach((src, idx) => {
      const key = normalizeUrlKey(src.url);
      if (!key || seenUrls.has(key)) return;
      seenUrls.add(key);
      const isHls = src.format === 'hls' || isHlsSource(src.url);
      rawList.push({
        id: `custom-${idx}`,
        shortLabel: src.label || `سيرفر ${rawList.length + 1}`,
        label: src.label || `المصدر ${rawList.length + 1}`,
        url: src.url,
        format: isHls ? 'hls' : src.format === 'webm' ? 'webm' : 'mp4',
        qualityLabel: src.label || 'HD',
        qualityRank: getQualityRank(src.label),
        isDefault: Boolean(src.isDefault) && rawList.length === 0,
        engineType: 'custom-source',
      });
    });

    // 3. Fallback baseVideoUrl if not yet represented
    const baseKey = normalizeUrlKey(baseVideoUrl || '');
    if (baseKey && !seenUrls.has(baseKey)) {
      const isHls = isHlsSource(baseVideoUrl);
      rawList.unshift({
        id: 'server-primary',
        shortLabel: isHls ? 'البث التكيفي HLS' : 'السيرفر الرئيسي',
        label: isHls ? 'المشغل الرئيسي (HLS)' : 'المشغل الرئيسي (MP4)',
        url: baseVideoUrl,
        format: isHls ? 'hls' : 'mp4',
        qualityLabel: media.videoQuality || 'الأصلية',
        qualityRank: getQualityRank(media.videoQuality),
        isDefault: true,
        engineType: isHls ? 'hls-adaptive' : 'custom-source',
      });
    }

    return rawList.map((item, idx) => ({
      ...item,
      orderNumber: idx + 1,
    }));
  }, [availableCustomSources, baseVideoUrl, media.videoQuality, serverStreamData]);

  const resolvedActiveServer = useMemo(() => {
    const byId = orderedServers.find((s) => s.id === activeServerId);
    if (byId) return byId;
    const byUrl = orderedServers.find((s) => s.url === selectedSourceUrl);
    return byUrl || orderedServers[0] || null;
  }, [activeServerId, orderedServers, selectedSourceUrl]);

  const effectiveQualityOptions = useMemo<QualityOption[]>(() => {
    if (isHlsSource(selectedSourceUrl)) {
      if (hlsQualityOptions.length > 0) return hlsQualityOptions;
      return [{ id: 'auto', label: 'تلقائي (Auto)', hlsLevel: -1, status: 'ready', rank: 9999 }];
    }

    if (
      resolvedActiveServer?.engineType === 'direct-mp4' &&
      serverStreamData?.exists &&
      serverStreamData.qualities.length > 0 &&
      (serverStreamData.qualities.length > 1 || availableCustomSources.length <= 1)
    ) {
      return [...serverStreamData.qualities]
        .map((q) => ({
          id: q.id,
          label: q.label,
          url: q.url,
          status: q.status,
          rank: q.height || 900,
        }))
        .sort((a, b) => (b.rank || 0) - (a.rank || 0));
    }

    if (availableCustomSources.length > 1) {
      return [...availableCustomSources]
        .map((src, index) => ({
          id: `src-${index}`,
          label: src.label,
          url: src.url,
          status: 'ready' as const,
          rank: getQualityRank(src.label),
        }))
        .sort((a, b) => (b.rank || 0) - (a.rank || 0));
    }

    return [
      {
        id: 'source',
        label: detectedResolution || media.videoQuality || 'الجودة الأصلية',
        url: selectedSourceUrl,
        status: 'ready',
        rank: getQualityRank(detectedResolution || media.videoQuality),
      },
    ];
  }, [
    availableCustomSources,
    detectedResolution,
    hlsQualityOptions,
    media.videoQuality,
    resolvedActiveServer?.engineType,
    selectedSourceUrl,
    serverStreamData,
  ]);

  const activeQualityId = useMemo(() => {
    if (isHlsSource(selectedSourceUrl)) {
      return activeHlsQualityId;
    }
    const matched = effectiveQualityOptions.find((q) => q.url && q.url === selectedSourceUrl);
    return matched?.id || effectiveQualityOptions[0]?.id || 'source';
  }, [activeHlsQualityId, effectiveQualityOptions, selectedSourceUrl]);

  const activeQualityLabel = useMemo(() => {
    const matched = effectiveQualityOptions.find((q) => q.id === activeQualityId);
    if (matched?.id === 'auto' && detectedResolution) {
      return `تلقائي (${detectedResolution})`;
    }
    return matched?.label || detectedResolution || media.videoQuality || 'الجودة الأصلية';
  }, [activeQualityId, detectedResolution, effectiveQualityOptions, media.videoQuality]);

  const showNextEpisodePrompt =
    Boolean(nextEpisode) && !isEnded && !errorMessage && duration > 60 && duration - currentTime <= 25;

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      dir="rtl"
      className={`fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none font-sans ${
        !showControls && isPlaying && !errorMessage && !isEnded ? 'cursor-none' : ''
      }`}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      {/* Hidden subtitle file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        onChange={handleSubtitleFileUpload}
        className="hidden"
      />

      {/* Top Cinema Control Bar + Ordered Servers & Qualities Strip */}
      <AnimatePresence>
        {(showControls || errorMessage || isEnded) && (
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-0 inset-x-0 z-30 flex flex-col gap-2 px-3 py-2.5 sm:px-5 sm:py-3.5 bg-gradient-to-b from-black/95 via-black/80 to-transparent"
          >
            {/* Row 1: Close + Title & Quick Controls */}
            <div className="flex items-center justify-between gap-2">
              {/* Right slot in RTL: Close & Title */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={handleClosePlayer}
                  aria-label="العودة"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-zinc-900/85 hover:bg-zinc-800 active:scale-95 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 cursor-pointer shrink-0"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-white font-black text-xs sm:text-base md:text-lg truncate">
                      {media.titleAr || media.title}
                    </h2>
                    {activeEpisode && (
                      <span className="shrink-0 text-[11px] sm:text-xs font-bold text-amber-400">
                        م{activeEpisode.seasonNumber} · ح{activeEpisode.episodeNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                    {activeEpisode
                      ? activeEpisode.title
                      : `${media.year}${media.duration ? ` · ${media.duration}` : ''}`}
                  </p>
                </div>
              </div>

              {/* Left slot in RTL: Quick Settings & Series Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
                {nextEpisode && (
                  <button
                    type="button"
                    onClick={() => handleSelectEpisode(activeEpisodeIndex + 1)}
                    className="hidden sm:flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 active:scale-95 border border-amber-400/35 text-amber-300 text-xs font-bold backdrop-blur-md transition-all cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>الحلقة التالية</span>
                  </button>
                )}

                {episodesList.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setActivePopover((prev) => (prev === 'episodes' ? null : 'episodes'))
                    }
                    aria-label="قائمة الحلقات"
                    className={`min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                      activePopover === 'episodes'
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-zinc-900/85 hover:bg-zinc-800 text-zinc-200 border-white/10'
                    }`}
                  >
                    <ListVideo className="w-4 h-4" />
                    <span className="hidden md:inline">الحلقات</span>
                  </button>
                )}

                {/* Subtitles Button */}
                <button
                  type="button"
                  onClick={() =>
                    setActivePopover((prev) => (prev === 'subtitles' ? null : 'subtitles'))
                  }
                  aria-label="إعدادات الترجمة"
                  className={`min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                    activePopover === 'subtitles'
                      ? 'bg-amber-400 text-black border-amber-400'
                      : subtitlesEnabled && subtitleCues.length > 0
                      ? 'bg-amber-400/15 text-amber-300 border-amber-400/35 hover:bg-amber-400/25'
                      : 'bg-zinc-900/85 hover:bg-zinc-800 text-zinc-200 border-white/10'
                  }`}
                >
                  <Captions className="w-4 h-4" />
                  <span className="hidden sm:inline">الترجمة</span>
                </button>

                {/* Speed Button */}
                <button
                  type="button"
                  onClick={() => setActivePopover((prev) => (prev === 'speed' ? null : 'speed'))}
                  aria-label="سرعة التشغيل"
                  className={`min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 backdrop-blur-md transition-all active:scale-95 cursor-pointer tabular-nums ${
                    activePopover === 'speed'
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-zinc-900/85 hover:bg-zinc-800 text-zinc-200 border-white/10'
                  }`}
                >
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <span>{playbackSpeed}x</span>
                </button>

                {/* Quality Button */}
                <button
                  type="button"
                  onClick={() => setActivePopover((prev) => (prev === 'quality' ? null : 'quality'))}
                  aria-label="جودة الفيديو"
                  className={`min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                    activePopover === 'quality'
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-zinc-900/85 hover:bg-zinc-800 text-zinc-200 border-white/10'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">{activeQualityLabel}</span>
                </button>

                {/* Popover Panels */}
                <AnimatePresence>
                  {activePopover === 'speed' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-44 max-w-[calc(100vw-1.5rem)] bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl z-50"
                    >
                      <div className="text-[11px] text-zinc-400 font-bold px-2.5 py-1.5 border-b border-white/10 mb-1">
                        سرعة التشغيل
                      </div>
                      <div className="space-y-1">
                        {SPEED_OPTIONS.map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => changeSpeed(speed)}
                            className={`w-full min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                              playbackSpeed === speed
                                ? 'bg-amber-400 text-black'
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
                    </motion.div>
                  )}

                  {activePopover === 'quality' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-60 max-w-[calc(100vw-1.5rem)] bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl z-50"
                    >
                      <div className="text-[11px] text-zinc-400 font-bold px-2.5 py-1.5 border-b border-white/10 mb-1">
                        جودة الفيديو المتاحة
                      </div>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {effectiveQualityOptions.map((opt) => {
                          const isProcessingOpt = opt.status === 'processing';
                          const isActiveOpt = activeQualityId === opt.id && !isProcessingOpt;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isProcessingOpt}
                              onClick={() => changeQuality(opt)}
                              className={`w-full min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                                isProcessingOpt
                                  ? 'text-zinc-500 bg-zinc-900/50 cursor-wait'
                                  : isActiveOpt
                                  ? 'bg-amber-400 text-black cursor-pointer'
                                  : 'text-zinc-200 hover:bg-white/10 cursor-pointer'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {isProcessingOpt && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                )}
                                <span>
                                  {opt.id === 'auto' && detectedResolution
                                    ? `تلقائي (${detectedResolution})`
                                    : opt.id === 'source' && detectedResolution
                                    ? `${detectedResolution} (المصدر الفعلي)`
                                    : isProcessingOpt
                                    ? `${opt.label} (جارٍ التجهيز...)`
                                    : opt.label}
                                </span>
                              </span>
                              {isActiveOpt && <Check className="w-4 h-4" />}
                            </button>
                          );
                        })}
                      </div>
                      {effectiveQualityOptions.length === 1 && !serverStreamData?.processing && (
                        <p className="text-[11px] text-zinc-500 px-2.5 pt-2 mt-1 border-t border-white/10 leading-relaxed">
                          تتوفر جودة المصدر الفعلي فقط لهذا الملف.
                        </p>
                      )}
                    </motion.div>
                  )}

                {activePopover === 'subtitles' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] max-h-[72vh] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-2xl z-50 space-y-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-white">إعدادات الترجمة</span>
                      <button
                        type="button"
                        onClick={() => setSubtitlesEnabled((prev) => !prev)}
                        className={`px-3 min-h-[34px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          subtitlesEnabled
                            ? 'bg-amber-400 text-black'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {subtitlesEnabled ? 'مفعلة' : 'متوقفة'}
                      </button>
                    </div>

                    {/* Upload external SRT/VTT */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-amber-400/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>اختيار ملف ترجمة (SRT / VTT)</span>
                      </button>

                      {subtitleFileName && (
                        <div className="flex items-center justify-between gap-2 bg-zinc-900 rounded-xl px-2.5 py-2 border border-white/10">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">
                              {subtitleFileName}
                            </p>
                            <p className="text-[10px] text-zinc-400 tabular-nums">
                              {subtitleCues.length} سطر ترجمة جاهز
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
                            className="min-w-[36px] min-h-[36px] rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {subtitleError && (
                        <p className="text-[11px] text-red-400 leading-relaxed">{subtitleError}</p>
                      )}
                    </div>

                    {/* Font Size */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-zinc-400 font-bold block">حجم الخط</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SUBTITLE_SIZES.map((sz) => (
                          <button
                            key={sz.id}
                            type="button"
                            onClick={() => setSubtitleSize(sz.id)}
                            className={`min-h-[38px] rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              subtitleSize === sz.id
                                ? 'bg-amber-400 text-black'
                                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-white/10'
                            }`}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text Color */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-zinc-400 font-bold block">لون الترجمة</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SUBTITLE_COLORS.map((col) => (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => setSubtitleColor(col.value)}
                            className={`min-h-[38px] px-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                              subtitleColor === col.value
                                ? 'bg-white/15 border border-amber-400 text-white'
                                : 'bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: col.value }}
                            />
                            <span>{col.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePopover === 'episodes' && episodesList.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] max-h-[65vh] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl z-50"
                  >
                    <div className="text-[11px] text-zinc-400 font-bold px-2.5 py-1.5 border-b border-white/10 mb-1.5">
                      الحلقات المتوفرة ({episodesList.length})
                    </div>
                    <div className="space-y-1">
                      {episodesList.map((ep, idx) => {
                        const isActive = idx === activeEpisodeIndex;
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => handleSelectEpisode(idx)}
                            className={`w-full min-h-[48px] px-3 py-2 rounded-xl text-right flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-amber-400 text-black'
                                : 'bg-zinc-900/70 hover:bg-white/10 text-zinc-200'
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
            </div>

            {/* Row 2: Ordered Servers / Players & Qualities Top Strip */}
            {(orderedServers.length > 0 || effectiveQualityOptions.length > 0) && (
              <div
                onPointerUp={(e) => e.stopPropagation()}
                className="rounded-2xl bg-zinc-950/80 border border-white/10 backdrop-blur-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 shadow-xl"
              >
                {/* Servers / Players Ordered List (المشغلات) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 shrink-0 pl-1">
                    <Server className="w-3.5 h-3.5 text-amber-400" />
                    <span>المشغلات:</span>
                  </span>
                  {orderedServers.map((srv) => {
                    const isActive = resolvedActiveServer?.id === srv.id;
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => switchServer(srv)}
                        className={`shrink-0 min-h-[34px] px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                          isActive
                            ? 'bg-amber-400 text-black font-black shadow-[0_0_12px_rgba(250,204,21,0.35)]'
                            : 'bg-white/5 hover:bg-white/15 text-zinc-200 font-bold border border-white/10'
                        }`}
                      >
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                            isActive
                              ? 'bg-black/20 text-black'
                              : 'bg-amber-400/15 text-amber-300'
                          }`}
                        >
                          مشغل {srv.orderNumber}
                        </span>
                        <span className="whitespace-nowrap">{srv.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Qualities Ordered List (الجودات) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 shrink-0 pl-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>الجودات:</span>
                  </span>
                  {effectiveQualityOptions.map((opt) => {
                    const isProcessingOpt = opt.status === 'processing';
                    const isActive = activeQualityId === opt.id && !isProcessingOpt;
                    const displayLabel =
                      opt.id === 'auto' && detectedResolution
                        ? `تلقائي (${detectedResolution})`
                        : opt.id === 'source' && detectedResolution
                        ? detectedResolution
                        : opt.label;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isProcessingOpt}
                        onClick={() => changeQuality(opt)}
                        title={
                          isProcessingOpt
                            ? 'جارٍ تحويل هذه الجودة في الخلفية...'
                            : `تشغيل بجودة ${displayLabel}`
                        }
                        className={`shrink-0 min-h-[34px] px-2.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all ${
                          isProcessingOpt
                            ? 'bg-zinc-900/75 text-zinc-500 border border-white/5 cursor-wait'
                            : isActive
                            ? 'bg-amber-400 text-black font-black shadow-[0_0_10px_rgba(250,204,21,0.3)] active:scale-95 cursor-pointer'
                            : 'bg-zinc-900/90 hover:bg-white/15 text-zinc-200 border border-white/10 active:scale-95 cursor-pointer'
                        }`}
                      >
                        {isProcessingOpt && (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        )}
                        <span className="whitespace-nowrap">{displayLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Cinema Video Stage */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center bg-black"
        onPointerUp={handleViewportPointerUp}
      >
        <video
          ref={videoRef}
          className="w-full h-full max-h-screen object-contain"
          playsInline
          preload="metadata"
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
          onCanPlay={() => {
            setIsLoading(false);
          }}
          onLoadedData={() => {
            setIsLoading(false);
          }}
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
          onPause={() => {
            setIsPlaying(false);
          }}
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
            hasFatalErrorRef.current = true;
            setIsLoading(false);
            setIsPlaying(false);

            const code = videoRef.current?.error?.code;
            if (!navigator.onLine) {
              setErrorMessage('انقطع الاتصال بالإنترنت. تحقق من الشبكة ثم اضغط إعادة المحاولة.');
            } else if (code === 2) {
              setErrorMessage('تعذر تنزيل الفيديو بسبب خطأ في الشبكة.');
            } else if (code === 3) {
              setErrorMessage('تعذر فك ترميز الفيديو. قد يكون الملف تالفاً أو بترميز غير مدعوم.');
            } else if (code === 4) {
              setErrorMessage('رابط الفيديو غير صالح أو صيغة الفيديو غير مدعومة في هذا المتصفح.');
            } else {
              setErrorMessage('تعذر تشغيل ملف الفيديو أو أنه لم يعد متوفراً.');
            }
          }}
        />

        {/* Live Subtitle Overlay */}
        {activeSubtitleText && !errorMessage && !isEnded && (
          <div
            className={`absolute inset-x-4 z-20 pointer-events-none flex justify-center transition-all duration-300 ease-out ${
              showControls ? 'bottom-28 sm:bottom-28' : 'bottom-6 sm:bottom-10'
            }`}
          >
            <div
              className={`max-w-3xl px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-black/75 backdrop-blur-sm shadow-2xl border border-white/10 text-center font-bold whitespace-pre-line leading-relaxed ${subtitleSizeClass}`}
              style={{ color: subtitleColor, textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
            >
              {activeSubtitleText}
            </div>
          </div>
        )}

        {/* Seek +/- 10s Feedback Indicator */}
        <AnimatePresence>
          {seekFeedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={`absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center bg-black/70 backdrop-blur-md border border-amber-400/40 rounded-full w-20 h-20 text-amber-400 shadow-2xl ${
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

        {/* Loading / Buffering Overlay */}
        {isLoading && !errorMessage && !isEnded && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-none px-6 text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 border-4 border-amber-400/25 border-t-amber-400 rounded-full animate-spin mb-3" />
            <p className="text-amber-300 text-xs sm:text-sm font-bold">
              جارٍ تجهيز البث — {media.titleAr || media.title}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              يتم تحميل الفيديو تدريجياً لتشغيل أسرع دون استهلاك كامل للبيانات
            </p>
          </div>
        )}

        {/* Resume Playback Prompt */}
        <AnimatePresence>
          {resumePrompt !== null && !errorMessage && !isEnded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onPointerUp={(e) => e.stopPropagation()}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-zinc-950/95 border border-amber-400/45 rounded-2xl p-3 px-4 shadow-2xl backdrop-blur-xl flex flex-wrap sm:flex-nowrap items-center gap-3 text-xs sm:text-sm w-[92vw] sm:w-auto max-w-lg"
            >
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold">
                  توقفت سابقاً عند{' '}
                  <span className="text-amber-400 tabular-nums">
                    {formatClockTime(resumePrompt)}
                  </span>
                </p>
                <p className="text-[11px] text-zinc-400">استكمل المشاهدة من نفس اللحظة</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={resumeSavedProgress}
                  className="min-h-[38px] px-3 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  استكمال
                </button>
                <button
                  type="button"
                  onClick={() => setResumePrompt(null)}
                  aria-label="إغلاق تنبيه الاستكمال"
                  className="min-w-[38px] min-h-[38px] rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip Intro Button (only rendered when intro boundaries exist) */}
        <AnimatePresence>
          {canSkipIntro && !errorMessage && !isEnded && (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => handleSeek(introEnd as number)}
              className="absolute bottom-28 sm:bottom-32 left-4 sm:left-6 z-30 min-h-[44px] px-4 py-2 rounded-xl bg-zinc-950/90 hover:bg-amber-400 text-white hover:text-black border border-amber-400/50 text-xs sm:text-sm font-bold flex items-center gap-2 backdrop-blur-md shadow-2xl transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>تخطي المقدمة</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Floating Next Episode Prompt near End of Episode */}
        <AnimatePresence>
          {showNextEpisodePrompt && nextEpisode && (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => handleSelectEpisode(activeEpisodeIndex + 1)}
              className="absolute bottom-28 sm:bottom-32 right-4 sm:right-6 z-30 min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs sm:text-sm font-black flex items-center gap-2 shadow-2xl transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>الحلقة التالية: ح{nextEpisode.episodeNumber}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Center Play/Pause Button (smooth fade in/out with HUD) */}
        <AnimatePresence>
          {!isLoading && !errorMessage && !isEnded && showControls && (
            <motion.button
              key="center-play-btn"
              type="button"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              className="absolute z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/65 hover:bg-amber-400 text-white hover:text-black border border-amber-400/45 flex items-center justify-center backdrop-blur-md transition-colors shadow-[0_0_30px_rgba(0,0,0,0.65)] cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 sm:w-9 sm:h-9 fill-current" />
              ) : (
                <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-0.5" />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Offline Banner while already buffered */}
        {isOffline && !errorMessage && (
          <div className="absolute top-20 right-4 z-30 px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-500/40 text-red-200 text-xs font-bold flex items-center gap-2 backdrop-blur-md">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>انقطع الاتصال بالإنترنت</span>
          </div>
        )}

        {/* Error Screen (never leaves blank black screen & stops retry loops) */}
        {errorMessage && (
          <div
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute inset-0 z-40 bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-md w-full bg-zinc-950/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-4">
                {isOffline ? <WifiOff className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
              </div>
              <h3 className="text-white font-black text-base sm:text-lg mb-2">
                {isOffline ? 'لا يوجد اتصال بالإنترنت' : 'تعذر تشغيل الفيديو'}
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
                {errorMessage}
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex-1 min-h-[46px] px-4 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </button>
                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="flex-1 min-h-[46px] px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs sm:text-sm rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  العودة للموقع
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cinema End-of-Playback Screen */}
        {isEnded && !errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex items-center justify-center p-5"
          >
            <div className="max-w-lg w-full bg-zinc-950/95 border border-white/10 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/35 text-amber-400 flex items-center justify-center mx-auto">
                <Film className="w-7 h-7" />
              </div>

              <div>
                <p className="text-xs font-bold text-amber-400 mb-1">
                  {nextEpisode ? 'انتهت الحلقة الحالية' : 'نهاية العرض السينمائي'}
                </p>
                <h3 className="text-lg sm:text-2xl font-black text-white">
                  {media.titleAr || media.title}
                </h3>
                {activeEpisode && (
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    الموسم {activeEpisode.seasonNumber} · الحلقة {activeEpisode.episodeNumber}:{' '}
                    {activeEpisode.title}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                {nextEpisode && (
                  <button
                    type="button"
                    onClick={() => handleSelectEpisode(activeEpisodeIndex + 1)}
                    className="flex-1 min-h-[48px] px-4 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>تشغيل الحلقة التالية (ح{nextEpisode.episodeNumber})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const video = videoRef.current;
                    if (!video) return;
                    setIsEnded(false);
                    video.currentTime = 0;
                    video.play().then(() => setIsPlaying(true)).catch(() => {});
                  }}
                  className={`flex-1 min-h-[48px] px-4 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                    nextEpisode
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-white border border-white/10'
                      : 'bg-amber-400 hover:bg-amber-300 text-black font-black'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة المشاهدة</span>
                </button>

                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="min-h-[48px] px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs sm:text-sm rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Cinema Control Bar */}
      <AnimatePresence>
        {(showControls || errorMessage) && !isEnded && (
          <motion.footer
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute bottom-0 inset-x-0 z-30 px-3 pb-3 pt-10 sm:px-5 sm:pb-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent"
          >
            {/* Interactive Progress Scrubber Bar with Subtle Golden Glow on Hover/Scrub */}
            <div
              className="relative group w-full h-9 flex items-center mb-1.5"
              dir="ltr"
              onMouseEnter={() => {
                setIsProgressHovered(true);
                revealControls();
              }}
              onMouseMove={(e) => {
                setIsProgressHovered(true);
                if (!duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverSeek({ time: ratio * duration, percent: ratio * 100 });
              }}
              onMouseLeave={() => {
                setIsProgressHovered(false);
                setHoverSeek(null);
                scheduleControlsHide();
              }}
              onTouchStart={(e) => {
                setIsScrubbing(true);
                revealControls();
                if (!duration || !e.touches[0]) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(
                  0,
                  Math.min(1, (e.touches[0].clientX - rect.left) / rect.width)
                );
                setHoverSeek({ time: ratio * duration, percent: ratio * 100 });
              }}
              onTouchMove={(e) => {
                if (!duration || !e.touches[0]) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(
                  0,
                  Math.min(1, (e.touches[0].clientX - rect.left) / rect.width)
                );
                setHoverSeek({ time: ratio * duration, percent: ratio * 100 });
              }}
              onTouchEnd={() => {
                setIsScrubbing(false);
                setHoverSeek(null);
                scheduleControlsHide();
              }}
            >
              {/* Soft Golden Ambient Glow Behind Progress Track on Hover/Scrub */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-5 rounded-full transition-opacity duration-300 ease-out ${
                  isProgressHovered || isScrubbing ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/35 to-amber-300/25 blur-md transition-all duration-150"
                  style={{
                    width: `${Math.max(
                      10,
                      hoverSeek ? hoverSeek.percent : progressPercent
                    )}%`,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-16 h-6 rounded-full bg-amber-400/35 blur-lg transition-all duration-100"
                  style={{
                    left: `${hoverSeek ? hoverSeek.percent : progressPercent}%`,
                  }}
                />
              </div>

              {hoverSeek && (
                <div
                  className="hidden sm:block absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-zinc-900/95 border border-amber-400/30 text-amber-300 text-[11px] font-mono font-bold tabular-nums pointer-events-none shadow-lg"
                  style={{ left: `${hoverSeek.percent}%` }}
                >
                  {formatClockTime(hoverSeek.time)}
                </div>
              )}

              {/* Visual Track & Buffered/Played Fill */}
              <div
                className={`relative w-full bg-white/20 rounded-full overflow-hidden pointer-events-none transition-all duration-200 ${
                  isProgressHovered || isScrubbing
                    ? 'h-2 shadow-[0_0_16px_rgba(251,191,36,0.3)]'
                    : 'h-1.5'
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/35 rounded-full"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <input
                type="range"
                aria-label="شريط تقدم الفيديو"
                dir="ltr"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onMouseDown={() => setIsScrubbing(true)}
                onMouseUp={() => {
                  setIsScrubbing(false);
                  scheduleControlsHide();
                }}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="absolute inset-0 z-10 w-full h-9 opacity-0 cursor-pointer"
              />

              {/* Visible Gold Thumb Handle */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-amber-400 pointer-events-none transition-all duration-150 ${
                  isProgressHovered || isScrubbing
                    ? 'scale-110 shadow-[0_0_16px_rgba(251,191,36,0.9)]'
                    : 'shadow-[0_0_10px_rgba(250,204,21,0.65)]'
                }`}
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            {/* Control Buttons Row */}
            <div className="flex items-center justify-between gap-2 text-white" dir="ltr">
              {/* Left Playback Controls */}
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-white hover:text-amber-400 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={skipBackward}
                  aria-label="تأخير 10 ثوانٍ"
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-200 hover:text-amber-400 hover:bg-white/10 active:scale-95 transition-all relative cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="absolute text-[9px] font-mono font-bold">10</span>
                </button>

                <button
                  type="button"
                  onClick={skipForward}
                  aria-label="تقديم 10 ثوانٍ"
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-200 hover:text-amber-400 hover:bg-white/10 active:scale-95 transition-all relative cursor-pointer"
                >
                  <RotateCw className="w-5 h-5" />
                  <span className="absolute text-[9px] font-mono font-bold">10</span>
                </button>

                {/* Volume Control (Mute on mobile + slider on sm+) */}
                <div className="flex items-center gap-1.5 group/vol">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                    className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-200 hover:text-amber-400 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
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
                    dir="ltr"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="hidden sm:block w-20 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                {/* Current / Total Time */}
                <div className="flex items-center gap-1 font-mono text-[11px] sm:text-xs text-zinc-300 px-1.5 tabular-nums shrink-0">
                  <span className="text-amber-400 font-bold">{formatClockTime(currentTime)}</span>
                  <span className="text-zinc-500">/</span>
                  <span>{formatClockTime(duration)}</span>
                </div>
              </div>

              {/* Right Fullscreen & Quality Badge */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {nextEpisode && (
                  <button
                    type="button"
                    onClick={() => handleSelectEpisode(activeEpisodeIndex + 1)}
                    aria-label="الحلقة التالية"
                    className="sm:hidden min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-amber-400 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    <FastForward className="w-5 h-5" />
                  </button>
                )}

                <span className="hidden md:inline text-xs font-bold text-amber-300 px-2">
                  {activeQualityLabel}
                </span>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-100 hover:text-amber-400 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  {isFullscreen ? (
                    <Minimize className="w-5 h-5" />
                  ) : (
                    <Maximize className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
};
