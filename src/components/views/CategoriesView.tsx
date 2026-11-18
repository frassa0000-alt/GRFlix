import React, { useState, useMemo } from 'react';
import { CategoryItem, MediaItem, MediaType, WatchProgress } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import { useLanguage } from '../../contexts/LanguageContext';
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
  Calendar,
  Tags,
} from 'lucide-react';

interface CategoriesViewProps {
  mediaItems: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  alertSubscribedIds?: string[];
  onToggleAlert?: (id: string) => void;
  history?: WatchProgress[];
  categories?: CategoryItem[];
}

interface GenreConfig {
  id: string;
  labelAr: string;
  labelEn: string;
  subtitleAr: string;
  subtitleEn: string;
  icon: React.ElementType;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  mediaItems,
  onSelectMedia,
  favorites,
  onToggleFavorite,
  alertSubscribedIds = [],
  onToggleAlert,
  history = [],
  categories = [],
}) => {
  const { lang, dir, t } = useLanguage();
  const [selectedType, setSelectedType] = useState<MediaType | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'rating'>('latest');

  const genresList: GenreConfig[] = useMemo(() => {
    const defaultGenres: GenreConfig[] = [
      { id: 'action', labelAr: 'أكشن وحركة', labelEn: 'Action', subtitleAr: 'إثارة ومطاردات سينمائية', subtitleEn: 'High-octane thrills', icon: Zap },
      { id: 'sci-fi', labelAr: 'خيال علمي', labelEn: 'Sci-Fi', subtitleAr: 'عوالم مستقبلية وفضاء', subtitleEn: 'Futuristic worlds & space', icon: Rocket },
      { id: 'drama', labelAr: 'دراما وسينما', labelEn: 'Drama', subtitleAr: 'قصص إنسانية ومشاعر عميقة', subtitleEn: 'Compelling stories', icon: Clapperboard },
      { id: 'horror', labelAr: 'رعب وتشويق', labelEn: 'Horror & Thriller', subtitleAr: 'غموض ولحظات حبس أنفاس', subtitleEn: 'Chilling suspense', icon: Ghost },
      { id: 'comedy', labelAr: 'كوميديا ومرح', labelEn: 'Comedy', subtitleAr: 'ضحك وأوقات عائلية ممتعة', subtitleEn: 'Laughs & good times', icon: Laugh },
      { id: 'adventure', labelAr: 'مغامرات', labelEn: 'Adventure', subtitleAr: 'رحلات واستكشافات ملحمية', subtitleEn: 'Epic journeys', icon: Compass },
      { id: 'crime', labelAr: 'جريمة وغموض', labelEn: 'Crime & Mystery', subtitleAr: 'تحقيقات وألغاز مثيرة', subtitleEn: 'Detectives & intrigue', icon: ShieldAlert },
      { id: 'history', labelAr: 'تاريخ وحضارة', labelEn: 'History', subtitleAr: 'أحداث وشخصيات ملهمة', subtitleEn: 'True events & eras', icon: Hourglass },
      { id: 'romance', labelAr: 'رومانسي', labelEn: 'Romance', subtitleAr: 'عواطف وعلاقات مؤثرة', subtitleEn: 'Heartfelt stories', icon: Heart },
      { id: 'anime', labelAr: 'أنمي وفانتازيا', labelEn: 'Fantasy', subtitleAr: 'رسوم يابانية وأساطير', subtitleEn: 'Myth & fantasy worlds', icon: Flame },
    ];
    const allCard: GenreConfig = {
      id: 'all',
      labelAr: 'جميع التصنيفات',
      labelEn: 'All Genres',
      subtitleAr: 'استكشف كافة الأعمال',
      subtitleEn: 'Explore every title',
      icon: Layers,
    };

    if (!Array.isArray(categories) || categories.length === 0) {
      return [allCard, ...defaultGenres];
    }

    const defaultMap = new Map(defaultGenres.map((g) => [g.id, g]));
    const visibleDynamic: GenreConfig[] = [...categories]
      .filter((c) => c.isVisible !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((cat) => {
        const slug = String(cat.slug || cat.id).toLowerCase().trim();
        const preset = defaultMap.get(slug);
        return {
          id: slug,
          labelAr: cat.nameAr || preset?.labelAr || slug,
          labelEn: cat.nameEn || preset?.labelEn || slug,
          subtitleAr: cat.description || preset?.subtitleAr || 'تصنيف سينمائي مميز',
          subtitleEn: cat.description || preset?.subtitleEn || 'Curated cinema genre',
          icon: preset?.icon || Tags,
        };
      });

    return [allCard, ...visibleDynamic];
  }, [categories]);

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
  }, [mediaItems, selectedType, genresList]);

  const baseFilteredItems = useMemo(() => {
    return mediaItems.filter((item) => {
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (selectedGenre !== 'all') {
        const hasGenre = item.genres?.some(
          (g) => String(g).toLowerCase().trim() === selectedGenre.toLowerCase().trim()
        );
        if (!hasGenre) return false;
      }
      return true;
    });
  }, [mediaItems, selectedType, selectedGenre]);

  const { availableYears, yearCounts } = useMemo(() => {
    const counts: Record<number, number> = {};
    baseFilteredItems.forEach((item) => {
      const yr = Number(item.year);
      if (Number.isInteger(yr) && yr >= 1900 && yr <= 2100) {
        counts[yr] = (counts[yr] || 0) + 1;
      }
    });
    const years = Object.keys(counts)
      .map(Number)
      .sort((a, b) => b - a);
    return { availableYears: years, yearCounts: counts };
  }, [baseFilteredItems]);

  const filteredItems = useMemo(() => {
    return baseFilteredItems
      .filter((item) => {
        if (selectedYear !== 'all' && Number(item.year) !== Number(selectedYear)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') {
          return (b.rating || 0) - (a.rating || 0);
        }
        return (b.year || 0) - (a.year || 0);
      });
  }, [baseFilteredItems, selectedYear, sortBy]);

  const activeGenreObj = genresList.find((g) => g.id === selectedGenre) || genresList[0];

  const resetFilters = () => {
    setSelectedType('all');
    setSelectedGenre('all');
    setSelectedYear('all');
    setSortBy('latest');
  };

  const isFilterActive =
    selectedType !== 'all' || selectedGenre !== 'all' || selectedYear !== 'all';

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
                  {t('تصفح الأقسام والتصنيفات', 'Browse Categories & Genres')}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
                  {t('سينما حصرية', 'Exclusive Cinema')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {t(
                  'استكشف أحدث الأفلام والمسلسلات وفق التصنيف والنوع المفضل لديك',
                  'Explore movies and series filtered by your favorite genre'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900/90 text-zinc-300 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/40 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('إعادة ضبط', 'Reset')}</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-extrabold shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {filteredItems.length} {t('عمل متاح', 'titles')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Type Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('نوع المحتوى:', 'Content Type:')}</span>
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">
            {selectedType === 'all'
              ? t('كافة الأنواع', 'All Formats')
              : selectedType === 'movie'
              ? t('الأفلام السينمائية', 'Feature Movies')
              : selectedType === 'series'
              ? t('المسلسلات التلفزيونية', 'TV Series')
              : t('الأنمي والرسوم', 'Animation')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1.5 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
              selectedType === 'all'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('الكل', 'All')}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('movie')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
              selectedType === 'movie'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Film className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('أفلام', 'Movies')}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('series')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
              selectedType === 'series'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Tv className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('مسلسلات', 'Series')}</span>
          </button>
        </div>
      </div>

      {/* Genre Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('اختر التصنيف الفني:', 'Select a Genre:')}</span>
          </span>
          <span className="text-[11px] text-amber-400/90 font-medium">
            {lang === 'en' ? activeGenreObj.labelEn : activeGenreObj.labelAr} (
            {genreCounts[selectedGenre] ?? 0})
          </span>
        </div>

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
                className={`group relative ${
                  dir === 'ltr' ? 'text-left' : 'text-right'
                } p-3 rounded-2xl border transition-all duration-200 active:scale-[0.97] flex flex-col justify-between overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-500/15 via-zinc-900 to-zinc-950 border-amber-400/80 shadow-md shadow-amber-500/10'
                    : 'bg-zinc-900/70 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700'
                }`}
              >
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
                    {lang === 'en' ? genre.labelEn : genre.labelAr}
                  </h3>
                  <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5 font-normal">
                    {lang === 'en' ? genre.subtitleEn : genre.subtitleAr}
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
            <span>{t('النتائج المعروضة', 'Results')}</span>
            <span className="text-zinc-400 text-[11px] font-normal">
              ({lang === 'en' ? activeGenreObj.labelEn : activeGenreObj.labelAr} •{' '}
              {filteredItems.length} {t('عمل', 'titles')})
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {availableYears.length > 0 && (
            <div className="relative flex items-center">
              <Calendar
                className={`w-3.5 h-3.5 text-amber-400 absolute pointer-events-none ${
                  dir === 'ltr' ? 'left-2.5' : 'right-2.5'
                }`}
              />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                aria-label={t('تصفية حسب سنة الإنتاج', 'Filter by release year')}
                className={`h-9 bg-zinc-950 hover:bg-zinc-900 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-800/80 focus:border-amber-400/70 focus:outline-none transition-colors cursor-pointer ${
                  dir === 'ltr' ? 'pl-8 pr-3' : 'pr-8 pl-3'
                }`}
              >
                <option value="all">
                  {t('سنة الإنتاج: الكل', 'Year: All')} ({baseFilteredItems.length})
                </option>
                {availableYears.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr} ({yearCounts[yr] || 0})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 px-2 font-medium">
              {t('الترتيب:', 'Sort:')}
            </span>
            <button
              type="button"
              onClick={() => setSortBy('latest')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                sortBy === 'latest'
                  ? 'bg-amber-400 text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>{t('الأحدث', 'Latest')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy('rating')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                sortBy === 'rating'
                  ? 'bg-amber-400 text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Star className="w-3 h-3" />
              <span>{t('الأعلى تقييماً', 'Top Rated')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items Results Grid */}
      {filteredItems.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800/60 p-6 space-y-3 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Film className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-white">
              {t('لا توجد أعمال في هذا التصنيف حالياً', 'No titles found in this category')}
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {t(
                'لم يتم إضافة أعمال تطابق خيارات التصفية المختارة. يمكنك تصفح باقي الأقسام أو إعادة ضبط الفلاتر.',
                'No releases match the selected filters yet. Try resetting your filters.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md shadow-amber-500/20 transition-all active:scale-95 hover:brightness-110 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('عرض كافة الأفلام والمسلسلات', 'Show All Movies & Series')}</span>
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
                isAlertSubscribed={alertSubscribedIds.includes(item.id)}
                onToggleAlert={onToggleAlert ? () => onToggleAlert(item.id) : undefined}
                watchProgress={history.find((h) => h.mediaId === item.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
