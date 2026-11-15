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
  Calendar,
  Film,
  Camera,
  Crown,
  Sparkles,
  RefreshCw,
  Mail,
  ChevronLeft,
  ChevronRight,
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
  onOpenFavorites?: () => void;
  onOpenHistory?: () => void;
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
  onOpenFavorites,
  onOpenHistory,
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
    if (!isOpen) {
      setIsEditing(false);
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
      setIsEditing(true);
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
              setIsEditing(true);
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
      : t('عضو مسجل', 'Verified Member');

  const displayName = user?.displayName || user?.name || 'GoldenFlix User';
  const resolvedAvatar =
    photoUrl ||
    user?.picture ||
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=f7c600&color=000&size=160&bold=true`;

  const ArrowEnd = dir === 'ltr' ? ChevronRight : ChevronLeft;

  return (
    <AnimatePresence>
      {isOpen && user && (
        <div
          dir={dir}
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 select-none font-sans overflow-y-auto"
        >
          {/* Animated Obsidian Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Main Animated Profile Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 26 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 18 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className={`relative z-10 w-full max-w-[430px] bg-[#0e0e13] border border-[#F7C600]/25 rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.95)] overflow-hidden max-h-[92vh] overflow-y-auto no-scrollbar my-auto ${
              dir === 'ltr' ? 'text-left' : 'text-right'
            }`}
          >
            {/* Hidden Avatar File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileSelected}
              className="hidden"
            />

            {/* 1. Curved Obsidian & Metallic Gold Profile Cover */}
            <div className="relative h-28 sm:h-32 overflow-hidden bg-gradient-to-br from-[#231b04] via-[#131218] to-[#0a0a0e]">
              <svg
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 w-full h-full"
              >
                <defs>
                  <linearGradient id="pfGoldArc" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F7C600" stopOpacity="0.6" />
                    <stop offset="55%" stopColor="#9c7500" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#0e0e13" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,0 L260,0 C150,70 70,115 0,145 Z" fill="url(#pfGoldArc)" />
                <path
                  d="M600,180 L360,180 C475,115 545,65 600,15 Z"
                  fill="#F7C600"
                  fillOpacity="0.14"
                />
              </svg>

              {/* Top Controls inside Cover */}
              <div className="relative z-10 flex items-center justify-between px-4 pt-3.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-[#F7C600]/30 text-[10px] font-black text-[#F7C600]">
                  <User className="w-3 h-3" />
                  <span>{t('الملف الشخصي', 'My Profile')}</span>
                </span>

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  type="button"
                  aria-label={t('إغلاق', 'Close')}
                  className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-zinc-300 hover:text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer backdrop-blur-md"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* 2. Overlapping Glowing Avatar + Identity */}
            <div className="px-5 pb-5">
              <div className="relative -mt-12 flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24, delay: 0.05 }}
                  className="relative"
                >
                  {/* Animated Golden Glow Halo */}
                  <motion.div
                    animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.05, 1] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden="true"
                    className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-[#F7C600]/55 via-amber-300/30 to-[#F7C600]/55 blur-md"
                  />

                  <img
                    src={resolvedAvatar}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-full object-cover border-[3px] border-[#F7C600] bg-zinc-900 shadow-[0_12px_30px_rgba(0,0,0,0.8)]"
                  />

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      fileInputRef.current?.click();
                    }}
                    title={t('تغيير الصورة الشخصية', 'Change profile photo')}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#F7C600] hover:bg-[#ffd633] text-black flex items-center justify-center shadow-lg cursor-pointer border-2 border-[#0e0e13]"
                  >
                    {isUploadingAvatar ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </motion.button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 }}
                  className="mt-3 space-y-1 max-w-full"
                >
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight truncate max-w-[260px]">
                      {displayName}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#F7C600]/15 text-[#F7C600] font-bold border border-[#F7C600]/30">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{roleDisplay}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-mono">
                    <Mail className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span className="truncate max-w-[260px]">{user.email}</span>
                  </div>

                  <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
                    <Calendar className="w-3 h-3 text-[#F7C600]" />
                    <span>
                      {t('عضو منذ:', 'Member since:')} {formatDate(user.joinedAt)}
                    </span>
                  </div>
                </motion.div>

                {/* Primary Edit Trigger Pill */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => {
                    setName(user.displayName || user.name);
                    setPhotoUrl(user.picture || user.photoURL || '');
                    setFavoriteGenre(user.favoriteGenre || 'أكشن ومغامرات');
                    setBio(user.bio || '');
                    setIsEditing((prev) => !prev);
                  }}
                  className={`mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    isEditing
                      ? 'bg-[#F7C600] text-black border-[#F7C600] font-black shadow-[0_6px_18px_rgba(247,198,0,0.3)]'
                      : 'bg-[#17171f] hover:bg-[#1f1f2a] text-zinc-200 border-white/10 hover:border-[#F7C600]/45'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>
                    {isEditing
                      ? t('عرض الملف الشخصي', 'View Profile')
                      : t('تعديل الاسم والصورة', 'Edit Profile & Photo')}
                  </span>
                </motion.button>
              </div>

              {/* 3. Animated 3-Card Cinema Stats */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.14 }}
                className="grid grid-cols-3 gap-2.5 mt-5"
              >
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => {
                    if (onOpenFavorites) {
                      onClose();
                      onOpenFavorites();
                    }
                  }}
                  className="p-3 rounded-2xl bg-gradient-to-b from-[#17171f] to-[#111116] border border-white/[0.08] hover:border-rose-400/40 text-center transition-colors cursor-pointer"
                >
                  <Heart className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                  <span className="block text-base font-black text-white font-mono tabular-nums">
                    {favoritesCount}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">
                    {t('المفضلة', 'Favorites')}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => {
                    if (onOpenHistory) {
                      onClose();
                      onOpenHistory();
                    }
                  }}
                  className="p-3 rounded-2xl bg-gradient-to-b from-[#17171f] to-[#111116] border border-white/[0.08] hover:border-sky-400/40 text-center transition-colors cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                  <span className="block text-base font-black text-white font-mono tabular-nums">
                    {historyCount}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">
                    {t('المشاهدة', 'History')}
                  </span>
                </motion.button>

                <div className="p-3 rounded-2xl bg-gradient-to-b from-[#17171f] to-[#111116] border border-white/[0.08] text-center">
                  <Film className="w-4 h-4 text-[#F7C600] mx-auto mb-1" />
                  <span className="block text-sm font-black text-emerald-400 font-mono mt-0.5">
                    {t('مجاني', 'Free')}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">
                    {t('الحساب', 'Plan')}
                  </span>
                </div>
              </motion.div>

              {/* 4. VIP Membership Card with Subtle Shimmer */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.18 }}
                className="relative overflow-hidden mt-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-[#241c05] via-[#17140d] to-[#141419] border border-[#F7C600]/35 shadow-[0_10px_28px_rgba(247,198,0,0.08)]"
              >
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#F7C600]/15 to-transparent skew-x-12"
                />
                <div className="relative z-10 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ffe259] to-[#f5b800] text-black flex items-center justify-center shadow-md shrink-0">
                      <Crown className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        {t('اشتراك VIP الحصري', 'GoldenFlix VIP Membership')}
                      </h4>
                      <p className="text-[11px] text-amber-200/80 mt-0.5 leading-snug">
                        {t(
                          'مزايا حصرية وجودة فائقة ستُفعّل قريباً.',
                          'Exclusive perks & ultra streaming coming soon.'
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F7C600]/15 border border-[#F7C600]/40 text-[#F7C600] text-[10px] font-black">
                    <Sparkles className="w-3 h-3" />
                    <span>{t('قريباً', 'Soon')}</span>
                  </span>
                </div>
              </motion.div>

              {/* 5. Animated Profile Details OR Edit Form */}
              <div className="mt-4">
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.form
                      key="profile-edit-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      onSubmit={handleSave}
                      className="space-y-3 p-4 rounded-2xl bg-[#15151c] border border-white/10"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-xs font-black text-[#F7C600]">
                          {t('تعديل بيانات وصورة الحساب', 'Edit Name, Photo & Details')}
                        </span>
                      </div>

                      {editError && (
                        <p className="text-[11px] text-rose-400 font-bold">{editError}</p>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-zinc-300">
                          {t('الصورة الشخصية:', 'Profile Photo:')}
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className="px-3 py-2 rounded-xl bg-[#F7C600]/15 hover:bg-[#F7C600]/25 border border-[#F7C600]/35 text-[#F7C600] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>
                              {isUploadingAvatar
                                ? t('جارٍ الرفع...', 'Uploading...')
                                : t('اختيار صورة', 'Upload')}
                            </span>
                          </button>
                          <input
                            type="url"
                            value={photoUrl.startsWith('data:') ? '' : photoUrl}
                            onChange={(e) => setPhotoUrl(e.target.value)}
                            placeholder={t('أو رابط صورة مباشر...', 'Or paste image URL...')}
                            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 focus:border-[#F7C600] rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                          {t('الاسم المعروض:', 'Display Name:')}
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#F7C600] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                          {t('التصنيف السينمائي المفضل:', 'Favorite Genre:')}
                        </label>
                        <select
                          value={favoriteGenre}
                          onChange={(e) => setFavoriteGenre(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#F7C600] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          {GENRE_OPTIONS.map((g) => (
                            <option key={g.ar} value={g.ar}>
                              {lang === 'en' ? g.en : g.ar}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                          {t('النبذة الشخصية:', 'Bio:')}
                        </label>
                        <textarea
                          rows={2}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder={t('اكتب نبذة قصيرة عن ذوقك السينمائي...', 'About your cinema taste...')}
                          className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#F7C600] rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
                        />
                      </div>

                      {saveSuccess ? (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>{t('تم حفظ التعديلات بنجاح!', 'Profile updated successfully!')}</span>
                        </motion.div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-3.5 py-2 text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
                          >
                            {t('إلغاء', 'Cancel')}
                          </button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            type="submit"
                            disabled={isSaving || isUploadingAvatar}
                            className="px-4 py-2 bg-[#F7C600] hover:bg-[#ffd633] text-black text-xs font-black rounded-xl shadow cursor-pointer disabled:opacity-50"
                          >
                            {isSaving
                              ? t('جارٍ الحفظ...', 'Saving...')
                              : t('حفظ التغييرات', 'Save Changes')}
                          </motion.button>
                        </div>
                      )}
                    </motion.form>
                  ) : (
                    <motion.div
                      key="profile-info-view"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className="space-y-2.5"
                    >
                      <div className="p-3.5 rounded-2xl bg-[#15151c] border border-white/[0.08] space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400">
                            {t('التصنيف المفضل', 'Favorite Genre')}
                          </span>
                          <span className="text-[#F7C600] font-bold">
                            {GENRE_OPTIONS.find((g) => g.ar === user.favoriteGenre)?.[lang] ||
                              user.favoriteGenre ||
                              t('أكشن ومغامرات', 'Action & Adventure')}
                          </span>
                        </div>

                        {user.bio ? (
                          <div className="pt-2 border-t border-white/[0.06]">
                            <span className="text-[11px] text-zinc-400 block mb-1">
                              {t('النبذة الشخصية', 'Bio')}
                            </span>
                            <p className="text-zinc-200 text-xs leading-relaxed">{user.bio}</p>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                            <span className="text-[11px] text-zinc-500">
                              {t('لم تتم إضافة نبذة شخصية بعد', 'No bio added yet')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsEditing(true)}
                              className="inline-flex items-center gap-1 text-[11px] text-[#F7C600] hover:underline font-bold cursor-pointer"
                            >
                              <span>{t('إضافة الآن', 'Add now')}</span>
                              <ArrowEnd className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 6. Sign Out Action */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSignOut}
                type="button"
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('تسجيل الخروج', 'Sign Out')}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
