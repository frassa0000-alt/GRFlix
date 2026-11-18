import React, { useMemo } from 'react';
import { MediaItem, WatchProgress } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface RecommendationSectionProps {
  history: WatchProgress[];
  mediaItems: MediaItem[];
  favorites: string[];
  onSelectMedia: (item: MediaItem) => void;
  onToggleFavorite: (id: string) => void;
  alertSubscribedIds?: string[];
  onToggleAlert?: (id: string) => void;
  onViewAll?: () => void;
  userGenrePreference?: string;
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  history,
  mediaItems,
  favorites,
  onSelectMedia,
  onToggleFavorite,
  alertSubscribedIds = [],
  onToggleAlert,
  onViewAll,
}) => {
  const { dir, t } = useLanguage();

  const { recommendedItems } = useMemo(() => {
    if (!mediaItems || mediaItems.length === 0) {
      return { recommendedItems: [] };
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

    if (candidates.length < 6) {
      const remaining = mediaItems
        .filter((m) => !candidates.some((c) => c.item.id === m.id))
        .map((item) => ({
          item,
          score: (item.rating || 7) * 1.5 + (item.year ? (item.year - 2000) * 0.1 : 0),
        }));
      candidates = [...candidates, ...remaining];
    }

    candidates.sort((a, b) => b.score - a.score);
    const finalItems = candidates.slice(0, 12).map((c) => c.item);

    return {
      recommendedItems: finalItems,
    };
  }, [history, mediaItems, favorites]);

  if (recommendedItems.length === 0) return null;

  return (
    <section className="w-full mb-6 select-none">
      {/* Clean Header Matching "For you" + "See all" in the video */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
          {t('مقترح لك', 'For you')}
        </h2>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>{t('عرض الكل', 'See all')}</span>
            {dir === 'ltr' ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-stretch gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory overscroll-x-contain py-1">
        {recommendedItems.map((item, idx) => (
          <MediaCard
            key={`rec-${item.id}`}
            media={item}
            index={idx}
            variant="poster"
            onClick={() => onSelectMedia(item)}
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
            isAlertSubscribed={alertSubscribedIds.includes(item.id)}
            onToggleAlert={onToggleAlert ? () => onToggleAlert(item.id) : undefined}
            watchProgress={history.find((h) => h.mediaId === item.id)}
          />
        ))}
      </div>
    </section>
  );
};
