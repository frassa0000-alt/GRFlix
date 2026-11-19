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
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden pointer-events-none select-none">
      <nav
        aria-label={t('التنقل السفلي للموبايل', 'Mobile bottom navigation')}
        className="pointer-events-auto relative w-full bg-[#130f18]/96 backdrop-blur-2xl border-t border-white/[0.06] px-6 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(0,0,0,0.8)] flex items-center justify-around"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.id);
          const label = lang === 'en' ? tab.labelEn : tab.labelAr;

          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => onSelectTab(tab.id)}
              aria-label={label}
              title={label}
              className="relative min-w-[48px] h-10 flex items-center justify-center cursor-pointer focus:outline-none"
            >
              <motion.span
                animate={active ? { scale: 1.12 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 460, damping: 26 }}
                className="flex items-center justify-center"
              >
                <Icon
                  className={`w-[22px] h-[22px] transition-colors duration-200 ${
                    active
                      ? tab.id === 'settings'
                        ? 'text-[#ea1d24] stroke-[#ea1d24] stroke-[2.3]'
                        : 'text-[#ea1d24] fill-[#ea1d24] stroke-[#ea1d24] stroke-[1.8]'
                      : 'text-zinc-400 hover:text-zinc-200 stroke-[1.8]'
                  }`}
                />
              </motion.span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};
