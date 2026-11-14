import React from 'react';
import { motion } from 'motion/react';
import { Home, Film, Tv, User, LogIn } from 'lucide-react';
import { AppUserProfile, BottomNavTab } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface BottomNavigationProps {
  currentTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  user?: AppUserProfile | null;
  isProfileOpen?: boolean;
  isAuthOpen?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  user,
  isProfileOpen = false,
  isAuthOpen = false,
}) => {
  const { lang, t } = useLanguage();
  const isLoggedIn = Boolean(user);

  const tabs: {
    id: BottomNavTab;
    labelAr: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', labelAr: 'الرئيسية', labelEn: 'Home', icon: Home },
    { id: 'movies', labelAr: 'الأفلام', labelEn: 'Movies', icon: Film },
    { id: 'series', labelAr: 'المسلسلات', labelEn: 'Series', icon: Tv },
    {
      id: 'profile',
      labelAr: isLoggedIn ? 'حسابي' : 'دخول',
      labelEn: isLoggedIn ? 'Account' : 'Sign In',
      icon: isLoggedIn ? User : LogIn,
    },
  ];

  const isTabActive = (id: BottomNavTab) => {
    if (isProfileOpen || isAuthOpen) return id === 'profile';
    return currentTab === id;
  };

  return (
    <nav
      aria-label={t('التنقل السفلي للموبايل', 'Mobile bottom navigation')}
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#08080c]/95 backdrop-blur-2xl border-t border-white/10 pb-[env(safe-area-inset-bottom)] shadow-[0_-14px_36px_rgba(0,0,0,0.88)]"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" />
      <div className="max-w-md mx-auto h-16 px-2 flex items-center justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.id);
          const showUserAvatar =
            tab.id === 'profile' && isLoggedIn && Boolean(user?.picture || user?.photoURL);
          const label = lang === 'en' ? tab.labelEn : tab.labelAr;

          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex-1 min-h-[46px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-amber-400'
                  : tab.id === 'profile' && !isLoggedIn
                  ? 'text-amber-300/90 hover:text-amber-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {active && (
                <>
                  <motion.div
                    layoutId="mobileBottomGlowBg"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-x-1 inset-y-1 rounded-xl bg-amber-400/10 border border-amber-400/20"
                  />
                  <motion.div
                    layoutId="mobileBottomIndicator"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute top-0 w-9 h-[2.5px] rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                  />
                </>
              )}

              <motion.div
                animate={active ? { y: -1, scale: 1.06 } : { y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                className="relative z-10 flex items-center justify-center"
              >
                {showUserAvatar ? (
                  <img
                    src={user?.picture || user?.photoURL}
                    alt={user?.name || label}
                    referrerPolicy="no-referrer"
                    className={`w-5 h-5 rounded-full object-cover border ${
                      active ? 'border-amber-400' : 'border-zinc-500'
                    }`}
                  />
                ) : (
                  <Icon className={`w-4.5 h-4.5 ${active ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
                )}
              </motion.div>

              <span className="relative z-10 text-[11px] font-bold leading-none whitespace-nowrap">
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
