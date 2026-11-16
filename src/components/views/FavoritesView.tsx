import React, { useState, useMemo } from 'react';
import { MediaItem, MediaType, WatchProgress } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import { EmptyCinemaState } from '../common/EmptyCinemaState';
import { Heart, Film, Sparkles, Tv } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface FavoritesViewProps {
  favorites: string[];
  mediaItems: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
  onToggleFavorite: (id: string) => void;
  alertSubscribedIds?: string[];
  onToggleAlert?: (id: string) => void;
  history?: WatchProgress[];
  onBrowseContent?: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  mediaItems,
  onSelectMedia,
  onToggleFavorite,
  alertSubscribedIds = [],
  onToggleAlert,
  history = [],
  onBrowseContent,
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
    <div className="px-1 sm:px-2 py-2 space-y-5 animate-fade-in">
      {/* Header when items exist */}
      {favoriteMedia.length > 0 && (
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#F7C600]/12 border border-[#F7C600]/30 flex items-center justify-center text-[#F7C600]">
              <Heart className="w-4.5 h-4.5 fill-[#F7C600]/20" />
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
          <span className="text-xs font-bold text-[#F7C600] tabular-nums">
            {favoriteMedia.length} {t('في المفضلة', 'saved')}
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      {favoriteMedia.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#121217] rounded-full border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`py-2 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedType === 'all'
                ? 'bg-[#F7C600] text-black shadow-md shadow-[#F7C600]/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {t('الكل', 'All')} ({favoriteMedia.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('movie')}
            className={`py-2 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedType === 'movie'
                ? 'bg-[#F7C600] text-black shadow-md shadow-[#F7C600]/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{t('أفلام', 'Movies')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('series')}
            className={`py-2 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedType === 'series'
                ? 'bg-[#F7C600] text-black shadow-md shadow-[#F7C600]/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{t('مسلسلات', 'Series')}</span>
          </button>
        </div>
      )}

      {/* Empty State matching 3D Cinema Box Reference */}
      {favoriteMedia.length === 0 ? (
        <EmptyCinemaState
          titleStart={t('مكتبتك', 'Your Library is')}
          titleHighlight={t('فارغة', 'Empty')}
          titleEnd={t('حالياً', 'Right Now')}
          subtitle={t(
            'ستجد هنا أفلامك ومسلسلاتك المفضلة بعد إضافتها',
            'Your favorite movies and series will appear here once added'
          )}
          ctaLabel={t('تصفح المحتوى', 'Browse Content')}
          onCtaClick={onBrowseContent}
        />
      ) : filteredFavorites.length === 0 ? (
        <EmptyCinemaState
          titleStart={t('لا توجد أعمال', 'No Items in')}
          titleHighlight={t('مطابقة', 'This Filter')}
          titleEnd=""
          subtitle={t('اختر تصنيفاً آخر أو تصفح المحتوى المتاح', 'Try another filter or browse available titles')}
          ctaLabel={t('عرض الكل', 'Show All')}
          onCtaClick={() => setSelectedType('all')}
          showHeartAccent={false}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredFavorites.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              inGrid={true}
              onSelect={() => onSelectMedia(item)}
              isFavorite={true}
              onToggleFavorite={() => onToggleFavorite(item.id)}
              isAlertSubscribed={alertSubscribedIds.includes(item.id)}
              onToggleAlert={onToggleAlert ? () => onToggleAlert(item.id) : undefined}
              watchProgress={history.find((h) => h.mediaId === item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
