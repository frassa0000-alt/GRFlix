import React, { useEffect, useState } from 'react';
import { Play, Star, Heart, X, Film, AlertTriangle, ShieldAlert, ShieldCheck, EyeOff } from 'lucide-react';
import { MediaItem } from '../../types';
import { getMediaProgress } from '../../services/storage';
import { useLanguage } from '../../contexts/LanguageContext';

interface MediaDetailModalProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (media: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
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

  const getAgeRatingInfo = (rating?: string) => {
    const r = (rating || '+16').trim();
    if (r.includes('18')) {
      return {
        badge: '+18',
        label: t('للكبار فقط (18+)', 'Adults Only (18+)'),
        colorClass: 'text-rose-400 bg-rose-500/15 border-rose-500/35',
        icon: AlertTriangle,
      };
    }
    if (r.includes('16')) {
      return {
        badge: '+16',
        label: t('إرشاد عائلي (16+)', 'Parental Guidance (16+)'),
        colorClass: 'text-amber-400 bg-amber-500/15 border-amber-500/35',
        icon: ShieldAlert,
      };
    }
    if (r.includes('13')) {
      return {
        badge: '+13',
        label: t('مناسب لسن 13 فما فوق', 'Suitable for ages 13+'),
        colorClass: 'text-sky-400 bg-sky-500/15 border-sky-500/35',
        icon: ShieldAlert,
      };
    }
    return {
      badge: lang === 'en' ? 'G' : 'عام',
      label: t('مناسب لجميع الأعمار (G)', 'General Audiences (G)'),
      colorClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35',
      icon: ShieldCheck,
    };
  };

  const ageInfo = getAgeRatingInfo(media.ageRating);
  const AgeIcon = ageInfo.icon;
  const backdropSrc = media.bannerUrl || media.posterUrl;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto select-none animate-fade-in"
    >
      <div
        className={`bg-[#121215] border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl relative animate-slide-up ${
          dir === 'ltr' ? 'text-left' : 'text-right'
        }`}
      >
        {/* Backdrop Header */}
        <div className="relative w-full h-52 sm:h-64 bg-zinc-950">
          {backdropSrc && !imgFailed ? (
            <img
              src={backdropSrc}
              alt={primaryTitle}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-[#14120c] to-amber-950/35 text-zinc-500">
              <Film className="w-14 h-14 text-amber-400/40 mb-2" />
              <span className="text-xs font-bold text-zinc-300 px-4 truncate max-w-full">{primaryTitle}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#121215] via-[#121215]/50 to-transparent" />

          <button
            onClick={onClose}
            aria-label={t('إغلاق', 'Close')}
            className={`absolute top-4 ${
              dir === 'ltr' ? 'right-4' : 'left-4'
            } w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md transition-all z-10 cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleFavorite}
            aria-label={t('المفضلة', 'Favorite')}
            className={`absolute top-4 ${
              dir === 'ltr' ? 'left-4' : 'right-4'
            } w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md transition-all z-10 cursor-pointer`}
          >
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`}
            />
          </button>

          <button
            onClick={() => onPlay(media)}
            aria-label={t('تشغيل', 'Play')}
            className="absolute inset-0 m-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#facc15] hover:bg-[#eab308] text-black flex items-center justify-center shadow-2xl shadow-amber-500/40 transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-0.5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="p-4 sm:p-6 space-y-4 -mt-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {media.videoQuality || '1080p Full HD'}
              </span>

              {media.isPublished === false && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-400/50 bg-zinc-900 text-amber-300 text-[10px] sm:text-[11px] font-black">
                  <EyeOff className="w-3 h-3" />
                  <span>{t('ملف مخفي عن الزوار', 'Hidden from Visitors')}</span>
                </span>
              )}

              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-black shadow-xs ${ageInfo.colorClass}`}
                title={ageInfo.label}
              >
                <AgeIcon className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span>
                  {t(`تصنيف العمر: ${ageInfo.badge}`, `Rated: ${ageInfo.badge}`)}
                </span>
              </div>

              <span className="text-xs text-zinc-400 font-mono">{media.year}</span>
              {media.duration && (
                <span className="text-xs text-zinc-400 font-mono">· {media.duration}</span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight">
              {primaryTitle}
            </h2>
            {lang === 'ar' && media.title && media.title !== media.titleAr && (
              <p className="text-xs text-zinc-400 font-sans mt-0.5">{media.title}</p>
            )}
            {lang === 'en' && media.titleAr && media.titleAr !== media.title && (
              <p className="text-xs text-zinc-400 font-sans mt-0.5">{media.titleAr}</p>
            )}

            {/* Rating Stars & Genres */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold text-sm font-mono">{media.rating.toFixed(1)}</span>
                <span className="text-xs text-zinc-500 font-mono">/ 10</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {media.genres.map((g) => (
                  <span
                    key={g}
                    className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
                  >
                    {translateGenre(g)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="space-y-2">
            <button
              onClick={() => onPlay(media)}
              className="w-full py-3.5 bg-[#facc15] hover:bg-[#eab308] text-black font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
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

            {onDeleteMovie && (
              <button
                type="button"
                onClick={() => {
                  onDeleteMovie(media);
                  onClose();
                }}
                className="w-full py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <span>{t('حذف هذا الفيديو نهائياً', 'Permanently Delete Video')}</span>
              </button>
            )}
          </div>

          {/* Story Synopsis */}
          <div>
            <h4 className="text-xs font-bold text-zinc-300 mb-1">
              {t('قصة العمل:', 'Storyline:')}
            </h4>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {media.description ||
                t(
                  'عمل سينمائي مميز متاح للمشاهدة بجودة عالية على منصة GoldenFlix Cinema.',
                  'A premium cinema release available to stream in high quality on GoldenFlix Cinema.'
                )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
