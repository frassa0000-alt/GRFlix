import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Home,
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
}) => {
  const { lang, dir, setLang, t } = useLanguage();

  const isDeveloperUser =
    (googleUser?.email || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com';

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
    { id: 'home', labelAr: 'الصفحة الرئيسية', labelEn: 'Home', icon: Home },
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
            className={`absolute top-0 bottom-0 w-[86vw] max-w-xs sm:max-w-sm bg-[#101015] border-zinc-800/90 shadow-2xl flex flex-col h-full max-h-screen overflow-y-auto overscroll-contain z-10 ${
              dir === 'ltr' ? 'left-0 border-r text-left' : 'right-0 border-l text-right'
            }`}
          >
            {/* Top Header & User Profile Banner */}
            <div className="p-4 sm:p-5 pb-4 border-b border-zinc-800/80 bg-[#15151b] shrink-0">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-black flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/25">
                    GF
                  </div>
                  <span className="text-white font-black text-lg sm:text-xl tracking-tight">
                    Golden<span className="text-amber-400">Flix</span> Cinema
                  </span>
                </div>
                <button
                  onClick={onClose}
                  type="button"
                  className="w-8 h-8 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-zinc-750"
                  title={t('إغلاق القائمة', 'Close menu')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Card OR Login/Register Dual Buttons */}
              {googleUser ? (
                <div
                  onClick={() => {
                    onClose();
                    onOpenProfileModal();
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-400/50 transition-all cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={googleUser.picture || googleUser.photoURL}
                      alt={googleUser.name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-amber-400"
                    />
                    <div
                      className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center shadow"
                      title={t('حساب مؤكد', 'Verified Account')}
                    >
                      <ShieldCheck className="w-2.5 h-2.5 stroke-[2.5]" />
                    </div>
                  </div>

                  <div className="truncate flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                        {googleUser.name}
                      </h4>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                        {isDeveloperUser
                          ? t('المطور والمشرف', 'Developer & Admin')
                          : t('عضو مفعل', 'Member')}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                      {googleUser.email}
                    </p>
                  </div>

                  <ArrowEnd className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors shrink-0" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div
                    onClick={() => {
                      onClose();
                      onOpenProfileModal();
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 text-amber-400 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="truncate flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white">
                        {t('الملف الشخصي (زائر)', 'Guest Profile')}
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        {t('تصفح ومشاهدة الأفلام متاحة مجاناً', 'Browse and watch movies for free')}
                      </p>
                    </div>
                  </div>

                  {/* TWO SEPARATE ACTION BUTTONS: LOGIN & SIGN UP */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLogin();
                      }}
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
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
                      className="py-2.5 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-400/40 hover:border-amber-400 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('إنشاء حساب', 'Sign Up')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Menu List */}
            <div className="p-3.5 space-y-1.5 flex-1">
              {/* Language Switcher Exclusively Inside Three-Bar Menu */}
              <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-amber-400/[0.08] via-zinc-900/90 to-zinc-900/90 border border-amber-400/25">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-white">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/15 text-amber-400 flex items-center justify-center border border-amber-400/30">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <span>{t('لغة الموقع', 'Language')}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setLang('ar')}
                      className={`relative px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                        lang === 'ar' ? 'text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lang === 'ar' && (
                        <motion.span
                          layoutId="drawerLangPill"
                          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                          className="absolute inset-0 rounded-lg bg-amber-400"
                        />
                      )}
                      <span className="relative z-10">العربية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`relative px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                        lang === 'en' ? 'text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lang === 'en' && (
                        <motion.span
                          layoutId="drawerLangPill"
                          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                          className="absolute inset-0 rounded-lg bg-amber-400"
                        />
                      )}
                      <span className="relative z-10">English</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-bold text-zinc-400 px-3 py-1">
                {t('الأقسام والتصفح', 'Browse & Sections')}
              </div>

              {navItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: dir === 'ltr' ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.025 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                        : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-black' : item.iconAccent || 'text-zinc-300'
                        }`}
                      />
                      <span>{lang === 'en' ? item.labelEn : item.labelAr}</span>
                    </div>
                    <ArrowEnd className="w-3.5 h-3.5 opacity-60" />
                  </motion.button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  onSelectBottomTab('categories');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-zinc-300 hover:bg-zinc-850 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <LayoutGrid className="w-4 h-4 text-amber-400" />
                  <span>{t('جميع التصنيفات والأنواع', 'All Categories & Genres')}</span>
                </div>
                <ArrowEnd className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectBottomTab('favorites');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-zinc-300 hover:bg-zinc-850 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4 text-rose-400" />
                  <span>{t('قائمتي المفضلة', 'My Favorites')}</span>
                </div>
                {favoritesCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono font-bold tabular-nums">
                    {favoritesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectBottomTab('history');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-zinc-300 hover:bg-zinc-850 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>{t('سجل المشاهدة', 'Watch History')}</span>
                </div>
                {historyCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold tabular-nums">
                    {historyCount}
                  </span>
                )}
              </button>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-zinc-800/80 bg-[#15151a] space-y-2.5 shrink-0 mt-auto">
              {isDeveloperUser && (
                <div className="pt-1 text-center flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdminDashboard();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/35 text-xs text-amber-300 hover:text-amber-200 transition-colors cursor-pointer font-bold flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('حساب مطور', 'Developer Console')}</span>
                  </button>
                </div>
              )}

              <div className="text-center text-[10px] text-zinc-500 font-mono pb-2">
                GoldenFlix Cinema v2.5
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
