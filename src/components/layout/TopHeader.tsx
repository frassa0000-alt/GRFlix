import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Bell,
  X,
  User,
  BellRing,
  CheckCheck,
  Trash2,
  Clock,
  Menu,
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
import { MashhadLogo } from '../common/MashhadLogo';

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

export const GoldenOrbitalG: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <MashhadLogo className={className} roundedClassName="rounded-lg" />
);

const TOP_UNDERLINE_TABS: {
  id: string;
  labelAr: string;
  labelEn: string;
  tab: ActiveTab;
}[] = [
  { id: 'home', labelAr: 'الكل', labelEn: 'All', tab: 'home' },
  { id: 'movies', labelAr: 'الأفلام', labelEn: 'Movies', tab: 'movies' },
  { id: 'series', labelAr: 'المسلسلات', labelEn: 'Series', tab: 'series' },
  { id: 'latest', labelAr: 'أحدث الإضافات', labelEn: 'Latest', tab: 'latest' },
  { id: 'top_rated', labelAr: 'الأعلى تقييماً', labelEn: 'Top Rated', tab: 'top_rated' },
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
  notifications,
  releaseNotifications = [],
  mediaAlerts = [],
  onSelectReleaseNotification,
  onMarkAllReleaseRead,
  onRemoveMediaAlert,
  onOpenAlertMedia,
  siteName = 'MASHHAD',
}) => {
  const { lang, dir, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState<'feed' | 'alerts'>('feed');
  const [searchOpen, setSearchOpen] = useState(false);

  const cleanedRaw = (siteName || 'MASHHAD')
    .replace(/\s+cinema\b/gi, '')
    .replace(/\s+(سينما|سيما)\b/g, '')
    .trim();

  const displaySiteName =
    !cleanedRaw || /^(goldenflix|goldenfelix|جولدن(\s+فليكس)?)$/i.test(cleanedRaw)
      ? 'MASHHAD'
      : cleanedRaw;

  const userFirstName = (googleUser?.displayName || googleUser?.name || '')
    .trim()
    .split(/\s+/)[0];

  const handleLogoClick = () => {
    setShowNotifications(false);
    if (searchQuery) {
      onSearchChange('');
    }
    onSelectTab('home');
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

  const isTabActive = (tab: ActiveTab) => {
    if (searchQuery.trim().length > 0) return false;
    if (
      bottomNavTab === 'categories' ||
      bottomNavTab === 'history' ||
      bottomNavTab === 'favorites' ||
      bottomNavTab === 'search'
    ) {
      return false;
    }
    return activeTab === tab;
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
    <>
      <header
        dir={dir}
        className="sticky top-0 z-30 w-full select-none font-sans bg-[#0f0c14]/97 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 pb-1.5 space-y-2.5">
          {/* Top Greeting + Circular Notification & Profile Row Matching Reference Screen 1 */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleLogoClick}
              className="min-w-0 flex flex-col text-start cursor-pointer focus:outline-none"
            >
              <span className="text-[11px] font-bold text-zinc-400 leading-none">
                {t('أهلاً بك', 'Hello')}
              </span>
              <div className="flex items-center gap-1.5 mt-1 min-w-0">
                <GoldenOrbitalG className="w-5 h-5 shrink-0" />
                <span className="text-[17px] sm:text-xl font-black text-white tracking-tight truncate leading-none">
                  {userFirstName || displaySiteName}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label={t('البحث', 'Search')}
                className={`w-9 h-9 rounded-full flex items-center justify-center border transition-transform duration-150 hover:scale-105 active:scale-92 cursor-pointer ${
                  searchOpen || searchQuery
                    ? 'bg-[#ea1d24] text-white border-[#ea1d24]'
                    : 'bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 border-white/[0.08]'
                }`}
              >
                <Search className="w-4 h-4 stroke-[2.2]" />
              </button>

              <button
                onClick={() => setShowNotifications((v) => !v)}
                type="button"
                aria-label={t('الإشعارات', 'Notifications')}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center border transition-transform duration-150 hover:scale-105 active:scale-92 cursor-pointer ${
                  showNotifications
                    ? 'bg-[#ea1d24] text-white border-[#ea1d24]'
                    : 'bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 border-white/[0.08]'
                }`}
              >
                <Bell className="w-4 h-4 fill-current" />
                {totalBadgeCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ea1d24] text-white text-[9px] font-black flex items-center justify-center leading-none tabular-nums ring-2 ring-[#0f0c14]">
                    {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
                  </span>
                )}
              </button>

              <button
                onClick={onOpenGoogleLogin}
                type="button"
                aria-label={googleUser ? t('الملف الشخصي', 'My Profile') : t('تسجيل الدخول', 'Sign In')}
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] flex items-center justify-center overflow-hidden transition-transform duration-150 hover:scale-105 active:scale-92 cursor-pointer shrink-0"
              >
                {googleUser?.picture || googleUser?.photoURL ? (
                  <img
                    src={googleUser.picture || googleUser.photoURL}
                    alt={googleUser.displayName || googleUser.name}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : googleUser ? (
                  <span className="text-xs font-black text-white">
                    {(googleUser.displayName || googleUser.name || 'G').trim().charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-4 h-4 text-zinc-200" />
                )}
              </button>

              <button
                onClick={onOpenSideMenu}
                type="button"
                aria-label={t('القائمة والإعدادات', 'Menu & Settings')}
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.08] flex items-center justify-center text-zinc-200 transition-transform duration-150 hover:scale-105 active:scale-92 cursor-pointer shrink-0"
              >
                <Menu className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Expandable Search Input */}
          <AnimatePresence initial={false}>
            {(searchOpen || searchQuery.trim().length > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="relative flex items-center w-full max-w-xl mx-auto">
                  <Search
                    className={`w-4 h-4 text-zinc-400 absolute pointer-events-none ${
                      dir === 'ltr' ? 'left-3.5' : 'right-3.5'
                    }`}
                  />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('ابحث عن فيلم أو مسلسل...', 'Search movies or series...')}
                    className={`w-full h-10 bg-white/[0.07] text-white placeholder-zinc-400 text-xs sm:text-sm font-bold rounded-xl border border-white/[0.1] focus:border-[#ea1d24] focus:outline-none ${
                      dir === 'ltr' ? 'pl-10 pr-9' : 'pr-10 pl-9'
                    }`}
                  />
                  {(searchQuery || searchOpen) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (searchQuery) onSearchChange('');
                        else setSearchOpen(false);
                      }}
                      aria-label={t('إغلاق البحث', 'Close search')}
                      className={`absolute p-1.5 text-zinc-400 hover:text-white cursor-pointer ${
                        dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clean Text-Only Tabs with Gliding Cinema Red Underline Matching Screen 1 ("All | Movies | Drama | TV Show...") */}
          <nav
            aria-label={t('التصنيفات السريعة', 'Quick category tabs')}
            className="flex items-center justify-start sm:justify-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar border-b border-white/[0.06]"
          >
            {TOP_UNDERLINE_TABS.map((item) => {
              const active = isTabActive(item.tab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    if (searchQuery) onSearchChange('');
                    onSelectTab(item.tab);
                  }}
                  className={`relative shrink-0 pb-2.5 pt-1 text-xs sm:text-[13px] whitespace-nowrap transition-colors cursor-pointer focus:outline-none ${
                    active ? 'text-white font-black' : 'text-zinc-400 hover:text-zinc-200 font-bold'
                  }`}
                >
                  <span>{lang === 'en' ? item.labelEn : item.labelAr}</span>
                  {active && (
                    <motion.span
                      layoutId="topNavCrimsonUnderline"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full bg-[#ea1d24] shadow-[0_0_10px_rgba(234,29,36,0.75)]"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Notifications Dropdown Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]"
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              dir={dir}
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`fixed top-[62px] left-3 right-3 sm:left-6 sm:right-auto sm:w-96 max-w-full bg-[#15111b]/98 backdrop-blur-md border border-white/[0.12] rounded-2xl p-4 shadow-[0_24px_60px_rgba(0,0,0,0.95)] z-50 ${
                dir === 'ltr' ? 'text-left' : 'text-right'
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#ea1d24]/15 text-[#ea1d24] flex items-center justify-center">
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
                    className="w-8 h-8 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/35 rounded-xl border border-white/[0.06] mb-3">
                <button
                  type="button"
                  onClick={() => setNotifTab('feed')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    notifTab === 'feed'
                      ? 'bg-[#ea1d24] text-white font-black'
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
                      ? 'bg-[#ea1d24] text-white font-black'
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
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto overscroll-contain no-scrollbar">
                    {mediaAlerts.map((alert) => (
                      <div
                        key={alert.mediaId}
                        className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-2.5"
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
                              <BellRing className="w-4 h-4 text-[#ea1d24]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-white truncate">
                              {alert.mediaTitle}
                            </h4>
                            <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {alert.mediaType === 'series'
                                  ? t(
                                      `متابعة الحلقات (${alert.knownEpisodeCount})`,
                                      `Tracking (${alert.knownEpisodeCount})`
                                    )
                                  : t('متابعة التحديثات', 'Tracking updates')}
                              </span>
                            </p>
                          </div>
                        </button>
                        {onRemoveMediaAlert && (
                          <button
                            type="button"
                            onClick={() => onRemoveMediaAlert(alert.mediaId)}
                            aria-label={t('إزالة التنبيه', 'Remove alert')}
                            className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 cursor-pointer"
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
                          ? 'bg-white/[0.04] border-white/[0.06]'
                          : 'bg-[#ea1d24]/10 border-[#ea1d24]/45'
                      }`}
                    >
                      {rn.posterUrl ? (
                        <img
                          src={rn.posterUrl}
                          alt={rn.mediaTitle || rn.title}
                          className="w-10 h-14 rounded-lg object-cover shrink-0 bg-zinc-800"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-[#ea1d24]/15 flex items-center justify-center shrink-0">
                          <BellRing className="w-4 h-4 text-[#ea1d24]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-black text-white leading-snug truncate">
                            {rn.title}
                          </h4>
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
                      className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-black text-white leading-snug">{n.title}</h4>
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
    </>
  );
};
