import React from 'react';
import { motion } from 'motion/react';
import { Home, Film, Tv, User } from 'lucide-react';
import { AppUserProfile, BottomNavTab } from '../../types';

interface BottomNavigationProps {
  currentTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  user?: AppUserProfile | null;
  isProfileOpen?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  user,
  isProfileOpen = false,
}) => {
  const tabs: {
    id: BottomNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'movies', label: 'الأفلام', icon: Film },
    { id: 'series', label: 'المسلسلات', icon: Tv },
    { id: 'profile', label: 'حسابي', icon: User },
  ];

  const isTabActive = (id: BottomNavTab) => {
    if (isProfileOpen) return id === 'profile';
    return currentTab === id;
  };

  return (
    <nav
      aria-label="التنقل السفلي للموبايل"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#08080b]/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,0.85)]"
    >
      <div className="max-w-md mx-auto h-16 px-2 flex items-center justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.id);
          const showUserAvatar = tab.id === 'profile' && Boolean(user?.picture || user?.photoURL);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
                active ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="mobileBottomIndicator"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute top-0 w-8 h-[2.5px] rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]"
                />
              )}

              {showUserAvatar ? (
                <img
                  src={user?.picture || user?.photoURL}
                  alt={user?.name || 'حسابي'}
                  referrerPolicy="no-referrer"
                  className={`w-5 h-5 rounded-full object-cover border ${
                    active ? 'border-amber-400' : 'border-zinc-600'
                  }`}
                />
              ) : (
                <Icon className={`w-4.5 h-4.5 ${active ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
              )}

              <span className="text-[11px] font-bold leading-none whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
