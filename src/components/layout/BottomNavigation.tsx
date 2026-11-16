import React from 'react';
import { motion } from 'motion/react';
import { Home, Search, Heart, Settings } from 'lucide-react';
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
    { id: 'search', labelAr: 'البحث', labelEn: 'Search', icon: Search },
    { id: 'favorites', labelAr: 'المفضلة', labelEn: 'Favorites', icon: Heart },
    { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: Settings },
  ];

  const isTabActive = (id: BottomNavTab) => {
    if (isSettingsOpen) return id === 'settings';
    return currentTab === id;
  };

  return (
    <div className="fixed bottom-2.5 inset-x-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)] flex justify-center px-4 pointer-events-none select-none">
      <nav
        aria-label={t('التنقل السفلي للموبايل', 'Mobile bottom navigation')}
        className="pointer-events-auto relative inline-flex items-center gap-1 rounded-full bg-[#101116]/75 backdrop-blur-xl border border-white/[0.12] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.14)]"
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
              className={`relative min-w-[66px] min-h-[42px] px-3 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200 cursor-pointer ${
                active ? 'text-[#F7C600]' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="bottomNavActivePill"
                  transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-[#F7C600]/[0.13] border border-[#F7C600]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                />
              )}

              <span
                className={`relative z-10 flex items-center justify-center transition-transform duration-200 ${
                  active ? '-translate-y-[0.5px]' : ''
                }`}
              >
                <Icon
                  className={`w-[17px] h-[17px] transition-all duration-200 ${
                    active
                      ? tab.id === 'favorites'
                        ? 'fill-[#F7C600] text-[#F7C600] stroke-[1.9]'
                        : 'text-[#F7C600] stroke-[2.2]'
                      : 'stroke-[1.9]'
                  }`}
                />
              </span>

              <span
                className={`relative z-10 text-[9.5px] leading-none whitespace-nowrap transition-all ${
                  active ? 'font-bold text-[#F7C600]' : 'font-medium text-zinc-400'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

