import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Star,
  BookmarkPlus,
  BookmarkCheck,
  Film,
  EyeOff,
  Bell,
  BellRing,
  ArrowLeft,
  ArrowRight,
  User,
  Share2,
  Check,
  Tv,
  Trash2,
  Download,
  Cast,
  ChevronRight,
  ChevronLeft,
  Send,
  MessageSquare,
} from 'lucide-react';
import { CommentItem, MediaItem } from '../../types';
import { getMediaProgress } from '../../services/storage';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatQualityLabel } from '../../utils/quality';
import { hasPlayableMediaVideo, isMediaComingSoon } from '../../services/releaseAlertService';
import { getEffectiveMediaRating } from '../../utils/rating';
import { fetchTmdbMediaDetails, isTmdbMediaItem } from '../../services/tmdbClient';
import { recordMediaView } from '../../services/adminService';
import { isPlainExternalWebUrl, normalizeExternalHttpUrl } from '../../utils/videoEngines';

interface MediaDetailModalProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (media: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isAlertSubscribed?: boolean;
  onToggleAlert?: () => void;
  onOpenAdminDashboard?: () => void;
  onDeleteMovie?: (media: MediaItem) => void;
  isAdmin?: boolean;
  relatedMedia?: MediaItem[];
  onSelectMedia?: (media: MediaItem) => void;
  currentUserName?: string;
  currentUserEmail?: string;
}

type DetailBottomTab = 'trailers' | 'related' | 'comments';

const LOCAL_COMMENTS_STORAGE_KEY = 'mashhad_local_media_comments';

