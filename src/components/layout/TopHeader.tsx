import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, Menu, X } from 'lucide-react';
import {
  ActiveTab,
  BottomNavTab,
  GoogleUserProfile,
  NotificationItem,
} from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface TopHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSideMenu: () => void;
  onOpenGoogleLogin: () => void;
  googleUser: GoogleUserProfile | null;
  activeTab: ActiveTab;
  bottomNavTab: BottomNavTab;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectBottomTab: (tab: BottomNavTab) => void;
  notifications: NotificationItem[];
  siteName?: string;
}

const TOP_NAV_ITEMS: {
  id: string;
  labelAr: string;
  labelEn: string;
  tab?: ActiveTab;
  bottomTab?: BottomNavTab;
}[] = [
  { id: 'home', labelAr: 'الرئيسية', labelEn: 'Home', tab: 'home' },
  { id: 'movies', labelAr: 'الأفلام', labelEn: 'Movies', tab: 'movies' },
  { id: 'series', labelAr: 'المسلسلات', labelEn: 'Series', tab: 'series' },
  { id: 'trending', labelAr: 'الأكثر مشاهدة', labelEn: 'Trending', tab: 'trending' },
  { id: 'action', labelAr: 'أكشن', labelEn: 'Action', tab: 'action' },
  { id: 'drama', labelAr: 'دراما', labelEn: 'Drama', tab: 'drama' },
  { id: 'horror', labelAr: 'رعب', labelEn: 'Horror', tab: 'horror' },
  { id: 'comedy', labelAr: 'كوميديا', labelEn: 'Comedy', tab: 'comedy' },
  { id: 'sci-fi', labelAr: 'خيال علمي', labelEn: 'Sci-Fi', tab: 'sci-fi' },
  { id: 'adventure', labelAr: 'مغامرات', labelEn: 'Adventure', tab: 'adventure' },
  { id: 'categories', labelAr: 'التصنيفات', labelEn: 'Categories', bottomTab: 'categories' },
  { id: 'favorites', labelAr: 'المفضلة', labelEn: 'Favorites', tab: 'favorites', bottomTab: 'favorites' },
];

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSideMenu,
  activeTab,
  bottomNavTab,
  onSelectTab,
  onSelectBottomTab,
  notifications,
  siteName,
}) => {
  const { lang, dir, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const activeNotifications = React.useMemo(
    () =>
      (notifications || [])
        .filter((n) => n.isActive !== false)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [notifications]
  );

  const handleOpenMenuSafely = () => {
    setShowNotifications(false);
    onOpenSideMenu();
  };

  const handleBrandClick = () => {
    setShowNotifications(false);
    onSearchChange('');
    onSelectTab('home');
    onSelectBottomTab('home');
  };

  const handleTopNavClick = (item: (typeof TOP_NAV_ITEMS)[number]) => {
    setShowNotifications(false);
    if (searchQuery) {
      onSearchChange('');
    }
    if (item.bottomTab && !item.tab) {
      onSelectBottomTab(item.bottomTab);
      return;
    }
    if (item.tab) {
      onSelectTab(item.tab);
    }
  };

  const isNavActive = (item: (typeof TOP_NAV_ITEMS)[number]) => {
    if (searchQuery.trim().length > 0) return false;
    if (item.id === 'categories') return bottomNavTab === 'categories';
    if (item.id === 'favorites') return bottomNavTab === 'favorites' || activeTab === 'favorites';
    if (
      bottomNavTab === 'categories' ||
      bottomNavTab === 'history' ||
      bottomNavTab === 'favorites'
    ) {
      return false;
    }
    if (item.id === 'home') return activeTab === 'home';
    return item.tab === activeTab;
  };

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return t('حديث', 'New');
    const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
    if (diffMin < 60) return lang === 'en' ? `${diffMin}m ago` : `منذ ${diffMin} د`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return lang === 'en' ? `${diffHr}h ago` : `منذ ${diffHr} س`;
    const diffDays = Math.floor(diffHr / 24);
    return lang === 'en' ? `${diffDays}d ago` : `منذ ${diffDays} ي`;
  };

  const brandDisplay = siteName?.trim() || 'GoldenFlix';

  return (
    <header className="sticky top-0 z-30 w-full bg-[#070709]/90 backdrop-blur-2xl border-b border-white/[0.08] select-none font-sans">
      {/* Subtle Golden Ambient Top Accent */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/45 to-transparent cinema-header-aurora" />

      <div className="max-w-7xl mx-auto px-2.5 sm:px-6">
        {/* Row 1: Three-Bar Menu + Brand + Search + Notifications (No Language or Login button in TopBar) */}
        <div className="h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Start Zone: Menu (Three Bars) + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleOpenMenuSafely}
              type="button"
              aria-label={t('فتح القائمة الجانبية', 'Open Menu')}
              className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-amber-400/15 text-amber-400 flex items-center justify-center border border-white/[0.08] hover:border-amber-400/35 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-4.5 h-4.5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleBrandClick}
              className={`flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0 ${
                dir === 'ltr' ? 'text-left' : 'text-right'
              }`}
              title={t('العودة للرئيسية', 'Back to Home')}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-black flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.3)] group-hover:shadow-[0_0_26px_rgba(251,191,36,0.5)] group-hover:scale-105 transition-all shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                {brandDisplay.toLowerCase().includes('golden') ? (
                  <span className="text-xl sm:text-2xl md:text-[26px] font-black tracking-tight text-white whitespace-nowrap">
                    Golden<span className="text-amber-400">Flix</span>
                  </span>
                ) : (
                  <span className="text-xl sm:text-2xl md:text-[26px] font-black tracking-tight text-white whitespace-nowrap">
                    {brandDisplay}
                  </span>
                )}
              </div>
            </motion.button>
          </div>

          {/* Center Inline Search (Desktop/Tablet md+) */}
          <div className="hidden md:flex flex-1 max-w-md mx-2 relative items-center">
            <Search
              className={`w-3.5 h-3.5 text-zinc-400 absolute pointer-events-none ${
                dir === 'ltr' ? 'left-3.5' : 'right-3.5'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('ابحث عن فيلم أو مسلسل...', 'Search movies or series...')}
              className={`w-full h-10 bg-white/[0.05] hover:bg-white/[0.08] focus:bg-[#121218] text-zinc-100 placeholder-zinc-500 text-xs font-medium rounded-xl border border-white/[0.08] focus:border-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400/15 transition-all ${
                dir === 'ltr' ? 'pl-9.5 pr-8' : 'pr-9.5 pl-8'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label={t('مسح البحث', 'Clear search')}
                className={`absolute p-1 text-zinc-400 hover:text-white cursor-pointer ${
                  dir === 'ltr' ? 'right-2' : 'left-2'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* End Zone: Mobile Search + Notifications Bell */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={t('البحث', 'Search')}
              className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                mobileSearchOpen || searchQuery
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-400'
                  : 'bg-white/[0.05] border-white/[0.08] text-zinc-300 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowNotifications((v) => !v)}
              type="button"
              aria-label={t('الإشعارات', 'Notifications')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border relative cursor-pointer shrink-0 ${
                showNotifications
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-400'
                  : 'bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 hover:text-white border-white/[0.08]'
              }`}
            >
              <Bell className="w-4 h-4" />
              {activeNotifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-400 text-black text-[9px] font-black flex items-center justify-center leading-none tabular-nums">
                  {activeNotifications.length > 9 ? '9+' : activeNotifications.length}
                </span>
              )}
            </motion.button>
          </div>
        </div>

        {/* Mobile Expandable Search Input */}
        <AnimatePresence initial={false}>
          {(mobileSearchOpen || searchQuery.trim().length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden overflow-hidden pb-2.5"
            >
              <div className="relative flex items-center w-full">
                <Search
                  className={`w-4 h-4 text-zinc-400 absolute pointer-events-none ${
                    dir === 'ltr' ? 'left-3' : 'right-3'
                  }`}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t('ابحث عن فيلم أو مسلسل...', 'Search movies or series...')}
                  className="w-full h-10 bg-[#121217] text-zinc-100 placeholder-zinc-500 text-xs font-medium rounded-xl px-9 border border-white/10 focus:border-amber-400/70 focus:outline-none"
                />
                {(searchQuery || mobileSearchOpen) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (searchQuery) {
                        onSearchChange('');
                      } else {
                        setMobileSearchOpen(false);
                      }
                    }}
                    aria-label={t('إغلاق أو مسح البحث', 'Clear or close search')}
                    className={`absolute p-1.5 text-zinc-400 hover:text-white cursor-pointer ${
                      dir === 'ltr' ? 'right-2' : 'left-2'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 2: Unified Top Navigation Strip with Animated Pill Highlight */}
        <nav
          aria-label={t('التنقل الرئيسي', 'Main navigation')}
          className="flex items-center justify-start md:justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1.5 border-t border-white/[0.05]"
        >
          {TOP_NAV_ITEMS.map((item) => {
            const active = isNavActive(item);
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => handleTopNavClick(item)}
                className={`relative shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active ? 'text-amber-300' : 'text-zinc-300 hover:text-white'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="topHeaderNavActiveBg"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-amber-400/12 border border-amber-400/30"
                  />
                )}
                <span className="relative z-10">{lang === 'en' ? item.labelEn : item.labelAr}</span>
                {active && (
                  <motion.div
                    layoutId="topHeaderNavUnderline"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* Notifications Dropdown Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px]"
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              dir={dir}
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`fixed sm:absolute top-16 left-3 right-3 sm:w-96 max-w-full bg-[#111116] border border-amber-500/30 rounded-2xl p-4 shadow-[0_24px_60px_rgba(0,0,0,0.95)] z-50 ${
                dir === 'ltr'
                  ? 'sm:left-auto sm:right-6 text-left'
                  : 'sm:right-auto sm:left-6 text-right'
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/15 text-amber-400 flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-black text-white">
                    {t('الإشعارات', 'Notifications')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-400 tabular-nums">
                    {activeNotifications.length} {t('نشط', 'active')}
                  </span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    type="button"
                    aria-label={t('إغلاق الإشعارات', 'Close notifications')}
                    className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {activeNotifications.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 space-y-1">
                  <Bell className="w-7 h-7 mx-auto text-zinc-600 mb-2" />
                  <p className="text-xs font-bold text-zinc-300">
                    {t('لا توجد إشعارات جديدة حالياً', 'No new notifications right now')}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {t(
                      'ستظهر تنبيهات الأعمال المضافة حديثاً هنا فور نشرها.',
                      'Alerts for newly published releases will appear here.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto overscroll-contain no-scrollbar">
                  {activeNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-xl bg-zinc-900/90 border border-white/[0.08] hover:border-amber-400/35 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-black text-white leading-snug">
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">
                          {formatTimeAgo(n.createdAt)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-[11px] text-zinc-300 mt-1.5 leading-relaxed break-words">
                          {n.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};
