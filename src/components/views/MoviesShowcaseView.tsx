import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  RotateCcw,
  Film,
  Tv,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getEffectiveMediaRating } from '../../utils/rating';
import { EmptyCinemaState } from '../common/EmptyCinemaState';

interface MoviesShowcaseViewProps {
  mode?: 'movies' | 'series';
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
  onOpenCategories?: () => void;
}

const DEFAULT_GENRE_ORDER = [
  'action',
  'adventure',
  'comedy',
  'drama',
  'horror',
  'sci-fi',
  'crime',
  'romance',
  'anime',
  'fantasy',
  'history',
  'biography',
  'documentary',
];

export const MoviesShowcaseView: React.FC<MoviesShowcaseViewProps> = ({
  mode = 'movies',
  items,
  allMoviesCount,
  availableYears,
  yearCounts,
  selectedYear,
  onSelectYear,
  history,
  onSelectMedia,
  onBrowseHome,
  onOpenCategories,
}) => {
  const { dir, t, getMediaTitle, translateGenre } = useLanguage();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [showAllGrid, setShowAllGrid] = useState<boolean>(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const gridSectionRef = useRef<HTMLDivElement>(null);

  const isSeries = mode === 'series';

  const historyMap = useMemo(() => {
    const map = new Map<string, WatchProgress>();
    for (const h of history) {
      if (!map.has(h.mediaId)) map.set(h.mediaId, h);
    }
    return map;
  }, [history]);

  // 1. New Releases horizontal strip (pure full-bleed poster cards matching reference)
  const newReleases = useMemo(() => {
    const list = [...items];
    list.sort(
      (a, b) =>
        (b.isLatest ? 1 : 0) - (a.isLatest ? 1 : 0) ||
        (b.year || 0) - (a.year || 0) ||
        (b.createdAt || 0) - (a.createdAt || 0)
    );
    return list.slice(0, 12);
  }, [items]);

  // Dynamic genre chips derived from items + canonical order
  const availableGenres = useMemo(() => {
    const present = new Set<string>();
    for (const item of items) {
      if (Array.isArray(item.genres)) {
        for (const g of item.genres) {
          if (typeof g === 'string' && g.trim()) {
            present.add(g.trim().toLowerCase());
          }
        }
      }
    }
    const ordered: string[] = [];
    for (const g of DEFAULT_GENRE_ORDER) {
      if (present.has(g)) {
        ordered.push(g);
        present.delete(g);
      }
    }
    for (const remaining of present) {
      ordered.push(remaining);
    }
    return ordered;
  }, [items]);

  const activeGenre =
    selectedGenre !== 'all' && availableGenres.includes(selectedGenre)
      ? selectedGenre
      : 'all';

  // Items filtered by selected genre
  const genreFilteredItems = useMemo(() => {
    if (activeGenre === 'all') return items;
    return items.filter(
      (m) =>
        Array.isArray(m.genres) &&
        m.genres.some((g) => typeof g === 'string' && g.trim().toLowerCase() === activeGenre)
    );
  }, [items, activeGenre]);

  // 2. Being Watched horizontal strip (clean square/portrait cards + title & year/genre below)
  const beingWatchedItems = useMemo(() => {
    const list = [...genreFilteredItems];
    list.sort((a, b) => {
      const aProg = historyMap.has(a.id) ? 1 : 0;
      const bProg = historyMap.has(b.id) ? 1 : 0;
      return (
        bProg - aProg ||
        (b.isMostWatched ? 1 : 0) - (a.isMostWatched ? 1 : 0) ||
        (b.viewsCount || 0) - (a.viewsCount || 0) ||
        getEffectiveMediaRating(b) - getEffectiveMediaRating(a)
      );
    });
    return list.slice(0, 14);
  }, [genreFilteredItems, historyMap]);

  const scrollToCatalog = () => {
    setShowAllGrid(true);
    gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (items.length === 0) {
    return (
      <EmptyCinemaState
        titleStart={isSeries ? t('مكتبة', 'Series List is') : t('مكتبة', 'Movies List is')}
        titleHighlight={isSeries ? t('المسلسلات', 'Empty') : t('الأفلام', 'Empty')}
        titleEnd={t('فارغة حالياً', 'Right Now')}
        subtitle={
          selectedYear !== 'all'
            ? t(
                `لا توجد ${isSeries ? 'مسلسلات' : 'أفلام'} متاحة لسنة الإنتاج ${selectedYear}.`,
                `No ${isSeries ? 'series' : 'movies'} available for release year ${selectedYear}.`
              )
            : t(
                `لا توجد ${isSeries ? 'مسلسلات' : 'أفلام'} منشورة حالياً، يمكنك تصفح باقي أقسام المنصة`,
                `No ${isSeries ? 'series' : 'movies'} published right now. Browse other sections`
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

  const FallbackIcon = isSeries ? Tv : Film;
  const SeeMoreChevron = dir === 'ltr' ? ChevronRight : ChevronLeft;

  return (
    <div dir={dir} className="space-y-6 pb-4 select-none">
      {/* 1. New Releases ("أحدث الأفلام" / "أحدث المسلسلات") — Clean Full-Bleed Posters */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
          {isSeries ? t('أحدث المسلسلات', 'New Releases') : t('أحدث الأفلام', 'New Releases')}
        </h2>

        <div className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
          {newReleases.map((item, idx) => {
            const title = getMediaTitle(item);
            const posterSrc = item.posterUrl || item.bannerUrl;

            return (
              <article
                key={`new-${item.id}`}
                onClick={() => onSelectMedia(item)}
                className="group relative snap-start shrink-0 w-[43%] sm:w-[27%] md:w-[21%] lg:w-[17%] aspect-[2/3] rounded-2xl overflow-hidden bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/70 transition-transform duration-150 ease-out active:scale-[0.98] cursor-pointer shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
              >
                {posterSrc && !failedImages[`new-${item.id}`] ? (
                  <img
                    src={posterSrc}
                    alt={title}
                    loading={idx < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [`new-${item.id}`]: true }))
                    }
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1f182a] via-[#140f1b] to-[#0f0c14] flex flex-col items-center justify-center p-3 text-center">
                    <FallbackIcon className="w-8 h-8 text-[#ea1d24]/60 mb-2" />
                    <span className="text-xs font-black text-zinc-200 line-clamp-2">{title}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* 2. Categories + Horizontal Pill Strip */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
            {t('التصنيفات', 'Categories')}
          </h3>
          <button
            type="button"
            onClick={onOpenCategories ? onOpenCategories : scrollToCatalog}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <span>{t('عرض الكل', 'See More')}</span>
            <SeeMoreChevron className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedGenre('all')}
            className={`px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
              activeGenre === 'all'
                ? 'bg-[#ea1d24] text-white font-black shadow-[0_6px_18px_rgba(234,29,36,0.35)]'
                : 'bg-[#17121f] hover:bg-[#1f182a] text-zinc-300 hover:text-white font-bold border border-white/[0.08]'
            }`}
          >
            {t('الكل', 'All')}
          </button>

          {availableGenres.map((genre) => {
            const isActive = activeGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#ea1d24] text-white font-black shadow-[0_6px_18px_rgba(234,29,36,0.35)]'
                    : 'bg-[#17121f] hover:bg-[#1f182a] text-zinc-300 hover:text-white font-bold border border-white/[0.08]'
                }`}
              >
                {translateGenre(genre)}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Being Watched Row — Clean Square/Rounded Thumbnails + Title & Year/Genre Below */}
      {beingWatchedItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
              {isSeries
                ? t('المسلسلات الأكثر مشاهدة', 'Series Being Watched')
                : t('الأفلام الأكثر مشاهدة', 'Movies Being Watched')}
            </h3>
            <button
              type="button"
              onClick={scrollToCatalog}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>{t('عرض الكل', 'See More')}</span>
              <SeeMoreChevron className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
            {beingWatchedItems.map((item) => {
              const title = getMediaTitle(item);
              const thumbSrc = item.posterUrl || item.bannerUrl;
              const prog = historyMap.get(item.id);
              const pct = prog
                ? prog.percentage > 0
                  ? Math.min(100, Math.round(prog.percentage))
                  : prog.duration > 0 && prog.currentTime > 2
                  ? Math.min(100, Math.round((prog.currentTime / prog.duration) * 100))
                  : 0
                : 0;
              const genresText =
                Array.isArray(item.genres) && item.genres.length > 0
                  ? item.genres
                      .slice(0, 2)
                      .map((g) => translateGenre(String(g)))
                      .join('/')
                  : isSeries
                  ? t('مسلسل', 'Series')
                  : t('فيلم', 'Movie');

              return (
                <article
                  key={`watched-${item.id}`}
                  onClick={() => onSelectMedia(item)}
                  className="group snap-start shrink-0 w-[41%] sm:w-[27%] md:w-[22%] lg:w-[18%] cursor-pointer"
                >
                  <div className="relative aspect-[1/1.05] rounded-2xl overflow-hidden bg-[#17121f] border border-white/[0.08] group-hover:border-[#ea1d24]/70 transition-transform duration-150 active:scale-[0.98] shadow-[0_10px_24px_rgba(0,0,0,0.55)]">
                    {thumbSrc && !failedImages[`watch-${item.id}`] ? (
                      <img
                        src={thumbSrc}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({
                            ...prev,
                            [`watch-${item.id}`]: true,
                          }))
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#1f182a] via-[#140f1b] to-[#0f0c14] flex items-center justify-center">
                        <FallbackIcon className="w-8 h-8 text-[#ea1d24]/60" />
                      </div>
                    )}

                    {pct > 0 && (
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                        <div className="h-full bg-[#ea1d24]" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Clean Metadata Below Card */}
                  <div className="pt-2 px-0.5 space-y-0.5">
                    <h4 className="text-xs sm:text-[13px] font-black text-white truncate">
                      {title}
                    </h4>
                    <p className="text-[10.5px] sm:text-[11px] font-medium text-zinc-400 truncate tabular-nums">
                      {item.year ? `${item.year}, ` : ''}
                      {genresText}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Full Catalog Grid + Compact Year Filter */}
      <section ref={gridSectionRef} className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
              {activeGenre !== 'all'
                ? translateGenre(activeGenre)
                : isSeries
                ? t('كل المسلسلات', 'All Series')
                : t('كل الأفلام', 'All Movies')}
            </h3>
            <span className="text-xs font-bold text-zinc-400 tabular-nums">
              ({genreFilteredItems.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
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
                    className={`h-8 bg-[#17121f] hover:bg-[#1f182a] text-zinc-100 text-[11px] font-bold rounded-xl border border-white/[0.08] focus:border-[#ea1d24]/70 focus:outline-none transition-colors cursor-pointer ${
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
                    className="h-8 px-2 rounded-xl bg-[#17121f] hover:bg-[#1f182a] text-zinc-300 hover:text-white border border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {genreFilteredItems.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllGrid((v) => !v)}
                className="inline-flex items-center gap-0.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <span>{showAllGrid ? t('أقل', 'Less') : t('عرض الكل', 'See More')}</span>
                <SeeMoreChevron className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {(showAllGrid ? genreFilteredItems : genreFilteredItems.slice(0, 15)).map((item) => {
            const title = getMediaTitle(item);
            const posterSrc = item.posterUrl || item.bannerUrl;
            const prog = historyMap.get(item.id);
            const pct = prog
              ? prog.percentage > 0
                ? Math.min(100, Math.round(prog.percentage))
                : prog.duration > 0 && prog.currentTime > 2
                ? Math.min(100, Math.round((prog.currentTime / prog.duration) * 100))
                : 0
              : 0;
            const genresText =
              Array.isArray(item.genres) && item.genres.length > 0
                ? item.genres
                    .slice(0, 2)
                    .map((g) => translateGenre(String(g)))
                    .join('/')
                : isSeries
                ? t('مسلسل', 'Series')
                : t('فيلم', 'Movie');

            return (
              <article
                key={`grid-${item.id}`}
                onClick={() => onSelectMedia(item)}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#17121f] border border-white/[0.08] group-hover:border-[#ea1d24]/70 transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98] shadow-[0_10px_24px_rgba(0,0,0,0.6)]">
                  {posterSrc && !failedImages[`grid-${item.id}`] ? (
                    <img
                      src={posterSrc}
                      alt={title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [`grid-${item.id}`]: true,
                        }))
                      }
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1f182a] via-[#140f1b] to-[#0f0c14] flex flex-col items-center justify-center p-4 text-center">
                      <FallbackIcon className="w-8 h-8 text-[#ea1d24]/60 mb-2" />
                      <span className="text-xs font-black text-zinc-200 line-clamp-2">{title}</span>
                    </div>
                  )}

                  {pct > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                      <div className="h-full bg-[#ea1d24]" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>

                <div className="pt-2 px-0.5 space-y-0.5">
                  <h4 className="text-xs sm:text-[13px] font-black text-white truncate">
                    {title}
                  </h4>
                  <p className="text-[10.5px] sm:text-[11px] font-medium text-zinc-400 truncate tabular-nums">
                    {item.year ? `${item.year}, ` : ''}
                    {genresText}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
