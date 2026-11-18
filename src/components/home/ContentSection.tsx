import React, { useRef } from 'react';
import { motion } from 'motion/react';
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

export const ContentSection: React.FC<ContentSectionProps> = ({
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

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -380 : 380;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 relative"
    >
      {/* Clean Minimal Section Header Matching Video ("For you" / "See all") */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
          {title}
        </h2>

        <div className="flex items-center gap-2 shrink-0">
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

          {/* Subtle Desktop Scroll Arrows */}
          <div className="hidden md:flex items-center gap-1">
            {dir === 'ltr' ? (
              <>
                <button
                  type="button"
                  onClick={() => scroll('left')}
                  aria-label="Scroll left"
                  className="w-7 h-7 rounded-full bg-[#17181f] border border-white/[0.08] hover:border-white/25 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll('right')}
                  aria-label="Scroll right"
                  className="w-7 h-7 rounded-full bg-[#17181f] border border-white/[0.08] hover:border-white/25 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
                  className="w-7 h-7 rounded-full bg-[#17181f] border border-white/[0.08] hover:border-white/25 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll('left')}
                  aria-label="تمرير لليسار"
                  className="w-7 h-7 rounded-full bg-[#17181f] border border-white/[0.08] hover:border-white/25 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
        {items.map((item, idx) => (
          <MediaCard
            key={item.id}
            item={item}
            index={idx}
            onSelect={onSelectMedia}
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={onToggleFavorite}
            isAlertSubscribed={alertSubscribedIds.includes(item.id)}
            onToggleAlert={onToggleAlert ? () => onToggleAlert(item.id) : undefined}
            watchProgress={history.find((h) => h.mediaId === item.id)}
            variant={variant}
          />
        ))}
      </div>
    </motion.section>
  );
};
