import React, { useState } from 'react';
import {
  User,
  Heart,
  Clock,
  LogOut,
  Edit3,
  Check,
  X,
  ShieldCheck,
  Calendar,
  Film,
  Mail,
  AlertCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import { AppUserProfile } from '../../types';
import {
  logoutUser,
  updateUserProfile,
  resendVerificationEmail,
} from '../../services/firebase';
import { clearStoredVerifiedUser, setStoredVerifiedUser } from '../../services/api';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUserProfile | null;
  onOpenAuthModal: () => void;
  onUserUpdated: (user: AppUserProfile | null) => void;
  favoritesCount: number;
  historyCount: number;
}

const GENRE_LIST = [
  'أكشن ومغامرات',
  'خيال علمي وفضاء',
  'دراما وسير ذاتية',
  'رعب وتشويق',
  'كوميديا',
  'أنمي ياباني',
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenAuthModal,
  onUserUpdated,
  favoritesCount,
  historyCount,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [name, setName] = useState<string>(user?.displayName || user?.name || '');
  const [favoriteGenre, setFavoriteGenre] = useState<string>(
    user?.favoriteGenre || 'أكشن ومغامرات'
  );
  const [bio, setBio] = useState<string>(user?.bio || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Email verification resend state
  const [isSendingVerification, setIsSendingVerification] = useState<boolean>(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    try {
      const updated = await updateUserProfile(user.uid, {
        displayName: name.trim() || user.name,
        favoriteGenre,
        bio: bio.trim(),
      });
      const mergedUser: AppUserProfile = {
        ...user,
        ...updated,
        email: updated.email || user.email,
        role: updated.role || user.role,
        picture: updated.picture || user.picture,
        photoURL: updated.photoURL || user.photoURL,
        name: updated.displayName || updated.name || user.name,
        displayName: updated.displayName || user.displayName || user.name,
      };
      setStoredVerifiedUser(mergedUser);
      onUserUpdated(mergedUser);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1000);
    } catch (err) {
      console.error('Error updating user profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setIsSendingVerification(true);
    setVerificationNotice(null);
    try {
      await resendVerificationEmail();
      setVerificationNotice('تم إرسال رابط التحقق بنجاح! تفقد بريدك الإلكتروني.');
    } catch (err: any) {
      setVerificationNotice(err.message || 'حدث خطأ أثناء إرسال رابط التحقق.');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleSignOut = async () => {
    try {
      clearStoredVerifiedUser();
      await logoutUser();
      onUserUpdated(null);
      onClose();
    } catch (err) {
      console.error('Error signing out:', err);
      clearStoredVerifiedUser();
      onUserUpdated(null);
      onClose();
    }
  };

  const formatDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'نوفمبر 2026';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in font-sans">
      <div className="bg-[#121216] border border-zinc-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative text-right animate-scale-up overflow-hidden max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* CASE A: USER IS NOT LOGGED IN */}
        {!user ? (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-850 text-amber-400 flex items-center justify-center mx-auto border border-zinc-750 shadow-inner">
              <User className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-white">الملف الشخصي للزائر</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                أنت تتصفح منصة GoldenFlix Cinema كزائر. يمكنك إنشاء حساب أو تسجيل الدخول لحفظ قائمة مفضلتك وسجل المشاهدة.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-right">
              <div className="p-2.5 rounded-xl bg-zinc-850/60">
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold mb-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span>المفضلة</span>
                </div>
                <span className="text-base font-bold text-white font-mono">{favoritesCount} عمل</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-850/60">
                <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>سجل المشاهدة</span>
                </div>
                <span className="text-base font-bold text-white font-mono">{historyCount} فيلم</span>
              </div>
            </div>

            {/* Sign In / Sign Up Trigger */}
            <button
              onClick={() => {
                onClose();
                onOpenAuthModal();
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#facc15] hover:bg-[#eab308] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>تسجيل الدخول / إنشاء حساب جديد</span>
            </button>
          </div>
        ) : (
          /* CASE B: AUTHENTICATED USER */
          <div className="space-y-4">
            {/* Top User Card */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800">
              <div className="relative">
                <img
                  src={user.picture}
                  alt={user.displayName || user.name}
                  className="w-13 h-13 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
              </div>

              <div className="truncate flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-white font-black text-sm sm:text-base truncate">
                    {user.displayName || user.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{user.role}</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono truncate mt-0.5">{user.email}</p>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>عضو منذ: {formatDate(user.joinedAt)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setName(user.displayName || user.name);
                  setFavoriteGenre(user.favoriteGenre || 'أكشن ومغامرات');
                  setBio(user.bio || '');
                  setIsEditing(!isEditing);
                }}
                className="w-8 h-8 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="تعديل البيانات"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Email Verification Status Banner */}
            {!user.emailVerified ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px]">البريد الإلكتروني غير مؤكد بعد</span>
                </div>
                <button
                  onClick={handleResendVerification}
                  disabled={isSendingVerification}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[10px] font-bold cursor-pointer shrink-0 flex items-center gap-1"
                >
                  {isSendingVerification ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  <span>إرسال الرابط</span>
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold">تم التحقق من ملكية البريد الإلكتروني بنجاح</span>
              </div>
            )}

            {verificationNotice && (
              <div className="p-2 rounded-lg bg-zinc-800 text-xs text-zinc-200 text-center animate-fade-in">
                {verificationNotice}
              </div>
            )}

            {/* Profile Statistics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
                <span className="block text-sm font-bold text-white font-mono">
                  {favoritesCount}
                </span>
                <span className="text-[10px] text-zinc-400">المفضلة</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <Clock className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                <span className="block text-sm font-bold text-white font-mono">
                  {historyCount}
                </span>
                <span className="text-[10px] text-zinc-400">سجل المشاهدة</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <Film className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <span className="block text-sm font-bold text-emerald-400 font-mono">مجاني</span>
                <span className="text-[10px] text-zinc-400">المشاهدة</span>
              </div>
            </div>

            {/* Editing Form or Info View */}
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="text-xs font-bold text-amber-400">تعديل بيانات الحساب</span>
                  <span className="text-[10px] text-zinc-400">حفظ في قاعدة البيانات</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    الاسم المعروض:
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    التصنيف السينمائي المفضل:
                  </label>
                  <select
                    value={favoriteGenre}
                    onChange={(e) => setFavoriteGenre(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {GENRE_LIST.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    النبذة الشخصية (Bio):
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="نبذة عن اهتماماتك السينمائية..."
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none resize-none"
                  />
                </div>

                {saveSuccess ? (
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>تم حفظ التعديلات بنجاح في السيرفر!</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold rounded-xl shadow cursor-pointer"
                    >
                      {isSaving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              /* Profile Details View */
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-zinc-400 block mb-0.5">التصنيف المفضل:</span>
                  <span className="text-amber-300 font-bold">{user.favoriteGenre || 'أكشن ومغامرات'}</span>
                </div>
                {user.bio && (
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">النبذة الشخصية:</span>
                    <p className="text-zinc-300 text-xs leading-relaxed">{user.bio}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>قاعدة بيانات Firestore مشفرة ومؤمنة</span>
                  </div>
                  <span className="font-mono text-zinc-500">Firebase Auth</span>
                </div>
              </div>
            )}

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج من الحساب</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
