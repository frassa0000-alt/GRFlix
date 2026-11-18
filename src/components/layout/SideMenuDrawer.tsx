import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Film,
  LayoutGrid,
  Heart,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  Tv,
  LogIn,
  UserPlus,
  ShieldCheck,
  Flame,
  Star,
  Sparkles,
  Globe,
} from 'lucide-react';
import { ActiveTab, BottomNavTab, GoogleUserProfile } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

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
}

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
}) => {
  const { lang, dir, setLang, t } = useLanguage();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const copyTimerRef = React.useRef<number | null>(null);

  const isDeveloperUser =
    (googleUser?.email || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com';
  const canAccessAdmin = isDeveloperUser || Boolean(hasAdminAccess);

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

    setCopiedLink(true);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedLink(false);
    }, 1800);
  };

  const handleNav = (tab: ActiveTab) => {
    onSelectTab(tab);
    onClose();
  };

  const ArrowEnd = dir === 'ltr' ? ChevronRight : ChevronLeft;

  const navItems: {
    id: ActiveTab;
    labelAr: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
    iconAccent?: string;
  }[] = [
    { id: 'movies', labelAr: 'الأفلام السينمائية', labelEn: 'Movies', icon: Film },
    { id: 'latest', labelAr: 'أحدث الإضافات', labelEn: 'Latest Releases', icon: Sparkles, iconAccent: 'text-amber-400' },
    { id: 'trending', labelAr: 'الأكثر مشاهدة', labelEn: 'Most Watched', icon: Flame, iconAccent: 'text-rose-400' },
    { id: 'top_rated', labelAr: 'الأعلى تقييماً', labelEn: 'Top Rated', icon: Star, iconAccent: 'text-yellow-400' },
    { id: 'series', labelAr: 'المسلسلات التلفزيونية', labelEn: 'TV Series', icon: Tv },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          dir={dir}
          className="fixed inset-0 z-[60] overflow-hidden select-none font-sans"
        >
          {/* Dark overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Side Drawer Panel with Directional Spring Slide */}
          <motion.div
            initial={{ x: dir === 'ltr' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: dir === 'ltr' ? '-100%' : '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className={`absolute top-0 bottom-0 w-[88vw] max-w-[360px] bg-[#0e0f13] border-white/[0.08] shadow-2xl flex flex-col h-full max-h-screen overflow-y-auto overscroll-contain z-10 ${
              dir === 'ltr' ? 'left-0 border-r text-left' : 'right-0 border-l text-right'
            }`}
          >
            {/* Clean Minimal Centered Header */}
            <div className="relative flex items-center justify-center px-4 pt-5 pb-3 shrink-0">
              <h2 className="text-base font-black text-white tracking-tight">
                {t('الإعدادات والقائمة', 'Settings & Menu')}
              </h2>
              <button
                onClick={onClose}
                type="button"
                className={`absolute ${
                  dir === 'ltr' ? 'right-4' : 'left-4'
                } w-8 h-8 rounded-full bg-[#181920] hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/[0.06]`}
                title={t('إغلاق القائمة', 'Close menu')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pb-6 space-y-5 flex-1">
              {/* 1. User Profile Summary Card */}
              {googleUser ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenProfileModal();
                  }}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#17181f] hover:bg-[#1c1d26] border border-white/[0.06] transition-all cursor-pointer group text-start"
                >
                  <div className="relative shrink-0">
                    {googleUser.picture || googleUser.photoURL ? (
                      <img
                        src={googleUser.picture || googleUser.photoURL}
                        alt={googleUser.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-white/15"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-800 text-[#F7C600] flex items-center justify-center font-black text-base border border-white/10">
                        {(googleUser.displayName || googleUser.name || 'G').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#F7C600] text-black flex items-center justify-center shadow"
                      title={t('حساب مؤكد', 'Verified Account')}
                    >
                      <ShieldCheck className="w-2.5 h-2.5 stroke-[2.5]" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4
                        dir={/^[A-Za-z0-9_.\s-]+$/.test(googleUser.name || '') ? 'ltr' : undefined}
                        className="text-sm font-black text-white group-hover:text-[#F7C600] transition-colors truncate"
                      >
                        {googleUser.name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                      {googleUser.email}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">
                      {isDeveloperUser
                        ? t('المطور والمشرف', 'Developer & Admin')
                        : hasAdminAccess
                        ? t('مشرف متعاون', 'Co-Editor Admin')
                        : t('عضو مفعل', 'Member')}
                    </p>
                  </div>

                  <ArrowEnd className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors shrink-0" />
                </button>
              ) : (
                <div className="rounded-2xl bg-[#17181f] border border-white/[0.06] p-3.5 space-y-3">
                  <div
                    onClick={() => {
                      onClose();
                      onOpenLogin();
                    }}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#22232c] text-[#F7C600] flex items-center justify-center shrink-0 border border-white/[0.06]">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white group-hover:text-[#F7C600] transition-colors truncate">
                        {t('تسجيل الدخول إلى حسابك', 'Sign In to Your Account')}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {t('احفظ مفضلتك وسجل المشاهدة وصورتك', 'Save favorites, history & profile photo')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLogin();
                      }}
                      className="py-2 px-2 rounded-xl bg-[#F7C600] hover:bg-[#ffd426] text-black text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('تسجيل الدخول', 'Sign In')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRegister();
                      }}
                      className="py-2 px-2 rounded-xl bg-[#22232c] hover:bg-[#2a2b36] text-zinc-100 border border-white/10 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 shrink-0 text-[#F7C600]" />
                      <span>{t('إنشاء حساب', 'Sign Up')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Account & Preferences Group */}
              <div>
                <div className="text-[11px] font-bold text-zinc-400 px-1.5 mb-2">
                  {t('الحساب والتفضيلات', 'Account & Preferences')}
                </div>

                <div className="rounded-2xl bg-[#17181f] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
                  {/* Language Row */}
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Globe className="w-[18px] h-[18px] text-zinc-300 shrink-0 stroke-[1.9]" />
                      <span className="text-xs font-bold text-zinc-100 truncate">
                        {t('لغة الموقع', 'Language')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-[#101116] p-0.5 rounded-lg border border-white/[0.06] shrink-0">
                      <button
                        type="button"
                        onClick={() => setLang('ar')}
                        className={`relative px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          lang === 'ar' ? 'text-black font-black' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {lang === 'ar' && (
                          <motion.span
                            layoutId="drawerLangPill"
                            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                            className="absolute inset-0 rounded-md bg-[#F7C600]"
                          />
                        )}
                        <span className="relative z-10">العربية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        className={`relative px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          lang === 'en' ? 'text-black font-black' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {lang === 'en' && (
                          <motion.span
                            layoutId="drawerLangPill"
                            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                            className="absolute inset-0 rounded-md bg-[#F7C600]"
                          />
                        )}
                        <span className="relative z-10">English</span>
                      </button>
                    </div>
                  </div>

                  {/* Admin Console Row (only for authorized developer / co-editors) */}
                  {canAccessAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdminDashboard();
                      }}
                      className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ShieldCheck className="w-[18px] h-[18px] text-[#F7C600] shrink-0 stroke-[1.9]" />
                        <span className="text-xs font-bold text-[#F7C600] truncate">
                          {isDeveloperUser
                            ? t('حساب مطور', 'Developer Console')
                            : t('لوحة الإدارة المتعاونة', 'Admin Console')}
                        </span>
                      </div>
                      <ArrowEnd className="w-4 h-4 text-zinc-500 shrink-0" />
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Browse & Sections Group */}
              <div>
                <div className="text-[11px] font-bold text-zinc-400 px-1.5 mb-2">
                  {t('الأقسام والتصفح', 'Browse & Sections')}
                </div>

                <div className="rounded-2xl bg-[#17181f] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNav(item.id)}
                        className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`w-[18px] h-[18px] shrink-0 stroke-[1.9] ${
                              isActive ? 'text-[#F7C600]' : item.iconAccent || 'text-zinc-300'
                            }`}
                          />
                          <span
                            className={`text-xs truncate ${
                              isActive ? 'text-[#F7C600] font-black' : 'text-zinc-100 font-semibold'
                            }`}
                          >
                            {lang === 'en' ? item.labelEn : item.labelAr}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActive && (
                            <span className="text-[11px] font-bold text-[#F7C600]">
                              {t('نشط', 'Active')}
                            </span>
                          )}
                          <ArrowEnd className="w-4 h-4 text-zinc-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Library & Personal Lists Group */}
              <div>
                <div className="text-[11px] font-bold text-zinc-400 px-1.5 mb-2">
                  {t('التصنيفات والمكتبة', 'Categories & Library')}
                </div>

                <div className="rounded-2xl bg-[#17181f] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBottomTab('categories');
                      onClose();
                    }}
                    className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <LayoutGrid className="w-[18px] h-[18px] text-amber-400 shrink-0 stroke-[1.9]" />
                      <span className="text-xs font-semibold text-zinc-100 truncate">
                        {t('جميع التصنيفات والأنواع', 'All Categories & Genres')}
                      </span>
                    </div>
                    <ArrowEnd className="w-4 h-4 text-zinc-500 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectBottomTab('favorites');
                      onClose();
                    }}
                    className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Heart className="w-[18px] h-[18px] text-rose-400 shrink-0 stroke-[1.9]" />
                      <span className="text-xs font-semibold text-zinc-100 truncate">
                        {t('قائمتي المفضلة', 'My Favorites')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {favoritesCount > 0 && (
                        <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
                          {favoritesCount}
                        </span>
                      )}
                      <ArrowEnd className="w-4 h-4 text-zinc-500" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectBottomTab('history');
                      onClose();
                    }}
                    className="w-full px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock className="w-[18px] h-[18px] text-sky-400 shrink-0 stroke-[1.9]" />
                      <span className="text-xs font-semibold text-zinc-100 truncate">
                        {t('سجل المشاهدة', 'Watch History')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {historyCount > 0 && (
                        <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
                          {historyCount}
                        </span>
                      )}
                      <ArrowEnd className="w-4 h-4 text-zinc-500" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Quiet Footer Version */}
              <div className="pt-1 text-center text-[10px] text-zinc-500 font-mono">
                GoldenFlix v2.5
              </div>

              {/* Miniature Looping Site-Link Video at Very Bottom */}
              <div className="pb-4 flex flex-col items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopySiteLink}
                  title={t('اضغط لنسخ رابط الموقع', 'Click to copy site link')}
                  aria-label={t(
                    'نسخ رابط الموقع https://gr-flix.vercel.app/',
                    'Copy site link https://gr-flix.vercel.app/'
                  )}
                  className="relative w-[128px] aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-[#F7C600]/45 shadow-md transition-colors cursor-pointer active:scale-[0.98] bg-[#17181f]"
                >
                  <video
                    src="/assets/settings-site-link.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    disablePictureInPicture
                    controls={false}
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                </button>

                {copiedLink && (
                  <span className="text-[10px] font-bold text-[#F7C600]">
                    {t('تم نسخ الرابط ✓', 'Link copied ✓')}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
