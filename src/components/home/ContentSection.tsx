import React, { memo, useMemo, useRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import { useLanguage } from '../../contexts/LanguageContext';

interface ContentSectionProps {
  title: string;
  iconType?: 'movies' | 'series' | 'trending' | 'sparkles';
  items: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  alertSubscribedIds?: string[];
  onToggleAlert?: (id: string) => void;
  history?: WatchProgress[];
  onViewAll?: () => void;
  variant?: 'poster' | 'landscape' | 'series_avatar';
}

const ContentSectionInner: React.FC<ContentSectionProps> = ({
  title,
  items,
  onSelectMedia,
  favorites,
  onToggleFavorite,
  alertSubscribedIds = [],
  onToggleAlert,
  history = [],
  onViewAll,
  variant = 'poster',
}) => {
  const { dir, t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const alertSet = useMemo(() => new Set(alertSubscribedIds), [alertSubscribedIds]);
  const historyMap = useMemo(() => {
    const map = new Map<string, WatchProgress>();
    for (const h of history) {
      if (!map.has(h.mediaId)) map.set(h.mediaId, h);
    }
    return map;
  }, [history]);

  const rowItems = useMemo(() => items.slice(0, 24), [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -380 : 380;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (!rowItems || rowItems.length === 0) {
    return null;
  }

  return (
    <section
      style={{ contentVisibility: 'auto', containIntrinsicSize: '260px' }}
      className="mb-6 relative"
    >
      {/* Clean Section Header + View All Link */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {title ? (
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
            {title}
          </h2>
        ) : (
          <div aria-hidden="true" />
        )}

        <div className="flex items-center gap-2 shrink-0">
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{t('عرض الكل', 'View All')}</span>
              {dir === 'ltr' ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Subtle Desktop Scroll Arrows */}
          <div className="hidden md:flex items-center gap-1">
            {dir === 'ltr' ? (
              <>
                <button
                  type="button"
                  onClick={() => scroll('left')}
                  aria-label="Scroll left"
                  className="w-7 h-7 rounded-full bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll('right')}
                  aria-label="Scroll right"
                  className="w-7 h-7 rounded-full bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => scroll('right')}
                  aria-label="تمرير لليمين"
                  className="w-7 h-7 rounded-full bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll('left')}
                  aria-label="تمرير لليسار"
                  className="w-7 h-7 rounded-full bg-[#17121f] border border-white/[0.08] hover:border-[#ea1d24]/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Row */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar py-1"
      >
        {rowItems.map((item, idx) => (
          <MediaCard
            key={item.id}
            item={item}
            index={idx}
            onSelect={onSelectMedia}
            isFavorite={favoriteSet.has(item.id)}
            onToggleFavorite={onToggleFavorite}
            isAlertSubscribed={alertSet.has(item.id)}
            onToggleAlert={onToggleAlert}
            watchProgress={historyMap.get(item.id)}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
};

export const ContentSection = memo(ContentSectionInner);
