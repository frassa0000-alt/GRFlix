import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Star,
  Heart,
  Calendar,
  RotateCcw,
  Film,
  EyeOff,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatQualityLabel } from '../../utils/quality';
import { getEffectiveMediaRating } from '../../utils/rating';
import { hasPlayableMediaVideo } from '../../services/releaseAlertService';
import { EmptyCinemaState } from '../common/EmptyCinemaState';
import { GoldenOrbitalG } from '../layout/TopHeader';

type MoviesSubFilter = 'popular' | 'latest' | 'top_rated';

interface MoviesShowcaseViewProps {
  items: MediaItem[];
  allMoviesCount: number;
  availableYears: number[];
  yearCounts: Record<number, number>;
  selectedYear: string;
  onSelectYear: (year: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  history: WatchProgress[];
  onSelectMedia: (item: MediaItem) => void;
  onPlayMedia: (item: MediaItem) => void;
  onBrowseHome: () => void;
}

export const MoviesShowcaseView: React.FC<MoviesShowcaseViewProps> = ({
  items,
  allMoviesCount,
  availableYears,
  yearCounts,
  selectedYear,
  onSelectYear,
  favorites,
  onToggleFavorite,
  history,
  onSelectMedia,
  onPlayMedia,
  onBrowseHome,
}) => {
  const { dir, t, getMediaTitle, translateGenre } = useLanguage();
  const [subFilter, setSubFilter] = useState<MoviesSubFilter>('popular');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const featuredScrollRef = useRef<HTMLDivElement>(null);

  const featuredSlides = useMemo(() => {
    const flagged = items.filter((m) => m.isFeatured);
    return (flagged.length > 0 ? flagged : items).slice(0, 6);
  }, [items]);

  const sortedGridItems = useMemo(() => {
    const list = [...items];
    if (subFilter === 'latest') {
      list.sort(
        (a, b) =>
          (b.year || 0) - (a.year || 0) || (b.createdAt || 0) - (a.createdAt || 0)
      );
    } else if (subFilter === 'top_rated') {
      list.sort(
        (a, b) =>
          getEffectiveMediaRating(b) - getEffectiveMediaRating(a) ||
          (b.viewsCount || 0) - (a.viewsCount || 0)
      );
    } else {
      // popular
      list.sort(
        (a, b) =>
          (b.viewsCount || 0) - (a.viewsCount || 0) ||
          getEffectiveMediaRating(b) - getEffectiveMediaRating(a) ||
          (b.createdAt || 0) - (a.createdAt || 0)
      );
    }
    return list;
  }, [items, subFilter]);

  const filterTabs: { id: MoviesSubFilter; labelAr: string; labelEn: string }[] = [
    { id: 'popular', labelAr: 'الأكثر مشاهدة', labelEn: 'Top Movies' },
    { id: 'latest', labelAr: 'أحدث الإضافات', labelEn: 'New Releases' },
    { id: 'top_rated', labelAr: 'الأعلى تقييماً', labelEn: 'Top Rated' },
  ];

  const scrollFeatured = (direction: 'left' | 'right') => {
    if (!featuredScrollRef.current) return;
    const delta = direction === 'left' ? -320 : 320;
    featuredScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (items.length === 0) {
    return (
      <EmptyCinemaState
        titleStart={t('مكتبة', 'Movies List is')}
        titleHighlight={t('الأفلام', 'Empty')}
        titleEnd={t('فارغة حالياً', 'Right Now')}
        subtitle={
          selectedYear !== 'all'
            ? t(
                `لا توجد أفلام متاحة لسنة الإنتاج ${selectedYear}.`,
                `No movies available for release year ${selectedYear}.`
              )
            : t(
                'لا توجد أفلام منشورة حالياً، يمكنك تصفح باقي أقسام المنصة',
                'No movies published right now. Browse other sections'
              )
        }
        ctaLabel={
          selectedYear !== 'all'
            ? t('عرض جميع السنوات', 'Show All Years')
            : t('العودة للرئيسية', 'Back to Home')
        }
        onCtaClick={() =>
          selectedYear !== 'all' ? onSelectYear('all') : onBrowseHome()
        }
        showHeartAccent={false}
      />
    );
  }

  return (
    <div dir={dir} className="space-y-5 select-none">
      {/* 1. Featured Landscape Showcase Strip (Side-Peeking Wide Hero Cards Matching Reference Top Card) */}
      {featuredSlides.length > 0 && (
        <div className="relative">
          {featuredSlides.length > 1 && (
            <div className="hidden md:flex items-center gap-1.5 absolute -top-9 end-0 z-10">
              <button
                type="button"
                onClick={() => scrollFeatured(dir === 'ltr' ? 'left' : 'right')}
                aria-label={t('السابق', 'Previous')}
                className="w-7 h-7 rounded-full bg-[#17121f] border border-white/10 hover:border-[#ea1d24]/70 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                {dir === 'ltr' ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => scrollFeatured(dir === 'ltr' ? 'right' : 'left')}
                aria-label={t('التالي', 'Next')}
                className="w-7 h-7 rounded-full bg-[#17121f] border border-white/10 hover:border-[#ea1d24]/70 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                {dir === 'ltr' ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          <div
            ref={featuredScrollRef}
            className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pb-1"
          >
            {featuredSlides.map((movie, idx) => {
              const title = getMediaTitle(movie);
              const imgSrc = movie.bannerUrl || movie.posterUrl;
              const quality = movie.videoQuality
                ? formatQualityLabel(movie.videoQuality).toUpperCase()
                : 'HD';
              const rating = getEffectiveMediaRating(movie);
              const firstGenre =
                movie.genres && movie.genres.length > 0 && typeof movie.genres[0] === 'string'
                  ? translateGenre(movie.genres[0])
                  : t('فيلم سينمائي', 'Cinema Movie');
              const playable = hasPlayableMediaVideo(movie);

              return (
                <motion.article
                  key={`featured-movie-${movie.id}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onSelectMedia(movie)}
                  className={`relative snap-start shrink-0 overflow-hidden rounded-[22px] sm:rounded-[26px] border border-white/[0.1] hover:border-[#ea1d24]/60 bg-[#17121f] shadow-[0_18px_42px_rgba(0,0,0,0.75)] cursor-pointer group ${
                    featuredSlides.length > 1
                      ? 'w-[86%] sm:w-[70%] md:w-[58%] lg:w-[48%]'
                      : 'w-full'
                  } aspect-[16/10] sm:aspect-[16/9] max-h-[300px]`}
                >
                  {imgSrc && !failedImages[`feat-${movie.id}`] ? (
                    <img
                      src={imgSrc}
                      alt={title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [`feat-${movie.id}`]: true }))
                      }
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1f182a] via-[#140f1b] to-[#0f0c14] flex items-center justify-center">
                      <Film className="w-12 h-12 text-[#ea1d24]/60" />
                    </div>
                  )}

                  {/* Rich Editorial Gradient Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c14]/95 via-black/40 to-black/15" />

                  {/* Overlaid Lower Content */}
                  <div className="absolute inset-x-4 bottom-3.5 sm:inset-x-5 sm:bottom-4 flex flex-col gap-2">
                    <div>
                      <h3 className="text-lg sm:text-2xl font-black text-white leading-tight truncate drop-shadow">
                        {title}
                      </h3>
                      <p className="text-[11px] sm:text-xs font-bold text-zinc-300/90 truncate mt-0.5">
                        {t('اختيار MASHHAD · ', 'Recommended · ')}
                        {firstGenre}
                        {movie.year ? ` · ${movie.year}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="inline-flex items-center rounded-lg overflow-hidden shadow-md border border-white/10">
                        <span className="bg-[#ea1d24] text-white px-2 py-1 text-[11px] font-black tracking-wide leading-none flex items-center gap-1">
                          <Star className="w-3 h-3 fill-white text-white" />
                          <span className="tabular-nums">{rating.toFixed(1)}</span>
                        </span>
                        <span className="bg-[#17121f]/95 backdrop-blur-md text-white px-2.5 py-1 text-[11px] font-black leading-none tabular-nums flex items-center gap-1.5">
                          <span>{quality}</span>
                          {movie.duration && (
                            <>
                              <span className="text-zinc-500">·</span>
                              <span className="text-zinc-200">{movie.duration}</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <GoldenOrbitalG className="w-5 h-4 opacity-90 drop-shadow" />
                        {playable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayMedia(movie);
                            }}
                            aria-label={t(`تشغيل ${title}`, `Play ${title}`)}
                            className="w-8 h-8 rounded-full bg-[#ea1d24] hover:bg-[#ff2b32] text-white flex items-center justify-center shadow-lg transition-all cursor-pointer active:scale-90"
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Sub-Filter Pills Row + Year Filter Matching Reference ("Top Sellers | Free to Play | Early Access") in GoldenFlix Colors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {filterTabs.map((tab) => {
            const active = subFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubFilter(tab.id)}
                className={`relative px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                  active ? 'text-white font-black' : 'text-zinc-400 hover:text-white font-bold'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="moviesShowcaseSubTabPill"
                    transition={{ type: 'spring', stiffness: 440, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-[#ea1d24] shadow-[0_6px_18px_rgba(234,29,36,0.38)]"
                  />
                )}
                <span className="relative z-10">
                  {dir === 'ltr' ? tab.labelEn : tab.labelAr}
                </span>
              </button>
            );
          })}
        </div>

        {/* Compact Production Year Filter Preserved */}
        {availableYears.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex items-center">
              <Calendar
                className={`w-3.5 h-3.5 text-[#ea1d24] absolute pointer-events-none ${
                  dir === 'ltr' ? 'left-2.5' : 'right-2.5'
                }`}
              />
              <select
                value={selectedYear}
                onChange={(e) => onSelectYear(e.target.value)}
                aria-label={t('تصفية حسب سنة الإنتاج', 'Filter by release year')}
                className={`h-8 sm:h-9 bg-[#17121f] hover:bg-[#1f182a] text-zinc-100 text-[11px] sm:text-xs font-bold rounded-xl border border-white/[0.1] focus:border-[#ea1d24]/70 focus:outline-none transition-colors cursor-pointer ${
                  dir === 'ltr' ? 'pl-7 pr-3' : 'pr-7 pl-3'
                }`}
              >
                <option value="all">
                  {t('الكل', 'All')} ({allMoviesCount})
                </option>
                {availableYears.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr} ({yearCounts[yr] || 0})
                  </option>
                ))}
              </select>
            </div>

            {selectedYear !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectYear('all')}
                title={t('إعادة ضبط السنة', 'Reset year')}
                className="h-8 sm:h-9 px-2 rounded-xl bg-[#17121f] hover:bg-[#1f182a] text-zinc-300 hover:text-white border border-white/[0.1] flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. 2-Column Rounded Artwork Card Grid Matching Reference Screen Bottom Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${subFilter}-${selectedYear}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
        >
          {sortedGridItems.map((movie, idx) => {
            const title = getMediaTitle(movie);
            const posterSrc = movie.posterUrl || movie.bannerUrl;
            const isFav = favorites.includes(movie.id);
            const isHidden = movie.isPublished === false;
            const isSoon = !hasPlayableMediaVideo(movie);
            const rating = getEffectiveMediaRating(movie);
            const prog = history.find((h) => h.mediaId === movie.id);
            const pct = prog
              ? prog.percentage > 0
                ? Math.min(100, Math.round(prog.percentage))
                : prog.duration > 0 && prog.currentTime > 2
                ? Math.min(100, Math.round((prog.currentTime / prog.duration) * 100))
                : 0
              : 0;

            return (
              <motion.article
                key={movie.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(idx * 0.025, 0.2) }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelectMedia(movie)}
                className={`group relative aspect-[2/3] rounded-[16px] overflow-hidden bg-[#17121f] border transition-all duration-200 cursor-pointer shadow-[0_14px_30px_rgba(0,0,0,0.65)] ${
                  isHidden
                    ? 'border-amber-400/50'
                    : 'border-white/[0.08] hover:border-[#ea1d24]/70'
                }`}
              >
                {posterSrc && !failedImages[`grid-${movie.id}`] ? (
                  <img
                    src={posterSrc}
                    alt={title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [`grid-${movie.id}`]: true }))
                    }
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1f182a] via-[#140f1b] to-[#0f0c14] flex flex-col items-center justify-center p-4 text-center">
                    <Film className="w-8 h-8 text-[#ea1d24]/60 mb-2" />
                    <span className="text-xs font-black text-zinc-200 line-clamp-2">{title}</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/15 to-transparent pointer-events-none" />

                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 z-10">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/65 backdrop-blur-md border border-white/10 text-[10px] font-black text-white tabular-nums">
                      <Star className="w-2.5 h-2.5 fill-white text-white" />
                      <span>{rating.toFixed(1)}</span>
                    </span>
                    {isSoon && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[#ea1d24] text-[9.5px] font-black">
                        <Clock className="w-2.5 h-2.5" />
                      </span>
                    )}
                    {isHidden && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-black/75 text-amber-300 text-[9.5px] font-black">
                        <EyeOff className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(movie.id);
                    }}
                    aria-label={
                      isFav
                        ? t('إزالة من المفضلة', 'Remove from favorites')
                        : t('إضافة إلى المفضلة', 'Add to favorites')
                    }
                    className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all cursor-pointer ${
                      isFav
                        ? 'bg-[#ea1d24] text-white opacity-100'
                        : 'bg-black/55 text-white/80 hover:text-white border border-white/15 opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="absolute bottom-2.5 inset-x-3 flex items-end justify-between gap-2 z-10">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-black text-white truncate drop-shadow">
                      {title}
                    </h4>
                    {movie.year && (
                      <p className="text-[10px] font-bold text-zinc-300/85 tabular-nums mt-0.5">
                        {movie.year}
                      </p>
                    )}
                  </div>

                  {!isSoon && (
                    <span className="w-7 h-7 rounded-full bg-[#ea1d24] text-white flex items-center justify-center shrink-0 shadow-md opacity-95 group-hover:scale-110 transition-transform">
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </span>
                  )}
                </div>

                {pct > 0 && (
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                    <div className="h-full bg-white" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </motion.article>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
