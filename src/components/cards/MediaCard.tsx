import React, { useState } from 'react';
import { Play, Star, Heart } from 'lucide-react';
import { MediaItem } from '../../types';

export interface MediaCardProps {
  media?: MediaItem;
  item?: MediaItem;
  onClick?: () => void;
  onSelect?: (item: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (id?: string) => void;
  variant?: 'poster' | 'landscape';
  inGrid?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  item,
  onClick,
  onSelect,
  isFavorite,
  onToggleFavorite,
  variant = 'poster',
  inGrid = false,
}) => {
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

  const isLandscape = variant === 'landscape';
  const displayImage = isLandscape
    ? currentItem.bannerUrl || currentItem.posterUrl
    : currentItem.posterUrl || currentItem.bannerUrl;

  const categoryName =
    currentItem.genres && currentItem.genres.length > 0 && typeof currentItem.genres[0] === 'string'
      ? currentItem.genres[0]
      : currentItem.type === 'movie'
      ? 'فيلم'
      : currentItem.type === 'series'
      ? 'مسلسل'
      : 'أنمي';

  return (
    <article
      onClick={handleClick}
      className={`group relative flex-shrink-0 cursor-pointer rounded-2xl overflow-hidden bg-[#101015] border border-white/[0.07] hover:border-amber-400/55 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(0,0,0,0.75)] ${
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
              {currentItem.titleAr || currentItem.title}
            </span>
          </div>
        ) : (
          <img
            src={displayImage}
            alt={currentItem.titleAr || currentItem.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Cinematic Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-85 group-hover:opacity-70 transition-opacity" />

        {/* Subtle Top Metadata Corners */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
          {currentItem.videoQuality ? (
            <span className="bg-amber-400 text-black font-black text-[10px] px-1.5 py-0.5 rounded-md shadow-sm uppercase">
              {currentItem.videoQuality}
            </span>
          ) : (
            <span />
          )}

          {typeof currentItem.rating === 'number' && currentItem.rating > 0 && (
            <div className="inline-flex items-center gap-1 bg-black/65 backdrop-blur-md px-1.5 py-0.5 rounded-md text-amber-400 text-[11px] font-bold tabular-nums">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{currentItem.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Favorite Button (40x40 target) */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          className={`absolute bottom-2.5 left-2.5 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
            isFavorite
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
              : 'bg-black/65 backdrop-blur-md text-white/85 hover:text-amber-300 border border-white/10'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Center Play Hover Orb */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-250 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.5)] transform scale-75 group-hover:scale-100 transition-transform duration-250">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Card Footer Information (Unboxed clean line) */}
      <div className="p-3 text-right">
        <h3 className="font-black text-white text-xs sm:text-sm truncate group-hover:text-amber-400 transition-colors">
          {currentItem.titleAr || currentItem.title}
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
    </article>
  );
};
