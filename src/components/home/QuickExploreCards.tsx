import React from 'react';
import { motion } from 'motion/react';
import { Clock, Flame, Star } from 'lucide-react';
import { ActiveTab } from '../../types';

interface QuickExploreCardsProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  latestCount: number;
  trendingCount: number;
  topRatedCount: number;
}

export const QuickExploreCards: React.FC<QuickExploreCardsProps> = ({
  activeTab,
  onSelectTab,
  latestCount,
  trendingCount,
  topRatedCount,
}) => {
  const cards: {
    id: ActiveTab;
    title: string;
    count: number;
    accentText: string;
    accentBg: string;
    iconAnimation: { y?: number[]; rotate?: number[]; scale?: number[] };
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'latest',
      title: 'الأحدث',
      count: latestCount,
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-400/15 border-amber-400/30',
      iconAnimation: { rotate: [0, -10, 10, 0] },
      Icon: Clock,
    },
    {
      id: 'trending',
      title: 'الأكثر مشاهدة',
      count: trendingCount,
      accentText: 'text-rose-400',
      accentBg: 'bg-rose-400/15 border-rose-400/30',
      iconAnimation: { scale: [1, 1.15, 1], y: [0, -1.5, 0] },
      Icon: Flame,
    },
    {
      id: 'top_rated',
      title: 'الأعلى تقييماً',
      count: topRatedCount,
      accentText: 'text-sky-400',
      accentBg: 'bg-sky-400/15 border-sky-400/30',
      iconAnimation: { rotate: [0, 12, -12, 0], scale: [1, 1.1, 1] },
      Icon: Star,
    },
  ];

  return (
    <div className="flex justify-center mb-5 px-2">
      <div className="inline-flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
        {cards.map((card, index) => {
          const Icon = card.Icon;
          const isSelected = activeTab === card.id;

          return (
            <motion.button
              key={card.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: [0, -3, 0],
              }}
              transition={{
                opacity: { duration: 0.28, delay: index * 0.08 },
                y: {
                  duration: 3.4,
                  delay: index * 0.45,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
              whileHover={{ y: -5, scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => onSelectTab(card.id)}
              className={`group flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border backdrop-blur-xl transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-zinc-900/95 border-amber-400/70 shadow-[0_10px_24px_-4px_rgba(250,204,21,0.22)]'
                  : 'bg-zinc-900/80 hover:bg-zinc-900 border-zinc-800/90 hover:border-amber-400/40 shadow-[0_10px_25px_-6px_rgba(0,0,0,0.85)]'
              }`}
            >
              <motion.span
                animate={card.iconAnimation}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 1.4,
                  ease: 'easeInOut',
                }}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border flex items-center justify-center shrink-0 ${card.accentBg} ${card.accentText}`}
              >
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </motion.span>

              <span className="text-[11px] sm:text-xs font-black text-white whitespace-nowrap">
                {card.title}
              </span>

              {card.count > 0 && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-zinc-800/90 text-amber-400">
                  {card.count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
