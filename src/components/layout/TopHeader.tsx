import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Bell,
  Menu,
  X,
  LayoutGrid,
  Clapperboard,
  Tv,
  Flame,
  Zap,
  Drama,
  Ghost,
  Laugh,
  Rocket,
  Compass,
  Star,
  Heart,
} from 'lucide-react';
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
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'home', labelAr: 'الرئيسية', labelEn: 'Home', tab: 'home', icon: LayoutGrid },
  { id: 'movies', labelAr: 'الأفلام', labelEn: 'Movies', tab: 'movies', icon: Clapperboard },
  { id: 'series', labelAr: 'المسلسلات', labelEn: 'Series', tab: 'series', icon: Tv },
  { id: 'categories', labelAr: 'أكثر', labelEn: 'More', bottomTab: 'categories', icon: Star },
  { id: 'trending', labelAr: 'الأكثر مشاهدة', labelEn: 'Trending', tab: 'trending', icon: Flame },
  { id: 'action', labelAr: 'أكشن', labelEn: 'Action', tab: 'action', icon: Zap },
  { id: 'drama', labelAr: 'دراما', labelEn: 'Drama', tab: 'drama', icon: Drama },
  { id: 'horror', labelAr: 'رعب', labelEn: 'Horror', tab: 'horror', icon: Ghost },
  { id: 'comedy', labelAr: 'كوميديا', labelEn: 'Comedy', tab: 'comedy', icon: Laugh },
  { id: 'sci-fi', labelAr: 'خيال علمي', labelEn: 'Sci-Fi', tab: 'sci-fi', icon: Rocket },
  { id: 'adventure', labelAr: 'مغامرات', labelEn: 'Adventure', tab: 'adventure', icon: Compass },
  { id: 'favorites', labelAr: 'المفضلة', labelEn: 'Favorites', tab: 'favorites', bottomTab: 'favorites', icon: Heart },
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
    <header className="sticky top-0 z-30 w-full bg-[#070709]/88 backdrop-blur-2xl select-none font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Row 1: Circular Gold Drawer Button · Centered GoldenFlix Logo · Circular Search + Bell */}
        <div className="h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Start Zone: Circular 3-bar Menu Button */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleOpenMenuSafely}
              type="button"
              aria-label={t('فتح القائمة الجانبية', 'Open Menu')}
              className="w-11 h-11 rounded-full bg-[#17171c] hover:bg-[#1f1f26] text-[#F7C600] flex items-center justify-center border border-[#F7C600]/25 hover:border-[#F7C600]/50 shadow-md transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Center Brand Mark (on mobile centered; on desktop compact left-aligned + inline search) */}
          <div className="flex-1 flex items-center justify-center md:justify-between gap-4 min-w-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleBrandClick}
              className="flex items-center gap-2 cursor-pointer group shrink-0"
              title={t('العودة للرئيسية', 'Back to Home')}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#ffe047] via-[#F7C600] to-[#d99b00] text-black flex items-center justify-center shadow-[0_4px_16px_rgba(247,198,0,0.35)] group-hover:scale-105 transition-transform shrink-0">
                <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
              {brandDisplay.toLowerCase().includes('golden') ? (
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white whitespace-nowrap">
                  Golden<span className="text-[#F7C600]">Flix</span>
                </span>
              ) : (
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white whitespace-nowrap">
                  {brandDisplay}
                </span>
              )}
            </motion.button>

            {/* Desktop Inline Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-2 relative items-center">
              <Search
                className={`w-4 h-4 text-zinc-400 absolute pointer-events-none ${
                  dir === 'ltr' ? 'left-3.5' : 'right-3.5'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('ابحث عن فيلم أو مسلسل...', 'Search movies or series...')}
                className={`w-full h-10 bg-[#15151a] hover:bg-[#1b1b22] focus:bg-[#121218] text-zinc-100 placeholder-zinc-500 text-xs font-medium rounded-full border border-white/10 focus:border-[#F7C600]/70 focus:outline-none focus:ring-2 focus:ring-[#F7C600]/15 transition-all ${
                  dir === 'ltr' ? 'pl-10 pr-8' : 'pr-10 pl-8'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label={t('مسح البحث', 'Clear search')}
                  className={`absolute p-1 text-zinc-400 hover:text-white cursor-pointer ${
                    dir === 'ltr' ? 'right-3' : 'left-3'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* End Zone: Circular Search + Notifications Bell */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={t('البحث', 'Search')}
              className={`md:hidden w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                mobileSearchOpen || searchQuery
                  ? 'bg-[#F7C600]/15 border-[#F7C600]/45 text-[#F7C600]'
                  : 'bg-[#17171c] hover:bg-[#1f1f26] border-white/10 text-zinc-200 hover:text-white'
              }`}
            >
              <Search className="w-4.5 h-4.5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowNotifications((v) => !v)}
              type="button"
              aria-label={t('الإشعارات', 'Notifications')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border relative cursor-pointer shrink-0 ${
                showNotifications
                  ? 'bg-[#F7C600]/15 border-[#F7C600]/45 text-[#F7C600]'
                  : 'bg-[#17171c] hover:bg-[#1f1f26] text-zinc-200 hover:text-white border-white/10'
              }`}
            >
              <Bell className="w-4.5 h-4.5" />
              {activeNotifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#F7C600] text-black text-[9px] font-black flex items-center justify-center leading-none tabular-nums">
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
                    dir === 'ltr' ? 'left-3.5' : 'right-3.5'
                  }`}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t('ابحث عن فيلم أو مسلسل...', 'Search movies or series...')}
                  className="w-full h-10 bg-[#15151a] text-zinc-100 placeholder-zinc-500 text-xs font-medium rounded-full px-10 border border-white/10 focus:border-[#F7C600]/70 focus:outline-none"
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
                      dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 2: Pill Navigation Strip Matching Mockup (Bright Gold Active Pill + Charcoal Inactive Pills) */}
        <nav
          aria-label={t('التنقل الرئيسي', 'Main navigation')}
          className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar pb-3 pt-1"
        >
          {TOP_NAV_ITEMS.map((item) => {
            const active = isNavActive(item);
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => handleTopNavClick(item)}
                className={`relative shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[#F7C600] text-black font-black shadow-[0_6px_18px_rgba(247,198,0,0.3)] border border-[#F7C600]'
                    : 'bg-[#15151a] hover:bg-[#1e1e26] text-zinc-200 hover:text-white border border-white/[0.08]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-black' : 'text-zinc-300'}`} />
                <span>{lang === 'en' ? item.labelEn : item.labelAr}</span>
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
              className={`fixed sm:absolute top-16 left-3 right-3 sm:w-96 max-w-full bg-[#111116] border border-[#F7C600]/30 rounded-2xl p-4 shadow-[0_24px_60px_rgba(0,0,0,0.95)] z-50 ${
                dir === 'ltr'
                  ? 'sm:left-auto sm:right-6 text-left'
                  : 'sm:right-auto sm:left-6 text-right'
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F7C600]/15 text-[#F7C600] flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-black text-white">
                    {t('الإشعارات', 'Notifications')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#F7C600] tabular-nums">
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
                      className="p-3 rounded-xl bg-zinc-900/90 border border-white/[0.08] hover:border-[#F7C600]/35 transition-colors"
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
