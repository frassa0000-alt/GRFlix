import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, Menu, X, LogIn } from 'lucide-react';
import {
  ActiveTab,
  BottomNavTab,
  GoogleUserProfile,
  NotificationItem,
} from '../../types';

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
  label: string;
  tab?: ActiveTab;
  bottomTab?: BottomNavTab;
}[] = [
  { id: 'home', label: 'الرئيسية', tab: 'home' },
  { id: 'movies', label: 'الأفلام', tab: 'movies' },
  { id: 'series', label: 'المسلسلات', tab: 'series' },
  { id: 'trending', label: 'الأكثر مشاهدة', tab: 'trending' },
  { id: 'action', label: 'أكشن', tab: 'action' },
  { id: 'drama', label: 'دراما', tab: 'drama' },
  { id: 'horror', label: 'رعب', tab: 'horror' },
  { id: 'comedy', label: 'كوميديا', tab: 'comedy' },
  { id: 'sci-fi', label: 'خيال علمي', tab: 'sci-fi' },
  { id: 'adventure', label: 'مغامرات', tab: 'adventure' },
  { id: 'categories', label: 'التصنيفات', bottomTab: 'categories' },
  { id: 'favorites', label: 'المفضلة', tab: 'favorites', bottomTab: 'favorites' },
];

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSideMenu,
  onOpenGoogleLogin,
  googleUser,
  activeTab,
  bottomNavTab,
  onSelectTab,
  onSelectBottomTab,
  notifications,
  siteName,
}) => {
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
    if (!ts) return 'حديث';
    const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
    if (diffMin < 60) return `منذ ${diffMin} د`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `منذ ${diffHr} س`;
    const diffDays = Math.floor(diffHr / 24);
    return `منذ ${diffDays} ي`;
  };

  const brandDisplay = siteName?.trim() || 'GoldenFlix';

  return (
    <header className="sticky top-0 z-30 w-full bg-[#070709]/95 backdrop-blur-xl border-b border-white/[0.08] select-none font-sans">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6">
        {/* Row 1: Brand + Search + Notifications + Login */}
        <div className="h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Right Zone (RTL): Menu + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleOpenMenuSafely}
              type="button"
              aria-label="فتح القائمة الجانبية"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-amber-400 flex items-center justify-center border border-white/[0.08] transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleBrandClick}
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group text-right shrink-0"
              title="العودة للرئيسية"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-black flex items-center justify-center shadow-[0_0_18px_rgba(251,191,36,0.28)] group-hover:scale-105 transition-transform shrink-0">
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
            </button>
          </div>

          {/* Center Inline Search (Desktop/Tablet md+) */}
          <div className="hidden md:flex flex-1 max-w-md mx-2 relative items-center">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute right-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن فيلم أو مسلسل..."
              className="w-full h-9.5 bg-white/[0.05] hover:bg-white/[0.08] focus:bg-[#121218] text-zinc-100 placeholder-zinc-500 text-xs font-medium rounded-xl pr-9 pl-7 border border-white/[0.08] focus:border-amber-400/70 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="مسح البحث"
                className="absolute left-2 p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Left Zone (RTL): Search (Mobile) + Notifications + Login (when guest) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="البحث"
              className={`md:hidden w-9 h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                mobileSearchOpen || searchQuery
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-400'
                  : 'bg-white/[0.05] border-white/[0.08] text-zinc-300 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setShowNotifications((v) => !v)}
              type="button"
              aria-label="الإشعارات"
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all border relative cursor-pointer shrink-0 ${
                showNotifications
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-400'
                  : 'bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 hover:text-white border-white/[0.08]'
              }`}
            >
              <Bell className="w-4 h-4" />
              {activeNotifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-400 text-black text-[9px] font-black flex items-center justify-center leading-none">
                  {activeNotifications.length > 9 ? '9+' : activeNotifications.length}
                </span>
              )}
            </button>

            {/* Login button when user is not signed in */}
            {!googleUser && (
              <button
                onClick={onOpenGoogleLogin}
                type="button"
                className="h-9 sm:h-10 flex items-center gap-1.5 px-2.5 sm:px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-xs font-black transition-all cursor-pointer active:scale-95 shadow-md shadow-amber-500/15 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>دخول</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Expandable Search Input */}
        <AnimatePresence initial={false}>
          {(mobileSearchOpen || searchQuery.trim().length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="md:hidden overflow-hidden pb-2"
            >
              <div className="relative flex items-center w-full">
                <Search className="w-4 h-4 text-zinc-400 absolute right-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="ابحث عن فيلم أو مسلسل..."
                  className="w-full h-9.5 bg-[#121217] text-zinc-100 placeholder-zinc-500 text-xs font-medium rounded-xl pr-9 pl-9 border border-white/10 focus:border-amber-400/70 focus:outline-none"
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
                    aria-label="إغلاق أو مسح البحث"
                    className="absolute left-2 p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 2: Unified Top Navigation Strip */}
        <nav
          aria-label="التنقل الرئيسي"
          className="flex items-center justify-start md:justify-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar py-1.5 border-t border-white/[0.05]"
        >
          {TOP_NAV_ITEMS.map((item) => {
            const active = isNavActive(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTopNavClick(item)}
                className={`relative shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="topHeaderNavUnderline"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute bottom-0 inset-x-1.5 h-[2px] rounded-full bg-amber-400"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Notifications Dropdown Panel */}
      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px]"
            onClick={() => setShowNotifications(false)}
          />
          <div
            dir="rtl"
            className="fixed sm:absolute top-16 left-3 right-3 sm:right-auto sm:left-6 sm:w-96 max-w-full bg-[#111116] border border-amber-500/30 rounded-2xl p-4 shadow-[0_24px_60px_rgba(0,0,0,0.95)] z-50 text-right"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-400/15 text-amber-400 flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-black text-white">الإشعارات</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-400 tabular-nums">
                  {activeNotifications.length} نشط
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  type="button"
                  aria-label="إغلاق الإشعارات"
                  className="w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeNotifications.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 space-y-1">
                <Bell className="w-7 h-7 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs font-bold text-zinc-300">لا توجد إشعارات جديدة حالياً</p>
                <p className="text-[11px] text-zinc-500">
                  ستظهر تنبيهات الأعمال المضافة حديثاً هنا فور نشرها.
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
          </div>
        </>
      )}
    </header>
  );
};
