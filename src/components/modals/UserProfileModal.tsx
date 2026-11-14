import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Crown,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { AppUserProfile } from '../../types';
import {
  logoutUser,
  updateUserProfile,
  uploadUserAvatar,
} from '../../services/firebase';
import { clearStoredVerifiedUser, setStoredVerifiedUser } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUserProfile | null;
  onOpenAuthModal: () => void;
  onUserUpdated: (user: AppUserProfile | null) => void;
  favoritesCount: number;
  historyCount: number;
}

const GENRE_OPTIONS = [
  { ar: 'أكشن ومغامرات', en: 'Action & Adventure' },
  { ar: 'خيال علمي وفضاء', en: 'Sci-Fi & Space' },
  { ar: 'دراما وسير ذاتية', en: 'Drama & Biography' },
  { ar: 'رعب وتشويق', en: 'Horror & Thriller' },
  { ar: 'كوميديا', en: 'Comedy' },
  { ar: 'أفلام سينمائية', en: 'Cinema Classics' },
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
  const { lang, dir, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [name, setName] = useState<string>(user?.displayName || user?.name || '');
  const [photoUrl, setPhotoUrl] = useState<string>(user?.picture || user?.photoURL || '');
  const [favoriteGenre, setFavoriteGenre] = useState<string>(
    user?.favoriteGenre || 'أكشن ومغامرات'
  );
  const [bio, setBio] = useState<string>(user?.bio || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setName(user.displayName || user.name || '');
      setPhotoUrl(user.picture || user.photoURL || '');
      setFavoriteGenre(user.favoriteGenre || 'أكشن ومغامرات');
      setBio(user.bio || '');
      setEditError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, user?.uid, user?.picture, user?.photoURL, user?.displayName]);

  if (!isOpen) return null;

  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setEditError(t('يرجى اختيار ملف صورة صالح', 'Please select a valid image file.'));
      return;
    }

    setEditError(null);
    setIsUploadingAvatar(true);

    try {
      const uploadedUrl = await uploadUserAvatar(user.uid, file);
      setPhotoUrl(uploadedUrl);
      setIsEditing(true);
    } catch {
      // Fallback: resize image cleanly to compact data URL if storage upload is unavailable
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 160;
            const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setPhotoUrl(dataUrl);
              setIsEditing(true);
            }
          };
          if (typeof reader.result === 'string') {
            img.src = reader.result;
          }
        };
        reader.readAsDataURL(file);
      } catch {
        setEditError(t('تعذر رفع الصورة، يمكنك وضع رابط صورة مباشرة', 'Could not upload image. Try pasting an image URL.'));
      }
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setEditError(null);

    const finalName = name.trim() || user.name;
    const finalPhoto =
      photoUrl.trim() ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        finalName
      )}&background=facc15&color=000&size=128&bold=true`;

    try {
      const updated = await updateUserProfile(user.uid, {
        displayName: finalName,
        favoriteGenre,
        bio: bio.trim(),
        photoURL: finalPhoto,
      });
      const mergedUser: AppUserProfile = {
        ...user,
        ...updated,
        email: updated.email || user.email,
        role: updated.role || user.role,
        picture: finalPhoto,
        photoURL: finalPhoto,
        name: finalName,
        displayName: finalName,
        favoriteGenre,
        bio: bio.trim(),
      };
      setStoredVerifiedUser(mergedUser);
      onUserUpdated(mergedUser);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 800);
    } catch (err) {
      console.error('Error updating user profile:', err);
      setEditError(t('حدث خطأ أثناء حفظ البيانات', 'Failed to save changes.'));
    } finally {
      setIsSaving(false);
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
      return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return lang === 'en' ? 'November 2026' : 'نوفمبر 2026';
    }
  };

  const roleDisplay =
    user?.role === 'مشرف المنصة'
      ? t('مشرف المنصة', 'Platform Admin')
      : t('عضو مسجل', 'Member');

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in font-sans"
    >
      <div
        className={`bg-[#121216] border border-zinc-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative animate-scale-up overflow-hidden max-h-[92vh] overflow-y-auto no-scrollbar ${
          dir === 'ltr' ? 'text-left' : 'text-right'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 ${
            dir === 'ltr' ? 'right-4' : 'left-4'
          } w-8 h-8 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer`}
          aria-label={t('إغلاق', 'Close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hidden Avatar File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarFileSelected}
          className="hidden"
        />

        {/* CASE A: GUEST */}
        {!user ? (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-850 text-amber-400 flex items-center justify-center mx-auto border border-zinc-750 shadow-inner">
              <User className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {t('الملف الشخصي للزائر', 'Guest Profile')}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                {t(
                  'أنت تتصفح منصة GoldenFlix Cinema كزائر. يمكنك تسجيل الدخول لحفظ مفضلتك وسجل المشاهدة.',
                  'You are browsing GoldenFlix Cinema as a guest. Sign in to save your favorites and watch history.'
                )}
              </p>
            </div>

            <div
              className={`grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 ${
                dir === 'ltr' ? 'text-left' : 'text-right'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-zinc-850/60">
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold mb-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span>{t('المفضلة', 'Favorites')}</span>
                </div>
                <span className="text-base font-bold text-white font-mono">
                  {favoritesCount} {t('عمل', 'titles')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-850/60">
                <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('سجل المشاهدة', 'Watch History')}</span>
                </div>
                <span className="text-base font-bold text-white font-mono">
                  {historyCount} {t('فيلم', 'watched')}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenAuthModal();
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#facc15] hover:bg-[#eab308] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>{t('دخول / حساب جديد', 'Sign In / Sign Up')}</span>
            </button>
          </div>
        ) : (
          /* CASE B: LOGGED IN USER */
          <div className="space-y-4">
            {/* Top User Card with Avatar Change Trigger */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800">
              <div className="relative group shrink-0">
                <img
                  src={photoUrl || user.picture}
                  alt={user.displayName || user.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    fileInputRef.current?.click();
                  }}
                  title={t('تغيير الصورة الشخصية', 'Change profile photo')}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center shadow cursor-pointer border border-black"
                >
                  {isUploadingAvatar ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                </button>
              </div>

              <div className="truncate flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-white font-black text-sm sm:text-base truncate">
                    {user.displayName || user.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{roleDisplay}</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono truncate mt-0.5">{user.email}</p>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>
                    {t('عضو منذ:', 'Member since:')} {formatDate(user.joinedAt)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setName(user.displayName || user.name);
                  setPhotoUrl(user.picture || user.photoURL || '');
                  setFavoriteGenre(user.favoriteGenre || 'أكشن ومغامرات');
                  setBio(user.bio || '');
                  setIsEditing(!isEditing);
                }}
                className="w-9 h-9 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-white/5"
                title={t('تعديل الحساب بالكامل', 'Edit Full Profile')}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* VIP Subscription Card right under User Name / Header */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-400/15 via-amber-500/5 to-zinc-900 border border-amber-400/35 shadow-[0_8px_24px_rgba(250,204,21,0.1)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-black flex items-center justify-center shadow-md shrink-0">
                    <Crown className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                      <span>{t('اشتراك VIP الحصري', 'GoldenFlix VIP Membership')}</span>
                    </h4>
                    <p className="text-[11px] text-amber-200/85 mt-0.5 leading-snug">
                      {t(
                        'سيتم تفعيل اشتراك VIP قريباً بمميزات خاصة ومشاهدة فائقة.',
                        'VIP subscription will launch soon with exclusive ultra perks.'
                      )}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black">
                  <Sparkles className="w-3 h-3" />
                  <span>{t('قريباً', 'Soon')}</span>
                </span>
              </div>
            </div>

            {/* Profile Statistics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
                <span className="block text-sm font-bold text-white font-mono">
                  {favoritesCount}
                </span>
                <span className="text-[10px] text-zinc-400">{t('المفضلة', 'Favorites')}</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <Clock className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                <span className="block text-sm font-bold text-white font-mono">
                  {historyCount}
                </span>
                <span className="text-[10px] text-zinc-400">{t('سجل المشاهدة', 'History')}</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <Film className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <span className="block text-sm font-bold text-emerald-400 font-mono">
                  {t('مجاني', 'Free')}
                </span>
                <span className="text-[10px] text-zinc-400">{t('المشاهدة', 'Access')}</span>
              </div>
            </div>

            {/* Full Profile Editing Form (Name, Photo, Genre, Bio) */}
            {isEditing ? (
              <form
                onSubmit={handleSave}
                className="space-y-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800"
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="text-xs font-bold text-amber-400">
                    {t('تعديل بيانات وصورة الحساب', 'Edit Name, Photo & Details')}
                  </span>
                </div>

                {editError && (
                  <p className="text-[11px] text-rose-400 font-bold">{editError}</p>
                )}

                {/* Avatar Upload / URL */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-zinc-300">
                    {t('الصورة الشخصية:', 'Profile Photo:')}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>
                        {isUploadingAvatar
                          ? t('جارٍ الرفع...', 'Uploading...')
                          : t('رفع صورة', 'Upload')}
                      </span>
                    </button>
                    <input
                      type="url"
                      value={photoUrl.startsWith('data:') ? '' : photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder={t('أو ضع رابط صورة مباشر...', 'Or paste image URL...')}
                      className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 focus:border-amber-400 rounded-xl px-2.5 py-1.5 text-[11px] text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    {t('الاسم المعروض:', 'Display Name:')}
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
                    {t('التصنيف السينمائي المفضل:', 'Favorite Genre:')}
                  </label>
                  <select
                    value={favoriteGenre}
                    onChange={(e) => setFavoriteGenre(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {GENRE_OPTIONS.map((g) => (
                      <option key={g.ar} value={g.ar}>
                        {lang === 'en' ? g.en : g.ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    {t('النبذة الشخصية (Bio):', 'Bio:')}
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('نبذة عن اهتماماتك السينمائية...', 'About your cinema taste...')}
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none resize-none"
                  />
                </div>

                {saveSuccess ? (
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>{t('تم حفظ التعديلات بنجاح!', 'Profile updated successfully!')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {t('إلغاء', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || isUploadingAvatar}
                      className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold rounded-xl shadow cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ التغييرات', 'Save Changes')}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              /* Profile Details View */
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-zinc-400 block mb-0.5">
                    {t('التصنيف المفضل:', 'Favorite Genre:')}
                  </span>
                  <span className="text-amber-300 font-bold">
                    {GENRE_OPTIONS.find((g) => g.ar === user.favoriteGenre)?.[lang] ||
                      user.favoriteGenre ||
                      t('أكشن ومغامرات', 'Action & Adventure')}
                  </span>
                </div>
                {user.bio && (
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">
                      {t('النبذة الشخصية:', 'Bio:')}
                    </span>
                    <p className="text-zinc-300 text-xs leading-relaxed">{user.bio}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t('تعديل الاسم والصورة والبيانات', 'Edit Name, Photo & Info')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('تسجيل الخروج من الحساب', 'Sign Out')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
