import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Star,
  Bookmark,
  Film,
  EyeOff,
  Bell,
  BellRing,
  ArrowLeft,
  ArrowRight,
  User,
  ThumbsUp,
  Share2,
  Check,
  Tv,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { MediaItem } from '../../types';
import { getMediaProgress } from '../../services/storage';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatQualityLabel } from '../../utils/quality';
import { isMediaComingSoon } from '../../services/releaseAlertService';
import { getEffectiveMediaRating } from '../../utils/rating';

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
}

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
}) => {
  const { lang, dir, t, getMediaTitle, translateGenre } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [sharedOk, setSharedOk] = useState(false);
  const [likedLocal, setLikedLocal] = useState(false);
  const [showAllRelated, setShowAllRelated] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setStoryExpanded(false);
    setSharedOk(false);
    setLikedLocal(false);
    setShowAllRelated(false);
  }, [media?.id]);

  useEffect(() => {
    if (!isOpen || !media?.videoUrl || !media.videoUrl.startsWith('/uploads/videos/')) return;
    const controller = new AbortController();
    fetch(media.videoUrl, {
      headers: { Range: 'bytes=0-262143' },
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [isOpen, media?.videoUrl]);

  if (!isOpen || !media) return null;

  const progress = getMediaProgress(media.id);
  const primaryTitle = getMediaTitle(media);
  const secondaryTitle =
    lang === 'ar' && media.title && media.title !== media.titleAr
      ? media.title
      : lang === 'en' && media.titleAr && media.titleAr !== media.title
      ? media.titleAr
      : '';

  const backdropSrc = media.bannerUrl || media.posterUrl;
  const comingSoon = isMediaComingSoon(media);
  const effectiveRating = getEffectiveMediaRating(media);
  const qualityLabel = media.videoQuality
    ? formatQualityLabel(media.videoQuality).toUpperCase()
    : 'HD';

  const genresTranslated =
    Array.isArray(media.genres) && media.genres.length > 0
      ? media.genres
          .filter((g) => typeof g === 'string' && g.trim())
          .map((g) => translateGenre(String(g)))
      : [
          media.type === 'series'
            ? t('مسلسل', 'Series')
            : media.type === 'anime'
            ? t('أنمي', 'Anime')
            : t('فيلم', 'Movie'),
        ];

  const genresSlash = genresTranslated.slice(0, 2).join('/');
  const genresComma = genresTranslated.join(', ');

  const synopsisText =
    media.description?.trim() ||
    t(
      'عمل مميز متاح للمشاهدة بجودة عالية على منصة MASHHAD.',
      'A featured title ready to stream in high quality on MASHHAD.'
    );
  const isLongStory = synopsisText.length > 155;

  const castList = Array.isArray(media.cast)
    ? media.cast.map((c) => String(c).trim()).filter(Boolean)
    : [];

  const allEpisodes = Array.isArray(media.seasons)
    ? media.seasons.flatMap((s) =>
        (s.episodes || []).map((ep) => ({ ...ep, seasonNumber: s.seasonNumber }))
      )
    : [];

  const filteredRelated = (relatedMedia || [])
    .filter((item) => item.id !== media.id)
    .slice(0, showAllRelated ? 12 : 6);

  const BackIcon = dir === 'ltr' ? ArrowLeft : ArrowRight;

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

  const durationText =
    media.duration ||
    (allEpisodes.length > 0
      ? t(`${allEpisodes.length} حلقة`, `${allEpisodes.length} Eps`)
      : '');

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
          {/* 1. Tall Edge-to-Edge Hero Backdrop Fading Smoothly into #0f0c14 */}
          <div className="relative w-full h-80 sm:h-96 shrink-0 bg-[#17121f] overflow-hidden">
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

            {/* Smooth Bottom Fade into #0f0c14 */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c14] via-[#0f0c14]/35 to-black/25 pointer-events-none" />

            {/* Single Circular Back Button Matching Screen 2 */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('رجوع', 'Back')}
              className={`absolute top-4 ${
                dir === 'ltr' ? 'left-4' : 'right-4'
              } w-9 h-9 rounded-full bg-white/25 hover:bg-white/35 text-white flex items-center justify-center transition-colors z-20 cursor-pointer`}
            >
              <BackIcon className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          </div>

          {/* 2. Main Editorial Body */}
          <div className="relative -mt-12 px-5 pb-4 space-y-3.5 z-10 flex-1">
            {/* Title */}
            <div className="space-y-0.5">
              <h2 className="text-2xl sm:text-[26px] font-black text-white tracking-tight leading-snug">
                {primaryTitle}
              </h2>
              {secondaryTitle && (
                <p className="text-xs font-bold text-zinc-400">{secondaryTitle}</p>
              )}
            </div>

            {/* Metadata Line: [Age/Quality Badge] Year, Genres, Duration */}
            <div className="flex items-center flex-wrap gap-2 text-xs font-medium text-zinc-300 tabular-nums">
              <span className="px-2 py-0.5 rounded-md border border-white/30 bg-[#17121f]/90 text-[10px] font-black text-zinc-100 tracking-wide leading-tight">
                {media.ageRating || qualityLabel}
              </span>
              <span>
                {[media.year || '', genresSlash, durationText]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>

            {/* Inline Ratings & Quality Row */}
            <div className="flex items-center flex-wrap gap-3 text-xs font-black tabular-nums">
              <span className="inline-flex items-center gap-1.5 text-white">
                <Star className="w-3.5 h-3.5 fill-[#ea1d24] text-[#ea1d24]" />
                <span>{effectiveRating.toFixed(1)}</span>
              </span>

              <span className="px-2 py-0.5 rounded bg-[#ea1d24] text-[10px] font-black text-white tracking-wide">
                {qualityLabel}
              </span>

              {media.isPublished === false && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t('مخفي', 'Hidden')}</span>
                </span>
              )}
            </div>

            {/* 3-Button Dark Action Row Matching Reference Screen 2 */}
            <div className="grid grid-cols-3 gap-2.5 pt-0.5">
              {comingSoon && onToggleAlert ? (
                <button
                  type="button"
                  onClick={onToggleAlert}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    isAlertSubscribed
                      ? 'bg-[#ea1d24]/15 border-[#ea1d24]/50 text-white'
                      : 'bg-[#17121f] hover:bg-[#1f182a] border-white/[0.08] text-zinc-200'
                  }`}
                >
                  {isAlertSubscribed ? (
                    <BellRing className="w-4 h-4 text-[#ea1d24] shrink-0" />
                  ) : (
                    <Bell className="w-4 h-4 text-[#ea1d24] shrink-0" />
                  )}
                  <span className="truncate">
                    {isAlertSubscribed ? t('مفعل', 'Notified') : t('تنبيه', 'Notify')}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLikedLocal((v) => !v)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    likedLocal
                      ? 'bg-[#ea1d24]/15 border-[#ea1d24]/50 text-white'
                      : 'bg-[#17121f] hover:bg-[#1f182a] border-white/[0.08] text-zinc-200'
                  }`}
                >
                  <ThumbsUp
                    className={`w-4 h-4 shrink-0 ${
                      likedLocal ? 'fill-[#ea1d24] text-[#ea1d24]' : 'text-zinc-300'
                    }`}
                  />
                  <span className="truncate">{t('إعجاب', 'Like')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleFavorite}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  isFavorite
                    ? 'bg-[#ea1d24]/15 border-[#ea1d24]/50 text-white'
                    : 'bg-[#17121f] hover:bg-[#1f182a] border-white/[0.08] text-zinc-200'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 shrink-0 ${
                    isFavorite ? 'fill-[#ea1d24] text-[#ea1d24]' : 'text-zinc-300'
                  }`}
                />
                <span className="truncate">
                  {isFavorite ? t('بالمفضلة', 'Saved') : t('المفضلة', 'Watchlist')}
                </span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#17121f] hover:bg-[#1f182a] border border-white/[0.08] text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
              >
                {sharedOk ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Share2 className="w-4 h-4 text-zinc-300 shrink-0" />
                )}
                <span className="truncate">
                  {sharedOk ? t('تم النسخ', 'Copied') : t('مشاركة', 'Share')}
                </span>
              </button>
            </div>

            {/* Clean Synopsis Paragraph */}
            <p className="text-xs sm:text-[13px] text-zinc-300 font-medium leading-relaxed pt-0.5">
              {isLongStory && !storyExpanded
                ? `${synopsisText.slice(0, 152)}...`
                : synopsisText}
              {isLongStory && (
                <button
                  type="button"
                  onClick={() => setStoryExpanded((prev) => !prev)}
                  className="text-[#ea1d24] hover:underline font-black cursor-pointer inline ms-1"
                >
                  {storyExpanded ? t('عرض أقل', 'Show Less') : t('المزيد', 'Read More')}
                </button>
              )}
            </p>

            {/* Aligned Credits Key-Value List Matching Screen 2 */}
            <div className="space-y-1.5 pt-1 text-xs">
              {media.director && (
                <div className="grid grid-cols-[84px_12px_1fr] items-baseline">
                  <span className="text-zinc-400 font-bold">{t('المخرج', 'Director')}</span>
                  <span className="text-zinc-400 font-bold text-center">:</span>
                  <span className="text-zinc-100 font-bold truncate">{media.director}</span>
                </div>
              )}
              <div className="grid grid-cols-[84px_12px_1fr] items-baseline">
                <span className="text-zinc-400 font-bold">{t('التصنيف', 'Genres')}</span>
                <span className="text-zinc-400 font-bold text-center">:</span>
                <span className="text-zinc-100 font-bold">{genresComma}</span>
              </div>
              {media.year && (
                <div className="grid grid-cols-[84px_12px_1fr] items-baseline">
                  <span className="text-zinc-400 font-bold">{t('سنة الإنتاج', 'Release')}</span>
                  <span className="text-zinc-400 font-bold text-center">:</span>
                  <span className="text-zinc-100 font-bold tabular-nums">{media.year}</span>
                </div>
              )}
              <div className="grid grid-cols-[84px_12px_1fr] items-baseline">
                <span className="text-zinc-400 font-bold">{t('الجودة', 'Quality')}</span>
                <span className="text-zinc-400 font-bold text-center">:</span>
                <span className="text-zinc-100 font-bold">{qualityLabel}</span>
              </div>
              {allEpisodes.length > 0 && (
                <div className="grid grid-cols-[84px_12px_1fr] items-baseline">
                  <span className="text-zinc-400 font-bold">{t('الحلقات', 'Episodes')}</span>
                  <span className="text-zinc-400 font-bold text-center">:</span>
                  <span className="text-zinc-100 font-bold tabular-nums">{allEpisodes.length}</span>
                </div>
              )}
            </div>

            {/* Cast Row */}
            {castList.length > 0 && (
              <div className="space-y-2 pt-1">
                <h4 className="text-sm font-black text-white">
                  {t('طاقم العمل', 'Cast')}
                </h4>
                <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
                  {castList.map((actor, idx) => (
                    <div
                      key={`${actor}-${idx}`}
                      className="w-24 shrink-0 rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.08] p-2 flex flex-col items-center text-center gap-1.5"
                    >
                      <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400">
                        <User className="w-5 h-5" />
                      </div>
                      <span className="text-[10.5px] font-black text-zinc-200 line-clamp-2 leading-tight">
                        {actor}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Series Episodes Row */}
            {allEpisodes.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <h4 className="text-sm font-black text-white">
                  {t('الحلقات', 'Episodes')} ({allEpisodes.length})
                </h4>
                <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
                  {allEpisodes.slice(0, 12).map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => onPlay(media)}
                      className="w-36 shrink-0 rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 transition-colors text-start cursor-pointer group"
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
                  ))}
                </div>
              </div>
            )}

            {/* Related Works */}
            {filteredRelated.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-white">
                    {t('أعمال مشابهة', 'Related')}
                  </h4>
                  {relatedMedia.filter((i) => i.id !== media.id).length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllRelated((v) => !v)}
                      className="inline-flex items-center gap-0.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>{showAllRelated ? t('أقل', 'Less') : t('عرض الكل', 'View All')}</span>
                      {dir === 'ltr' ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronLeft className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

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
                          <p className="text-[10.5px] font-black text-white truncate">{relTitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Admin Delete Button */}
            {onDeleteMovie && (
              <button
                type="button"
                onClick={() => {
                  onDeleteMovie(media);
                  onClose();
                }}
                className="w-full py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('حذف هذا الفيديو نهائياً', 'Permanently Delete Video')}</span>
              </button>
            )}
          </div>

          {/* 3. Sticky Bottom Full-Width Pill CTA Button Matching Screen 2 */}
          <div className="sticky bottom-0 z-20 px-5 pt-4 pb-5 bg-gradient-to-t from-[#0f0c14] via-[#0f0c14]/95 to-transparent">
            {comingSoon ? (
              onToggleAlert && (
                <button
                  type="button"
                  onClick={onToggleAlert}
                  className={`w-full p-2 rounded-full font-black text-sm flex items-center justify-between transition-transform active:scale-[0.98] cursor-pointer ${
                    isAlertSubscribed
                      ? 'bg-[#17121f] text-white border border-[#ea1d24]/60 shadow-[0_10px_28px_rgba(0,0,0,0.6)]'
                      : 'bg-[#ea1d24] hover:bg-[#ff2b32] text-white shadow-[0_12px_32px_rgba(234,29,36,0.45)]'
                  }`}
                >
                  <span className="w-10 h-10 rounded-full bg-black/25 border border-white/25 flex items-center justify-center shrink-0">
                    {isAlertSubscribed ? (
                      <BellRing className="w-4 h-4 text-[#ea1d24]" />
                    ) : (
                      <Bell className="w-4 h-4 text-white" />
                    )}
                  </span>
                  <span className="px-2 truncate">
                    {isAlertSubscribed
                      ? t('تم تفعيل التنبيه', 'Alert Enabled')
                      : t('تنبيهي عند الإضافة', 'Notify Me When Added')}
                  </span>
                  <span className="w-10 shrink-0" />
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onPlay(media)}
                className="w-full p-2 rounded-full bg-[#ea1d24] hover:bg-[#ff2b32] text-white font-black text-sm flex items-center justify-between shadow-[0_12px_32px_rgba(234,29,36,0.45)] transition-transform active:scale-[0.98] cursor-pointer"
              >
                <span className="w-10 h-10 rounded-full bg-black/25 border border-white/25 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </span>
                <span className="px-2">
                  {progress && progress.currentTime > 5
                    ? t('متابعة المشاهدة', 'Resume Watching')
                    : t('شاهد الآن', 'Watch Now')}
                </span>
                <span className="w-10 shrink-0" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
