import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Heart,
  Clock,
  LogOut,
  Edit3,
  Check,
  X,
  ShieldCheck,
  Film,
  Camera,
  Crown,
  FileText,
  RefreshCw,
  Mail,
  ChevronLeft,
  ChevronRight,
  Globe,
  Link2,
} from 'lucide-react';
import { AppUserProfile } from '../../types';
import {
  logoutUser,
  updateUserProfile,
  uploadUserAvatar,
} from '../../services/firebase';
import { clearStoredVerifiedUser, setStoredVerifiedUser } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { validateUsername } from '../../utils/username';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUserProfile | null;
  onOpenAuthModal: () => void;
  onUserUpdated: (user: AppUserProfile | null) => void;
  favoritesCount: number;
  historyCount: number;
  onOpenFavorites?: () => void;
  onOpenHistory?: () => void;
}

type ProfileView = 'profile' | 'edit' | 'language';

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
  onOpenFavorites,
  onOpenHistory,
}) => {
  const { lang, dir, setLang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<ProfileView>('profile');
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
    if (!isOpen) {
      setView('profile');
    }
  }, [isOpen, user?.uid, user?.picture, user?.photoURL, user?.displayName]);

  // Direct login redirect if opened without a signed-in user
  useEffect(() => {
    if (isOpen && !user) {
      onClose();
      onOpenAuthModal();
    }
  }, [isOpen, user, onClose, onOpenAuthModal]);

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
      setView('edit');
    } catch {
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
              setView('edit');
            }
          };
          if (typeof reader.result === 'string') {
            img.src = reader.result;
          }
        };
        reader.readAsDataURL(file);
      } catch {
        setEditError(
          t(
            'تعذر رفع الصورة، يمكنك وضع رابط صورة مباشرة',
            'Could not upload image. Try pasting an image URL.'
          )
        );
      }
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setEditError(null);

    const finalName = name.trim() || user.name;
    const previousName = (user.displayName || user.name || '').trim();
    if (finalName !== previousName) {
      const check = validateUsername(finalName);
      if (!check.valid) {
        setEditError(
          lang === 'en'
            ? check.errorEn || 'Invalid username.'
            : check.errorAr || 'اسم المستخدم غير صالح.'
        );
        return;
      }
    }

    setIsSaving(true);
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
        setView('profile');
      }, 850);
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
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return lang === 'en' ? 'Nov 2026' : 'نوفمبر 2026';
    }
  };

  const roleDisplay =
    user?.role === 'مشرف المنصة'
      ? t('مشرف المنصة', 'Platform Admin')
      : t('عضو مسجل', 'Verified Member');

  const displayName = user?.displayName || user?.name || 'GoldenFlix User';
  const resolvedAvatar =
    photoUrl ||
    user?.picture ||
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=f7c600&color=000&size=160&bold=true`;

  const activeGenreLabel =
    GENRE_OPTIONS.find((g) => g.ar === (user?.favoriteGenre || favoriteGenre))?.[lang] ||
    user?.favoriteGenre ||
    t('أكشن ومغامرات', 'Action & Adventure');

  const ArrowEnd = dir === 'ltr' ? ChevronRight : ChevronLeft;
  const ArrowBack = dir === 'ltr' ? ChevronLeft : ChevronRight;

  const openEditView = () => {
    if (!user) return;
    setName(user.displayName || user.name || '');
    setPhotoUrl(user.picture || user.photoURL || '');
    setFavoriteGenre(user.favoriteGenre || 'أكشن ومغامرات');
    setBio(user.bio || '');
    setEditError(null);
    setSaveSuccess(false);
    setView('edit');
  };

  return (
    <AnimatePresence>
      {isOpen && user && (
        <div
          dir={dir}
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 select-none font-sans overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Main Profile Sheet Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className={`relative z-10 w-full max-w-[410px] bg-[#0e0f13] border border-white/[0.08] rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.9)] overflow-hidden max-h-[92vh] overflow-y-auto no-scrollbar my-auto ${
              dir === 'ltr' ? 'text-left' : 'text-right'
            }`}
          >
            {/* Subtle top ambient corner wash matching mockup atmosphere */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-sky-400/[0.11] via-[#F7C600]/[0.07] to-transparent blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -left-12 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-400/[0.06] to-transparent blur-2xl"
            />

            {/* Hidden Avatar File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileSelected}
              className="hidden"
            />

            <div className="relative z-10 p-5">
              <AnimatePresence mode="wait">
                {view === 'profile' && (
                  <motion.div
                    key="view-profile"
                    initial={{ opacity: 0, x: dir === 'ltr' ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: dir === 'ltr' ? -12 : 12 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Header Row: Title + Close */}
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg font-black text-white tracking-tight">
                        {t('الملف الشخصي', 'Profile')}
                      </h2>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('إغلاق', 'Close')}
                        className="w-10 h-10 rounded-full bg-[#17181f] hover:bg-[#22232c] text-zinc-400 hover:text-white border border-white/[0.07] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Horizontal Avatar + Name + Email Row */}
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="relative shrink-0">
                        <img
                          src={resolvedAvatar}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-full object-cover border border-white/15 bg-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={openEditView}
                          title={t('تعديل الملف والصورة', 'Edit profile & photo')}
                          aria-label={t('تعديل الملف والصورة', 'Edit profile & photo')}
                          className={`absolute -bottom-0.5 ${
                            dir === 'ltr' ? '-right-0.5' : '-left-0.5'
                          } w-6 h-6 rounded-full bg-[#1d1e26] hover:bg-[#F7C600] text-white hover:text-black border border-white/15 flex items-center justify-center shadow transition-colors cursor-pointer`}
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3
                            dir={/^[A-Za-z0-9_.\s-]+$/.test(displayName) ? 'ltr' : undefined}
                            className="text-base font-black text-white truncate"
                          >
                            {displayName}
                          </h3>
                          <ShieldCheck
                            className="w-4 h-4 text-[#F7C600] shrink-0"
                            aria-label={roleDisplay}
                          />
                        </div>
                        <p className="text-xs text-zinc-400 truncate font-mono mt-0.5">
                          {user.email}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5 truncate">
                          <span>{roleDisplay}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDate(user.joinedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3-Card Stat Strip */}
                    <div className="grid grid-cols-3 gap-2.5 mb-5">
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenFavorites) {
                            onClose();
                            onOpenFavorites();
                          }
                        }}
                        className="rounded-2xl bg-[#17181f] hover:bg-[#1d1e27] border border-white/[0.06] py-3 px-2 text-center transition-colors cursor-pointer min-h-[72px] flex flex-col items-center justify-center"
                      >
                        <span className="text-base font-black text-white tabular-nums leading-tight">
                          {favoritesCount}
                        </span>
                        <span className="text-[11px] text-zinc-400 mt-1 font-medium">
                          {t('المفضلة', 'Favorites')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenHistory) {
                            onClose();
                            onOpenHistory();
                          }
                        }}
                        className="rounded-2xl bg-[#17181f] hover:bg-[#1d1e27] border border-white/[0.06] py-3 px-2 text-center transition-colors cursor-pointer min-h-[72px] flex flex-col items-center justify-center"
                      >
                        <span className="text-base font-black text-white tabular-nums leading-tight">
                          {historyCount}
                        </span>
                        <span className="text-[11px] text-zinc-400 mt-1 font-medium">
                          {t('المشاهدة', 'History')}
                        </span>
                      </button>

                      <div className="rounded-2xl bg-[#17181f] border border-white/[0.06] py-3 px-2 text-center min-h-[72px] flex flex-col items-center justify-center">
                        <span className="text-sm font-black text-[#F7C600] leading-tight">
                          {t('مجاني', 'Free')}
                        </span>
                        <span className="text-[11px] text-zinc-400 mt-1 font-medium">
                          {t('الحساب', 'Plan')}
                        </span>
                      </div>
                    </div>

                    {/* Group 1: General */}
                    <div className="mb-4">
                      <div className="text-[11px] font-semibold text-zinc-400 px-1 mb-2">
                        {t('عام', 'General')}
                      </div>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={openEditView}
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#17181f] hover:bg-[#1d1e27] border border-white/[0.06] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Edit3 className="w-[18px] h-[18px] text-zinc-200 shrink-0 stroke-[1.8]" />
                            <span className="text-xs font-bold text-zinc-100 truncate">
                              {t('تعديل الملف الشخصي', 'Edit Profile')}
                            </span>
                          </div>
                          <ArrowEnd className="w-4 h-4 text-zinc-500 shrink-0" />
                        </button>

                        <button
                          type="button"
                          onClick={openEditView}
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#17181f] hover:bg-[#1d1e27] border border-white/[0.06] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Film className="w-[18px] h-[18px] text-zinc-200 shrink-0 stroke-[1.8]" />
                            <span className="text-xs font-bold text-zinc-100 truncate">
                              {t('التصنيف المفضل', 'Favorite Genre')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 max-w-[48%]">
                            <span className="text-[11px] text-zinc-400 truncate">
                              {activeGenreLabel}
                            </span>
                            <ArrowEnd className="w-4 h-4 text-zinc-500 shrink-0" />
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={openEditView}
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#17181f] hover:bg-[#1d1e27] border border-white/[0.06] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-[18px] h-[18px] text-zinc-200 shrink-0 stroke-[1.8]" />
                            <span className="text-xs font-bold text-zinc-100 truncate">
                              {t('النبذة الشخصية', 'Bio')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 max-w-[50%]">
                            <span className="text-[11px] text-zinc-400 truncate">
                              {user.bio ? user.bio : t('غير مضافة', 'Not set')}
                            </span>
                            <ArrowEnd className="w-4 h-4 text-zinc-500 shrink-0" />
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Group 2: Preferences & Account */}
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-400 px-1 mb-2">
                        {t('التفضيلات والحساب', 'Preferences')}
                      </div>
                      <div className="space-y-2">
                        <div className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#17181f] border border-white/[0.06] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Crown className="w-[18px] h-[18px] text-[#F7C600] shrink-0 stroke-[1.8]" />
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-zinc-100 truncate">
                                {t('اشتراك VIP الحصري', 'GoldenFlix VIP')}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-[#F7C600] shrink-0">
                            {t('قريباً', 'Soon')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setView('language')}
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#17181f] hover:bg-[#1d1e27] border border-white/[0.06] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Globe className="w-[18px] h-[18px] text-zinc-200 shrink-0 stroke-[1.8]" />
                            <span className="text-xs font-bold text-zinc-100 truncate">
                              {t('اللغة', 'Language')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-zinc-400">
                              {lang === 'en' ? 'English' : 'العربية'}
                            </span>
                            <ArrowEnd className="w-4 h-4 text-zinc-500 shrink-0" />
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-[#17181f] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/25 flex items-center justify-between gap-3 transition-colors cursor-pointer text-rose-400"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <LogOut className="w-[18px] h-[18px] shrink-0 stroke-[1.8]" />
                            <span className="text-xs font-bold truncate">
                              {t('تسجيل الخروج', 'Sign Out')}
                            </span>
                          </div>
                          <ArrowEnd className="w-4 h-4 opacity-70 shrink-0" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {view === 'edit' && (
                  <motion.form
                    key="view-edit"
                    initial={{ opacity: 0, x: dir === 'ltr' ? 14 : -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: dir === 'ltr' ? 14 : -14 }}
                    transition={{ duration: 0.18 }}
                    onSubmit={handleSave}
                  >
                    {/* Top Back + Close Bar */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={() => setView('profile')}
                        aria-label={t('رجوع', 'Back')}
                        className="w-10 h-10 rounded-full bg-[#17181f] hover:bg-[#22232c] text-zinc-200 border border-white/[0.07] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ArrowBack className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('إغلاق', 'Close')}
                        className="w-10 h-10 rounded-full bg-[#17181f] hover:bg-[#22232c] text-zinc-400 hover:text-white border border-white/[0.07] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Heading */}
                    <h2 className="text-lg font-black text-white tracking-tight mb-4">
                      {t('تعديل الملف الشخصي', 'Edit Profile')}
                    </h2>

                    {/* Avatar with small edit camera/pencil badge */}
                    <div className="mb-5 flex items-center gap-4">
                      <div className="relative inline-block">
                        <img
                          src={resolvedAvatar}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-full object-cover border border-white/15 bg-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          title={t('تغيير الصورة الشخصية', 'Change profile photo')}
                          className={`absolute -bottom-0.5 ${
                            dir === 'ltr' ? '-right-0.5' : '-left-0.5'
                          } w-7 h-7 rounded-full bg-[#F7C600] hover:bg-[#ffd633] text-black flex items-center justify-center shadow-lg cursor-pointer border-2 border-[#0e0f13]`}
                        >
                          {isUploadingAvatar ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Camera className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-zinc-400">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="font-bold text-[#F7C600] hover:underline cursor-pointer"
                        >
                          {isUploadingAvatar
                            ? t('جارٍ رفع الصورة...', 'Uploading photo...')
                            : t('رفع صورة من جهازك', 'Upload photo from device')}
                        </button>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {t('أو أدخل رابط صورة أدناه', 'Or paste an image URL below')}
                        </p>
                      </div>
                    </div>

                    {editError && (
                      <div className="mb-3 px-3.5 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-bold">
                        {editError}
                      </div>
                    )}

                    {/* Clean Labeled Inputs matching Edit Profile screen */}
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                          {t('الاسم / اسم المستخدم', 'Name / Username')}
                        </label>
                        <div className="flex items-center gap-2.5 rounded-2xl bg-[#17181f] border border-white/[0.07] focus-within:border-[#F7C600]/60 px-3.5 py-3 transition-colors">
                          <User className="w-4 h-4 text-zinc-400 shrink-0" />
                          <input
                            type="text"
                            dir="ltr"
                            required
                            maxLength={24}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder={t('اسم مستخدم', 'Username')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-transparent text-xs font-latin-slim font-normal text-white focus:outline-none placeholder:text-zinc-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                          {t('البريد الإلكتروني', 'Email')}
                        </label>
                        <div className="flex items-center gap-2.5 rounded-2xl bg-[#17181f]/75 border border-white/[0.05] px-3.5 py-3 text-zinc-400">
                          <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="text-xs font-mono truncate">{user.email}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                          {t('رابط الصورة الشخصية (اختياري)', 'Photo URL (optional)')}
                        </label>
                        <div className="flex items-center gap-2.5 rounded-2xl bg-[#17181f] border border-white/[0.07] focus-within:border-[#F7C600]/60 px-3.5 py-3 transition-colors">
                          <Link2 className="w-4 h-4 text-zinc-400 shrink-0" />
                          <input
                            type="url"
                            dir="ltr"
                            value={photoUrl.startsWith('data:') ? '' : photoUrl}
                            onChange={(e) => setPhotoUrl(e.target.value)}
                            placeholder={t('https://...', 'https://...')}
                            className="w-full bg-transparent text-xs font-mono text-white focus:outline-none placeholder:text-zinc-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                          {t('التصنيف السينمائي المفضل', 'Favorite Genre')}
                        </label>
                        <div className="flex items-center gap-2.5 rounded-2xl bg-[#17181f] border border-white/[0.07] focus-within:border-[#F7C600]/60 px-3.5 py-3 transition-colors">
                          <Film className="w-4 h-4 text-zinc-400 shrink-0" />
                          <select
                            value={favoriteGenre}
                            onChange={(e) => setFavoriteGenre(e.target.value)}
                            className="w-full bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                          >
                            {GENRE_OPTIONS.map((g) => (
                              <option key={g.ar} value={g.ar} className="bg-[#17181f] text-white">
                                {lang === 'en' ? g.en : g.ar}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                          {t('النبذة الشخصية', 'Bio')}
                        </label>
                        <textarea
                          rows={2}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder={t('اكتب نبذة قصيرة عن ذوقك السينمائي...', 'About your cinema taste...')}
                          className="w-full rounded-2xl bg-[#17181f] border border-white/[0.07] focus:border-[#F7C600]/60 px-3.5 py-2.5 text-xs text-white focus:outline-none resize-none placeholder:text-zinc-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Bottom Full-Width Save Button */}
                    <div className="mt-5">
                      {saveSuccess ? (
                        <motion.div
                          initial={{ scale: 0.96, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="w-full min-h-[48px] py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>{t('تم حفظ التعديلات بنجاح!', 'Profile updated successfully!')}</span>
                        </motion.div>
                      ) : (
                        <button
                          type="submit"
                          disabled={isSaving || isUploadingAvatar}
                          className="w-full min-h-[48px] py-3 rounded-2xl bg-[#F7C600] hover:bg-[#ffd633] text-black text-xs font-black shadow-[0_8px_24px_rgba(247,198,0,0.2)] transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                          {isSaving
                            ? t('جارٍ الحفظ...', 'Saving...')
                            : t('حفظ التغييرات', 'Save Changes')}
                        </button>
                      )}
                    </div>
                  </motion.form>
                )}

                {view === 'language' && (
                  <motion.div
                    key="view-language"
                    initial={{ opacity: 0, x: dir === 'ltr' ? 14 : -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: dir === 'ltr' ? 14 : -14 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Top Back + Close Bar */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={() => setView('profile')}
                        aria-label={t('رجوع', 'Back')}
                        className="w-10 h-10 rounded-full bg-[#17181f] hover:bg-[#22232c] text-zinc-200 border border-white/[0.07] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ArrowBack className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('إغلاق', 'Close')}
                        className="w-10 h-10 rounded-full bg-[#17181f] hover:bg-[#22232c] text-zinc-400 hover:text-white border border-white/[0.07] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <h2 className="text-lg font-black text-white tracking-tight mb-4">
                      {t('اللغة', 'Language')}
                    </h2>

                    <div className="space-y-2.5">
                      {(
                        [
                          { code: 'ar', label: 'العربية', sub: 'Arabic' },
                          { code: 'en', label: 'English', sub: 'الإنجليزية' },
                        ] as const
                      ).map((option) => {
                        const selected = lang === option.code;
                        return (
                          <button
                            key={option.code}
                            type="button"
                            onClick={() => setLang(option.code)}
                            className={`w-full min-h-[54px] px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              selected
                                ? 'bg-[#1a1b23] border-[#F7C600]/40'
                                : 'bg-[#17181f] hover:bg-[#1d1e27] border-white/[0.06]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#22232c] flex items-center justify-center text-xs font-black text-zinc-200 border border-white/10">
                                {option.code === 'ar' ? 'ع' : 'EN'}
                              </div>
                              <div className={dir === 'ltr' ? 'text-left' : 'text-right'}>
                                <span className="block text-xs font-bold text-white">
                                  {option.label}
                                </span>
                                <span className="block text-[10px] text-zinc-500">
                                  {option.sub}
                                </span>
                              </div>
                            </div>

                            {/* Radio indicator matching Language screen */}
                            <span
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                selected
                                  ? 'border-[#F7C600] bg-[#F7C600]/20'
                                  : 'border-zinc-600 bg-transparent'
                              }`}
                            >
                              {selected && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F7C600]" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
