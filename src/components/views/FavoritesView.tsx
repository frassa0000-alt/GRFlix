import React, { useState, useMemo } from 'react';
import { MediaItem, MediaType } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import { Heart, Film, Sparkles, Tv } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface FavoritesViewProps {
  favorites: string[];
  mediaItems: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
  onToggleFavorite: (id: string) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  mediaItems,
  onSelectMedia,
  onToggleFavorite,
}) => {
  const { t } = useLanguage();
  const [selectedType, setSelectedType] = useState<MediaType | 'all'>('all');

  const favoriteMedia = useMemo(() => {
    return mediaItems.filter((item) => favorites.includes(item.id));
  }, [mediaItems, favorites]);

  const filteredFavorites = useMemo(() => {
    if (selectedType === 'all') return favoriteMedia;
    return favoriteMedia.filter((item) => item.type === selectedType);
  }, [favoriteMedia, selectedType]);

  return (
    <div className="px-3.5 sm:px-6 py-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Heart className="w-5 h-5 fill-amber-400/20" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">
              {t('قائمتي المفضلة', 'My Favorites')}
            </h2>
            <p className="text-[11px] text-zinc-400">
              {t(
                'الأعمال السينمائية التي قمت بإضافتها للمفضلة',
                'Movies and series you bookmarked'
              )}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
          {favoriteMedia.length} {t('في المفضلة', 'saved')}
        </span>
      </div>

      {/* Filter Tabs */}
      {favoriteMedia.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800">
          <button
            onClick={() => setSelectedType('all')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedType === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {t('الكل', 'All')} ({favoriteMedia.length})
            </span>
          </button>
          <button
            onClick={() => setSelectedType('movie')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedType === 'movie'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{t('أفلام', 'Movies')}</span>
          </button>
          <button
            onClick={() => setSelectedType('series')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedType === 'series'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{t('مسلسلات', 'Series')}</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {favoriteMedia.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800/60 p-6 space-y-3">
          <div className="w-16 h-16 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto text-zinc-500">
            <Heart className="w-8 h-8" />
          </div>
          <p className="text-sm font-bold text-white">
            {t('قائمة المفضلة فارغة حالياً', 'Your favorites list is empty')}
          </p>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            {t(
              'اضغط على أيقونة القلب على أي بوستر فيلم أو مسلسل لإضافته إلى قائمتك والوصول إليه بسرعة',
              'Tap the heart icon on any poster to bookmark it for quick access.'
            )}
          </p>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800/60 p-6 space-y-2">
          <p className="text-sm font-bold text-white">
            {t('لا توجد أعمال في هذا القسم ضمن المفضلة', 'No favorites in this filter')}
          </p>
          <p className="text-xs text-zinc-400">
            {t('اختر تصنيفاً آخر أو تصفح الكل', 'Choose another filter or view all.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredFavorites.map((item) => (
            <div key={item.id} className="w-full flex justify-center">
              <MediaCard
                media={item}
                inGrid={true}
                onClick={() => onSelectMedia(item)}
                isFavorite={true}
                onToggleFavorite={() => onToggleFavorite(item.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
