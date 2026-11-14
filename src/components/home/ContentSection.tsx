import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ChevronLeft, Film, Tv, Flame, Sparkles } from 'lucide-react';
import { MediaItem } from '../../types';
import { MediaCard } from '../cards/MediaCard';
import { useLanguage } from '../../contexts/LanguageContext';

interface ContentSectionProps {
  title: string;
  iconType?: 'movies' | 'series' | 'trending' | 'sparkles';
  items: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onViewAll?: () => void;
  variant?: 'poster' | 'landscape';
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  title,
  iconType = 'movies',
  items,
  onSelectMedia,
  favorites,
  onToggleFavorite,
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

  const SectionIcon =
    iconType === 'series'
      ? Tv
      : iconType === 'trending'
      ? Flame
      : iconType === 'sparkles'
      ? Sparkles
      : Film;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="mb-9 relative"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/5 border border-amber-400/35 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(251,191,36,0.12)]">
            <SectionIcon className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg md:text-xl font-black text-white flex items-center gap-2 truncate">
            <span className="truncate">{title}</span>
            <span className="text-xs font-mono font-bold text-amber-400 tabular-nums shrink-0">
              ({items.length})
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="min-h-[38px] px-2.5 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('عرض الكل', 'View All')}
            </button>
          )}

          {/* Desktop Navigation Arrows */}
          <div className="hidden md:flex items-center gap-1.5">
            {dir === 'ltr' ? (
              <>
                <button
                  type="button"
                  onClick={() => scroll('left')}
                  aria-label="Scroll left"
                  className="w-8 h-8 rounded-xl bg-zinc-900/90 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-amber-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll('right')}
                  aria-label="Scroll right"
                  className="w-8 h-8 rounded-xl bg-zinc-900/90 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-amber-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => scroll('right')}
                  aria-label="تمرير لليمين"
                  className="w-8 h-8 rounded-xl bg-zinc-900/90 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-amber-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll('left')}
                  aria-label="تمرير لليسار"
                  className="w-8 h-8 rounded-xl bg-zinc-900/90 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-amber-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 md:gap-4 overflow-x-auto no-scrollbar py-1.5"
      >
        {items.map((item, idx) => (
          <MediaCard
            key={item.id}
            item={item}
            index={idx}
            onSelect={onSelectMedia}
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={onToggleFavorite}
            variant={variant}
          />
        ))}
      </div>
    </motion.section>
  );
};
