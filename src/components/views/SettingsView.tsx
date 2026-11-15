import React from 'react';
import { Settings, Shield, User, Bell, Sliders, Moon, ArrowLeft, Crown } from 'lucide-react';
import { AppUserProfile } from '../../types';

interface SettingsViewProps {
  user: AppUserProfile | null;
  onOpenProfile: () => void;
  onOpenLogin: () => void;
  onOpenAdmin: () => void;
  onBackToHome: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onOpenProfile,
  onOpenLogin,
  onOpenAdmin,
  onBackToHome,
}) => {
  return (
    <div className="w-full px-4 py-4 select-none animate-fade-in space-y-4 text-right font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <button
          onClick={onBackToHome}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-black text-white">الإعدادات (Settings)</h2>
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Settings className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Account Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900/90 to-black border border-amber-400/40 shadow-[0_0_15px_rgba(250,204,21,0.15)] flex items-center justify-between gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <img
              src={user.picture || user.photoURL}
              alt={user.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-white">{user.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                  {user.role || 'عضو مسجل'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-zinc-800 text-amber-400 flex items-center justify-center border border-amber-400/40">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">حساب زائر</h3>
              <p className="text-[11px] text-zinc-400">سجل الدخول لحفظ مفضلتك وتاريخ مشاهداتك</p>
            </div>
          </div>
        )}

        <button
          onClick={user ? onOpenProfile : onOpenLogin}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0"
        >
          {user ? 'الملف الشخصي' : 'تسجيل الدخول'}
        </button>
      </div>

      {/* Preference Settings Options */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-zinc-400 px-1">تفضيلات العرض والمشاهدة</h4>

        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 text-amber-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">جودة البث الافتراضية</span>
              <span className="text-[10px] text-zinc-400">4K Ultra HD / 1080p</span>
            </div>
          </div>
          <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
            تلقائي 4K
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 text-amber-400 flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">المظهر السينمائي</span>
              <span className="text-[10px] text-zinc-400">النمط الأسود والذهبي الفاخر</span>
            </div>
          </div>
          <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
            مفعل دائماً
          </span>
        </div>
      </div>

      {/* Administration & Supervisor Access */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-bold text-zinc-400 px-1">إدارة المنصة</h4>

        <div
          onClick={onOpenAdmin}
          className="p-3.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-850 border border-amber-500/30 flex items-center justify-between cursor-pointer transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/40">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">لوحة تحكم المشرف</span>
              <span className="text-[10px] text-zinc-400">رفع وتعديل وحذف الأفلام وإدارة السيرفر</span>
            </div>
          </div>
          <span className="text-xs text-amber-400 font-bold hover:underline">دخول المشرف ›</span>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="pt-6 pb-4 text-center space-y-1 text-zinc-500 text-[11px]">
        <div className="flex items-center justify-center gap-1 text-amber-400/80">
          <Crown className="w-3.5 h-3.5" />
          <span className="font-black text-xs">Golden Flix Cinema</span>
        </div>
        <p>الإصدار 2.5 • جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
};
