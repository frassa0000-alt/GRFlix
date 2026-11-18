import React from 'react';
import { motion } from 'motion/react';
import { Home, LayoutGrid, Heart, Settings } from 'lucide-react';
import { BottomNavTab } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface BottomNavigationProps {
  currentTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  isSettingsOpen?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  isSettingsOpen = false,
}) => {
  const { lang, t } = useLanguage();

  const tabs: {
    id: BottomNavTab;
    labelAr: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', labelAr: 'الرئيسية', labelEn: 'Home', icon: Home },
    { id: 'categories', labelAr: 'التصنيفات', labelEn: 'Categories', icon: LayoutGrid },
    { id: 'favorites', labelAr: 'المفضلة', labelEn: 'Favorites', icon: Heart },
    { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: Settings },
  ];

  const isTabActive = (id: BottomNavTab) => {
    if (isSettingsOpen) return id === 'settings';
    return currentTab === id;
  };

  return (
    <div className="fixed bottom-3 inset-x-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)] flex justify-center px-4 pointer-events-none select-none">
      <nav
        aria-label={t('التنقل السفلي للموبايل', 'Mobile bottom navigation')}
        className="pointer-events-auto relative inline-flex items-center gap-2 sm:gap-3 rounded-full bg-[#151619]/95 backdrop-blur-xl border border-white/[0.1] p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.78)]"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.id);
          const label = lang === 'en' ? tab.labelEn : tab.labelAr;

          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 520, damping: 30 }}
              onClick={() => onSelectTab(tab.id)}
              aria-label={label}
              title={label}
              className="relative w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {active && (
                <motion.div
                  layoutId="bottomNavActiveCircle"
                  transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
                />
              )}

              <span className="relative z-10 flex items-center justify-center">
                <Icon
                  className={`w-[21px] h-[21px] transition-colors duration-200 stroke-[2.1] ${
                    active ? 'text-[#151619]' : 'text-white'
                  }`}
                />
              </span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

