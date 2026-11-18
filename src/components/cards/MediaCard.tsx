import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Star, Heart, EyeOff, Bell, BellRing, Clock } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
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
  variant?: 'poster' | 'landscape' | 'series_avatar';
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
  const effectiveRating = getEffectiveMediaRating(currentItem);

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.18), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`group relative flex flex-col flex-shrink-0 cursor-pointer select-none ${
        inGrid
          ? 'w-full'
          : isLandscape
          ? 'w-[240px] sm:w-[275px] md:w-[300px]'
          : 'w-[142px] sm:w-[164px] md:w-[184px]'
      }`}
    >
      {/* Clean Rounded Poster Artwork Frame Matching Video Reference */}
      <div
        className={`relative w-full overflow-hidden bg-[#13141a] rounded-[20px] transition-all duration-300 shadow-[0_14px_30px_rgba(0,0,0,0.7)] group-hover:shadow-[0_20px_42px_rgba(0,0,0,0.9)] ${
          isLandscape ? 'aspect-video' : 'aspect-[2/3]'
        } ${
          isHiddenItem
            ? 'ring-1 ring-amber-400/50 opacity-95'
            : 'ring-1 ring-white/[0.08] group-hover:ring-white/25'
        }`}
      >
        {!imageLoaded && !imageError && displayImage && (
          <div className="absolute inset-0 bg-[#16171f] flex items-center justify-center">
            <Play className="w-6 h-6 text-zinc-700" />
          </div>
        )}

        {imageError || !displayImage ? (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-[#14151c] to-zinc-950 flex flex-col items-center justify-center p-4 text-center">
            <Play className="w-7 h-7 text-[#F7C600]/60 mb-1.5" />
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
            className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Minimal Status Indicators Only When Coming Soon or Hidden */}
        {(isComingSoonItem || isHiddenItem) && (
          <div className="absolute top-2.5 inset-x-2.5 flex items-center gap-1 z-10 pointer-events-none">
            {isComingSoonItem && (
              <span className="inline-flex items-center gap-1 bg-black/70 backdrop-blur-md text-[#F7C600] font-bold text-[10px] px-2 py-0.5 rounded-full border border-[#F7C600]/30">
                <Clock className="w-2.5 h-2.5" />
                <span>{t('قريباً', 'Soon')}</span>
              </span>
            )}
            {isHiddenItem && (
              <span className="inline-flex items-center gap-1 bg-black/75 backdrop-blur-md border border-amber-400/50 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded-full">
                <EyeOff className="w-2.5 h-2.5" />
                <span>{t('مخفي', 'Hidden')}</span>
              </span>
            )}
          </div>
        )}

        {/* Quick Favorite & Alert Corner Actions (Subtle, appear cleanly on hover or when active) */}
        <div
          className={`absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-1.5 z-20 transition-opacity duration-200 ${
            isFavorite || isAlertSubscribed
              ? 'opacity-100'
              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
        >
          {onToggleAlert ? (
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
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer backdrop-blur-md ${
                isAlertSubscribed
                  ? 'bg-[#F7C600] text-black shadow-md'
                  : 'bg-black/55 text-white/85 hover:text-[#F7C600] border border-white/15'
              }`}
            >
              {isAlertSubscribed ? (
                <BellRing className="w-3.5 h-3.5" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={
              isFavorite
                ? t('إزالة من المفضلة', 'Remove from favorites')
                : t('إضافة إلى المفضلة', 'Add to favorites')
            }
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer backdrop-blur-md ${
              isFavorite
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-black/55 text-white/85 hover:text-rose-400 border border-white/15'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Clean Frosted Center Play Orb on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-black/20">
          <div className="w-11 h-11 rounded-full bg-white/25 backdrop-blur-md border border-white/35 text-white flex items-center justify-center shadow-2xl transform scale-85 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-4.5 h-4.5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Clean Minimal Title & Single-Line Metadata Below Artwork */}
      <div className={`pt-2 px-1 ${dir === 'ltr' ? 'text-left' : 'text-right'}`}>
        <h3 className="font-bold text-white text-xs sm:text-sm truncate group-hover:text-[#F7C600] transition-colors">
          {displayTitle}
        </h3>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 truncate tabular-nums">
          <span className="truncate">{categoryName}</span>
          {currentItem.year ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{currentItem.year}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-0.5 text-zinc-200 font-semibold shrink-0">
            <Star className="w-2.5 h-2.5 fill-[#F7C600] text-[#F7C600]" />
            <span>{effectiveRating.toFixed(1)}</span>
          </span>
        </div>

        {watchedPercent > 0 && (
          <div className="mt-1.5">
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
