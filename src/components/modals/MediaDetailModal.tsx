import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Star,
  Bookmark,
  X,
  Film,
  EyeOff,
  Bell,
  BellRing,
  Clock,
  ArrowLeft,
  ArrowRight,
  User,
  ThumbsUp,
  Share2,
  Check,
  Tv,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MediaItem } from '../../types';
import { getMediaProgress } from '../../services/storage';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatQualityLabel } from '../../utils/quality';
import { hasPlayableMediaVideo, isMediaComingSoon } from '../../services/releaseAlertService';
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

  const firstGenre =
    media.genres && media.genres.length > 0 && typeof media.genres[0] === 'string'
      ? translateGenre(media.genres[0])
      : media.type === 'series'
      ? t('مسلسل', 'Series')
      : media.type === 'anime'
      ? t('أنمي', 'Anime')
      : t('فيلم', 'Movie');

  const synopsisText =
    media.description?.trim() ||
    t(
      'عمل مميز متاح للمشاهدة بجودة عالية على منصة MASHHAD.',
      'A featured title ready to stream in high quality on MASHHAD.'
    );
  const isLongStory = synopsisText.length > 135;

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

  return (
    <AnimatePresence>
      <div
        dir={dir}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto select-none"
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-[#0f0c14] border border-white/[0.08] rounded-t-[28px] sm:rounded-[28px] w-full max-w-lg max-h-[94vh] overflow-y-auto no-scrollbar shadow-[0_30px_80px_rgba(0,0,0,0.95)] relative ${
            dir === 'ltr' ? 'text-left' : 'text-right'
          }`}
        >
          {/* Full-Bleed Backdrop Fading Seamlessly into #0f0c14 */}
          <div className="relative w-full h-64 sm:h-72 bg-[#16121d] overflow-hidden">
            {backdropSrc && !imgFailed ? (
              <img
                src={backdropSrc}
                alt={primaryTitle}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1d1726] via-[#130f1a] to-[#0f0c14] text-zinc-500">
                <Film className="w-14 h-14 text-[#ea1d24]/55 mb-2" />
                <span className="text-xs font-bold text-zinc-300 px-4 truncate max-w-full">
                  {primaryTitle}
                </span>
              </div>
            )}

            {/* Seamless Bottom Fade into #0f0c14 */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c14] via-[#0f0c14]/35 to-black/35" />

            {/* Top-Start Frosted Back Arrow Button Matching Reference Screen 2 */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('رجوع', 'Back')}
              className={`absolute top-4 ${
                dir === 'ltr' ? 'left-4' : 'right-4'
              } w-9 h-9 rounded-full bg-white/25 hover:bg-white/35 text-white flex items-center justify-center backdrop-blur-md transition-all z-20 cursor-pointer`}
            >
              <BackIcon className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>

            {/* Subtle Top-End Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('إغلاق', 'Close')}
              className={`absolute top-4 ${
                dir === 'ltr' ? 'right-4' : 'left-4'
              } w-9 h-9 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all z-20 cursor-pointer`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seamless Start-Aligned Content Block Matching Reference Screen 2 */}
          <div className="relative -mt-6 px-5 pb-7 space-y-4 z-10">
            {/* Title + Inline Outlined Quality Pill */}
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-[24px] font-black text-white tracking-tight leading-snug">
                  {primaryTitle}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full border border-white/30 bg-white/[0.06] text-[10px] font-bold text-zinc-200 tracking-wide leading-tight">
                  {qualityLabel}
                </span>
              </div>
              {secondaryTitle && (
                <p className="text-xs font-bold text-zinc-400">{secondaryTitle}</p>
              )}
            </div>

            {/* Single-Line Metadata Row: Year > Genre | Duration | Rating */}
            <div className="flex items-center flex-wrap gap-2 text-[11.5px] font-bold text-zinc-300 tabular-nums">
              {media.year && <span>{media.year}</span>}
              <Play className={`w-2.5 h-2.5 fill-white text-white ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              <span>{firstGenre}</span>
              <span className="text-zinc-600">|</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {media.duration ||
                    (media.type === 'series'
                      ? t(`${allEpisodes.length || 1} حلقات`, `${allEpisodes.length || 1} Eps`)
                      : t('جودة عالية', 'Full HD'))}
                </span>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="inline-flex items-center gap-1 text-white font-black">
                <Star className="w-3.5 h-3.5 fill-white text-white" />
                <span>
                  {effectiveRating.toFixed(1)} {t('تقييم', 'Ratings')}
                </span>
              </span>
              {media.isPublished === false && (
                <>
                  <span className="text-zinc-600">|</span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <EyeOff className="w-3 h-3" />
                    <span>{t('مخفي', 'Hidden')}</span>
                  </span>
                </>
              )}
            </div>

            {/* Full-Width Vibrant Cinema Red Primary CTA Button */}
            <div className="space-y-2 pt-0.5">
              {comingSoon ? (
                onToggleAlert && (
                  <button
                    type="button"
                    onClick={onToggleAlert}
                    className={`w-full py-3.5 font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                      isAlertSubscribed
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/45'
                        : 'bg-[#ea1d24] hover:bg-[#ff2b32] text-white shadow-[0_10px_28px_rgba(234,29,36,0.38)]'
                    }`}
                  >
                    {isAlertSubscribed ? (
                      <>
                        <BellRing className="w-4 h-4 shrink-0" />
                        <span>
                          {t(
                            'تم تفعيل التنبيه — سيصلك إشعار فور الإضافة',
                            'Alert Enabled — Notified Upon Release'
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 shrink-0" />
                        <span>{t('تنبيهي عند الإضافة', 'Notify Me When Added')}</span>
                      </>
                    )}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => onPlay(media)}
                  className="w-full py-3.5 bg-[#ea1d24] hover:bg-[#ff2b32] text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(234,29,36,0.38)] transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>
                    {progress && progress.currentTime > 5
                      ? t('متابعة المشاهدة', 'Resume Watching')
                      : t('شاهد الآن', 'Play Free Now')}
                  </span>
                </button>
              )}

              {onDeleteMovie && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteMovie(media);
                    onClose();
                  }}
                  className="w-full py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span>{t('حذف هذا الفيديو نهائياً', 'Permanently Delete Video')}</span>
                </button>
              )}
            </div>

            {/* Synopsis Paragraph with Inline White Bold "...المزيد" Toggle */}
            <p className="text-xs sm:text-[13px] text-zinc-400 font-bold leading-relaxed pt-0.5">
              {isLongStory && !storyExpanded
                ? `${synopsisText.slice(0, 134)}...`
                : synopsisText}
              {isLongStory && (
                <button
                  type="button"
                  onClick={() => setStoryExpanded((prev) => !prev)}
                  className="text-white hover:underline font-black cursor-pointer inline ms-1"
                >
                  {storyExpanded ? t('عرض أقل', 'Show Less') : t('المزيد', 'Read More')}
                </button>
              )}
            </p>

            {/* 3-Column Hairline-Divided Action Bar (Like | Share/Alert | Save) Matching Screen 2 */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.14] rtl:divide-x-reverse py-2 border-y border-white/[0.06]">
              <button
                type="button"
                onClick={() => setLikedLocal((v) => !v)}
                className={`flex items-center justify-center gap-2 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  likedLocal ? 'text-[#ea1d24]' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${likedLocal ? 'fill-current' : ''}`} />
                <span>{t('إعجاب', 'Like')}</span>
              </button>

              {onToggleAlert && !comingSoon ? (
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-1.5 text-xs font-bold text-zinc-200 hover:text-white transition-colors cursor-pointer"
                >
                  {sharedOk ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span>{sharedOk ? t('تم النسخ', 'Copied') : t('مشاركة', 'Share')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-1.5 text-xs font-bold text-zinc-200 hover:text-white transition-colors cursor-pointer"
                >
                  {sharedOk ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span>{sharedOk ? t('تم النسخ', 'Copied') : t('مشاركة', 'Share')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleFavorite}
                className={`flex items-center justify-center gap-2 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  isFavorite ? 'text-[#ea1d24]' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                <span>{isFavorite ? t('محفوظ', 'Saved') : t('حفظ', 'Save')}</span>
              </button>
            </div>

            {/* Series Episodes Row (if series has episodes) */}
            {allEpisodes.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white">
                    {t('الحلقات', 'Episodes')} ({allEpisodes.length})
                  </h4>
                </div>
                <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
                  {allEpisodes.slice(0, 12).map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => onPlay(media)}
                      className="w-36 shrink-0 rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 transition-all text-start cursor-pointer group"
                    >
                      <div className="relative aspect-video bg-zinc-900">
                        {ep.thumbnailUrl || backdropSrc ? (
                          <img
                            src={ep.thumbnailUrl || backdropSrc}
                            alt={ep.title}
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

            {/* Real Catalog Related Titles Strip Matching Screen 2 Bottom 3-Column Posters */}
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
                        className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 transition-all cursor-pointer group text-start"
                      >
                        {relPoster ? (
                          <img
                            src={relPoster}
                            alt={relTitle}
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

            {/* Cast Row (when provided) */}
            {castList.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <h4 className="text-sm font-black text-white">
                  {t('طاقم العمل', 'Cast')}
                </h4>
                <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
                  {castList.map((actor, idx) => (
                    <div
                      key={`${actor}-${idx}`}
                      className="w-24 shrink-0 rounded-xl overflow-hidden bg-[#17121f] border border-white/[0.08] p-2 flex flex-col items-center text-center gap-1.5"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400">
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
