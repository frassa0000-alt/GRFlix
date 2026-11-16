import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Bell,
  X,
  LayoutGrid,
  Clapperboard,
  Tv,
  Zap,
  Drama,
  Ghost,
  Laugh,
  Rocket,
  Compass,
  Star,
  Heart,
  User,
  Play,
  BellRing,
  CheckCheck,
  Trash2,
  Clock,
} from 'lucide-react';
import {
  ActiveTab,
  BottomNavTab,
  GoogleUserProfile,
  MediaAlertSubscription,
  NotificationItem,
  UserReleaseNotification,
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
  releaseNotifications?: UserReleaseNotification[];
  mediaAlerts?: MediaAlertSubscription[];
  onSelectReleaseNotification?: (notif: UserReleaseNotification) => void;
  onMarkAllReleaseRead?: () => void;
  onRemoveMediaAlert?: (mediaId: string) => void;
  onOpenAlertMedia?: (mediaId: string) => void;
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
  { id: 'movies', labelAr: 'الأفلام', labelEn: 'Movies', tab: 'movies', icon: Star },
  { id: 'series', labelAr: 'المسلسلات', labelEn: 'Series', tab: 'series', icon: Clapperboard },
  { id: 'favorites', labelAr: 'المفضلة', labelEn: 'Favorites', tab: 'favorites', bottomTab: 'favorites', icon: Heart },
  { id: 'categories', labelAr: 'التصنيفات', labelEn: 'Categories', bottomTab: 'categories', icon: Tv },
  { id: 'action', labelAr: 'أكشن', labelEn: 'Action', tab: 'action', icon: Zap },
  { id: 'drama', labelAr: 'دراما', labelEn: 'Drama', tab: 'drama', icon: Drama },
  { id: 'horror', labelAr: 'رعب', labelEn: 'Horror', tab: 'horror', icon: Ghost },
  { id: 'comedy', labelAr: 'كوميديا', labelEn: 'Comedy', tab: 'comedy', icon: Laugh },
  { id: 'sci-fi', labelAr: 'خيال علمي', labelEn: 'Sci-Fi', tab: 'sci-fi', icon: Rocket },
  { id: 'adventure', labelAr: 'مغامرات', labelEn: 'Adventure', tab: 'adventure', icon: Compass },
];

