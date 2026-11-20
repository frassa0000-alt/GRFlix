import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  LogOut,
  SquarePen,
  Check,
  X,
  Film,
  Camera,
  RefreshCw,
  Mail,
  ChevronLeft,
  ChevronRight,
  Globe,
  Link2,
  Info,
  Lock,
  FileText,
  MessageSquareText,
  Bell,
  Bookmark,
} from 'lucide-react';
import { AppUserProfile, InfoPageId } from '../../types';
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
  onOpenInfoPage?: (page: InfoPageId) => void;
}

type ProfileView = 'profile' | 'edit' | 'language';

const NOTIF_PREF_KEY = 'mashhad_notifications_enabled';

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
  onOpenFavorites,
  onOpenInfoPage,
}) => {
  const { lang, dir, setLang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<ProfileView>('profile');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_PREF_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Edit profile form state
  const [name, setName] = useState<string>(user?.displayName || user?.name || '');
  const [photoUrl, setPhotoUrl] = useState<string>(user?.picture || user?.photoURL || '');
  const [favoriteGenre, setFavoriteGenre] = useState<string>(
    user?.favoriteGenre || 'أفلام سينمائية'
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
      setFavoriteGenre(user.favoriteGenre || 'أفلام سينمائية');
      setBio(user.bio || '');
      setEditError(null);
      setSaveSuccess(false);
    }
    if (!isOpen) {
      setView('profile');
    }
  }, [isOpen, user?.uid, user?.picture, user?.photoURL, user?.displayName, user?.bio, user?.favoriteGenre]);

  useEffect(() => {
    if (isOpen && !user) {
      onClose();
      onOpenAuthModal();
    }
  }, [isOpen, user, onClose, onOpenAuthModal]);

  const handleToggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    try {
      localStorage.setItem(NOTIF_PREF_KEY, String(next));
    } catch {
      // ignore
    }
    if (
      next &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {});
    }
  };

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
    } catch {
      clearStoredVerifiedUser();
      onUserUpdated(null);
      onClose();
    }
  };

  const handleOpenInfo = (page: InfoPageId) => {
    onClose();
    onOpenInfoPage?.(page);
  };

  const displayName = user?.displayName || user?.name || 'MASHHAD Member';
  const resolvedAvatar =
    photoUrl ||
    user?.picture ||
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=f7c600&color=000&size=160&bold=true`;

  const ArrowBack = dir === 'ltr' ? ChevronLeft : ChevronRight;
  const ArrowEnd = dir === 'ltr' ? ChevronRight : ChevronLeft;

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

          {/* Clean Dark Minimalist Profile Card Matching Reference */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full max-w-[390px] bg-[#0a0a0c] border border-white/[0.08] rounded-[28px] shadow-[0_32px_90px_rgba(0,0,0,0.95)] overflow-hidden max-h-[92vh] overflow-y-auto no-scrollbar my-auto ${
              dir === 'ltr' ? 'text-left' : 'text-right'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileSelected}
              className="hidden"
            />

            <AnimatePresence mode="wait">
              {view === 'profile' && (
                <motion.div
                  key="view-profile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col"
                >
                  {/* Top Black Identity Area */}
                  <div className="px-6 pt-5 pb-6 bg-[#0a0a0c]">
                    {/* Top Bar: Close + Sign out */}
                    <div className="flex items-center justify-between gap-2 mb-5">
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('إغلاق', 'Close')}
                        className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <span>{t('تسجيل الخروج', 'Sign out')}</span>
                        <LogOut className="w-4 h-4 stroke-[1.75]" />
                      </button>
                    </div>

                    {/* Avatar Circle */}
                    <div className="mb-3.5">
                      <img
                        src={resolvedAvatar}
                        alt={displayName}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover bg-zinc-900 border border-white/10"
                      />
                    </div>

                    {/* Bold Name + Inline Edit Icon */}
                    <div className="flex items-center gap-2 min-w-0">
                      <h2
                        dir={/^[A-Za-z0-9_.\s-]+$/.test(displayName) ? 'ltr' : undefined}
                        className="text-xl font-bold text-white tracking-tight truncate"
                      >
                        {displayName}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setView('edit')}
                        aria-label={t('تعديل الملف الشخصي', 'Edit Profile')}
                        title={t('تعديل الملف الشخصي', 'Edit Profile')}
                        className="text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0 p-1 rounded-md hover:bg-white/[0.06]"
                      >
                        <SquarePen className="w-[17px] h-[17px] stroke-[1.8]" />
                      </button>
                    </div>

                    {/* Email Below Name */}
                    <p className="text-xs text-zinc-500 truncate mt-0.5 font-mono">
                      {user.email}
                    </p>
                  </div>

                  {/* Lower Elevated Dark Sheet (#161618) */}
                  <div className="bg-[#161618] rounded-t-[26px] px-6 pt-6 pb-7 border-t border-white/[0.06] space-y-6">
                    {/* Group 1: Support & Info */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                        {t('الدعم والمعلومات', 'MASHHAD SUPPORT')}
                      </div>
                      <div className="divide-y divide-white/[0.07]">
                        <button
                          type="button"
                          onClick={() => handleOpenInfo('about')}
                          className="w-full py-3.5 flex items-center gap-3.5 text-start text-zinc-200 hover:text-white transition-colors cursor-pointer"
                        >
                          <Info className="w-[18px] h-[18px] text-zinc-400 shrink-0 stroke-[1.75]" />
                          <span className="text-[13.5px] font-medium">
                            {t('ما هو موقع MASHHAD؟', 'What is MASHHAD')}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenInfo('privacy')}
                          className="w-full py-3.5 flex items-center gap-3.5 text-start text-zinc-200 hover:text-white transition-colors cursor-pointer"
                        >
                          <Lock className="w-[18px] h-[18px] text-zinc-400 shrink-0 stroke-[1.75]" />
                          <span className="text-[13.5px] font-medium">
                            {t('سياسة الخصوصية', 'Privacy Notice')}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenInfo('terms')}
                          className="w-full py-3.5 flex items-center gap-3.5 text-start text-zinc-200 hover:text-white transition-colors cursor-pointer"
                        >
                          <FileText className="w-[18px] h-[18px] text-zinc-400 shrink-0 stroke-[1.75]" />
                          <span className="text-[13.5px] font-medium">
                            {t('اتفاقية الاستخدام', 'User Agreement')}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenInfo('support')}
                          className="w-full py-3.5 flex items-center gap-3.5 text-start text-zinc-200 hover:text-white transition-colors cursor-pointer"
                        >
                          <MessageSquareText className="w-[18px] h-[18px] text-zinc-400 shrink-0 stroke-[1.75]" />
                          <span className="text-[13.5px] font-medium">
                            {t('تواصل معنا', 'Contact Us')}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Group 2: Preferences */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                        {t('التفضيلات', 'PREFERENCES')}
                      </div>
                      <div className="divide-y divide-white/[0.07]">
                        {/* Notifications Switch Row */}
                        <div className="w-full py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <Bell className="w-[18px] h-[18px] text-zinc-400 shrink-0 stroke-[1.75]" />
                            <span className="text-[13.5px] font-medium text-zinc-200 truncate">
                              {t('الإشعارات', 'Notifications')}
                            </span>
                          </div>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={notificationsEnabled}
                            aria-label={t('تفعيل الإشعارات', 'Toggle notifications')}
                            onClick={handleToggleNotifications}
                            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                              notificationsEnabled ? 'bg-[#b91c1c]' : 'bg-zinc-700'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                notificationsEnabled
                                  ? dir === 'ltr'
                                    ? 'translate-x-[22px] left-0'
                                    : '-translate-x-[22px] right-0'
                                  : dir === 'ltr'
                                  ? 'translate-x-[2px] left-0'
                                  : '-translate-x-[2px] right-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Saved / Favorites Row */}
                        {onOpenFavorites && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenFavorites();
                            }}
                            className="w-full py-3.5 flex items-center justify-between gap-3 text-start text-zinc-200 hover:text-white transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <Bookmark className="w-[18px] h-[18px] text-zinc-400 shrink-0 stroke-[1.75]" />
                              <span className="text-[13.5px] font-medium truncate">
                                {t('الأفلام المحفوظة', 'Saved Movies')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-xs text-zinc-500">
                              <span className="tabular-nums">{favoritesCount}</span>
                              <ArrowEnd className="w-4 h-4" />
                            </div>
                          </button>
                        )}

                        {/* Language Row */}
                        <button
                          type="button"
                          onClick={() => setView('language')}
                          className="w-full py-3.5 flex items-center justify-between gap-3 text-start text-zinc-200 hover:text-white transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <Globe className="w-[18px] h-[18px] text-zinc-400 shrink-0 stroke-[1.75]" />
                            <span className="text-[13.5px] font-medium truncate">
                              {t('اللغة', 'Language')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-xs text-zinc-500">
                            <span>{lang === 'en' ? 'English' : 'العربية'}</span>
                            <ArrowEnd className="w-4 h-4" />
                          </div>
                        </button>
                      </div>
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
                  transition={{ duration: 0.16 }}
                  onSubmit={handleSave}
                  className="p-6 bg-[#161618]"
                >
                  <div className="flex items-center justify-between mb-5">
                    <button
                      type="button"
                      onClick={() => setView('profile')}
                      aria-label={t('رجوع', 'Back')}
                      className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ArrowBack className="w-4 h-4" />
                    </button>

                    <h2 className="text-base font-bold text-white">
                      {t('تعديل الملف الشخصي', 'Edit Profile')}
                    </h2>

                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={t('إغلاق', 'Close')}
                      className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Avatar Change */}
                  <div className="mb-5 flex items-center gap-4">
                    <div className="relative inline-block">
                      <img
                        src={resolvedAvatar}
                        alt={displayName}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover border border-white/15 bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        aria-label={t('تغيير الصورة', 'Change Photo')}
                        className={`absolute -bottom-0.5 ${
                          dir === 'ltr' ? '-right-0.5' : '-left-0.5'
                        } w-6 h-6 rounded-full bg-[#b91c1c] hover:bg-[#dc2626] text-white flex items-center justify-center shadow cursor-pointer border-2 border-[#161618]`}
                      >
                        {isUploadingAvatar ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Camera className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-zinc-400">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="font-bold text-white hover:underline cursor-pointer"
                      >
                        {isUploadingAvatar
                          ? t('جارٍ رفع الصورة...', 'Uploading photo...')
                          : t('رفع صورة جديدة', 'Upload photo')}
                      </button>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {t('أو أدخل رابط صورة أدناه', 'Or paste an image URL below')}
                      </p>
                    </div>
                  </div>

                  {editError && (
                    <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-bold">
                      {editError}
                    </div>
                  )}

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        {t('الاسم / اسم المستخدم', 'Name / Username')}
                      </label>
                      <div className="flex items-center gap-2.5 rounded-xl bg-[#0e0e11] border border-white/[0.08] focus-within:border-white/30 px-3.5 py-2.5">
                        <User className="w-4 h-4 text-zinc-400 shrink-0" />
                        <input
                          type="text"
                          required
                          maxLength={24}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-zinc-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        {t('البريد الإلكتروني', 'Email')}
                      </label>
                      <div className="flex items-center gap-2.5 rounded-xl bg-[#0e0e11]/60 border border-white/[0.05] px-3.5 py-2.5 text-zinc-500">
                        <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span className="text-xs font-mono truncate">{user.email}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        {t('رابط الصورة (اختياري)', 'Photo URL (optional)')}
                      </label>
                      <div className="flex items-center gap-2.5 rounded-xl bg-[#0e0e11] border border-white/[0.08] focus-within:border-white/30 px-3.5 py-2.5">
                        <Link2 className="w-4 h-4 text-zinc-400 shrink-0" />
                        <input
                          type="url"
                          dir="ltr"
                          value={photoUrl.startsWith('data:') ? '' : photoUrl}
                          onChange={(e) => setPhotoUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-transparent text-xs font-mono text-white focus:outline-none placeholder:text-zinc-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                        {t('التصنيف المفضل', 'Favorite Genre')}
                      </label>
                      <div className="flex items-center gap-2.5 rounded-xl bg-[#0e0e11] border border-white/[0.08] px-3.5 py-2.5">
                        <Film className="w-4 h-4 text-zinc-400 shrink-0" />
                        <select
                          value={favoriteGenre}
                          onChange={(e) => setFavoriteGenre(e.target.value)}
                          className="w-full bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                        >
                          {GENRE_OPTIONS.map((g) => (
                            <option key={g.ar} value={g.ar} className="bg-[#161618] text-white">
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
                        placeholder={t('اكتب نبذة قصيرة...', 'Short bio...')}
                        className="w-full rounded-xl bg-[#0e0e11] border border-white/[0.08] focus:border-white/30 px-3.5 py-2.5 text-xs text-white focus:outline-none resize-none placeholder:text-zinc-500"
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    {saveSuccess ? (
                      <div className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>{t('تم حفظ التعديلات بنجاح!', 'Profile updated!')}</span>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSaving || isUploadingAvatar}
                        className="w-full py-3 rounded-xl bg-[#b91c1c] hover:bg-[#dc2626] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
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
                  transition={{ duration: 0.16 }}
                  className="p-6 bg-[#161618]"
                >
                  <div className="flex items-center justify-between mb-5">
                    <button
                      type="button"
                      onClick={() => setView('profile')}
                      aria-label={t('رجوع', 'Back')}
                      className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ArrowBack className="w-4 h-4" />
                    </button>

                    <h2 className="text-base font-bold text-white">
                      {t('اللغة', 'Language')}
                    </h2>

                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={t('إغلاق', 'Close')}
                      className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

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
                          className={`w-full px-4 py-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#202024] border-[#b91c1c]/60'
                              : 'bg-[#0e0e11] hover:bg-[#1a1a1e] border-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-300">
                              {option.code === 'ar' ? 'AR' : 'EN'}
                            </span>
                            <div className={dir === 'ltr' ? 'text-left' : 'text-right'}>
                              <span className="block text-xs font-bold text-white">
                                {option.label}
                              </span>
                              <span className="block text-[10px] text-zinc-500">
                                {option.sub}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selected ? 'border-[#b91c1c] bg-[#b91c1c]/20' : 'border-zinc-600'
                            }`}
                          >
                            {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#b91c1c]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
