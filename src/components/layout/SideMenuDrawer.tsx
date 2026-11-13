import React from 'react';
import {
  X,
  Home,
  Film,
  LayoutGrid,
  Heart,
  Clock,
  ChevronLeft,
  User,
  Tv,
  LogIn,
  UserPlus,
  ShieldCheck,
  Compass,
  Flame,
  Star,
  Sparkles,
} from 'lucide-react';
import { ActiveTab, BottomNavTab, GoogleUserProfile } from '../../types';

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
  if (!isOpen) return null;

  const isDeveloperUser =
    (googleUser?.email || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com';

  const handleNav = (tab: ActiveTab) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden select-none animate-fade-in font-sans">
      {/* Dark overlay backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Side Drawer Panel (RTL: slides in from right, full viewport height scrollable) */}
      <div className="absolute top-0 right-0 bottom-0 w-[86vw] max-w-xs sm:max-w-sm bg-[#111115] border-l border-zinc-800/90 shadow-2xl flex flex-col h-full max-h-screen overflow-y-auto overscroll-contain z-10 animate-slide-left text-right">
        {/* Top Header & User Profile Banner */}
        <div className="p-4 sm:p-5 pb-4 border-b border-zinc-800/80 bg-[#15151a] shrink-0">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/20">
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
              title="إغلاق القائمة"
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
                  title="حساب مؤكد"
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
                    {isDeveloperUser ? 'المطور والمشرف' : 'عضو مفعل'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                  {googleUser.email}
                </p>
              </div>

              <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors shrink-0" />
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
                  <h4 className="text-xs sm:text-sm font-bold text-white">الملف الشخصي (زائر)</h4>
                  <p className="text-[10px] text-zinc-400">تصفح ومشاهدة الأفلام متاحة مجاناً</p>
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
                  <span>تسجيل الدخول</span>
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
                  <span>إنشاء حساب</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu List */}
        <div className="p-3.5 space-y-1.5 flex-1">
          <div className="text-[10px] font-bold text-zinc-400 px-3 py-1">الأقسام والتصفح</div>

          {/* Home */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Home className="w-4 h-4" />
              <span>الصفحة الرئيسية</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Movies */}
          <button
            type="button"
            onClick={() => handleNav('movies')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'movies'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Film className="w-4 h-4" />
              <span>الأفلام السينمائية</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* New 3 Quick Options: Latest, Trending, Top Rated */}
          <button
            type="button"
            onClick={() => handleNav('latest')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'latest'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className={`w-4 h-4 ${activeTab === 'latest' ? 'text-black' : 'text-amber-400'}`} />
              <span>أحدث الإضافات</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            type="button"
            onClick={() => handleNav('trending')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'trending'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Flame className={`w-4 h-4 ${activeTab === 'trending' ? 'text-black' : 'text-rose-400'}`} />
              <span>الأكثر مشاهدة</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            type="button"
            onClick={() => handleNav('top_rated')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'top_rated'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className={`w-4 h-4 ${activeTab === 'top_rated' ? 'text-black' : 'text-yellow-400'}`} />
              <span>الأعلى تقييماً</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Series */}
          <button
            type="button"
            onClick={() => handleNav('series')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'series'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Tv className="w-4 h-4" />
              <span>المسلسلات التلفزيونية</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Categories */}
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
              <span>جميع التصنيفات والأنواع</span>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Favorites */}
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
              <span>قائمتي المفضلة</span>
            </div>
            {favoritesCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono font-bold">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Watch History */}
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
              <span>سجل المشاهدة</span>
            </div>
            {historyCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold">
                {historyCount}
              </span>
            )}
          </button>
        </div>

        {/* Drawer Footer with Developer Account */}
        <div className="p-4 border-t border-zinc-800/80 bg-[#15151a] space-y-2.5 shrink-0 mt-auto">

          {/* Developer / Supervisor Account Link — Visible ONLY for frassa.wwindows@gmail.com */}
          {isDeveloperUser && (
            <div className="pt-1 text-center flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminDashboard();
                }}
                className="w-full py-2 px-3 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/35 text-xs text-amber-300 hover:text-amber-200 transition-colors cursor-pointer font-bold flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>حساب مطور</span>
              </button>
            </div>
          )}

          <div className="text-center text-[10px] text-zinc-500 font-mono pb-2">
            GoldenFlix Cinema v2.5
          </div>
        </div>
      </div>
    </div>
  );
};
