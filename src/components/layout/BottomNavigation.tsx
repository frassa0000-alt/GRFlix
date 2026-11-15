import React from 'react';
import { motion } from 'motion/react';
import { Home, Tv, Heart, Settings } from 'lucide-react';
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
    { id: 'series', labelAr: 'المسلسلات', labelEn: 'Series', icon: Tv },
    { id: 'favorites', labelAr: 'المفضلة', labelEn: 'Favorites', icon: Heart },
    { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: Settings },
  ];

  const isTabActive = (id: BottomNavTab) => {
    if (isSettingsOpen) return id === 'settings';
    return currentTab === id;
  };

  return (
    <nav
      aria-label={t('التنقل السفلي للموبايل', 'Mobile bottom navigation')}
      className="fixed bottom-0 inset-x-0 z-40 md:hidden rounded-t-[26px] bg-[#121216]/96 backdrop-blur-2xl border-t border-white/[0.09] pb-[env(safe-area-inset-bottom)] shadow-[0_-14px_38px_rgba(0,0,0,0.92)] overflow-hidden"
    >
      <div className="max-w-md mx-auto h-[68px] px-3 flex items-center justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.id);
          const label = lang === 'en' ? tab.labelEn : tab.labelAr;

          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex-1 min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-200 cursor-pointer ${
                active ? 'text-[#F7C600]' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <motion.div
                animate={
                  active
                    ? {
                        y: -1.5,
                        scale: 1.12,
                        rotate: tab.id === 'settings' ? 25 : 0,
                      }
                    : { y: 0, scale: 1, rotate: 0 }
                }
                transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                className="relative z-10 flex items-center justify-center"
              >
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    active
                      ? tab.id === 'settings'
                        ? 'stroke-[2.2] text-[#F7C600]'
                        : 'stroke-[2.2] fill-[#F7C600] text-[#F7C600]'
                      : 'stroke-[1.9]'
                  }`}
                />
              </motion.div>

              <motion.span
                animate={active ? { scale: 1.03 } : { scale: 1 }}
                transition={{ duration: 0.18 }}
                className="relative z-10 text-[11px] font-bold leading-none whitespace-nowrap"
              >
                {label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

