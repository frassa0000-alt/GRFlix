import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Star, Heart, EyeOff, Bell, BellRing, Clock } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatQualityLabel } from '../../utils/quality';
import { hasPlayableMediaVideo } from '../../services/releaseAlertService';
import { getMediaProgress } from '../../services/storage';
import { getEffectiveMediaRating } from '../../utils/rating';

export interface MediaCardProps {
  media?: MediaItem;
  item?: MediaItem;
  onClick?: () => void;
  onSelect?: (item: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (id?: string) => void;
  isAlertSubscribed?: boolean;
  onToggleAlert?: (id?: string) => void;
  watchProgress?: number | WatchProgress;
  variant?: 'poster' | 'landscape';
  inGrid?: boolean;
  index?: number;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  item,
  onClick,
  onSelect,
  isFavorite,
  onToggleFavorite,
  isAlertSubscribed = false,
  onToggleAlert,
  watchProgress,
  variant = 'poster',
  inGrid = false,
  index = 0,
}) => {
  const { dir, t, getMediaTitle, translateGenre } = useLanguage();
  const currentItem = media || item;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!currentItem) return null;

  const handleClick = () => {
    if (onClick) onClick();
    if (onSelect) onSelect(currentItem);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(currentItem.id);
  };

  const handleAlertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleAlert) {
      onToggleAlert(currentItem.id);
    }
  };

  const isLandscape = variant === 'landscape';
  const displayImage = isLandscape
    ? currentItem.bannerUrl || currentItem.posterUrl
    : currentItem.posterUrl || currentItem.bannerUrl;

  const displayTitle = getMediaTitle(currentItem);
  const isHiddenItem = currentItem.isPublished === false;
  const isComingSoonItem = !hasPlayableMediaVideo(currentItem);

  const resolvedProgress =
    typeof watchProgress === 'number'
      ? undefined
      : watchProgress || getMediaProgress(currentItem.id);

  const watchedPercent =
    typeof watchProgress === 'number'
      ? Math.max(0, Math.min(100, Math.round(watchProgress)))
      : resolvedProgress
      ? resolvedProgress.percentage > 0
        ? Math.min(100, Math.round(resolvedProgress.percentage))
        : resolvedProgress.duration > 0 && resolvedProgress.currentTime > 2
        ? Math.max(
            1,
            Math.min(100, Math.round((resolvedProgress.currentTime / resolvedProgress.duration) * 100))
          )
        : 0
      : 0;

  const categoryName =
    currentItem.genres && currentItem.genres.length > 0 && typeof currentItem.genres[0] === 'string'
      ? translateGenre(currentItem.genres[0])
      : currentItem.type === 'movie'
      ? t('فيلم', 'Movie')
      : currentItem.type === 'series'
      ? t('مسلسل', 'Series')
      : t('أنمي', 'Anime');

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.18), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.985 }}
      onClick={handleClick}
      className={`group relative flex flex-col flex-shrink-0 cursor-pointer rounded-2xl overflow-hidden bg-[#101016] border transition-colors duration-300 shadow-[0_12px_30px_rgba(0,0,0,0.65)] hover:shadow-[0_22px_45px_rgba(0,0,0,0.85),0_0_0_1px_rgba(251,191,36,0.45)] ${
        isHiddenItem
          ? 'border-amber-500/45 opacity-95'
          : 'border-white/[0.08] hover:border-amber-400/60'
      } ${
        inGrid
          ? 'w-full'
          : isLandscape
          ? 'w-[255px] sm:w-[295px] md:w-[320px]'
          : 'w-[146px] sm:w-[170px] md:w-[195px]'
      }`}
    >
      {/* Poster / Backdrop Frame */}
      <div
        className={`relative w-full overflow-hidden bg-zinc-950 ${
          isLandscape ? 'aspect-video' : 'aspect-[2/3]'
        }`}
      >
        {!imageLoaded && !imageError && displayImage && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            <Play className="w-7 h-7 text-amber-500/20" />
          </div>
        )}

        {imageError || !displayImage ? (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-[#121218] to-amber-950/30 flex flex-col items-center justify-center p-4 text-center">
            <Play className="w-8 h-8 text-amber-400/50 mb-1.5" />
            <span className="text-xs text-zinc-300 font-bold line-clamp-2">
              {displayTitle}
            </span>
          </div>
        ) : (
          <img
            src={displayImage}
            alt={displayTitle}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Diagonal Gold Light Sheen Sweep on Hover */}
        <div className="cinema-card-sheen pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent opacity-0" />

        {/* Cinematic Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] via-black/20 to-transparent opacity-90 group-hover:opacity-75 transition-opacity" />

        {/* Subtle Top Metadata Corners */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 z-10 pointer-events-none">
          <div className="flex items-center gap-1 flex-wrap">
            {currentItem.videoQuality ? (
              <span className="bg-amber-400 text-black font-black text-[10px] px-1.5 py-0.5 rounded-md shadow-sm uppercase">
                {formatQualityLabel(currentItem.videoQuality)}
              </span>
            ) : null}
            {isComingSoonItem && (
              <span className="inline-flex items-center gap-1 bg-amber-500/90 text-black font-black text-[10px] px-1.5 py-0.5 rounded-md shadow">
                <Clock className="w-2.5 h-2.5" />
                <span>{t('قريباً', 'Soon')}</span>
              </span>
            )}
            {isHiddenItem && (
              <span className="inline-flex items-center gap-1 bg-zinc-950/90 border border-amber-400/60 text-amber-300 font-black text-[10px] px-1.5 py-0.5 rounded-md shadow">
                <EyeOff className="w-2.5 h-2.5" />
                <span>{t('مخفي', 'Hidden')}</span>
              </span>
            )}
          </div>

          {(() => {
            const effectiveRating = getEffectiveMediaRating(currentItem);
            return (
              <div className="inline-flex items-center gap-1 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md text-amber-400 text-[11px] font-bold tabular-nums border border-white/10">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{effectiveRating.toFixed(1)}</span>
              </div>
            );
          })()}
        </div>

        {/* Notify Me When Added Button */}
        {onToggleAlert && (
          <button
            type="button"
            onClick={handleAlertClick}
            title={
              isAlertSubscribed
                ? t('إلغاء تنبيهي عند الإضافة', 'Disable release alert')
                : t('تنبيهي عند الإضافة', 'Notify me when added')
            }
            aria-label={
              isAlertSubscribed
                ? t('إلغاء تنبيهي عند الإضافة', 'Disable release alert')
                : t('تنبيهي عند الإضافة', 'Notify me when added')
            }
            className={`absolute bottom-2.5 ${
              dir === 'ltr' ? 'left-2.5' : 'right-2.5'
            } z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
              isAlertSubscribed
                ? 'bg-[#F7C600] text-black shadow-lg shadow-[#F7C600]/35'
                : 'bg-black/65 backdrop-blur-md text-white/85 hover:text-[#F7C600] border border-white/15'
            }`}
          >
            {isAlertSubscribed ? (
              <BellRing className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Favorite Button */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-label={
            isFavorite
              ? t('إزالة من المفضلة', 'Remove from favorites')
              : t('إضافة إلى المفضلة', 'Add to favorites')
          }
          className={`absolute bottom-2.5 ${
            dir === 'ltr' ? 'right-2.5' : 'left-2.5'
          } z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
            isFavorite
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/35'
              : 'bg-black/65 backdrop-blur-md text-white/85 hover:text-amber-300 border border-white/15'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Center Play Hover Orb with Halo Ring */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-250 pointer-events-none">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-14 h-14 rounded-full bg-amber-400/25 scale-75 group-hover:scale-115 opacity-0 group-hover:opacity-100 transition-all duration-500" />
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-black flex items-center justify-center shadow-[0_0_28px_rgba(251,191,36,0.55)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Information */}
      <div className={`p-3 flex-1 flex flex-col justify-between ${dir === 'ltr' ? 'text-left' : 'text-right'}`}>
        <div>
          <h3 className="font-black text-white text-xs sm:text-sm truncate group-hover:text-amber-400 transition-colors">
            {displayTitle}
          </h3>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1 truncate tabular-nums">
            <span className="truncate">{categoryName}</span>
            {currentItem.year ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{currentItem.year}</span>
              </>
            ) : null}
            {currentItem.duration ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{currentItem.duration}</span>
              </>
            ) : null}
          </div>
        </div>

        {watchedPercent > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] leading-none tabular-nums">
              <span className="text-zinc-400 font-medium">
                {watchedPercent >= 95
                  ? t('مكتمل', 'Completed')
                  : t('تمت المشاهدة', 'Watched')}
              </span>
              <span
                className={`font-black ${
                  watchedPercent >= 95 ? 'text-emerald-400' : 'text-[#F7C600]'
                }`}
              >
                {watchedPercent}%
              </span>
            </div>
            <div
              className="w-full h-1 rounded-full bg-white/10 overflow-hidden"
              role="progressbar"
              aria-valuenow={watchedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t(`تمت مشاهدة ${watchedPercent}%`, `${watchedPercent}% watched`)}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  watchedPercent >= 95
                    ? 'bg-emerald-400'
                    : 'bg-gradient-to-r from-amber-500 to-[#F7C600]'
                }`}
                style={{ width: `${watchedPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
};
