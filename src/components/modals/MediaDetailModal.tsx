import React, { useEffect, useState } from 'react';
import {
  Play,
  Star,
  Heart,
  X,
  Film,
  EyeOff,
  Bell,
  BellRing,
  Clock,
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
}) => {
  const { lang, dir, t, getMediaTitle, translateGenre } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
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

  const ageBadge = (media.ageRating || '+16').trim();
  const backdropSrc = media.bannerUrl || media.posterUrl;
  const playable = hasPlayableMediaVideo(media);
  const comingSoon = isMediaComingSoon(media);
  const effectiveRating = getEffectiveMediaRating(media);

  const BackIcon = dir === 'ltr' ? ChevronLeft : ChevronRight;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto select-none animate-fade-in"
    >
      <div
        className={`bg-[#101116] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl relative animate-slide-up ${
          dir === 'ltr' ? 'text-left' : 'text-right'
        }`}
      >
        {/* Backdrop Header Matching Video Detail Screen */}
        <div className="relative w-full h-60 sm:h-72 bg-zinc-950">
          {backdropSrc && !imgFailed ? (
            <img
              src={backdropSrc}
              alt={primaryTitle}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-[#14151c] to-zinc-950 text-zinc-500">
              <Film className="w-14 h-14 text-[#F7C600]/40 mb-2" />
              <span className="text-xs font-bold text-zinc-300 px-4 truncate max-w-full">
                {primaryTitle}
              </span>
            </div>
          )}

          {/* Soft cinematic fade into dark canvas */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#101116] via-[#101116]/35 to-black/30" />

          {/* Floating Back & Close Buttons */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('رجوع', 'Back')}
            className={`absolute top-4 ${
              dir === 'ltr' ? 'left-4' : 'right-4'
            } w-9 h-9 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-all z-10 cursor-pointer`}
          >
            <BackIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('إغلاق', 'Close')}
            className={`absolute top-4 ${
              dir === 'ltr' ? 'right-4' : 'left-4'
            } w-9 h-9 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-all z-10 cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Centered Frosted Play Orb Matching Video (00:07) */}
          {playable ? (
            <button
              type="button"
              onClick={() => onPlay(media)}
              aria-label={t('تشغيل', 'Play')}
              className="absolute left-1/2 bottom-6 -translate-x-1/2 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/25 hover:bg-[#F7C600] text-white hover:text-black backdrop-blur-md border border-white/35 hover:border-[#F7C600] flex items-center justify-center shadow-2xl transform hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
            >
              <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
            </button>
          ) : (
            <div className="absolute left-1/2 bottom-6 -translate-x-1/2 w-fit px-4 py-2 rounded-full bg-black/75 border border-[#F7C600]/45 backdrop-blur-md text-[#F7C600] flex items-center gap-2 shadow-xl z-10 whitespace-nowrap">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="text-xs font-black">
                {t('قريباً — بانتظار إضافة الفيديو', 'Coming Soon — Awaiting Video')}
              </span>
            </div>
          )}
        </div>

        {/* Content Details */}
        <div className="px-5 pb-6 pt-1 space-y-4 relative z-10">
          <div>
            {/* Subtle kicker (Year / Original Title) */}
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1 tabular-nums">
              {media.year && <span>{media.year}</span>}
              {media.videoQuality && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#F7C600] font-bold">
                    {formatQualityLabel(media.videoQuality)}
                  </span>
                </>
              )}
              {media.isPublished === false && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                    <EyeOff className="w-3 h-3" />
                    <span>{t('مخفي', 'Hidden')}</span>
                  </span>
                </>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {primaryTitle}
            </h2>
            {lang === 'ar' && media.title && media.title !== media.titleAr && (
              <p className="text-xs text-zinc-400 mt-0.5">{media.title}</p>
            )}
            {lang === 'en' && media.titleAr && media.titleAr !== media.title && (
              <p className="text-xs text-zinc-400 mt-0.5">{media.titleAr}</p>
            )}

            {/* Clean Metadata Row Matching Video (1h 41min · Fantasy · Movie · 16+) */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {media.duration && (
                <span className="px-2.5 py-1 rounded-lg bg-[#181920] border border-white/[0.06] text-[11px] font-semibold text-zinc-300 tabular-nums">
                  {media.duration}
                </span>
              )}
              {media.genres.slice(0, 2).map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 rounded-lg bg-[#181920] border border-white/[0.06] text-[11px] font-semibold text-zinc-300"
                >
                  {translateGenre(g)}
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-lg bg-[#181920] border border-white/[0.06] text-[11px] font-semibold text-zinc-300">
                {media.type === 'series'
                  ? t('مسلسل', 'Series')
                  : media.type === 'anime'
                  ? t('أنمي', 'Anime')
                  : t('فيلم', 'Movie')}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#181920] border border-white/[0.06] text-[11px] font-bold text-zinc-300 tabular-nums">
                {ageBadge}
              </span>
            </div>

            {/* Rating + Quick Actions Row Matching Video */}
            <div className="mt-4 flex items-center justify-between gap-3 py-2.5 border-y border-white/[0.06]">
              <div className="flex items-center gap-1.5 tabular-nums">
                <Star className="w-5 h-5 fill-[#F7C600] text-[#F7C600]" />
                <span className="text-lg font-black text-white">
                  {effectiveRating.toFixed(1)}
                </span>
                <span className="text-xs text-zinc-500 font-medium">/10</span>
              </div>

              <div className="flex items-center gap-2">
                {onToggleAlert && (
                  <button
                    type="button"
                    onClick={onToggleAlert}
                    aria-label={t('تنبيهي عند الإضافة', 'Notify me when added')}
                    className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isAlertSubscribed
                        ? 'bg-[#F7C600]/15 border-[#F7C600]/40 text-[#F7C600]'
                        : 'bg-[#181920] border-white/[0.08] text-zinc-300 hover:text-white'
                    }`}
                  >
                    {isAlertSubscribed ? (
                      <BellRing className="w-3.5 h-3.5" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isAlertSubscribed ? t('مفعل', 'Alert On') : t('تنبيه', 'Notify')}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onToggleFavorite}
                  aria-label={t('المفضلة', 'Favorite')}
                  className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isFavorite
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                      : 'bg-[#181920] border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                  <span>{isFavorite ? t('بالمفضلة', 'Saved') : t('مفضلة', 'Save')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Primary Play / Notify Action */}
          <div className="space-y-2">
            {comingSoon ? (
              onToggleAlert && (
                <button
                  type="button"
                  onClick={onToggleAlert}
                  className={`w-full py-3.5 font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    isAlertSubscribed
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/45'
                      : 'bg-[#F7C600] hover:bg-[#ffd426] text-black shadow-lg shadow-[#F7C600]/20'
                  }`}
                >
                  {isAlertSubscribed ? (
                    <>
                      <BellRing className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          'تم تفعيل التنبيه ✓ — سيصلك إشعار فور الإضافة',
                          'Alert Enabled ✓ — You will be notified upon release'
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
                className="w-full py-3.5 bg-[#F7C600] hover:bg-[#ffd426] text-black font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#F7C600]/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>
                  {progress && progress.currentTime > 5
                    ? t('متابعة المشاهدة', 'Resume Watching')
                    : media.type === 'series'
                    ? t('مشاهدة المسلسل الآن', 'Watch Series Now')
                    : t('مشاهدة الفيلم الآن', 'Watch Movie Now')}
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

          {/* Synopsis */}
          <div>
            <h4 className="text-sm font-black text-white mb-1.5">
              {t('القصة', 'Synopsis')}
            </h4>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {media.description ||
                t(
                  'عمل مميز متاح للمشاهدة بجودة عالية على منصة GoldenFlix.',
                  'A premium release available to stream on GoldenFlix.'
                )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
