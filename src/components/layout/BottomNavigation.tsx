import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Settings, LayoutGrid, Heart, Clock, Plus, X } from 'lucide-react';
import { BottomNavTab } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface BottomNavigationProps {
  currentTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  isSettingsOpen?: boolean;
}

type FabPhase = 'closed' | 'lifting' | 'open' | 'collapsing';

// Identical command sequence (M L C C L C L C L C L C Z) for 60fps SVG path morphing
const DOCK_PATH_CRADLED =
  'M 26,0 L 132,0 C 150,0 152,32 180,32 C 208,32 210,0 228,0 L 334,0 C 348.36,0 360,11.64 360,26 L 360,42 C 360,56.36 348.36,68 334,68 L 26,68 C 11.64,68 0,56.36 0,42 L 0,26 C 0,11.64 11.64,0 26,0 Z';

const DOCK_PATH_FLAT =
  'M 26,0 L 132,0 C 150,0 152,0 180,0 C 208,0 210,0 228,0 L 334,0 C 348.36,0 360,11.64 360,26 L 360,42 C 360,56.36 348.36,68 334,68 L 26,68 C 11.64,68 0,56.36 0,42 L 0,26 C 0,11.64 11.64,0 26,0 Z';

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  isSettingsOpen = false,
}) => {
  const { t } = useLanguage();
  const [fabPhase, setFabPhase] = useState<FabPhase>('closed');
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (isSettingsOpen && (fabPhase === 'open' || fabPhase === 'lifting')) {
      clearTimers();
      setFabPhase('closed');
    }
  }, [isSettingsOpen, fabPhase]);

  const openFabMenu = () => {
    if (fabPhase === 'open' || fabPhase === 'lifting') return;
    clearTimers();
    setFabPhase('lifting');
    const t1 = window.setTimeout(() => {
      setFabPhase('open');
    }, 150);
    timersRef.current.push(t1);
  };

  const closeFabMenu = () => {
    if (fabPhase === 'closed' || fabPhase === 'collapsing') return;
    clearTimers();
    setFabPhase('collapsing');
    const t1 = window.setTimeout(() => {
      setFabPhase('closed');
    }, 240);
    timersRef.current.push(t1);
  };

  const handleToggleFab = () => {
    if (fabPhase === 'closed' || fabPhase === 'collapsing') {
      openFabMenu();
    } else {
      closeFabMenu();
    }
  };

  const handlePrimarySelect = (tab: BottomNavTab) => {
    if (fabPhase !== 'closed') {
      closeFabMenu();
    }
    onSelectTab(tab);
  };

  const handleQuickActionSelect = (tab: BottomNavTab) => {
    closeFabMenu();
    onSelectTab(tab);
  };

  const isHomeActive = !isSettingsOpen && currentTab === 'home';
  const isSettingsActive = isSettingsOpen || currentTab === 'settings';
  const hasQuickTabActive =
    !isSettingsOpen &&
    (currentTab === 'categories' ||
      currentTab === 'favorites' ||
      currentTab === 'history');

  const quickActions: {
    id: BottomNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'categories',
      label: t('التصنيفات', 'Categories'),
      icon: LayoutGrid,
    },
    {
      id: 'favorites',
      label: t('المفضلة', 'Favorites'),
      icon: Heart,
    },
    {
      id: 'history',
      label: t('السجل', 'History'),
      icon: Clock,
    },
  ];

  const isLiftedOrOpen = fabPhase === 'lifting' || fabPhase === 'open';
  const isWidePill = fabPhase === 'open';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden pointer-events-none select-none px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
      {/* Invisible outside click catcher while floating pill is expanded */}
      {isLiftedOrOpen && (
        <div
          aria-hidden="true"
          onClick={closeFabMenu}
          className="fixed inset-0 pointer-events-auto z-0"
        />
      )}

      <nav
        aria-label={t('التنقل السفلي للموبايل', 'Mobile bottom navigation')}
        className="pointer-events-auto relative z-10 w-full max-w-[360px] h-[68px] mx-auto"
      >
        {/* Morphing Curved-Notch Dock Background (MASHHAD Dark Obsidian + White Rim) */}
        <svg
          viewBox="0 0 360 68"
          fill="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full drop-shadow-[0_14px_34px_rgba(0,0,0,0.85)] overflow-visible"
        >
          <defs>
            <linearGradient id="mashhadDockFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1c1924" stopOpacity="0.97" />
              <stop offset="100%" stopColor="#121017" stopOpacity="0.99" />
            </linearGradient>
          </defs>
          <motion.path
            d={isLiftedOrOpen ? DOCK_PATH_FLAT : DOCK_PATH_CRADLED}
            animate={{ d: isLiftedOrOpen ? DOCK_PATH_FLAT : DOCK_PATH_CRADLED }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            fill="url(#mashhadDockFill)"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="1.2"
          />
        </svg>

        {/* Center Morphing Floating Crimson Action Button / Expanded Capsule */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-[22px] z-20 flex items-center justify-center">
          <motion.div
            initial={false}
            animate={{
              y: fabPhase === 'closed' ? 0 : -40,
              width: isWidePill ? 296 : 48,
              height: isWidePill ? 52 : 48,
            }}
            transition={{
              y: { type: 'spring', stiffness: 460, damping: 30 },
              width: { type: 'spring', stiffness: 420, damping: 30 },
              height: { type: 'spring', stiffness: 420, damping: 30 },
            }}
            style={{ maxWidth: 'calc(100vw - 28px)' }}
            className={`pointer-events-auto relative rounded-full bg-gradient-to-br from-[#ef232a] via-[#ea1d24] to-[#c51219] border border-white/25 flex items-center justify-center overflow-hidden ${
              hasQuickTabActive && fabPhase === 'closed'
                ? 'ring-2 ring-white/80 shadow-[0_10px_28px_rgba(234,29,36,0.62)]'
                : 'shadow-[0_10px_28px_rgba(234,29,36,0.48)]'
            }`}
          >
            {/* Soft top gloss reflection */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3 top-0.5 h-2 rounded-full bg-white/20 blur-[2px]"
            />

            <AnimatePresence mode="wait" initial={false}>
              {fabPhase === 'closed' && (
                <motion.button
                  key="fab-plus"
                  type="button"
                  onClick={handleToggleFab}
                  aria-label={t('القائمة السريعة', 'Quick navigation menu')}
                  aria-expanded={false}
                  initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                  transition={{ duration: 0.14 }}
                  className="w-full h-full flex items-center justify-center text-white cursor-pointer active:scale-90 transition-transform focus:outline-none"
                >
                  <Plus className="w-5 h-5 stroke-[2.6]" />
                </motion.button>
              )}

              {fabPhase === 'lifting' && (
                <motion.span
                  key="fab-dot-up"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.12 }}
                  className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.85)]"
                />
              )}

              {fabPhase === 'open' && (
                <motion.div
                  key="fab-expanded-actions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="w-full h-full px-1.5 flex items-center justify-between gap-1"
                >
                  {quickActions.map((action, idx) => {
                    const ActionIcon = action.icon;
                    const active = !isSettingsOpen && currentTab === action.id;
                    return (
                      <motion.button
                        key={action.id}
                        type="button"
                        onClick={() => handleQuickActionSelect(action.id)}
                        aria-label={action.label}
                        title={action.label}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03, duration: 0.14 }}
                        className={`flex-1 min-w-0 h-10 px-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer active:scale-95 ${
                          active
                            ? 'bg-white text-[#ea1d24] shadow-sm'
                            : 'text-white hover:bg-white/15'
                        }`}
                      >
                        <ActionIcon className="w-[15px] h-[15px] stroke-[2.2] shrink-0" />
                        <span className="text-[9.5px] font-extrabold leading-none whitespace-nowrap">
                          {action.label}
                        </span>
                      </motion.button>
                    );
                  })}

                  <motion.button
                    type="button"
                    onClick={closeFabMenu}
                    aria-label={t('إغلاق القائمة السريعة', 'Close quick menu')}
                    title={t('إغلاق', 'Close')}
                    initial={{ opacity: 0, scale: 0.7, rotate: -45 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ delay: 0.09, duration: 0.14 }}
                    className="w-9 h-9 rounded-full bg-black/20 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer active:scale-90 shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </motion.button>
                </motion.div>
              )}

              {fabPhase === 'collapsing' && (
                <motion.div
                  key="fab-four-dots"
                  initial={{ opacity: 0.9, scale: 1 }}
                  animate={{ opacity: 1, scale: 0.75 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center justify-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="w-2 h-2 rounded-full bg-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Dock Side Navigation Anchors (Exact Mirror Corners on Both Wings) */}
        <div className="relative z-10 w-full h-full px-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handlePrimarySelect('home')}
            aria-label={t('الرئيسية', 'Home')}
            aria-current={isHomeActive ? 'page' : undefined}
            className="relative w-[104px] h-[35px] px-2.5 rounded-full flex items-center justify-center gap-1.5 cursor-pointer group focus:outline-none active:scale-95 transition-transform"
          >
            {isHomeActive && (
              <motion.span
                layoutId="bottomDockActivePill"
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                className="pointer-events-none absolute inset-0 rounded-full bg-white shadow-[0_4px_14px_rgba(255,255,255,0.2)] overflow-hidden"
              >
                <motion.span
                  aria-hidden="true"
                  initial={{ x: '-120%' }}
                  animate={{ x: '220%' }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[#ea1d24]/20 to-transparent -skew-x-12"
                />
              </motion.span>
            )}

            <motion.span
              animate={isHomeActive ? { scale: [0.85, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.28 }}
              className={`relative z-10 flex items-center justify-center shrink-0 ${
                isHomeActive
                  ? 'text-[#ea1d24]'
                  : 'text-zinc-200 group-hover:text-white'
              }`}
            >
              <Home
                className={`w-[15px] h-[15px] ${
                  isHomeActive ? 'stroke-[2.4]' : 'stroke-[2]'
                }`}
              />
            </motion.span>

            <span
              className={`relative z-10 text-[11px] font-bold tracking-tight whitespace-nowrap transition-colors ${
                isHomeActive
                  ? 'text-[#121017]'
                  : 'text-zinc-200 group-hover:text-white'
              }`}
            >
              {t('الرئيسية', 'Home')}
            </span>
          </button>

          {/* Symmetric Center Spacer Underneath Curved Cradle */}
          <div className="w-[82px] shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={() => handlePrimarySelect('settings')}
            aria-label={t('الإعدادات', 'Settings')}
            aria-current={isSettingsActive ? 'page' : undefined}
            className="relative w-[104px] h-[35px] px-2.5 rounded-full flex items-center justify-center gap-1.5 cursor-pointer group focus:outline-none active:scale-95 transition-transform"
          >
            {isSettingsActive && (
              <motion.span
                layoutId="bottomDockActivePill"
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                className="pointer-events-none absolute inset-0 rounded-full bg-white shadow-[0_4px_14px_rgba(255,255,255,0.2)] overflow-hidden"
              >
                <motion.span
                  aria-hidden="true"
                  initial={{ x: '-120%' }}
                  animate={{ x: '220%' }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[#ea1d24]/20 to-transparent -skew-x-12"
                />
              </motion.span>
            )}

            <motion.span
              animate={
                isSettingsActive
                  ? { rotate: 90, scale: [0.85, 1.12, 1] }
                  : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.32 }}
              className={`relative z-10 flex items-center justify-center shrink-0 ${
                isSettingsActive
                  ? 'text-[#ea1d24]'
                  : 'text-zinc-200 group-hover:text-white'
              }`}
            >
              <Settings
                className={`w-[15px] h-[15px] ${
                  isSettingsActive ? 'stroke-[2.4]' : 'stroke-[2]'
                }`}
              />
            </motion.span>

            <span
              className={`relative z-10 text-[11px] font-bold tracking-tight whitespace-nowrap transition-colors ${
                isSettingsActive
                  ? 'text-[#121017]'
                  : 'text-zinc-200 group-hover:text-white'
              }`}
            >
              {t('الإعدادات', 'Settings')}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
