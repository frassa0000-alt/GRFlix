import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  History,
  KeyRound,
  Mail,
  MonitorPlay,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  clearAuditLogs,
  createAdminMember,
  deleteAdminMember,
  fetchAdminMembers,
  fetchAdminSiteSettings,
  fetchAuditLogs,
  saveAdminSiteSettings,
  updateAdminMember,
} from '../../../services/adminService';
import {
  AuthDiagnosticsResponse,
  fetchAdminMailConfig,
  fetchAuthDiagnostics,
  saveAdminMailConfig,
} from '../../../services/api';
import {
  AdminMember,
  AuditLogEntry,
  BannerSlideItem,
  MediaItem,
  SiteSettingsConfig,
} from '../../../types';
import { AdminConfirmDialog } from '../AdminConfirmDialog';

interface SettingsGovernanceSectionsProps {
  mode: 'banners_home' | 'player_settings' | 'admins_permissions' | 'audit_logs' | 'site_settings';
  token: string;
  mediaItems: MediaItem[];
  onSettingsUpdated?: () => void;
}

export const SettingsGovernanceSections: React.FC<SettingsGovernanceSectionsProps> = ({
  mode,
  token,
  mediaItems,
  onSettingsUpdated,
}) => {
  const [settings, setSettings] = useState<SiteSettingsConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Admins & Permissions
  const [admins, setAdmins] = useState<AdminMember[]>([]);
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminRole, setNewAdminRole] = useState<string>('محرر محتوى');
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<AdminMember | null>(null);

  // Audit Logs
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [logSearch, setLogSearch] = useState<string>('');
  const [confirmClearLogs, setConfirmClearLogs] = useState<boolean>(false);

  // Banner Draft
  const [bannerTitle, setBannerTitle] = useState<string>('');
  const [bannerSubtitle, setBannerSubtitle] = useState<string>('');
  const [bannerImage, setBannerImage] = useState<string>('');
  const [bannerMediaId, setBannerMediaId] = useState<string>('');

  // Mail / SMTP Settings (Preserved working email config)
  const [emailDiagnostics, setEmailDiagnostics] = useState<AuthDiagnosticsResponse | null>(null);
  const [smtpHost, setSmtpHost] = useState<string>('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<string>('465');
  const [smtpSecure, setSmtpSecure] = useState<boolean>(true);
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPass, setSmtpPass] = useState<string>('');
  const [hasSavedSmtpPass, setHasSavedSmtpPass] = useState<boolean>(false);
  const [smtpFrom, setSmtpFrom] = useState<string>('');
  const [resendKey, setResendKey] = useState<string>('');
  const [hasSavedResend, setHasSavedResend] = useState<boolean>(false);
  const [testEmailAddr, setTestEmailAddr] = useState<string>('frassa.wwindows@gmail.com');
  const [isTestingMail, setIsTestingMail] = useState<boolean>(false);
  const [mailResult, setMailResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const s = await fetchAdminSiteSettings(token);
      setSettings(s);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر تحميل الإعدادات' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMailSettings = async () => {
    try {
      const [diag, cfg] = await Promise.all([
        fetchAuthDiagnostics(),
        fetchAdminMailConfig(token).catch(() => null),
      ]);
      setEmailDiagnostics(diag);
      if (cfg) {
        setSmtpHost(cfg.smtpHost || 'smtp.gmail.com');
        setSmtpPort(String(cfg.smtpPort || 465));
        setSmtpSecure(cfg.smtpSecure !== undefined ? cfg.smtpSecure : true);
        setSmtpUser(cfg.smtpUser || '');
        setHasSavedSmtpPass(Boolean(cfg.hasSmtpPass));
        setSmtpFrom(cfg.smtpFrom || '');
        setHasSavedResend(Boolean(cfg.hasResendKey));
      }
    } catch {
      // ignore
    }
  };

  const loadAdmins = async () => {
    setIsLoading(true);
    try {
      setAdmins(await fetchAdminMembers(token));
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'فشل تحميل قائمة المديرين' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      setLogs(await fetchAuditLogs(token));
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'فشل تحميل سجل العمليات' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setFeedback(null);
    if (mode === 'banners_home' || mode === 'player_settings' || mode === 'site_settings') {
      loadSettings();
    }
    if (mode === 'site_settings') loadMailSettings();
    if (mode === 'admins_permissions') loadAdmins();
    if (mode === 'audit_logs') loadLogs();
  }, [mode, token]);

  const handleSaveSettingsPayload = async (partial: Partial<SiteSettingsConfig>, msg: string) => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await saveAdminSiteSettings(token, partial);
      setSettings(updated);
      setFeedback({ type: 'success', msg });
      onSettingsUpdated?.();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر حفظ الإعدادات' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- 1. BANNERS & HOME ---
  if (mode === 'banners_home') {
    const handleAddBanner = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!settings || !bannerTitle.trim() || !bannerImage.trim()) return;
      const newSlide: BannerSlideItem = {
        id: `bn-${Date.now()}`,
        title: bannerTitle.trim(),
        subtitle: bannerSubtitle.trim(),
        imageUrl: bannerImage.trim(),
        mediaId: bannerMediaId || undefined,
        isActive: true,
        order: (settings.banners?.length || 0) + 1,
      };
      const nextBanners = [...(settings.banners || []), newSlide];
      await handleSaveSettingsPayload({ banners: nextBanners }, 'تمت إضافة البنر وحفظ إعدادات الواجهة');
      setBannerTitle('');
      setBannerSubtitle('');
      setBannerImage('');
      setBannerMediaId('');
    };

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-amber-400" />
            <span>إدارة البنرات والواجهة الرئيسية</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            التحكم في إظهار وإخفاء أقسام الصفحة الرئيسية وإضافة بنرات ترويجية مخصصة
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {settings && (
          <>
            {/* Home Section Visibility Toggles */}
            <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
              <h3 className="text-xs font-black text-amber-400">أقسام الصفحة الرئيسية الظاهرة للزوار</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {(
                  [
                    ['showHeroBanner', 'البانر الترويجي الرئيسي (Hero)'],
                    ['showCategories', 'شريط التصنيفات السريع'],
                    ['showQuickExplore', 'بطاقات الاستكشاف السريع'],
                    ['showLatestMovies', 'قسم أحدث الأفلام السينمائية'],
                    ['showRecommendations', 'قسم المقترح لك'],
                    ['showSeries', 'قسم المسلسلات المشهورة'],
                    ['showMostWatched', 'قسم الأكثر مشاهدة وتقييماً'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="p-3 rounded-xl bg-zinc-950 border border-white/[0.06] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="font-bold text-zinc-200">{label}</span>
                    <input
                      type="checkbox"
                      checked={settings.homeSections[key]}
                      onChange={(e) => {
                        const updatedSections = {
                          ...settings.homeSections,
                          [key]: e.target.checked,
                        };
                        handleSaveSettingsPayload(
                          { homeSections: updatedSections },
                          'تم تحديث ظهور الأقسام على الواجهة الرئيسية'
                        );
                      }}
                      className="accent-amber-400 w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Banners */}
            <form
              onSubmit={handleAddBanner}
              className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3 text-xs"
            >
              <h3 className="font-black text-white">إضافة بنر ترويجي مخصص</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder="عنوان البنر *"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
                <input
                  type="text"
                  value={bannerSubtitle}
                  onChange={(e) => setBannerSubtitle(e.target.value)}
                  placeholder="وصف قصير (اختياري)"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
                <input
                  type="url"
                  dir="ltr"
                  required
                  value={bannerImage}
                  onChange={(e) => setBannerImage(e.target.value)}
                  placeholder="رابط صورة البنر (16:9) *"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <select
                  value={bannerMediaId}
                  onChange={(e) => setBannerMediaId(e.target.value)}
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">ربط بعمل معين (اختياري)</option>
                  {mediaItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.titleAr}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة البنر</span>
              </button>

              {settings.banners?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  {settings.banners.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-white/[0.06] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={b.imageUrl}
                          alt={b.title}
                          className="w-16 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{b.title}</p>
                          <p className="text-[10px] text-zinc-400 truncate">{b.subtitle}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveSettingsPayload(
                            { banners: settings.banners.filter((x) => x.id !== b.id) },
                            'تم حذف البنر'
                          )
                        }
                        className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </>
        )}
      </div>
    );
  }

  // --- 2. PLAYER SETTINGS ---
  if (mode === 'player_settings') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <MonitorPlay className="w-5 h-5 text-amber-400" />
            <span>إعدادات مشغل الفيديو الافتراضية</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            تحديد الخيارات الافتراضية لمشغل GoldenFlix في الموقع لجميع المشاهدين
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {settings && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveSettingsPayload(
                { playerSettings: settings.playerSettings },
                'تم حفظ إعدادات مشغل الفيديو بنجاح'
              );
            }}
            className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">سرعة التشغيل الافتراضية</label>
                <select
                  value={settings.playerSettings.defaultSpeed}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      playerSettings: {
                        ...settings.playerSettings,
                        defaultSpeed: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                >
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x (عادي)</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 font-bold mb-1">الجودة المفضلة</label>
                <select
                  value={settings.playerSettings.defaultQuality}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      playerSettings: {
                        ...settings.playerSettings,
                        defaultQuality: e.target.value,
                      },
                    })
                  }
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="auto">تلقائي (Auto)</option>
                  <option value="100p">100p</option>
                  <option value="144p">144p</option>
                  <option value="240p">240p</option>
                  <option value="360p">360p</option>
                  <option value="480p">480p</option>
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 font-bold mb-1">حجم الترجمة الافتراضي</label>
                <select
                  value={settings.playerSettings.defaultSubtitleSize}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      playerSettings: {
                        ...settings.playerSettings,
                        defaultSubtitleSize: e.target.value as any,
                      },
                    })
                  }
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="sm">صغير</option>
                  <option value="md">متوسط</option>
                  <option value="lg">كبير</option>
                  <option value="xl">كبير جداً</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-bold">
                <input
                  type="checkbox"
                  checked={settings.playerSettings.autoPlayNextEpisode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      playerSettings: {
                        ...settings.playerSettings,
                        autoPlayNextEpisode: e.target.checked,
                      },
                    })
                  }
                  className="accent-amber-400"
                />
                <span>تشغيل الحلقة التالية تلقائياً</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-bold">
                <input
                  type="checkbox"
                  checked={settings.playerSettings.allowExternalSubtitles}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      playerSettings: {
                        ...settings.playerSettings,
                        allowExternalSubtitles: e.target.checked,
                      },
                    })
                  }
                  className="accent-amber-400"
                />
                <span>السماح برفع ملفات ترجمة خارجية (SRT/VTT)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-bold">
                <input
                  type="checkbox"
                  checked={settings.playerSettings.skipIntroEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      playerSettings: {
                        ...settings.playerSettings,
                        skipIntroEnabled: e.target.checked,
                      },
                    })
                  }
                  className="accent-amber-400"
                />
                <span>تفعيل زر تخطي المقدمة</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ إعدادات المشغل</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  // --- 3. ADMINS & PERMISSIONS ---
  if (mode === 'admins_permissions') {
    const handleAddAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAdminName.trim() || !newAdminEmail.trim()) return;
      try {
        await createAdminMember(token, {
          name: newAdminName.trim(),
          email: newAdminEmail.trim(),
          roleTitle: newAdminRole,
        });
        setNewAdminName('');
        setNewAdminEmail('');
        loadAdmins();
        setFeedback({ type: 'success', msg: 'تمت إضافة المشرف بنجاح' });
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'فشل إضافة المشرف' });
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <span>إدارة الصلاحيات والمديرين ({admins.length})</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            تخصيص صلاحيات الرفع والتعديل والحذف وإدارة المستخدمين لكل مشرف بالمنصة
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        <form
          onSubmit={handleAddAdmin}
          className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs"
        >
          <input
            type="text"
            required
            value={newAdminName}
            onChange={(e) => setNewAdminName(e.target.value)}
            placeholder="اسم المشرف *"
            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
          />
          <input
            type="email"
            dir="ltr"
            required
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="email@example.com *"
            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
          />
          <input
            type="text"
            value={newAdminRole}
            onChange={(e) => setNewAdminRole(e.target.value)}
            placeholder="المسمى الوظيفي"
            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
          />
          <button
            type="submit"
            className="py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black cursor-pointer"
          >
            إضافة صلاحية مدير
          </button>
        </form>

        <div className="space-y-3">
          {admins.map((adm) => (
            <div
              key={adm.id}
              className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/15 text-amber-400 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white">{adm.name}</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 text-[10px] font-bold">
                        {adm.roleTitle}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-zinc-400">{adm.email}</p>
                  </div>
                </div>

                {!adm.isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveAdmin(adm)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold cursor-pointer"
                  >
                    سحب الصلاحية
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-white/[0.05]">
                {(
                  [
                    ['canUpload', 'رفع الفيديوهات'],
                    ['canEditMedia', 'تعديل المحتوى'],
                    ['canDeleteMedia', 'حذف المحتوى'],
                    ['canManageUsers', 'إدارة المستخدمين'],
                    ['canManageSettings', 'إعدادات الموقع'],
                  ] as const
                ).map(([permKey, label]) => (
                  <label key={permKey} className="flex items-center gap-1.5 text-zinc-300">
                    <input
                      type="checkbox"
                      disabled={adm.isSuperAdmin}
                      checked={adm.permissions[permKey]}
                      onChange={async (e) => {
                        await updateAdminMember(token, adm.id, {
                          permissions: { ...adm.permissions, [permKey]: e.target.checked },
                        });
                        loadAdmins();
                      }}
                      className="accent-amber-400"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <AdminConfirmDialog
          isOpen={Boolean(confirmRemoveAdmin)}
          title="سحب الصلاحية الإدارية"
          message={`هل تريد إزالة "${confirmRemoveAdmin?.email || ''}" من قائمة المديرين؟`}
          confirmLabel="سحب الصلاحية"
          onConfirm={async () => {
            if (!confirmRemoveAdmin) return;
            await deleteAdminMember(token, confirmRemoveAdmin.id);
            setConfirmRemoveAdmin(null);
            loadAdmins();
          }}
          onCancel={() => setConfirmRemoveAdmin(null)}
        />
      </div>
    );
  }

  // --- 4. AUDIT LOGS ---
  if (mode === 'audit_logs') {
    const filteredLogs = logs.filter(
      (l) =>
        !logSearch.trim() ||
        l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.details.toLowerCase().includes(logSearch.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <span>سجل العمليات الإدارية ({filteredLogs.length})</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              توثيق آلي لجميع عمليات الإضافة والتعديل والحذف وتغييرات الأمان والإعدادات
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClearLogs(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-black cursor-pointer"
          >
            مسح السجل
          </button>
        </div>

        <input
          type="text"
          value={logSearch}
          onChange={(e) => setLogSearch(e.target.value)}
          placeholder="تصفية العمليات..."
          className="w-full bg-[#111116] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white"
        />

        {isLoading ? (
          <div className="py-16 text-center text-zinc-400 text-xs">جارٍ تحميل السجل...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-[#111116] border border-white/[0.08] text-zinc-500 text-xs">
            السجل فارغ حالياً.
          </div>
        ) : (
          <div className="rounded-2xl bg-[#111116] border border-white/[0.08] divide-y divide-white/[0.05] text-xs">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white">{log.action}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-amber-300 font-mono">
                      {log.category}
                    </span>
                  </div>
                  <p className="text-zinc-400 mt-0.5">{log.details}</p>
                </div>
                <div className="text-left font-mono text-[10px] text-zinc-500 shrink-0">
                  <div>{log.adminEmail}</div>
                  <div>{new Date(log.createdAt).toLocaleString('ar-EG')}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AdminConfirmDialog
          isOpen={confirmClearLogs}
          title="تنظيف سجل العمليات"
          message="هل أنت متأكد من مسح كافة سجلات العمليات السابقة؟"
          confirmLabel="مسح السجل"
          onConfirm={async () => {
            await clearAuditLogs(token);
            setConfirmClearLogs(false);
            loadLogs();
          }}
          onCancel={() => setConfirmClearLogs(false)}
        />
      </div>
    );
  }

  // --- 5. SITE SETTINGS + REAL SMTP / MAIL CONFIG ---
  const handleSaveMail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMailResult(null);
    try {
      const res = await saveAdminMailConfig(token, {
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 465,
        smtpSecure,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim() || undefined,
        smtpFrom: smtpFrom.trim(),
        resendApiKey: resendKey.trim() || undefined,
        supabaseUrl: '',
      });
      if (res.diagnostics) setEmailDiagnostics(res.diagnostics);
      setSmtpPass('');
      setResendKey('');
      setMailResult({ success: true, message: res.message || 'تم حفظ إعدادات البريد بنجاح' });
      loadMailSettings();
    } catch (err: any) {
      setMailResult({ success: false, message: err?.message || 'فشل حفظ إعدادات البريد' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestMail = async () => {
    setIsTestingMail(true);
    setMailResult(null);
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testEmail: testEmailAddr }),
      });
      const data = await res.json();
      setMailResult({
        success: Boolean(res.ok && data.success),
        message: data.message || data.error || 'اكتمل الاختبار',
      });
    } catch (err: any) {
      setMailResult({ success: false, message: err?.message || 'فشل الاتصال بالخادم' });
    } finally {
      setIsTestingMail(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-400" />
          <span>إعدادات الموقع العامة والبريد الإلكتروني</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          اسم المنصة والألوان والأمان والتخزين وإعدادات خادم إرسال روابط تسجيل الدخول (SMTP)
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {settings && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveSettingsPayload(settings, 'تم حفظ إعدادات المنصة العامة بنجاح');
          }}
          className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4 text-xs"
        >
          <h3 className="font-black text-amber-400 border-b border-white/[0.06] pb-2">
            الإعدادات العامة والأمان والتخزين
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-400 font-bold mb-1">اسم الموقع</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-bold mb-1">الوصف المختصر</label>
              <input
                type="text"
                value={settings.siteTagline}
                onChange={(e) => setSettings({ ...settings, siteTagline: e.target.value })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-bold mb-1">نص الشعار (Logo Text)</label>
              <input
                type="text"
                dir="ltr"
                value={settings.logoText}
                onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-bold">
              <input
                type="checkbox"
                checked={settings.securitySettings.allowNewRegistrations}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: {
                      ...settings.securitySettings,
                      allowNewRegistrations: e.target.checked,
                    },
                  })
                }
                className="accent-amber-400"
              />
              <span>السماح بتسجيل حسابات جديدة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-bold">
              <input
                type="checkbox"
                checked={settings.securitySettings.requireEmailVerification}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: {
                      ...settings.securitySettings,
                      requireEmailVerification: e.target.checked,
                    },
                  })
                }
                className="accent-amber-400"
              />
              <span>إلزام التحقق عبر رابط البريد الإلكتروني</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ إعدادات المنصة</span>
          </button>
        </form>
      )}

      {/* Email / SMTP / Resend Dispatch Configuration */}
      <form
        onSubmit={handleSaveMail}
        className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
          <div className="flex items-center gap-2 font-black text-white">
            <Mail className="w-4 h-4 text-amber-400" />
            <span>خادم إرسال روابط تسجيل الدخول (SMTP / Resend)</span>
          </div>
          {emailDiagnostics && (
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                emailDiagnostics.realDeliveryReady
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
            >
              {emailDiagnostics.realDeliveryReady ? 'متصل وجاهز للإرسال' : 'بانتظار الإعداد'}
            </span>
          )}
        </div>

        {mailResult && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 ${
              mailResult.success
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {mailResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{mailResult.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-zinc-400 font-bold mb-1">SMTP Host</label>
            <input
              type="text"
              dir="ltr"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-zinc-400 font-bold mb-1">SMTP Port</label>
            <input
              type="number"
              dir="ltr"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-zinc-400 font-bold mb-1">SMTP User (Email)</label>
            <input
              type="email"
              dir="ltr"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-zinc-400 font-bold mb-1">
              SMTP App Password {hasSavedSmtpPass ? '(محفوظ حالياً)' : ''}
            </label>
            <input
              type="password"
              dir="ltr"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={hasSavedSmtpPass ? '••••••••••••' : 'أدخل كلمة مرور التطبيقات'}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-zinc-400 font-bold mb-1">عنوان المرسل (From)</label>
            <input
              type="text"
              dir="ltr"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="GoldenFlix <noreply@domain.com>"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-zinc-400 font-bold mb-1">
              Resend API Key {hasSavedResend ? '(محفوظ)' : '(بديل اختياري)'}
            </label>
            <input
              type="password"
              dir="ltr"
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              placeholder="re_..."
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>حفظ والتحقق من البريد</span>
          </button>

          <div className="flex items-center gap-2">
            <input
              type="email"
              dir="ltr"
              value={testEmailAddr}
              onChange={(e) => setTestEmailAddr(e.target.value)}
              className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono w-56"
            />
            <button
              type="button"
              disabled={isTestingMail}
              onClick={handleSendTestMail}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer"
            >
              {isTestingMail ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>اختبار الإرسال</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
