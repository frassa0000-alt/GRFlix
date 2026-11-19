import React from 'react';
import { motion } from 'motion/react';
import { Home, Flame, Clock, Star, Film, Tv, PlaySquare, Heart } from 'lucide-react';
import { ActiveTab } from '../../types';

interface CategoryCapsulesProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  favoritesCount?: number;
}

export const CategoryCapsules: React.FC<CategoryCapsulesProps> = ({
  activeTab,
  onSelectTab,
  favoritesCount = 0,
}) => {
  const categories: {
    id: ActiveTab;
    label: string;
    renderIcon: (isActive: boolean) => React.ReactNode;
  }[] = [
    {
      id: 'home',
      label: 'الرئيسية',
      renderIcon: (isActive) => (
        <Home className={`w-3 h-3 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
      ),
    },
    {
      id: 'latest',
      label: 'الأحدث',
      renderIcon: (isActive) => (
        <motion.span
          animate={isActive ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex"
        >
          <Clock className="w-3 h-3" />
        </motion.span>
      ),
    },
    {
      id: 'trending',
      label: 'المشاهدة',
      renderIcon: (isActive) => (
        <motion.span
          animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.45 }}
          className="inline-flex"
        >
          <Flame className="w-3 h-3" />
        </motion.span>
      ),
    },
    {
      id: 'top_rated',
      label: 'التقييم',
      renderIcon: (isActive) => (
        <motion.span
          animate={isActive ? { rotate: [0, 20, 0], scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.45 }}
          className="inline-flex"
        >
          <Star className={`w-3 h-3 ${isActive ? 'fill-current' : ''}`} />
        </motion.span>
      ),
    },
    {
      id: 'movies',
      label: 'الأفلام',
      renderIcon: () => <Film className="w-3 h-3" />,
    },
    {
      id: 'series',
      label: 'المسلسلات',
      renderIcon: () => <Tv className="w-3 h-3" />,
    },
    {
      id: 'anime',
      label: 'الأنمي',
      renderIcon: () => <PlaySquare className="w-3 h-3" />,
    },
    {
      id: 'favorites',
      label: 'المفضلة',
      renderIcon: (isActive) => (
        <span className="relative flex items-center">
          <Heart className={`w-3 h-3 ${isActive ? 'fill-current' : ''}`} />
          {favoritesCount > 0 && (
            <span
              className={`absolute -top-1.5 -right-1.5 font-black text-[8px] w-3 h-3 rounded-full flex items-center justify-center ${
                isActive ? 'bg-black text-amber-400' : 'bg-amber-500 text-black'
              }`}
            >
              {favoritesCount}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mb-4 flex justify-center px-1">
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-full bg-zinc-900/85 backdrop-blur-xl border border-zinc-800/90 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.85)]">
        {categories.map((cat, idx) => {
          const isActive = activeTab === cat.id;
          return (
            <motion.button
              key={cat.id}
              type="button"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.025 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => onSelectTab(cat.id)}
              className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-colors duration-200 cursor-pointer shrink-0 ${
                isActive
                  ? 'text-black font-black'
                  : 'text-zinc-300 hover:text-white font-bold'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTopCapsuleBg"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-md shadow-amber-500/25"
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                {cat.renderIcon(isActive)}
                <span>{cat.label}</span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