let hasPlayedEntryLogoSpin = false;

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenGoogleLogin,
  googleUser,
  activeTab,
  bottomNavTab,
  onSelectTab,
  onSelectBottomTab,
  notifications,
  releaseNotifications = [],
  mediaAlerts = [],
  onSelectReleaseNotification,
  onMarkAllReleaseRead,
  onRemoveMediaAlert,
  onOpenAlertMedia,
  siteName = 'GoldenFlix',
}) => {
  const { lang, dir, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState<'feed' | 'alerts'>('feed');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [shouldSpinOnEntry] = useState<boolean>(() => !hasPlayedEntryLogoSpin);

  React.useEffect(() => {
    hasPlayedEntryLogoSpin = true;
  }, []);

  const displaySiteName = (siteName || 'GoldenFlix').trim() || 'GoldenFlix';

  const handleLogoClick = () => {
    setShowNotifications(false);
    if (searchQuery) {
      onSearchChange('');
    }
    if (activeTab !== 'home') {
      onSelectTab('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeNotifications = React.useMemo(
    () =>
      (notifications || [])
        .filter((n) => n.isActive !== false)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [notifications]
  );

  const unreadReleaseCount = React.useMemo(
    () => releaseNotifications.filter((n) => !n.read).length,
    [releaseNotifications]
  );

  const totalBadgeCount = unreadReleaseCount + activeNotifications.length;

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
      bottomNavTab === 'favorites' ||
      bottomNavTab === 'search'
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

  return (
    <header className="sticky top-0 z-30 w-full bg-[#070709]/90 backdrop-blur-2xl select-none font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Row 1: Profile + One-time Intro Spinning GoldenFelix · Desktop Search · Search + Bell */}
        <div className="h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
          {/* Start Zone: Profile/Login Button + GoldenFelix Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={onOpenGoogleLogin}
              type="button"
              aria-label={googleUser ? t('الملف الشخصي', 'My Profile') : t('تسجيل الدخول', 'Sign In')}
              title={googleUser ? googleUser.displayName || googleUser.name : t('تسجيل الدخول', 'Sign In')}
              className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#17171c] hover:bg-[#1f1f26] text-[#F7C600] flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                googleUser
                  ? 'border-[#F7C600] shadow-[0_0_18px_rgba(247,198,0,0.28)]'
                  : 'border-[#F7C600]/35 hover:border-[#F7C600]/65 shadow-[0_0_16px_rgba(247,198,0,0.12)]'
              }`}
            >
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                {googleUser?.picture || googleUser?.photoURL ? (
                  <img
                    src={googleUser.picture || googleUser.photoURL}
                    alt={googleUser.displayName || googleUser.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : googleUser ? (
                  <span className="text-xs sm:text-sm font-black text-[#F7C600]">
                    {(googleUser.displayName || googleUser.name || 'G').trim().charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-[#F7C600] text-[#F7C600]" />
                )}
              </div>
            </motion.button>

            {/* Horizontal Site Name Wordmark (Spins 360° once on site entry only) */}
            <motion.button
              type="button"
              onClick={handleLogoClick}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              aria-label="GoldenFelix"
              title="GoldenFelix"
              className="relative flex items-center cursor-pointer shrink-0 py-1 px-0.5 focus:outline-none"
            >
              <motion.span
                initial={shouldSpinOnEntry ? { rotate: 0, scale: 0.92 } : false}
                animate={shouldSpinOnEntry ? { rotate: 360, scale: 1 } : { rotate: 0, scale: 1 }}
                transition={{
                  rotate: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
                  scale: { duration: 0.5, ease: 'easeOut' },
                }}
                dir="ltr"
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-[#F7C600] text-[#F7C600] drop-shadow-[0_0_8px_rgba(247,198,0,0.45)] shrink-0" />
                {displaySiteName.trim().toLowerCase() === 'goldenflix' ||
                displaySiteName.trim().toLowerCase() === 'goldenfelix' ? (
                  <span className="text-[15px] sm:text-lg font-black tracking-tight leading-none">
                    <span className="text-white">Golden</span>
                    <span className="text-[#F7C600] drop-shadow-[0_0_10px_rgba(247,198,0,0.38)]">
                      Felix
                    </span>
                  </span>
                ) : (
                  <span className="text-[15px] sm:text-lg font-black tracking-tight text-[#F7C600] leading-none">
                    {displaySiteName}
                  </span>
                )}
              </motion.span>
            </motion.button>
          </div>

          {/* Center Zone: Desktop Search */}
          <div className="hidden md:flex flex-1 items-center justify-center min-w-0">
            {/* Desktop Inline Search */}
            <div className="flex flex-1 max-w-md mx-2 relative items-center">
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
          <div className="flex items-center gap-1.5 shrink-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={t('البحث', 'Search')}
              className={`md:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                mobileSearchOpen || searchQuery
                  ? 'bg-[#F7C600]/15 border-[#F7C600]/45 text-[#F7C600]'
                  : 'bg-[#17171c] hover:bg-[#1f1f26] border-white/10 text-zinc-200 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowNotifications((v) => !v)}
              type="button"
              aria-label={t('الإشعارات', 'Notifications')}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all border relative cursor-pointer shrink-0 ${
                showNotifications
                  ? 'bg-[#F7C600]/15 border-[#F7C600]/45 text-[#F7C600]'
                  : 'bg-[#17171c] hover:bg-[#1f1f26] text-zinc-200 hover:text-white border-white/10'
              }`}
            >
              <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              {totalBadgeCount > 0 && (
                <span
                  className={`absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-black flex items-center justify-center leading-none tabular-nums ${
                    unreadReleaseCount > 0
                      ? 'bg-emerald-400 text-black shadow-[0_0_8px_rgba(52,211,153,0.75)]'
                      : 'bg-[#F7C600] text-black'
                  }`}
                >
                  {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
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

        {/* Row 2: Pill Navigation Strip Matching Mockup */}
        <nav
          aria-label={t('التنقل الرئيسي', 'Main navigation')}
          className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar pb-3 pt-0.5"
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
                className={`relative shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
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
                    {t('الإشعارات والتنبيهات', 'Notifications & Alerts')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadReleaseCount > 0 && onMarkAllReleaseRead && (
                    <button
                      type="button"
                      onClick={onMarkAllReleaseRead}
                      title={t('تحديد الكل كمقروء', 'Mark all read')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>{t('قرأت الكل', 'Read all')}</span>
                    </button>
                  )}
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

              {/* Sub-tabs: الإشعارات vs التنبيهات المفعّلة */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900/90 rounded-xl border border-white/[0.06] mb-3">
                <button
                  type="button"
                  onClick={() => setNotifTab('feed')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    notifTab === 'feed'
                      ? 'bg-[#F7C600] text-black font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Bell className="w-3 h-3" />
                  <span>{t('الإشعارات', 'Notifications')}</span>
                  {releaseNotifications.length + activeNotifications.length > 0 && (
                    <span className="tabular-nums opacity-80">
                      ({releaseNotifications.length + activeNotifications.length})
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setNotifTab('alerts')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    notifTab === 'alerts'
                      ? 'bg-[#F7C600] text-black font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <BellRing className="w-3 h-3" />
                  <span>{t('التنبيهات المفعّلة', 'Active Alerts')}</span>
                  {mediaAlerts.length > 0 && (
                    <span className="tabular-nums opacity-80">({mediaAlerts.length})</span>
                  )}
                </button>
              </div>

              {notifTab === 'alerts' ? (
                mediaAlerts.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 space-y-1.5">
                    <BellRing className="w-7 h-7 mx-auto text-zinc-600 mb-2" />
                    <p className="text-xs font-bold text-zinc-300">
                      {t('لم تفعّل أي تنبيه بعد', 'No active alerts yet')}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {t(
                        'اضغط على "تنبيهي عند الإضافة" لأي فيلم أو مسلسل ليصلك إشعار عند توفر حلقات أو إضافات جديدة.',
                        'Tap "Notify Me When Added" on any movie or series to receive updates.'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto overscroll-contain no-scrollbar">
                    {mediaAlerts.map((alert) => (
                      <div
                        key={alert.mediaId}
                        className="p-2.5 rounded-xl bg-zinc-900/90 border border-white/[0.08] hover:border-[#F7C600]/35 transition-colors flex items-center gap-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifications(false);
                            onOpenAlertMedia?.(alert.mediaId);
                          }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-start cursor-pointer"
                        >
                          {alert.posterUrl ? (
                            <img
                              src={alert.posterUrl}
                              alt={alert.mediaTitle}
                              className="w-10 h-14 rounded-lg object-cover shrink-0 bg-zinc-800"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                              <BellRing className="w-4 h-4 text-[#F7C600]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-white truncate">
                              {alert.mediaTitle}
                            </h4>
                            <p className="text-[10px] text-amber-300/90 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {alert.mediaType === 'series'
                                  ? t(
                                      `متابعة الحلقات الجديدة (حالياً ${alert.knownEpisodeCount})`,
                                      `Tracking new episodes (current: ${alert.knownEpisodeCount})`
                                    )
                                  : alert.hadVideo
                                  ? t('متابعة التحديثات الجديدة', 'Tracking updates')
                                  : t('بانتظار الإضافة على المنصة', 'Waiting for release')}
                              </span>
                            </p>
                          </div>
                        </button>
                        {onRemoveMediaAlert && (
                          <button
                            type="button"
                            onClick={() => onRemoveMediaAlert(alert.mediaId)}
                            aria-label={t('إزالة التنبيه', 'Remove alert')}
                            className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : releaseNotifications.length === 0 && activeNotifications.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 space-y-1">
                  <Bell className="w-7 h-7 mx-auto text-zinc-600 mb-2" />
                  <p className="text-xs font-bold text-zinc-300">
                    {t('لا توجد إشعارات جديدة حالياً', 'No new notifications right now')}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {t(
                      'ستظهر تنبيهات الحلقات الجديدة والأعمال المضافة حديثاً هنا فور نشرها.',
                      'Alerts for new episodes and newly published releases will appear here.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto overscroll-contain no-scrollbar">
                  {releaseNotifications.map((rn) => (
                    <button
                      key={rn.id}
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        onSelectReleaseNotification?.(rn);
                      }}
                      className={`w-full text-start p-2.5 rounded-xl border transition-colors flex items-start gap-2.5 cursor-pointer ${
                        rn.read
                          ? 'bg-zinc-900/75 border-white/[0.06] hover:border-[#F7C600]/30'
                          : 'bg-[#F7C600]/10 border-[#F7C600]/45 hover:border-[#F7C600]/75'
                      }`}
                    >
                      {rn.posterUrl ? (
                        <img
                          src={rn.posterUrl}
                          alt={rn.mediaTitle || rn.title}
                          className="w-10 h-14 rounded-lg object-cover shrink-0 bg-zinc-800"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-[#F7C600]/15 flex items-center justify-center shrink-0">
                          <BellRing className="w-4 h-4 text-[#F7C600]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!rn.read && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            )}
                            <h4 className="text-xs font-black text-white leading-snug truncate">
                              {rn.title}
                            </h4>
                          </div>
                          <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">
                            {formatTimeAgo(rn.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed break-words">
                          {rn.message}
                        </p>
                      </div>
                    </button>
                  ))}

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
