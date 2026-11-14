import React, { useMemo } from 'react';
import { MediaItem, WatchProgress } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import { Sparkles, Compass, ThumbsUp } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface RecommendationSectionProps {
  history: WatchProgress[];
  mediaItems: MediaItem[];
  favorites: string[];
  onSelectMedia: (item: MediaItem) => void;
  onToggleFavorite: (id: string) => void;
  userGenrePreference?: string;
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  history,
  mediaItems,
  favorites,
  onSelectMedia,
  onToggleFavorite,
}) => {
  const { lang, t, translateGenre } = useLanguage();

  const { recommendedItems, topGenreLabels, isPersonalized } = useMemo(() => {
    if (!mediaItems || mediaItems.length === 0) {
      return { recommendedItems: [], topGenreLabels: [], isPersonalized: false };
    }

    const watchedIds = new Set(history.map((h) => h.mediaId));
    const genreScores: Record<string, number> = {};

    history.forEach((h) => {
      const item = mediaItems.find((m) => m.id === h.mediaId);
      if (!item || !Array.isArray(item.genres)) return;
      const weight = 1 + (h.percentage || 0) / 100;
      item.genres.forEach((g) => {
        const key = String(g).toLowerCase();
        genreScores[key] = (genreScores[key] || 0) + weight;
      });
    });

    favorites.forEach((favId) => {
      const item = mediaItems.find((m) => m.id === favId);
      if (!item || !Array.isArray(item.genres)) return;
      item.genres.forEach((g) => {
        const key = String(g).toLowerCase();
        genreScores[key] = (genreScores[key] || 0) + 1.5;
      });
    });

    const sortedGenres = Object.entries(genreScores).sort((a, b) => b[1] - a[1]);
    const topGenres = sortedGenres.slice(0, 3).map(([genre]) => genre);

    const readableTopGenres = topGenres
      .map((g) => translateGenre(g))
      .slice(0, 2);

    let candidates: { item: MediaItem; score: number }[] = [];

    if (topGenres.length > 0) {
      mediaItems.forEach((item) => {
        const isWatched = watchedIds.has(item.id);
        const itemGenres = (item.genres || []).map((g) => String(g).toLowerCase());

        let overlap = 0;
        topGenres.forEach((tg) => {
          if (itemGenres.includes(tg)) {
            overlap += genreScores[tg] || 1;
          }
        });

        if (overlap > 0) {
          const unwatchedBonus = isWatched ? 0 : 5;
          const ratingBoost = (item.rating || 7) * 0.5;
          const score = overlap * 3 + ratingBoost + unwatchedBonus;
          candidates.push({ item, score });
        }
      });
    }

    if (candidates.length < 3) {
      const remaining = mediaItems
        .filter((m) => !candidates.some((c) => c.item.id === m.id))
        .map((item) => ({
          item,
          score: (item.rating || 7) * 1.5 + (item.year ? (item.year - 2000) * 0.1 : 0),
        }));
      candidates = [...candidates, ...remaining];
    }

    candidates.sort((a, b) => b.score - a.score);
    const finalItems = candidates.slice(0, 10).map((c) => c.item);

    return {
      recommendedItems: finalItems,
      topGenreLabels: readableTopGenres,
      isPersonalized: topGenres.length > 0,
    };
  }, [history, mediaItems, favorites, translateGenre]);

  if (recommendedItems.length === 0) return null;

  return (
    <section className="w-full py-3 select-none">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 sm:px-4 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-black text-white tracking-wide">
              {t('مقترحات مخصصة لك', 'Picked for You')}
            </h3>
          </div>

          {isPersonalized && topGenreLabels.length > 0 ? (
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25 flex items-center gap-1">
              <ThumbsUp className="w-2.5 h-2.5" />
              <span>
                {lang === 'en'
                  ? `Based on: ${topGenreLabels.join(' & ')}`
                  : `حسب ذوقك في: ${topGenreLabels.join(' و ')}`}
              </span>
            </span>
          ) : (
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
              <Compass className="w-2.5 h-2.5 text-amber-400" />
              <span>
                {t('أعمال سينمائية مختارة بعناية', 'Curated cinema selections')}
              </span>
            </span>
          )}
        </div>

        <span className="text-[11px] text-zinc-400 hidden sm:inline font-medium">
          {t('تحليل ذكي بناءً على التصنيفات', 'Smart genre-based recommendations')}
        </span>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar scroll-smooth px-3 sm:px-4 snap-x snap-mandatory overscroll-x-contain pb-1">
        {recommendedItems.map((item) => (
          <MediaCard
            key={`rec-${item.id}`}
            media={item}
            variant="poster"
            onClick={() => onSelectMedia(item)}
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
          />
        ))}
      </div>
    </section>
  );
};
