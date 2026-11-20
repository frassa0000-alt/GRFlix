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
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden pointer-events-none select-none px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
      <nav
        aria-label={t('التنقل السفلي للموبايل', 'Mobile bottom navigation')}
        className="pointer-events-auto relative w-full max-w-md mx-auto rounded-[28px] bg-[#1a1c26]/96 backdrop-blur-md border border-white/[0.07] p-2 shadow-[0_14px_34px_rgba(0,0,0,0.75)] flex items-center justify-between gap-1"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.id);
          const label = lang === 'en' ? tab.labelEn : tab.labelAr;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              title={label}
              className={`relative min-h-[46px] flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                active
                  ? 'px-4 sm:px-5 shrink-0'
                  : 'flex-1 min-w-[44px] text-white/80 hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobileBottomNavPill"
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-[#e6e8ec] shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
                />
              )}

              <span
                className={`relative z-10 flex items-center justify-center gap-2 whitespace-nowrap ${
                  active ? 'text-[#111319]' : 'text-white/85'
                }`}
              >
                <Icon
                  className={`w-[21px] h-[21px] shrink-0 transition-transform duration-200 ${
                    active ? 'stroke-[2] scale-[1.02]' : 'stroke-[1.7]'
                  }`}
                />
                {active && (
                  <span className="text-xs font-bold tracking-tight whitespace-nowrap">
                    {label}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
