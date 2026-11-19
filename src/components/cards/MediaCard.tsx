import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Heart, EyeOff, Bell, BellRing, Clock } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { hasPlayableMediaVideo } from '../../services/releaseAlertService';
import { getMediaProgress } from '../../services/storage';
import { formatQualityLabel } from '../../utils/quality';

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
  const { dir, t, getMediaTitle } = useLanguage();
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.025, 0.16), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`group relative flex flex-col flex-shrink-0 cursor-pointer select-none ${
        inGrid
          ? 'w-full'
          : isLandscape
          ? 'w-[210px] sm:w-[244px] md:w-[268px]'
          : 'w-[122px] sm:w-[144px] md:w-[166px]'
      }`}
    >
      {/* Thumbnail Frame */}
      <div
        className={`relative w-full overflow-hidden bg-[#17121f] rounded-[14px] transition-all duration-300 shadow-[0_10px_24px_rgba(0,0,0,0.55)] group-hover:shadow-[0_16px_32px_rgba(0,0,0,0.85)] ${
          isLandscape ? 'aspect-video' : 'aspect-[2/3]'
        } ${
          isHiddenItem
            ? 'ring-1 ring-amber-400/50 opacity-95'
            : 'ring-1 ring-white/[0.08] group-hover:ring-[#ea1d24]/60'
        }`}
      >
        {!imageLoaded && !imageError && displayImage && (
          <div className="absolute inset-0 bg-[#1a1524] flex items-center justify-center">
            <Play className="w-6 h-6 text-zinc-700" />
          </div>
        )}

        {imageError || !displayImage ? (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1f1929] via-[#15111c] to-[#0f0c14] flex flex-col items-center justify-center p-3 text-center">
            <Play className="w-6 h-6 text-[#ea1d24]/70 mb-1.5" />
            <span className="text-[11px] text-zinc-300 font-bold line-clamp-2">
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

        {/* Subtle Top Corner Status & Hover Actions */}
        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 z-10 pointer-events-none">
          <div className="flex items-center gap-1">
            {currentItem.videoQuality && (
              <span className="bg-black/60 backdrop-blur-md text-white font-black text-[9px] px-1.5 py-0.5 rounded border border-white/10">
                {formatQualityLabel(currentItem.videoQuality).toUpperCase()}
              </span>
            )}
            {isComingSoonItem && (
              <span className="inline-flex items-center gap-0.5 bg-black/70 backdrop-blur-md text-zinc-200 font-bold text-[9px] px-1.5 py-0.5 rounded border border-white/15">
                <Clock className="w-2.5 h-2.5 text-[#ea1d24]" />
                <span>{t('قريباً', 'Soon')}</span>
              </span>
            )}
            {isHiddenItem && (
              <span className="inline-flex items-center bg-black/75 backdrop-blur-md border border-amber-400/50 text-amber-300 font-bold text-[9px] px-1.5 py-0.5 rounded">
                <EyeOff className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onToggleAlert && isComingSoonItem && (
              <button
                type="button"
                onClick={handleAlertClick}
                title={
                  isAlertSubscribed
                    ? t('إلغاء التنبيه', 'Disable alert')
                    : t('تنبيهي عند الإضافة', 'Notify me')
                }
                aria-label={t('تنبيه', 'Alert')}
                className={`pointer-events-auto w-6 h-6 rounded-full flex items-center justify-center transition-all backdrop-blur-md cursor-pointer ${
                  isAlertSubscribed
                    ? 'bg-[#ea1d24] text-white opacity-100'
                    : 'bg-black/55 text-white/85 hover:text-white border border-white/15 opacity-0 group-hover:opacity-100'
                }`}
              >
                {isAlertSubscribed ? (
                  <BellRing className="w-3 h-3" />
                ) : (
                  <Bell className="w-3 h-3" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleFavoriteClick}
              aria-label={
                isFavorite
                  ? t('إزالة من المفضلة', 'Remove from favorites')
                  : t('إضافة إلى المفضلة', 'Add to favorites')
              }
              className={`pointer-events-auto w-6 h-6 rounded-full flex items-center justify-center transition-all backdrop-blur-md cursor-pointer ${
                isFavorite
                  ? 'bg-[#ea1d24] text-white opacity-100 shadow-sm'
                  : 'bg-black/55 text-white/85 hover:text-white border border-white/15 opacity-0 group-hover:opacity-100'
              }`}
            >
              <Heart className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Play Orb Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-black/25">
          <div className="w-9 h-9 rounded-full bg-[#ea1d24] text-white flex items-center justify-center shadow-[0_8px_22px_rgba(234,29,36,0.55)] transform scale-85 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* Clean Portrait Bottom Gradient & Title on Poster Variant */}
        {!isLandscape && (
          <div
            className={`absolute inset-x-0 bottom-0 pt-8 pb-2 px-2 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none ${
              dir === 'ltr' ? 'text-left' : 'text-right'
            }`}
          >
            <h3 className="font-black text-white text-[11px] sm:text-xs truncate drop-shadow">
              {displayTitle}
            </h3>
          </div>
        )}

        {/* Watch Progress Bar Inside Thumbnail Matching Reference Screen 1 */}
        {watchedPercent > 0 && (
          <div className="absolute bottom-2 inset-x-2.5 h-1 rounded-full bg-white/25 overflow-hidden z-10 pointer-events-none">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${watchedPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Landscape Card Footer: Clean Single-Line Title Directly Below Thumbnail Matching Screen 1 */}
      {isLandscape && (
        <div className={`pt-2 px-0.5 ${dir === 'ltr' ? 'text-left' : 'text-right'}`}>
          <h3 className="font-black text-zinc-100 group-hover:text-white text-xs sm:text-[13px] truncate transition-colors">
            {displayTitle}
          </h3>
        </div>
      )}
    </motion.article>
  );
};
