import React from 'react';
import { Film, Heart, Clock, X, Shield, CheckCircle2 } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaCount: number;
  favoritesCount: number;
  historyCount: number;
  onOpenAdminDashboard: () => void;
  isAdmin?: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  mediaCount,
  favoritesCount,
  historyCount,
  onOpenAdminDashboard,
  isAdmin = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-scale-up text-right">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Profile Card */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800">
          <div className="w-14 h-14 rounded-full bg-[#ea1d24] text-white flex items-center justify-center shadow-lg shadow-[#ea1d24]/30 font-black text-xl">
            M
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-white font-bold text-base">منصة MASHHAD</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ea1d24]/20 text-[#ea1d24] font-bold">
                PRO
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">MASHHAD Platform</p>
          </div>
        </div>

        {/* Library Stats */}
        <div className="grid grid-cols-3 gap-2 my-4">
          <div className="bg-zinc-800/60 p-3 rounded-2xl text-center border border-zinc-800">
            <Film className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="block text-base font-bold text-white font-mono">{mediaCount}</span>
            <span className="text-[10px] text-zinc-400">الأفلام المنشورة</span>
          </div>
          <div className="bg-zinc-800/60 p-3 rounded-2xl text-center border border-zinc-800">
            <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <span className="block text-base font-bold text-white font-mono">{favoritesCount}</span>
            <span className="text-[10px] text-zinc-400">المفضلة</span>
          </div>
          <div className="bg-zinc-800/60 p-3 rounded-2xl text-center border border-zinc-800">
            <Clock className="w-4 h-4 text-sky-400 mx-auto mb-1" />
            <span className="block text-base font-bold text-white font-mono">{historyCount}</span>
            <span className="text-[10px] text-zinc-400">سجل المشاهدة</span>
          </div>
        </div>

        {/* Admin Access Shortcut (Only visible to developer email frassa.wwindows@gmail.com) */}
        {isAdmin && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-l from-amber-500/10 to-transparent border border-amber-500/25 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Shield className="w-4 h-4" />
                <span>إدارة المحتوى ورفع الأفلام</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">frassa.wwindows@gmail.com</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
              لرفع أفلام جديدة من جهازك أو إدارة الأعمال المنشورة وتعديلها أو حذفها، افتح لوحة تحكم المشرف.
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenAdminDashboard();
              }}
              className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>فتح لوحة تحكم المشرف</span>
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
};
