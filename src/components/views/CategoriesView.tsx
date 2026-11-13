import React, { useState, useMemo } from 'react';
import { MediaItem, MediaType } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import {
  Layers,
  Film,
  Tv,
  Flame,
  Zap,
  Rocket,
  Clapperboard,
  Ghost,
  Laugh,
  Compass,
  ShieldAlert,
  Hourglass,
  Heart,
  Star,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

interface CategoriesViewProps {
  mediaItems: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

interface GenreConfig {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  mediaItems,
  onSelectMedia,
  favorites,
  onToggleFavorite,
}) => {
  const [selectedType, setSelectedType] = useState<MediaType | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'rating'>('latest');

  // Curated genres with unified SVG icons - NO EMOJIS
  const genresList: GenreConfig[] = [
    { id: 'all', label: 'جميع التصنيفات', subtitle: 'استكشف كافة الأعمال', icon: Layers },
    { id: 'action', label: 'أكشن وحركة', subtitle: 'إثارة ومطاردات سينمائية', icon: Zap },
    { id: 'sci-fi', label: 'خيال علمي', subtitle: 'عوالم مستقبلية وفضاء', icon: Rocket },
    { id: 'drama', label: 'دراما وسينما', subtitle: 'قصص إنسانية ومشاعر عميقة', icon: Clapperboard },
    { id: 'horror', label: 'رعب وتشويق', subtitle: 'غموض ولحظات حبس أنفاس', icon: Ghost },
    { id: 'comedy', label: 'كوميديا ومرح', subtitle: 'ضحك وأوقات عائلية ممتعة', icon: Laugh },
    { id: 'adventure', label: 'مغامرات', subtitle: 'رحلات واستكشافات ملحمية', icon: Compass },
    { id: 'crime', label: 'جريمة وغموض', subtitle: 'تحقيقات وألغاز مثيرة', icon: ShieldAlert },
    { id: 'history', label: 'تاريخ وحضارة', subtitle: 'أحداث وشخصيات ملهمة', icon: Hourglass },
    { id: 'romance', label: 'رومانسي', subtitle: 'عواطف وعلاقات مؤثرة', icon: Heart },
    { id: 'anime', label: 'أنمي وفانتازيا', subtitle: 'رسوم يابانية وأساطير', icon: Flame },
  ];

  // Calculate dynamic counts per genre matching current type filter
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    genresList.forEach((g) => {
      counts[g.id] = 0;
    });

    mediaItems.forEach((item) => {
      if (selectedType !== 'all' && item.type !== selectedType) {
        return;
      }
      counts['all'] += 1;

      if (Array.isArray(item.genres)) {
        item.genres.forEach((g) => {
          const lower = String(g).toLowerCase().trim();
          if (counts[lower] !== undefined) {
            counts[lower] += 1;
          }
        });
      }
    });

    return counts;
  }, [mediaItems, selectedType]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return mediaItems
      .filter((item) => {
        if (selectedType !== 'all' && item.type !== selectedType) return false;
        if (selectedGenre !== 'all') {
          const hasGenre = item.genres?.some(
            (g) => String(g).toLowerCase().trim() === selectedGenre.toLowerCase().trim()
          );
          if (!hasGenre) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') {
          return (b.rating || 0) - (a.rating || 0);
        }
        return (b.year || 0) - (a.year || 0);
      });
  }, [mediaItems, selectedType, selectedGenre, sortBy]);

  const activeGenreObj = genresList.find((g) => g.id === selectedGenre) || genresList[0];

  const resetFilters = () => {
    setSelectedType('all');
    setSelectedGenre('all');
    setSortBy('latest');
  };

  const isFilterActive = selectedType !== 'all' || selectedGenre !== 'all';

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 py-4 space-y-6 animate-fade-in select-none">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/20 p-4 sm:p-5 shadow-lg shadow-black/40">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
                  تصفح الأقسام والتصنيفات
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
                  سينما حصرية
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                استكشف أحدث الأفلام والمسلسلات وفق التصنيف والنوع المفضل لديك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900/90 text-zinc-300 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/40 transition-all active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-extrabold shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{filteredItems.length} عمل متاح</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Type Tabs (Segmented Control) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>نوع المحتوى:</span>
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">
            {selectedType === 'all'
              ? 'كافة الأنواع'
              : selectedType === 'movie'
              ? 'الأفلام السينمائية'
              : selectedType === 'series'
              ? 'المسلسلات التلفزيونية'
              : 'الأنمي والرسوم'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 p-1.5 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              selectedType === 'all'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">الكل</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('movie')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              selectedType === 'movie'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Film className="w-4 h-4 shrink-0" />
            <span className="truncate">أفلام</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('series')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              selectedType === 'series'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Tv className="w-4 h-4 shrink-0" />
            <span className="truncate">مسلسلات</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('anime')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
              selectedType === 'anime'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span className="truncate">أنمي</span>
          </button>
        </div>
      </div>

      {/* Modern Genre Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>اختر التصنيف الفني:</span>
          </span>
          <span className="text-[11px] text-amber-400/90 font-medium">
            {activeGenreObj.label} ({genreCounts[selectedGenre] ?? 0})
          </span>
        </div>

        {/* Responsive Grid of Category Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {genresList.map((genre) => {
            const isSelected = selectedGenre === genre.id;
            const Icon = genre.icon;
            const count = genreCounts[genre.id] || 0;

            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => setSelectedGenre(genre.id)}
                className={`group relative text-right p-3 rounded-2xl border transition-all duration-200 active:scale-[0.97] flex flex-col justify-between overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-500/15 via-zinc-900 to-zinc-950 border-amber-400/80 shadow-md shadow-amber-500/10'
                    : 'bg-zinc-900/70 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Subtle active glow accent line */}
                {isSelected && (
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
                )}

                <div className="flex items-start justify-between w-full mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      isSelected
                        ? 'bg-amber-400 text-black shadow-md shadow-amber-500/30'
                        : 'bg-zinc-800 text-zinc-300 group-hover:text-amber-400 group-hover:bg-zinc-700/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md transition-colors ${
                      isSelected
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-zinc-800/80 text-zinc-400 group-hover:text-zinc-200'
                    }`}
                  >
                    {count}
                  </span>
                </div>

                <div>
                  <h3
                    className={`text-xs font-black transition-colors ${
                      isSelected ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                    }`}
                  >
                    {genre.label}
                  </h3>
                  <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5 font-normal">
                    {genre.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter summary & Sort Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-t border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>النتائج المعروضة</span>
            <span className="text-zinc-400 text-[11px] font-normal">
              ({activeGenreObj.label} • {filteredItems.length} عمل)
            </span>
          </span>
        </div>

        {/* Sort Pills */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
          <span className="text-[10px] text-zinc-400 px-2 font-medium">الترتيب:</span>
          <button
            type="button"
            onClick={() => setSortBy('latest')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
              sortBy === 'latest'
                ? 'bg-amber-400 text-black font-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>الأحدث</span>
          </button>
          <button
            type="button"
            onClick={() => setSortBy('rating')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
              sortBy === 'rating'
                ? 'bg-amber-400 text-black font-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3" />
            <span>الأعلى تقييماً</span>
          </button>
        </div>
      </div>

      {/* Items Results Grid */}
      {filteredItems.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800/60 p-6 space-y-3 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Film className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-white">لا توجد أعمال في هذا التصنيف حالياً</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              لم يتم إضافة أعمال تطابق خيارات التصفية المختارة. يمكنك تصفح باقي الأقسام أو إعادة ضبط
              الفلاتر.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md shadow-amber-500/20 transition-all active:scale-95 hover:brightness-110"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>عرض كافة الأفلام والمسلسلات</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="w-full flex justify-center animate-fade-in">
              <MediaCard
                media={item}
                inGrid={true}
                onClick={() => onSelectMedia(item)}
                isFavorite={favorites.includes(item.id)}
                onToggleFavorite={() => onToggleFavorite(item.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