const readLocalComments = (mediaId: string): CommentItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const list = parsed[mediaId];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeLocalComment = (mediaId: string, comment: CommentItem) => {
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const current = Array.isArray(parsed?.[mediaId]) ? parsed[mediaId] : [];
    parsed[mediaId] = [comment, ...current].slice(0, 50);
    localStorage.setItem(LOCAL_COMMENTS_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
};

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  media,
  isOpen,
  onClose,
  onPlay,
  isFavorite,
  onToggleFavorite,
  isAlertSubscribed = false,
  onToggleAlert,
  onDeleteMovie,
  relatedMedia = [],
  onSelectMedia,
  currentUserName,
  currentUserEmail,
}) => {
  const { lang, dir, t, getMediaTitle, translateGenre } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [sharedOk, setSharedOk] = useState(false);
  const [castHintOk, setCastHintOk] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [showAllCast, setShowAllCast] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<DetailBottomTab>('trailers');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [detailedMedia, setDetailedMedia] = useState<MediaItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setStoryExpanded(false);
    setSharedOk(false);
    setCastHintOk(false);
    setDownloadNotice(null);
    setShowAllCast(false);
    setActiveBottomTab('trailers');
    setCommentText('');
    setDetailedMedia(null);
  }, [media?.id]);

  useEffect(() => {
    if (!isOpen || !media || !isTmdbMediaItem(media)) {
      setLoadingDetails(false);
      return;
    }
    const controller = new AbortController();
    setLoadingDetails(true);
    fetchTmdbMediaDetails(media, controller.signal)
      .then((enriched) => {
        if (controller.signal.aborted || !enriched) return;
        const hasAdminVideo = hasPlayableMediaVideo(media);
        const existingEpMap = new Map<string, any>();
        for (const sn of media.seasons || []) {
          for (const ep of sn.episodes || []) {
            existingEpMap.set(`${sn.seasonNumber}:${ep.episodeNumber}`, ep);
          }
        }
        const mergedSeasons =
          media.seasons && media.seasons.length > 0 && hasAdminVideo
            ? media.seasons
            : enriched.seasons
            ? enriched.seasons.map((sn) => ({
                ...sn,
                episodes: (sn.episodes || []).map((ep) => {
                  const prev = existingEpMap.get(`${sn.seasonNumber}:${ep.episodeNumber}`);
                  return prev ? { ...ep, ...prev, videoUrl: prev.videoUrl || ep.videoUrl || '' } : ep;
                }),
              }))
            : media.seasons;

        setDetailedMedia({
          ...media,
          ...enriched,
          videoUrl: media.videoUrl?.trim() ? media.videoUrl : enriched.videoUrl || '',
          sources:
            Array.isArray(media.sources) && media.sources.length > 0
              ? media.sources
              : enriched.sources,
          seasons: mergedSeasons,
          trailerUrl: enriched.trailerUrl || media.trailerUrl,
          isFeatured: media.isFeatured,
          isLatest: media.isLatest,
          isMostWatched: media.isMostWatched,
          displayOrder: media.displayOrder,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingDetails(false);
        }
      });
    return () => controller.abort();
  }, [isOpen, media?.id]);

  useEffect(() => {
    if (!isOpen || !media?.videoUrl || !media.videoUrl.startsWith('/uploads/videos/')) return;
    const controller = new AbortController();
    fetch(media.videoUrl, {
      headers: { Range: 'bytes=0-262143' },
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [isOpen, media?.videoUrl]);

  useEffect(() => {
    if (!isOpen || !media?.id) return;
    let active = true;
    const loadComments = async () => {
      setLoadingComments(true);
      const localList = readLocalComments(media.id);
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(media.id)}/comments`);
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<')) {
            const serverList = JSON.parse(text);
            if (active && Array.isArray(serverList)) {
              const seen = new Set(serverList.map((c: CommentItem) => c.id));
              const merged = [...serverList, ...localList.filter((c) => !seen.has(c.id))];
              setComments(merged);
              setLoadingComments(false);
              return;
            }
          }
        }
      } catch {
        // Fallback to local comments
      }
      if (active) {
        setComments(localList);
        setLoadingComments(false);
      }
    };
    loadComments();
    return () => {
      active = false;
    };
  }, [isOpen, media?.id]);

  if (!isOpen || !media) return null;

  const activeMedia = detailedMedia || media;
  const progress = getMediaProgress(activeMedia.id);
  const primaryTitle = getMediaTitle(activeMedia);
  const secondaryTitle =
    lang === 'ar' && activeMedia.title && activeMedia.title !== activeMedia.titleAr
      ? activeMedia.title
      : lang === 'en' && activeMedia.titleAr && activeMedia.titleAr !== activeMedia.title
      ? activeMedia.titleAr
      : '';

  const backdropSrc = activeMedia.bannerUrl || activeMedia.posterUrl;
  const comingSoon = loadingDetails ? false : isMediaComingSoon(activeMedia);
  const effectiveRating = getEffectiveMediaRating(activeMedia);
  const qualityLabel = activeMedia.videoQuality
    ? formatQualityLabel(activeMedia.videoQuality).toUpperCase()
    : 'HD';

  const genresTranslated =
    Array.isArray(activeMedia.genres) && activeMedia.genres.length > 0
      ? activeMedia.genres
          .filter((g) => typeof g === 'string' && g.trim())
          .map((g) => translateGenre(String(g)))
      : [
          activeMedia.type === 'series'
            ? t('مسلسل', 'Series')
            : activeMedia.type === 'anime'
            ? t('أنمي', 'Anime')
            : t('فيلم', 'Movie'),
        ];

  const genresComma = genresTranslated.join(', ');

  const synopsisText =
    activeMedia.description?.trim() ||
    t(
      'عمل مميز متاح للمشاهدة بجودة عالية على منصة MASHHAD.',
      'A featured title ready to stream in high quality on MASHHAD.'
    );
  const isLongStory = synopsisText.length > 165;

  const castList = Array.isArray(activeMedia.cast)
    ? activeMedia.cast.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const castDetailsList = Array.isArray(activeMedia.castDetails) ? activeMedia.castDetails : [];

  const allEpisodes = Array.isArray(activeMedia.seasons)
    ? activeMedia.seasons.flatMap((s) =>
        (s.episodes || []).map((ep) => ({ ...ep, seasonNumber: s.seasonNumber }))
      )
    : [];

  const filteredRelated = (relatedMedia || [])
    .filter((item) => item.id !== media.id)
    .slice(0, 9);

  const BackIcon = dir === 'ltr' ? ArrowLeft : ArrowRight;
  const YearChevron = dir === 'ltr' ? ChevronRight : ChevronLeft;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: primaryTitle, url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setSharedOk(true);
      window.setTimeout(() => setSharedOk(false), 1800);
    } catch {
      // Ignore user cancel
    }
  };

  const handleCastTrigger = async () => {
    await handleShare();
    setCastHintOk(true);
    window.setTimeout(() => setCastHintOk(false), 2000);
  };

  const handleDownload = () => {
    if (comingSoon) {
      setDownloadNotice(t('سيتاح التحميل فور إضافة الفيديو', 'Download available upon release'));
      window.setTimeout(() => setDownloadNotice(null), 2200);
      return;
    }

    const downloadSource =
      activeMedia.videoUrl ||
      (Array.isArray(activeMedia.sources) && activeMedia.sources[0]?.url) ||
      (allEpisodes[0] && allEpisodes[0].videoUrl) ||
      '';

    if (!downloadSource) {
      setDownloadNotice(t('لا يوجد رابط تحميل مباشر لهذا العمل', 'No direct download link'));
      window.setTimeout(() => setDownloadNotice(null), 2200);
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = downloadSource;
      a.download = `${primaryTitle.replace(/[^\w\u0600-\u06FF\s-]/g, '').trim() || media.id}.mp4`;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadNotice(t('جاري بدء التحميل...', 'Starting download...'));
      window.setTimeout(() => setDownloadNotice(null), 2200);
    } catch {
      setDownloadNotice(t('تعذر بدء التحميل', 'Could not start download'));
      window.setTimeout(() => setDownloadNotice(null), 2200);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = commentText.trim();
    if (!cleanText || submittingComment) return;
    setSubmittingComment(true);

    const optimistic: CommentItem = {
      id: `cmt-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      mediaId: media.id,
      mediaTitle: primaryTitle,
      userName: currentUserName?.trim() || t('مشاهد', 'Viewer'),
      userEmail: currentUserEmail || '',
      rating: Math.round(effectiveRating),
      text: cleanText,
      status: 'approved',
      createdAt: Date.now(),
    };

    try {
      const res = await fetch(`/api/media/${encodeURIComponent(media.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: optimistic.userName,
          userEmail: optimistic.userEmail,
          rating: optimistic.rating,
          text: cleanText,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const saved = data?.comment || optimistic;
        setComments((prev) => [saved, ...prev]);
        writeLocalComment(media.id, saved);
        setCommentText('');
        setSubmittingComment(false);
        return;
      }
    } catch {
      // Fall back to local storage
    }

    writeLocalComment(media.id, optimistic);
    setComments((prev) => [optimistic, ...prev]);
    setCommentText('');
    setSubmittingComment(false);
  };

  const formatCommentTime = (ts?: number) => {
    if (!ts) return t('الآن', 'Just now');
    const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
    if (diffMin < 60) return lang === 'en' ? `${diffMin}m` : `منذ ${diffMin} د`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return lang === 'en' ? `${diffHr}h` : `منذ ${diffHr} س`;
    const diffDays = Math.floor(diffHr / 24);
    return lang === 'en' ? `${diffDays}d` : `منذ ${diffDays} ي`;
  };

  const pillTags: string[] = [
    activeMedia.ageRating || qualityLabel,
    activeMedia.type === 'series'
      ? t('مسلسل', 'Series')
      : activeMedia.type === 'anime'
      ? t('أنمي', 'Anime')
      : t('فيلم', 'Movie'),
    ...(activeMedia.subtitleUrl
      ? [t('مترجم', 'Subtitle')]
      : activeMedia.duration
      ? [activeMedia.duration]
      : []),
  ].filter(Boolean);

  return (
    <AnimatePresence>
      <div
        dir={dir}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto select-none"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-[#0f0c14] border border-white/[0.08] rounded-t-[28px] sm:rounded-[28px] w-full max-w-lg max-h-[94vh] overflow-y-auto no-scrollbar shadow-[0_30px_80px_rgba(0,0,0,0.95)] relative flex flex-col ${
            dir === 'ltr' ? 'text-left' : 'text-right'
          }`}
        >
          {/* 1. Top Full-Bleed Poster/Banner Matching Reference */}
          <div className="relative w-full h-64 sm:h-72 shrink-0 bg-[#17121f] overflow-hidden">
            {backdropSrc && !imgFailed ? (
              <img
                src={backdropSrc}
                alt={primaryTitle}
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1f182a] via-[#130f1a] to-[#0f0c14] text-zinc-500">
                <Film className="w-14 h-14 text-[#ea1d24]/55 mb-2" />
                <span className="text-xs font-bold text-zinc-300 px-4 truncate max-w-full">
                  {primaryTitle}
                </span>
              </div>
            )}

            {/* Smooth Gradient Fade Into #0f0c14 */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c14] via-[#0f0c14]/25 to-black/35 pointer-events-none" />

            {/* Top-Start Back Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('رجوع', 'Back')}
              className={`absolute top-4 ${
                dir === 'ltr' ? 'left-4' : 'right-4'
              } w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-colors z-20 cursor-pointer`}
            >
              <BackIcon className="w-5 h-5 stroke-[2.2]" />
            </button>

            {/* Top-End Cast & Optional Admin Delete Buttons */}
            <div
              className={`absolute top-4 ${
                dir === 'ltr' ? 'right-4' : 'left-4'
              } flex items-center gap-2 z-20`}
            >
              {onDeleteMovie && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteMovie(media);
                    onClose();
                  }}
                  aria-label={t('حذف الفيديو', 'Delete Video')}
                  title={t('حذف هذا الفيديو نهائياً', 'Permanently Delete Video')}
                  className="w-9 h-9 rounded-full bg-[#ea1d24]/85 hover:bg-[#ea1d24] text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleCastTrigger}
                aria-label={t('بث أو مشاركة', 'Cast or Share')}
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                {castHintOk ? <Check className="w-4 h-4 text-emerald-400" /> : <Cast className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* 2. Content Body Matching Attached Image */}
          <div className="relative -mt-6 px-5 pb-6 space-y-4 z-10">
            {/* Title + Bookmark & Share Icons */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-[23px] font-black text-white tracking-tight leading-snug">
                  {primaryTitle}
                </h2>
                {secondaryTitle && (
                  <p className="text-xs font-bold text-zinc-400 mt-0.5 truncate">
                    {secondaryTitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  aria-label={isFavorite ? t('إزالة من المفضلة', 'Remove from Watchlist') : t('إضافة للمفضلة', 'Save to Watchlist')}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    isFavorite ? 'text-[#ea1d24]' : 'text-zinc-200 hover:text-white'
                  }`}
                >
                  {isFavorite ? (
                    <BookmarkCheck className="w-5 h-5 fill-current" />
                  ) : (
                    <BookmarkPlus className="w-5 h-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  aria-label={t('مشاركة', 'Share')}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-200 hover:text-white transition-colors cursor-pointer"
                >
                  {sharedOk ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Share2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Rating + Year + Outlined Pill Badges Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-black tabular-nums">
                <Star className="w-4 h-4 text-[#ea1d24]" />
                <span className="text-[#ea1d24]">{effectiveRating.toFixed(1)}</span>
                <YearChevron className="w-3.5 h-3.5 text-[#ea1d24]" />
                {media.year && <span className="text-zinc-200 font-bold">{media.year}</span>}
                {media.isPublished === false && (
                  <span className="inline-flex items-center gap-1 text-amber-300 ms-1 text-[11px]">
                    <EyeOff className="w-3 h-3" />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {pillTags.map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    className="px-2.5 py-0.5 rounded-full border border-white/25 bg-white/[0.03] text-[10.5px] font-bold text-zinc-200 leading-tight"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* 2 Side-by-Side Pill Buttons: Play (Crimson Gradient) & Download (Outlined) */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              {comingSoon && onToggleAlert ? (
                <button
                  type="button"
                  onClick={onToggleAlert}
                  className={`py-2.5 px-4 rounded-full font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer ${
                    isAlertSubscribed
                      ? 'bg-[#17121f] text-white border border-[#ea1d24]/70'
                      : 'bg-gradient-to-r from-[#ea1d24] to-[#9b0f18] hover:from-[#ff2b32] hover:to-[#b8141e] text-white shadow-[0_8px_22px_rgba(234,29,36,0.38)]'
                  }`}
                >
                  {isAlertSubscribed ? (
                    <BellRing className="w-4 h-4 text-[#ea1d24] shrink-0" />
                  ) : (
                    <Bell className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {isAlertSubscribed ? t('تم التنبيه', 'Notified') : t('تنبيهي', 'Notify Me')}
                  </span>
                </button>
              ) : (() => {
                const directTargetUrl = normalizeExternalHttpUrl(
                  activeMedia.videoUrl ||
                    activeMedia.sources?.[0]?.url ||
                    activeMedia.seasons?.[0]?.episodes?.[0]?.videoUrl ||
                    ''
                );
                if (isPlainExternalWebUrl(directTargetUrl, activeMedia.storageType)) {
                  return (
                    <a
                      href={directTargetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => recordMediaView(activeMedia.id, undefined, currentUserEmail)}
                      className="py-2.5 px-4 rounded-full bg-gradient-to-r from-[#ea1d24] to-[#9b0f18] hover:from-[#ff2b32] hover:to-[#b8141e] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(234,29,36,0.38)] transition-transform active:scale-[0.98] cursor-pointer"
                    >
                      <span className="w-5 h-5 rounded-full bg-white text-[#ea1d24] flex items-center justify-center shrink-0">
                        <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                      </span>
                      <span className="truncate">{t('مشاهدة الآن', 'Watch Now')}</span>
                    </a>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => onPlay(activeMedia)}
                    className="py-2.5 px-4 rounded-full bg-gradient-to-r from-[#ea1d24] to-[#9b0f18] hover:from-[#ff2b32] hover:to-[#b8141e] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(234,29,36,0.38)] transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    <span className="w-5 h-5 rounded-full bg-white text-[#ea1d24] flex items-center justify-center shrink-0">
                      <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                    </span>
                    <span className="truncate">
                      {progress && progress.currentTime > 5
                        ? t('متابعة', 'Resume')
                        : t('مشاهدة الآن', 'Watch Now')}
                    </span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={handleDownload}
                className="py-2.5 px-4 rounded-full bg-[#17121f]/80 hover:bg-[#1f182a] border border-white/25 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">{t('تحميل', 'Download')}</span>
              </button>
            </div>

            {downloadNotice && (
              <p className="text-[11px] font-bold text-[#ea1d24] text-center">{downloadNotice}</p>
            )}

            {/* Genre Line + Synopsis ONLY (No Details Key-Value List) */}
            <div className="space-y-1.5 pt-1">
              <p className="text-xs sm:text-[13px] font-black text-white">
                {t('التصنيف:', 'Genre:')} <span className="font-bold text-zinc-200">{genresComma}</span>
              </p>

              <p className="text-xs sm:text-[13px] text-zinc-400 font-medium leading-relaxed">
                {isLongStory && !storyExpanded
                  ? `${synopsisText.slice(0, 162)}...`
                  : synopsisText}
                {isLongStory && (
                  <button
                    type="button"
                    onClick={() => setStoryExpanded((prev) => !prev)}
                    className="text-white hover:underline font-black cursor-pointer inline ms-1"
                  >
                    {storyExpanded ? t('أقل', 'Less') : t('المزيد', 'More')}
                  </button>
                )}
              </p>
            </div>

            {/* Cast Section (Shown when Cast Exists) */}
            {castList.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-white">{t('طاقم العمل', 'Cast')}</h4>
                  {castList.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCast((v) => !v)}
                      className="text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showAllCast ? t('أقل', 'Show less') : t('عرض الكل', 'See more')}
                    </button>
                  )}
                </div>

                <div
                  className={
                    showAllCast
                      ? 'grid grid-cols-4 sm:grid-cols-5 gap-2.5'
                      : 'flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1'
                  }
                >
                  {(showAllCast ? castList : castList.slice(0, 8)).map((actor, idx) => {
                    const detail = castDetailsList[idx];
                    const photoUrl = detail?.profileUrl;
                    const charName = detail?.character;
                    return (
                      <div
                        key={`${actor}-${idx}`}
                        className={`${
                          showAllCast ? '' : 'w-16 sm:w-[70px] shrink-0'
                        } flex flex-col items-center text-center gap-1.5`}
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.1] flex items-center justify-center text-zinc-300 shadow-md">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={actor}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-zinc-400" />
                          )}
                        </div>
                        <div className="w-full">
                          <span className="text-[10px] font-bold text-zinc-200 line-clamp-1 leading-tight block">
                            {actor}
                          </span>
                          {charName && (
                            <span className="text-[9px] text-zinc-500 line-clamp-1 leading-tight block">
                              {charName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom 3-Tab Switcher with Crimson Active Underline Matching Reference */}
            <div className="pt-2">
              <div className="grid grid-cols-3 border-b border-white/[0.1]">
                {[
                  {
                    id: 'trailers' as const,
                    label:
                      allEpisodes.length > 0
                        ? t('الحلقات', 'Episodes')
                        : t('العرض', 'Trailers'),
                  },
                  {
                    id: 'related' as const,
                    label: t('أعمال مشابهة', 'More like This'),
                  },
                  {
                    id: 'comments' as const,
                    label: `${t('التعليقات', 'Comments')}${
                      comments.length > 0 ? ` (${comments.length})` : ''
                    }`,
                  },
                ].map((tab) => {
                  const isActive = activeBottomTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveBottomTab(tab.id)}
                      className={`pb-2.5 text-xs sm:text-[13px] font-black transition-colors border-b-2 -mb-[1px] cursor-pointer truncate px-1 ${
                        isActive
                          ? 'text-[#ea1d24] border-[#ea1d24]'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Panel Content */}
              <div className="pt-3.5">
                {activeBottomTab === 'trailers' && (
                  allEpisodes.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {allEpisodes.slice(0, 12).map((ep) => {
                        const epCanPlay = Boolean(ep.videoUrl && ep.videoUrl.trim()) || hasPlayableMediaVideo(activeMedia);
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => {
                              if (epCanPlay) {
                                onPlay(activeMedia);
                              } else if (onToggleAlert) {
                                onToggleAlert();
                              }
                            }}
                            className="rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 transition-colors text-start cursor-pointer group"
                          >
                            <div className="relative aspect-video bg-zinc-900">
                              {ep.thumbnailUrl || backdropSrc ? (
                                <img
                                  src={ep.thumbnailUrl || backdropSrc}
                                  alt={ep.title}
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                  <Tv className="w-5 h-5" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <span className="w-7 h-7 rounded-full bg-[#ea1d24] text-white flex items-center justify-center shadow">
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                </span>
                              </div>
                            </div>
                            <div className="p-2">
                              <p className="text-[11px] font-black text-white truncate">
                                {t(`ح${ep.episodeNumber}`, `E${ep.episodeNumber}`)} · {ep.title}
                              </p>
                              {ep.duration && (
                                <p className="text-[10px] text-zinc-400 font-bold mt-0.5 tabular-nums">
                                  {ep.duration}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!comingSoon) {
                          onPlay(activeMedia);
                        } else if (activeMedia.trailerUrl) {
                          onPlay({
                            ...activeMedia,
                            videoUrl: activeMedia.trailerUrl,
                            trailerUrl: undefined,
                            seasons: undefined,
                            storageType: 'youtube',
                            sources: [
                              {
                                id: 'trailer-preview',
                                label: t('الإعلان الدعائي', 'Official Trailer'),
                                url: activeMedia.trailerUrl,
                                format: 'youtube',
                                quality: '1080p',
                                isDefault: true,
                              },
                            ],
                          });
                        }
                      }}
                      className="w-full relative aspect-video rounded-2xl overflow-hidden bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 transition-colors cursor-pointer group text-start"
                    >
                      {backdropSrc && !imgFailed ? (
                        <img
                          src={backdropSrc}
                          alt={primaryTitle}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <Film className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                        <span className="w-12 h-12 rounded-full bg-[#ea1d24] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </span>
                        <span className="text-xs font-black text-white drop-shadow">
                          {comingSoon
                            ? activeMedia.trailerUrl
                              ? t('مشاهدة الإعلان الدعائي', 'Watch Trailer')
                              : t('قريباً على MASHHAD', 'Coming Soon on MASHHAD')
                            : t('مشاهدة الآن', 'Watch Now')}
                        </span>
                      </div>
                    </button>
                  )
                )}

                {activeBottomTab === 'related' && (
                  filteredRelated.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2.5">
                      {filteredRelated.map((rel) => {
                        const relTitle = getMediaTitle(rel);
                        const relPoster = rel.posterUrl || rel.bannerUrl;
                        return (
                          <button
                            key={rel.id}
                            type="button"
                            onClick={() => onSelectMedia?.(rel)}
                            className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 transition-colors cursor-pointer group text-start"
                          >
                            {relPoster ? (
                              <img
                                src={relPoster}
                                alt={relTitle}
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <Film className="w-5 h-5" />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 pt-6 pb-1.5 px-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                              <p className="text-[10.5px] font-black text-white truncate">
                                {relTitle}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-zinc-400 text-center py-6">
                      {t('لا توجد أعمال مشابهة حالياً', 'No related titles available right now')}
                    </p>
                  )
                )}

                {activeBottomTab === 'comments' && (
                  <div className="space-y-3">
                    <form onSubmit={handlePostComment} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={t('اكتب تعليقك هنا...', 'Write your comment...')}
                        maxLength={500}
                        className="flex-1 h-10 px-3.5 rounded-xl bg-[#17121f] border border-white/[0.08] focus:border-[#ea1d24]/70 focus:outline-none text-xs font-medium text-white placeholder:text-zinc-500"
                      />
                      <button
                        type="submit"
                        disabled={!commentText.trim() || submittingComment}
                        aria-label={t('إرسال التعليق', 'Send comment')}
                        className="w-10 h-10 rounded-xl bg-[#ea1d24] hover:bg-[#ff2b32] disabled:opacity-45 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>

                    {loadingComments ? (
                      <p className="text-xs font-bold text-zinc-500 text-center py-4">
                        {t('جاري تحميل التعليقات...', 'Loading comments...')}
                      </p>
                    ) : comments.length === 0 ? (
                      <div className="py-6 flex flex-col items-center justify-center text-center gap-1.5">
                        <MessageSquare className="w-6 h-6 text-zinc-600" />
                        <p className="text-xs font-bold text-zinc-400">
                          {t('لا توجد تعليقات بعد، كن أول من يعلق!', 'No comments yet. Be the first!')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-56 overflow-y-auto no-scrollbar">
                        {comments.map((cmt) => (
                          <div
                            key={cmt.id}
                            className="p-3 rounded-xl bg-[#17121f] border border-white/[0.06] space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-white truncate">
                                {cmt.userName || t('مشاهد', 'Viewer')}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-500 shrink-0">
                                {formatCommentTime(cmt.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed">{cmt.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
