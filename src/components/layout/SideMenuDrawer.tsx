import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Film,
  LayoutGrid,
  Heart,
  Clock,
  User,
  Tv,
  LogIn,
  UserPlus,
  ShieldCheck,
  Flame,
  Star,
  Clapperboard,
  Globe,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ActiveTab, BottomNavTab, GoogleUserProfile } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { MashhadLogo } from '../common/MashhadLogo';

interface SideMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectBottomTab: (tab: BottomNavTab) => void;
  favoritesCount: number;
  historyCount: number;
  onOpenAdminDashboard: () => void;
  googleUser: GoogleUserProfile | null;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenProfileModal: () => void;
  hasAdminAccess?: boolean;
  siteName?: string;
}

interface MenuRowConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  count?: number;
  subtitle?: string;
  avatarUrl?: string;
}

const MashhadEmblem: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <MashhadLogo className={className} roundedClassName="rounded-lg" />
);

export const SideMenuDrawer: React.FC<SideMenuDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onSelectBottomTab,
  favoritesCount,
  historyCount,
  onOpenAdminDashboard,
  googleUser,
  onOpenLogin,
  onOpenRegister,
  onOpenProfileModal,
  hasAdminAccess = false,
  siteName = 'MASHHAD',
}) => {
  const { lang, dir, setLang, t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const isDeveloperUser =
    (googleUser?.email || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com';
  const canAccessAdmin = isDeveloperUser || Boolean(hasAdminAccess);
  const rawTitle = (siteName || '').trim();
  const brandTitle =
    !rawTitle || /^(goldenflix|goldenfelix|جولدن(\s+فليكس)?)$/i.test(rawTitle)
      ? 'MASHHAD'
      : rawTitle;

  useEffect(() => {
    if (isOpen) {
      setHoveredKey(null);
    }
  }, [isOpen]);

  const handleCopySiteLink = async () => {
    const siteUrl = 'https://gr-flix.vercel.app/';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(siteUrl);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = siteUrl;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        // Ignore fallback failure
      }
      document.body.removeChild(textarea);
    }
  };

  const handleNav = (tab: ActiveTab) => {
    onSelectTab(tab);
    onClose();
  };

  // Preserve earlier rule: never show 'home' inside Settings
  const resolvedActiveKey =
    activeTab && activeTab !== 'home' ? activeTab : 'movies';
  const highlightedKey = hoveredKey || resolvedActiveKey;

  const menuItems: MenuRowConfig[] = [
    {
      key: 'movies',
      label: t('الأفلام السينمائية', 'Movies'),
      icon: Film,
      onClick: () => handleNav('movies'),
    },
    {
      key: 'series',
      label: t('المسلسلات التلفزيونية', 'TV Series'),
      icon: Tv,
      onClick: () => handleNav('series'),
    },
    {
      key: 'latest',
      label: t('أحدث الإضافات', 'Latest Releases'),
      icon: Clapperboard,
      onClick: () => handleNav('latest'),
    },
    {
      key: 'trending',
      label: t('الأكثر مشاهدة', 'Most Watched'),
      icon: Flame,
      onClick: () => handleNav('trending'),
    },
    {
      key: 'top_rated',
      label: t('الأعلى تقييماً', 'Top Rated'),
      icon: Star,
      onClick: () => handleNav('top_rated'),
    },
    {
      key: 'categories',
      label: t('التصنيفات والأنواع', 'Categories'),
      icon: LayoutGrid,
      onClick: () => {
        onSelectBottomTab('categories');
        onClose();
      },
    },
    {
      key: 'favorites',
      label: t('المفضلة', 'Favorites'),
      icon: Heart,
      count: favoritesCount,
      onClick: () => {
        onSelectBottomTab('favorites');
        onClose();
      },
    },
    {
      key: 'history',
      label: t('سجل المشاهدة', 'Watch History'),
      icon: Clock,
      count: historyCount,
      onClick: () => {
        onSelectBottomTab('history');
        onClose();
      },
    },
  ];

  if (googleUser) {
    menuItems.push({
      key: 'account',
      label: googleUser.name || t('حسابي', 'Profile'),
      subtitle: googleUser.email,
      avatarUrl: googleUser.picture || googleUser.photoURL,
      icon: User,
      onClick: () => {
        onClose();
        onOpenProfileModal();
      },
    });
  } else {
    menuItems.push(
      {
        key: 'account',
        label: t('تسجيل الدخول', 'Sign In'),
        icon: LogIn,
        onClick: () => {
          onClose();
          onOpenLogin();
        },
      },
      {
        key: 'register',
        label: t('إنشاء حساب جديد', 'Create Account'),
        icon: UserPlus,
        onClick: () => {
          onClose();
          onOpenRegister();
        },
      }
    );
  }

  if (canAccessAdmin) {
    menuItems.push({
      key: 'admin',
      label: isDeveloperUser
        ? t('حساب مطور', 'Developer Console')
        : t('لوحة الإدارة المتعاونة', 'Admin Console'),
      icon: ShieldCheck,
      onClick: () => {
        onClose();
        onOpenAdminDashboard();
      },
    });
  }

  const CollapseChevron =
    dir === 'ltr'
      ? isCollapsed
        ? ChevronRight
        : ChevronLeft
      : isCollapsed
      ? ChevronLeft
      : ChevronRight;

  const renderActiveRowBackdrop = (isHighlighted: boolean) => {
    if (!isHighlighted) return null;
    return (
      <motion.span
        layoutId="settingsMonochromeActiveBox"
        transition={{ type: 'spring', stiffness: 430, damping: 32 }}
        style={{
          background:
            'linear-gradient(125deg, rgba(255,255,255,0.13) 0%, rgba(28,28,32,0.92) 34%, rgba(12,12,15,0.98) 76%, rgba(255,255,255,0.08) 100%)',
        }}
        className="pointer-events-none absolute inset-0 rounded-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_6px_18px_rgba(0,0,0,0.45)]"
      />
    );
  };

  const renderMenuRow = (item: MenuRowConfig) => {
    const Icon = item.icon;
    const isHighlighted = highlightedKey === item.key;

    return (
      <motion.button
        key={item.key}
        type="button"
        onClick={item.onClick}
        onMouseEnter={() => setHoveredKey(item.key)}
        onFocus={() => setHoveredKey(item.key)}
        whileTap={{ scale: 0.985 }}
        title={isCollapsed ? item.label : undefined}
        className={`relative w-full min-h-[44px] rounded-xl flex items-center transition-colors cursor-pointer group outline-none border ${
          isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
        } ${
          isHighlighted
            ? 'border-transparent bg-transparent'
            : 'border-white/[0.07] bg-[#161619] hover:bg-[#1b1b1f] hover:border-white/[0.13]'
        }`}
      >
        {renderActiveRowBackdrop(isHighlighted)}

        <div
          className={`relative z-10 flex items-center min-w-0 ${
            isCollapsed ? 'justify-center' : 'gap-2.5'
          }`}
        >
          {/* Rounded-Square Icon Tile: Solid White on Active, Dark Outlined Box on Inactive */}
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden transition-all duration-200 ${
              item.avatarUrl
                ? isHighlighted
                  ? 'ring-2 ring-white bg-white'
                  : 'ring-1 ring-white/20 bg-[#1e1e23]'
                : isHighlighted
                ? 'bg-white text-[#0d0d0f] shadow-[0_2px_10px_rgba(255,255,255,0.25)]'
                : 'border border-white/[0.11] bg-[#1c1c20] text-zinc-300 group-hover:text-white group-hover:border-white/25'
            }`}
          >
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt={item.label}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon className="w-[15px] h-[15px] stroke-[2]" />
            )}
          </span>

          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: dir === 'ltr' ? -5 : 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir === 'ltr' ? -5 : 5 }}
                transition={{ duration: 0.15 }}
                className="min-w-0 flex flex-col text-start"
              >
                <span
                  className={`text-[13.5px] tracking-tight truncate whitespace-nowrap ${
                    isHighlighted
                      ? 'text-white font-semibold'
                      : 'text-zinc-200 group-hover:text-white font-medium'
                  }`}
                >
                  {item.label}
                </span>
                {item.subtitle && (
                  <span className="text-[10px] text-zinc-400 truncate font-mono leading-tight">
                    {item.subtitle}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clean Minimal Count Indicator */}
        {!isCollapsed && typeof item.count === 'number' && item.count > 0 && (
          <span
            className={`relative z-10 min-w-[22px] h-[20px] px-1.5 rounded-md border text-[11px] font-medium tabular-nums flex items-center justify-center shrink-0 transition-colors ${
              isHighlighted
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-white/[0.1] bg-white/[0.03] text-zinc-400'
            }`}
          >
            {item.count}
          </span>
        )}
      </motion.button>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          dir={dir}
          className="fixed inset-0 z-[60] overflow-hidden select-none font-sans"
        >
          {/* Dimmed Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Matte Obsidian Floating Sidebar Panel (Expanded & Collapsed Icon Rail) */}
          <motion.aside
            initial={{
              x: dir === 'ltr' ? '-108%' : '108%',
              opacity: 0.65,
            }}
            animate={{
              x: 0,
              opacity: 1,
              width: isCollapsed ? 66 : 302,
              borderRadius: isCollapsed ? 18 : 20,
            }}
            exit={{
              x: dir === 'ltr' ? '-108%' : '108%',
              opacity: 0.4,
            }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onMouseLeave={() => setHoveredKey(null)}
            style={{ maxWidth: 'calc(100vw - 24px)' }}
            className={`absolute top-3 bottom-3 flex flex-col overflow-hidden bg-[#111113] border border-white/[0.07] shadow-[0_24px_80px_rgba(0,0,0,0.9)] z-10 ${
              dir === 'ltr' ? 'left-3 text-left' : 'right-3 text-right'
            }`}
          >
            {/* Minimalist Top Bar: Brand Identity + Collapse Chevron & Close */}
            <div
              className={`relative z-10 flex items-center shrink-0 pt-4 pb-3 ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'
              }`}
            >
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <MashhadEmblem className="w-7 h-7 shadow-sm" />
                  <span className="text-[14.5px] font-bold tracking-tight text-white truncate">
                    {brandTitle}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => !prev)}
                  className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
                  aria-label={
                    isCollapsed ? t('توسيع القائمة', 'Expand') : t('طي القائمة', 'Collapse')
                  }
                  title={
                    isCollapsed
                      ? t('توسيع القائمة', 'Expand Menu')
                      : t('طي للأيقونات', 'Collapse Rail')
                  }
                >
                  <CollapseChevron className="w-4 h-4 stroke-[2]" />
                </button>

                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
                    aria-label={t('إغلاق الإعدادات', 'Close Settings')}
                    title={t('إغلاق', 'Close')}
                  >
                    <X className="w-4 h-4 stroke-[2]" />
                  </button>
                )}
              </div>
            </div>

            {/* Unified Stacked Box List — NO Section Dividers ("بدون اي جدوله") */}
            <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none px-3">
              <div className="space-y-2 pb-2">
                {menuItems.map(renderMenuRow)}

                {/* Language Switch Row matching identical stacked card box */}
                <div
                  onMouseEnter={() => setHoveredKey('language')}
                  onClick={
                    isCollapsed
                      ? () => setLang(lang === 'ar' ? 'en' : 'ar')
                      : undefined
                  }
                  role={isCollapsed ? 'button' : undefined}
                  tabIndex={isCollapsed ? 0 : undefined}
                  title={isCollapsed ? t('تبديل اللغة', 'Switch Language') : undefined}
                  className={`relative w-full min-h-[44px] rounded-xl flex items-center transition-colors group border ${
                    isCollapsed
                      ? 'justify-center px-0 cursor-pointer'
                      : 'justify-between px-2.5'
                  } ${
                    highlightedKey === 'language'
                      ? 'border-transparent bg-transparent'
                      : 'border-white/[0.07] bg-[#161619] hover:bg-[#1b1b1f] hover:border-white/[0.13]'
                  }`}
                >
                  {renderActiveRowBackdrop(highlightedKey === 'language')}

                  <div
                    className={`relative z-10 flex items-center min-w-0 ${
                      isCollapsed ? 'justify-center' : 'gap-2.5'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                        highlightedKey === 'language'
                          ? 'bg-white text-[#0d0d0f] shadow-[0_2px_10px_rgba(255,255,255,0.25)]'
                          : 'border border-white/[0.11] bg-[#1c1c20] text-zinc-300 group-hover:text-white group-hover:border-white/25'
                      }`}
                    >
                      <Globe className="w-[15px] h-[15px] stroke-[2]" />
                    </span>

                    {!isCollapsed && (
                      <span
                        className={`text-[13.5px] tracking-tight truncate ${
                          highlightedKey === 'language'
                            ? 'text-white font-semibold'
                            : 'text-zinc-200 group-hover:text-white font-medium'
                        }`}
                      >
                        {t('لغة الموقع', 'Language')}
                      </span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="relative z-10 flex items-center gap-0.5 bg-[#0e0e10] p-0.5 rounded-lg border border-white/[0.1] shrink-0">
                      <button
                        type="button"
                        onClick={() => setLang('ar')}
                        className={`relative px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          lang === 'ar' ? 'text-[#0d0d0f]' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {lang === 'ar' && (
                          <motion.span
                            layoutId="drawerLangPillMonochrome"
                            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                            className="absolute inset-0 rounded-md bg-white shadow-sm"
                          />
                        )}
                        <span className="relative z-10">عربي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        className={`relative px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          lang === 'en' ? 'text-[#0d0d0f]' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {lang === 'en' && (
                          <motion.span
                            layoutId="drawerLangPillMonochrome"
                            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                            className="absolute inset-0 rounded-md bg-white shadow-sm"
                          />
                        )}
                        <span className="relative z-10">EN</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Centered Transparent Miniature Site-Link Video at Bottom (No Box, No Side Text) */}
            <div className="relative z-10 shrink-0 px-3 pt-2 pb-3 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopySiteLink}
                title="https://gr-flix.vercel.app/"
                aria-label={t(
                  'نسخ رابط الموقع https://gr-flix.vercel.app/',
                  'Copy site link https://gr-flix.vercel.app/'
                )}
                className={`bg-transparent border-0 p-0 shadow-none outline-none cursor-pointer active:scale-[0.97] transition-transform flex items-center justify-center ${
                  isCollapsed ? 'w-11 aspect-video' : 'w-[128px] aspect-video'
                }`}
              >
                <video
                  src="/assets/settings-site-link.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  disablePictureInPicture
                  controls={false}
                  className="w-full h-full object-contain bg-transparent pointer-events-none select-none"
                />
              </button>

              {isCollapsed && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
                  aria-label={t('إغلاق الإعدادات', 'Close Settings')}
                  title={t('إغلاق', 'Close')}
                >
                  <X className="w-4 h-4 stroke-[2]" />
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
