import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Film,
  LayoutGrid,
  Heart,
  Clock,
  User,
  Tv,
  UserPlus,
  ShieldCheck,
  Flame,
  Star,
  Clapperboard,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  Info,
  LifeBuoy,
} from 'lucide-react';
import {
  ActiveTab,
  BottomNavTab,
  GoogleUserProfile,
  InfoPageId,
  UserReleaseNotification,
} from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { MashhadLogo } from '../common/MashhadLogo';
import { LoginRobotBuddy } from '../auth/LoginRobotBuddy';

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
  releaseNotifications?: UserReleaseNotification[];
  onSelectReleaseNotification?: (notification: UserReleaseNotification) => void;
  onOpenInfoPage?: (page: InfoPageId) => void;
}

interface MenuRowConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  count?: number;
}

interface InsetRowConfig {
  key: string;
  label: string;
  badgeText?: string;
  isUnread?: boolean;
  avatarUrl?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface CollapsedTooltipState {
  key: string;
  label: string;
  top: number;
  variant: 'menu' | 'inset';
}

const MishmishAlertAvatar: React.FC<{ className?: string }> = () => (
  <svg viewBox="0 0 100 92" className="w-4 h-4" aria-hidden="true">
    <path
      d="M 50,12 C 67,11 81,20 84,37 C 87,55 77,73 59,78 C 43,82 23,77 17,60 C 11,42 19,21 35,14 C 41,12 45,12 50,12 Z"
      fill="#7c3aed"
      stroke="#67e8f9"
      strokeWidth="5"
    />
    <path
      d="M 34,43 Q 40,35 46,43"
      fill="none"
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <path
      d="M 54,43 Q 60,35 66,43"
      fill="none"
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <path
      d="M 41,54 Q 50,62 59,54"
      fill="none"
      stroke="#ffffff"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
  </svg>
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
  releaseNotifications = [],
  onSelectReleaseNotification,
  onOpenInfoPage,
}) => {
  const { lang, dir, setLang, t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [insetPage, setInsetPage] = useState<'shortcuts' | 'alerts'>('shortcuts');
  const [collapsedTooltip, setCollapsedTooltip] =
    useState<CollapsedTooltipState | null>(null);

  const asideRef = useRef<HTMLElement>(null);

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
      setCollapsedTooltip(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isCollapsed) {
      setCollapsedTooltip(null);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNav = (tab: ActiveTab) => {
    onSelectTab(tab);
    onClose();
  };

  const updateCollapsedTooltip = (
    el: HTMLElement | null,
    key: string,
    label: string,
    variant: 'menu' | 'inset'
  ) => {
    if (!isCollapsed || !el || !asideRef.current) return;
    const asideRect = asideRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const centerTop = elRect.top + elRect.height / 2 - asideRect.top;
    setCollapsedTooltip({ key, label, top: centerTop, variant });
  };

  const resolvedActiveKey =
    activeTab && activeTab !== 'home' ? activeTab : 'movies';
  const highlightedKey = hoveredKey || resolvedActiveKey;

  const menuItems: MenuRowConfig[] = [
    {
      key: 'movies',
      label: t('الأفلام', 'Movies'),
      icon: Film,
      onClick: () => handleNav('movies'),
    },
    {
      key: 'series',
      label: t('المسلسلات', 'TV Series'),
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
      label: t('التصنيفات', 'Categories'),
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

  if (canAccessAdmin) {
    menuItems.push({
      key: 'admin',
      label: isDeveloperUser
        ? t('حساب مطور', 'Developer Console')
        : t('لوحة الإدارة', 'Admin Console'),
      icon: ShieldCheck,
      onClick: () => {
        onClose();
        onOpenAdminDashboard();
      },
    });
  }

  const unreadAlertsCount = releaseNotifications.filter((n) => !n.read).length;

  const shortcutInsetItems: InsetRowConfig[] = [
    {
      key: 'lang-toggle',
      label: t('لغة الموقع', 'Language'),
      badgeText: lang === 'ar' ? 'AR' : 'EN',
      icon: Globe,
      onClick: () => setLang(lang === 'ar' ? 'en' : 'ar'),
    },
    {
      key: 'alerts-tab',
      label: t('التنبيهات والإشعارات', 'Notifications'),
      badgeText: unreadAlertsCount > 0 ? String(unreadAlertsCount) : undefined,
      isUnread: unreadAlertsCount > 0,
      icon: Bell,
      onClick: () => setInsetPage('alerts'),
    },
    !googleUser
      ? {
          key: 'quick-register',
          label: t('إنشاء حساب جديد', 'Create Account'),
          icon: UserPlus,
          onClick: () => {
            onClose();
            onOpenRegister();
          },
        }
      : {
          key: 'support-page',
          label: t('الدعم والمساعدة', 'Help & Support'),
          icon: LifeBuoy,
          onClick: () => {
            if (onOpenInfoPage) {
              onOpenInfoPage('support');
            } else {
              onClose();
              onOpenProfileModal();
            }
          },
        },
    {
      key: 'about-platform',
      label: t('عن منصة MASHHAD', 'About MASHHAD'),
      icon: Info,
      onClick: () => {
        if (onOpenInfoPage) {
          onOpenInfoPage('about');
        } else {
          onClose();
          if (googleUser) onOpenProfileModal();
          else onOpenLogin();
        }
      },
    },
  ];

  const alertInsetItems: InsetRowConfig[] =
    releaseNotifications.length > 0
      ? releaseNotifications.slice(0, 4).map((notif) => ({
          key: `notif-${notif.id}`,
          label:
            notif.title ||
            notif.mediaTitle ||
            notif.message ||
            t('إشعار جديد', 'New notification'),
          badgeText: !notif.read ? '1' : undefined,
          isUnread: !notif.read,
          avatarUrl:
            notif.kind === 'mishmish_welcome' ? undefined : notif.posterUrl || undefined,
          icon: notif.kind === 'mishmish_welcome' ? MishmishAlertAvatar : Bell,
          onClick: () => {
            if (onSelectReleaseNotification) {
              onSelectReleaseNotification(notif);
            }
            onClose();
          },
        }))
      : [
          {
            key: 'no-alerts',
            label: t('لا توجد إشعارات جديدة', 'No new notifications'),
            icon: Bell,
            onClick: () => setInsetPage('shortcuts'),
          },
          {
            key: 'browse-latest-fallback',
            label: t('تصفح أحدث الأعمال', 'Browse Latest Releases'),
            icon: Clapperboard,
            onClick: () => handleNav('latest'),
          },
        ];

  const activeInsetItems =
    insetPage === 'alerts' ? alertInsetItems : shortcutInsetItems;

  const CollapseChevron =
    dir === 'ltr'
      ? isCollapsed
        ? ChevronRight
        : ChevronLeft
      : isCollapsed
      ? ChevronLeft
      : ChevronRight;

  const userAvatar = googleUser?.picture || googleUser?.photoURL;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          dir={dir}
          className="fixed inset-0 z-[60] overflow-hidden select-none font-sans"
        >
          {/* Dimmed Glass Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Floating Reference Panel (Expanded & Collapsed Icon Rail) */}
          <motion.aside
            ref={asideRef}
            initial={{
              x: dir === 'ltr' ? '-108%' : '108%',
              opacity: 0.7,
            }}
            animate={{
              x: 0,
              opacity: 1,
              width: isCollapsed ? 72 : 292,
            }}
            exit={{
              x: dir === 'ltr' ? '-108%' : '108%',
              opacity: 0.45,
            }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onMouseLeave={() => {
              setHoveredKey(null);
              setCollapsedTooltip(null);
            }}
            style={{ maxWidth: 'calc(100vw - 24px)' }}
            className={`absolute top-3 bottom-3 flex flex-col overflow-visible rounded-[24px] bg-[#16171a]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_24px_75px_rgba(0,0,0,0.88)] z-10 ${
              dir === 'ltr' ? 'left-3 text-left' : 'right-3 text-right'
            }`}
          >
            {/* Soft Subtle Ambient White & Light Red Corner Sheen ("على خفافي") */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[24px] overflow-hidden"
            >
              <div className="absolute -top-12 -start-10 w-36 h-36 rounded-full bg-white/[0.04] blur-2xl" />
              <div className="absolute bottom-14 -end-10 w-32 h-32 rounded-full bg-[#ea1d24]/[0.07] blur-2xl" />
            </div>

            {/* Collapsed Floating Tooltip Pill (matches glowing side pill & ••• capsule in reference) */}
            <AnimatePresence>
              {isCollapsed && collapsedTooltip && (
                <motion.div
                  key={collapsedTooltip.key}
                  initial={{
                    opacity: 0,
                    x: dir === 'ltr' ? -6 : 6,
                    scale: 0.92,
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x: dir === 'ltr' ? -4 : 4,
                    scale: 0.94,
                  }}
                  transition={{ duration: 0.14 }}
                  style={{ top: collapsedTooltip.top }}
                  className={`pointer-events-none absolute -translate-y-1/2 z-40 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white border border-white/25 shadow-[0_6px_22px_rgba(234,29,36,0.45)] text-[11.5px] font-semibold whitespace-nowrap ${
                    dir === 'ltr' ? 'left-full ml-3' : 'right-full mr-3'
                  }`}
                >
                  {collapsedTooltip.variant === 'inset' ? '•••' : collapsedTooltip.label}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 1. Top Bar: Interactive Mishmish (replacing the 3 colored dots) + Collapse & Close */}
            <div
              className={`relative z-20 flex items-center shrink-0 pt-2.5 pb-1 ${
                isCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'
              }`}
            >
              <div className="w-11 h-10 flex items-center justify-center overflow-visible shrink-0">
                <div className="scale-[0.68] origin-center">
                  <LoginRobotBuddy size="sm" />
                </div>
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    title={t('طي القائمة', 'Collapse Rail')}
                    aria-label={t('طي القائمة', 'Collapse Rail')}
                    className="w-7 h-7 rounded-full bg-white/[0.1] hover:bg-white/[0.18] border border-white/[0.08] text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <CollapseChevron className="w-3.5 h-3.5 stroke-[2.2]" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title={t('إغلاق', 'Close')}
                    aria-label={t('إغلاق', 'Close')}
                    className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-[#ea1d24]/25 border border-white/[0.06] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.1]" />
                  </button>
                </div>
              )}
            </div>

            {/* 2. Brand Header Row (Circular White Emblem + Site Title + Hairline Divider) */}
            <div
              className={`relative z-10 flex items-center shrink-0 pb-3.5 mx-3.5 border-b border-white/[0.06] ${
                isCollapsed ? 'justify-center pt-1' : 'justify-start gap-2.5 pt-1'
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-1 shadow-[0_4px_14px_rgba(255,255,255,0.14)] overflow-hidden">
                  <MashhadLogo
                    className="w-full h-full"
                    roundedClassName="rounded-full"
                  />
                </div>
                {isCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(false)}
                    title={t('توسيع القائمة', 'Expand Menu')}
                    aria-label={t('توسيع القائمة', 'Expand Menu')}
                    className="absolute -bottom-1 -end-1 w-4.5 h-4.5 rounded-full bg-[#24262b] hover:bg-[#ea1d24] border border-white/25 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                  >
                    <CollapseChevron className="w-2.5 h-2.5 stroke-[2.5]" />
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <span className="text-[15px] font-bold tracking-tight text-white truncate">
                  {brandTitle}
                </span>
              )}
            </div>

            {/* Scrollable Body: MENU Section + Recessed Lower Inset Card */}
            <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none pt-3 pb-2">
              {/* Section Title: MENU */}
              <div
                className={`px-4 mb-1.5 ${
                  isCollapsed ? 'text-center px-1' : 'text-start'
                }`}
              >
                <span className="text-[10px] font-semibold tracking-[0.09em] text-zinc-400/75 uppercase">
                  {t('القائمة', 'MENU')}
                </span>
              </div>

              {/* Clean Borderless MENU Items */}
              <div className={`space-y-0.5 ${isCollapsed ? 'px-2' : 'px-2.5'}`}>
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isHighlighted = highlightedKey === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      onMouseEnter={(e) => {
                        setHoveredKey(item.key);
                        updateCollapsedTooltip(
                          e.currentTarget,
                          item.key,
                          item.label,
                          'menu'
                        );
                      }}
                      onFocus={(e) => {
                        setHoveredKey(item.key);
                        updateCollapsedTooltip(
                          e.currentTarget,
                          item.key,
                          item.label,
                          'menu'
                        );
                      }}
                      className={`relative w-full h-9 rounded-xl flex items-center transition-all duration-150 cursor-pointer group outline-none ${
                        isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                      } ${
                        isHighlighted
                          ? 'bg-white/[0.08] text-white'
                          : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      {/* Subtle Soft Light-Red & White Edge Whisper when Active */}
                      {isHighlighted && !isCollapsed && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-xl border border-[#ea1d24]/25 bg-gradient-to-r from-[#ea1d24]/[0.08] via-white/[0.02] to-transparent"
                        />
                      )}

                      <div
                        className={`relative z-10 flex items-center min-w-0 ${
                          isCollapsed ? 'justify-center' : 'gap-2.5'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 ${
                            isHighlighted
                              ? 'bg-white text-[#141518] shadow-[0_2px_10px_rgba(255,255,255,0.22)] ring-2 ring-[#ea1d24]/40'
                              : 'bg-white/[0.08] text-zinc-200 group-hover:bg-white/[0.15] group-hover:text-white'
                          }`}
                        >
                          <Icon className="w-[13px] h-[13px] stroke-[2.1]" />
                        </span>

                        {!isCollapsed && (
                          <span
                            className={`text-[13px] tracking-tight truncate whitespace-nowrap ${
                              isHighlighted
                                ? 'text-white font-semibold'
                                : 'text-zinc-200 group-hover:text-white font-medium'
                            }`}
                          >
                            {item.label}
                          </span>
                        )}
                      </div>

                      {!isCollapsed &&
                        typeof item.count === 'number' &&
                        item.count > 0 && (
                          <span className="relative z-10 min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#ea1d24]/90 text-white text-[10.5px] font-bold tabular-nums flex items-center justify-center shrink-0 shadow-[0_2px_10px_rgba(234,29,36,0.4)] border border-white/20">
                            {item.count}
                          </span>
                        )}
                    </button>
                  );
                })}
              </div>

              {/* Nested Lower Recessed Dark Section (matches MESSAGES card + < > pager + glowing CTA pill) */}
              <div className="mt-3.5 pb-4">
                <div
                  className={`flex items-center mb-1.5 ${
                    isCollapsed ? 'justify-center px-1' : 'justify-between px-4'
                  }`}
                >
                  <span className="text-[10px] font-semibold tracking-[0.09em] text-zinc-400/75 uppercase">
                    {insetPage === 'alerts'
                      ? t('الإشعارات', 'ALERTS')
                      : t('الاختصارات', 'QUICK')}
                  </span>

                  {!isCollapsed && (
                    <div className="flex items-center gap-1 text-zinc-400">
                      <button
                        type="button"
                        onClick={() =>
                          setInsetPage((p) =>
                            p === 'shortcuts' ? 'alerts' : 'shortcuts'
                          )
                        }
                        aria-label={t('السابق', 'Previous')}
                        className="w-5 h-5 rounded-full hover:bg-white/[0.08] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setInsetPage((p) =>
                            p === 'shortcuts' ? 'alerts' : 'shortcuts'
                          )
                        }
                        aria-label={t('التالي', 'Next')}
                        className="w-5 h-5 rounded-full hover:bg-white/[0.08] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Recessed Inner Container */}
                <div
                  className={`relative rounded-2xl bg-[#0c0d10]/90 border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                    isCollapsed ? 'mx-2 px-1 py-2 pb-5' : 'mx-2.5 p-1.5 pb-5'
                  }`}
                >
                  <div className="space-y-1">
                    {activeInsetItems.map((row) => {
                      const RowIcon = row.icon;
                      return (
                        <button
                          key={row.key}
                          type="button"
                          onClick={row.onClick}
                          onMouseEnter={(e) =>
                            updateCollapsedTooltip(
                              e.currentTarget,
                              row.key,
                              row.label,
                              'inset'
                            )
                          }
                          onFocus={(e) =>
                            updateCollapsedTooltip(
                              e.currentTarget,
                              row.key,
                              row.label,
                              'inset'
                            )
                          }
                          className={`w-full h-8 rounded-xl flex items-center transition-colors hover:bg-white/[0.06] cursor-pointer group outline-none ${
                            isCollapsed
                              ? 'justify-center px-0'
                              : 'justify-between px-2'
                          }`}
                        >
                          <div
                            className={`flex items-center min-w-0 ${
                              isCollapsed ? 'justify-center' : 'gap-2.5'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden transition-colors ${
                                row.avatarUrl
                                  ? 'ring-1 ring-white/25'
                                  : row.isUnread
                                  ? 'bg-[#ea1d24]/25 text-white ring-1 ring-[#ea1d24]/45'
                                  : 'bg-white/[0.1] text-zinc-200 group-hover:bg-white/[0.16] group-hover:text-white'
                              }`}
                            >
                              {row.avatarUrl ? (
                                <img
                                  src={row.avatarUrl}
                                  alt={row.label}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <RowIcon className="w-3 h-3 stroke-[2.1]" />
                              )}
                            </span>

                            {!isCollapsed && (
                              <span className="text-[12.5px] font-medium text-zinc-200 group-hover:text-white truncate">
                                {row.label}
                              </span>
                            )}
                          </div>

                          {!isCollapsed && row.badgeText && (
                            <span
                              className={`min-w-[19px] h-[19px] px-1 rounded-full text-[10px] font-semibold tabular-nums flex items-center justify-center shrink-0 ${
                                row.isUnread
                                  ? 'bg-[#ea1d24]/85 text-white shadow-[0_2px_8px_rgba(234,29,36,0.35)]'
                                  : 'bg-white/[0.09] text-zinc-300'
                              }`}
                            >
                              {row.badgeText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Centered Soft Glowing White & Red Pill CTA Straddling Bottom Edge */}
                  <button
                    type="button"
                    onClick={() =>
                      setInsetPage((p) =>
                        p === 'shortcuts' ? 'alerts' : 'shortcuts'
                      )
                    }
                    title={
                      insetPage === 'shortcuts'
                        ? t('عرض الإشعارات', 'View Alerts')
                        : t('عرض الاختصارات', 'View Shortcuts')
                    }
                    className={`absolute left-1/2 -translate-x-1/2 -bottom-3.5 z-20 rounded-full bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white border border-white/25 shadow-[0_6px_22px_rgba(234,29,36,0.42)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
                      isCollapsed
                        ? 'w-8 h-8 p-0'
                        : 'px-4 py-1.5 gap-1.5 text-[11.5px] font-semibold whitespace-nowrap'
                    }`}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${
                        insetPage === 'alerts' ? 'rotate-180' : ''
                      }`}
                    />
                    {!isCollapsed && (
                      <span>
                        {insetPage === 'shortcuts'
                          ? t('عرض الإشعارات', 'All alerts')
                          : t('الاختصارات', 'Shortcuts')}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Bottom User Profile Footer */}
            <div className="relative z-10 shrink-0 px-3 pb-3 pt-1.5 border-t border-white/[0.05]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (googleUser) {
                    onOpenProfileModal();
                  } else {
                    onOpenLogin();
                  }
                }}
                onMouseEnter={(e) =>
                  updateCollapsedTooltip(
                    e.currentTarget,
                    'footer-user',
                    googleUser
                      ? googleUser.name || t('حسابي', 'Profile')
                      : t('تسجيل الدخول', 'Sign In'),
                    'menu'
                  )
                }
                className={`w-full rounded-xl p-1.5 flex items-center transition-colors hover:bg-white/[0.05] cursor-pointer group ${
                  isCollapsed ? 'justify-center' : 'gap-2.5'
                }`}
              >
                <span className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-white/20 bg-white/[0.08] flex items-center justify-center text-white">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={googleUser?.name || t('المستخدم', 'User')}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 stroke-[2]" />
                  )}
                </span>

                {!isCollapsed && (
                  <div className="min-w-0 flex-1 text-start">
                    <div className="text-[13px] font-bold text-white truncate leading-tight">
                      {googleUser
                        ? googleUser.name || t('حسابي', 'Profile')
                        : t('تسجيل الدخول', 'Sign In')}
                    </div>
                    <div className="text-[10.5px] text-zinc-400 truncate leading-tight mt-0.5">
                      {googleUser
                        ? googleUser.email || t('عضو MASHHAD', 'MASHHAD Member')
                        : t('اضغط للدخول إلى حسابك', 'Tap to access account')}
                    </div>
                  </div>
                )}
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
