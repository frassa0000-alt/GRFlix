import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ChevronLeft,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import {
  AdminSectionId,
  AdminSessionInfo,
  CategoryItem,
  MediaItem,
  PersonItem,
} from '../../types';
import {
  clearStoredAdminSession,
  getStoredAdminSession,
  getStoredAdminToken,
  loginAdmin,
  verifyAdminSession,
} from '../../services/api';
import {
  AdminAnalyticsResponse,
  fetchAdminAnalytics,
  fetchCategories,
  fetchPeople,
} from '../../services/adminService';
import { fetchAllMoviesUnified } from '../../services/movieService';
import {
  fetchTmdbSyncStatus,
  TmdbSyncStatusInfo,
  triggerAdminTmdbSync,
} from '../../services/tmdbClient';
import {
  ADMIN_NAV_ITEMS,
  AdminSidebar,
  canViewAdminSection,
  getWorkspaceGroupForSection,
} from './AdminSidebar';
import { DashboardOverviewSection } from './sections/DashboardOverviewSection';
import { MediaUploadSection } from './sections/MediaUploadSection';
import { MediaCatalogSection } from './sections/MediaCatalogSection';
import { SeriesManagerSection } from './sections/SeriesManagerSection';
import { VideoLibrarySourcesSection } from './sections/VideoLibrarySourcesSection';
import { CommunityCatalogSections } from './sections/CommunityCatalogSections';
import { UsersAnalyticsSections } from './sections/UsersAnalyticsSections';
import { SettingsGovernanceSections } from './sections/SettingsGovernanceSections';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMoviesChanged: () => void;
  onSettingsChanged?: () => void;
  onPlayMovie?: (movie: MediaItem) => void;
  initialTab?: 'upload' | 'manage' | 'email_settings' | AdminSectionId;
  currentUserEmail?: string | null;
  allowAdminAccess?: boolean;
}

const PRIMARY_ADMIN_EMAIL = 'frassa.wwindows@gmail.com';

const mapInitialTabToSection = (
  tab?: 'upload' | 'manage' | 'email_settings' | AdminSectionId
): AdminSectionId => {
  if (!tab) return 'dashboard';
  if (tab === 'upload') return 'add_movie';
  if (tab === 'manage') return 'movies';
  if (tab === 'email_settings') return 'site_settings';
  return tab;
};

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  onMoviesChanged,
  onSettingsChanged,
  onPlayMovie,
  initialTab = 'dashboard',
  currentUserEmail,
  allowAdminAccess = false,
}) => {
  const normalizedUserEmail = (currentUserEmail || '').trim().toLowerCase();
  const isPrimaryDeveloper = normalizedUserEmail === PRIMARY_ADMIN_EMAIL;
  const canOpenAdmin = isPrimaryDeveloper || Boolean(allowAdminAccess);

  // Auth State
  const [token, setToken] = useState<string | null>(getStoredAdminToken());
  const [adminSession, setAdminSession] = useState<AdminSessionInfo | null>(() =>
    getStoredAdminSession()
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>(
    normalizedUserEmail || PRIMARY_ADMIN_EMAIL
  );
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Navigation & Layout State
  const [activeSection, setActiveSection] = useState<AdminSectionId>(() =>
    mapInitialTabToSection(initialTab)
  );
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

  // Shared Core Data
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [tmdbSyncStatus, setTmdbSyncStatus] = useState<TmdbSyncStatusInfo | null>(null);
  const [isSyncingTmdb, setIsSyncingTmdb] = useState<boolean>(false);
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Sync initialTab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveSection(mapInitialTabToSection(initialTab));
      setLoginEmail(normalizedUserEmail || PRIMARY_ADMIN_EMAIL);
      setLoginError(null);
    }
  }, [isOpen, initialTab, normalizedUserEmail]);

  // Verify admin session on open
  useEffect(() => {
    if (!isOpen) return;

    const verifyAuth = async () => {
      if (!canOpenAdmin) {
        clearStoredAdminSession();
        setToken(null);
        setAdminSession(null);
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
        return;
      }

      setIsCheckingAuth(true);
      const storedSession = getStoredAdminSession();
      let curToken = getStoredAdminToken();

      // Never reuse another user's cached admin token
      if (
        storedSession?.email &&
        normalizedUserEmail &&
        storedSession.email.trim().toLowerCase() !== normalizedUserEmail
      ) {
        clearStoredAdminSession();
        curToken = null;
      }

      // Only the primary owner auto-authenticates without prompt
      if (!curToken && isPrimaryDeveloper) {
        try {
          const res = await loginAdmin(PRIMARY_ADMIN_EMAIL, 'fr010020');
          curToken = res.token;
          setAdminSession(res);
        } catch {
          // require manual login
        }
      }

      if (curToken) {
        const verified = await verifyAdminSession(curToken);
        if (
          verified &&
          (!normalizedUserEmail ||
            verified.email.trim().toLowerCase() === normalizedUserEmail)
        ) {
          setToken(curToken);
          setAdminSession(verified);
          setIsAuthenticated(true);
          setIsCheckingAuth(false);
          return;
        }
        clearStoredAdminSession();
      }

      setToken(null);
      setAdminSession(null);
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
    };

    verifyAuth();
  }, [isOpen, canOpenAdmin, isPrimaryDeveloper, normalizedUserEmail]);

  const loadCoreData = async (activeToken = token) => {
    if (!activeToken) return;
    setIsLoadingData(true);
    try {
      const [allMedia, cats, ppl, dashAnalytics, syncStatus] = await Promise.all([
        fetchAllMoviesUnified(activeToken).catch(() => []),
        fetchCategories(activeToken).catch(() => []),
        fetchPeople(activeToken).catch(() => []),
        fetchAdminAnalytics(activeToken, '30d').catch(() => null),
        fetchTmdbSyncStatus().catch(() => null),
      ]);
      setMediaItems(allMedia);
      setCategories(cats);
      setPeople(ppl);
      setAnalytics(dashAnalytics);
      setTmdbSyncStatus(syncStatus);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleTriggerTmdbSync = async () => {
    if (!token || isSyncingTmdb) return;
    setIsSyncingTmdb(true);
    try {
      const res = await triggerAdminTmdbSync(token);
      if (res?.status) {
        setTmdbSyncStatus(res.status);
      }
      await loadCoreData(token);
      onMoviesChanged();
    } finally {
      setIsSyncingTmdb(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated && token) {
      loadCoreData(token);
    }
  }, [isOpen, isAuthenticated, token]);

  // Redirect collaborator away from restricted tabs automatically
  useEffect(() => {
    if (!adminSession) return;
    if (
      !canViewAdminSection(
        activeSection,
        adminSession.isSuperAdmin,
        adminSession.permissions
      )
    ) {
      const firstAllowed = ADMIN_NAV_ITEMS.find((item) =>
        canViewAdminSection(item.id, adminSession.isSuperAdmin, adminSession.permissions)
      );
      setActiveSection(firstAllowed?.id || 'dashboard');
    }
  }, [activeSection, adminSession]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const enteredEmail = loginEmail.trim().toLowerCase();
    if (!enteredEmail || !loginPassword.trim()) {
      setLoginError('يرجى إدخال البريد الإلكتروني وكلمة مرور الإدارة');
      return;
    }
    if (!canOpenAdmin) {
      setLoginError(`لوحة الإدارة محصورة بحساب المطور ${PRIMARY_ADMIN_EMAIL} والمشرفين المعتمدين`);
      return;
    }
    if (!isPrimaryDeveloper && enteredEmail !== normalizedUserEmail) {
      setLoginError(`يجب استخدام البريد المسجل حالياً (${normalizedUserEmail})`);
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await loginAdmin(enteredEmail, loginPassword);
      setAdminSession(res);
      setToken(res.token);
      setIsAuthenticated(true);
      setLoginPassword('');
    } catch (err: any) {
      setLoginError(err?.message || 'فشل تسجيل الدخول');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearStoredAdminSession();
    setToken(null);
    setAdminSession(null);
    setIsAuthenticated(false);
    onClose();
  };

  const handleMediaUpdated = () => {
    loadCoreData();
    onMoviesChanged();
    onSettingsChanged?.();
  };

  const isSuper = adminSession?.isSuperAdmin ?? isPrimaryDeveloper;
  const activeNavMeta =
    ADMIN_NAV_ITEMS.find((i) => i.id === activeSection) || ADMIN_NAV_ITEMS[0];
  const activeGroup = getWorkspaceGroupForSection(activeSection);
  const groupSiblingTabs = ADMIN_NAV_ITEMS.filter(
    (item) =>
      item.groupId === activeGroup.id &&
      canViewAdminSection(item.id, isSuper, adminSession?.permissions)
  );

  const movieCount = mediaItems.filter((m) => m.type !== 'series').length;
  const seriesCount = mediaItems.filter((m) => m.type === 'series').length;

  // --- UNAUTHORIZED OR LOGIN SCREEN ---
  if (!canOpenAdmin || !isAuthenticated || !token) {
    if (canOpenAdmin && isCheckingAuth) {
      return (
        <div
          className="fixed inset-0 z-[110] bg-[#141416]/95 backdrop-blur-md flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="flex flex-col items-center gap-3 text-xs text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-[#ff45a2]" />
            <span>جارٍ التحقق من صلاحية الإدارة...</span>
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 z-[110] bg-[#141416]/95 backdrop-blur-md flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="bg-[#121215] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6bc9] via-[#ff2e93] to-[#d4126b] text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,46,147,0.45)]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">لوحة إدارة MASHHAD</h2>
                <p className="text-[11px] font-mono text-zinc-400">
                  {normalizedUserEmail || PRIMARY_ADMIN_EMAIL}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#1e1e22] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!canOpenAdmin ? (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-white">وصول مقتصر على الإدارة</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                يرجى تسجيل الدخول في المنصة بحساب المطور أو بريد مشرف معتمد:{' '}
                <span className="text-[#ff5ec4] font-mono">{PRIMARY_ADMIN_EMAIL}</span>
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-full bg-[#222227] hover:bg-[#2c2c33] text-white text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
              <div>
                <label className="block text-zinc-300 font-bold mb-1.5">البريد الإلكتروني للمشرف</label>
                <input
                  type="email"
                  dir="ltr"
                  required
                  readOnly={!isPrimaryDeveloper && Boolean(normalizedUserEmail)}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.09] focus:border-[#ff2e93]/70 rounded-2xl px-3.5 py-2.5 text-zinc-100 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-bold mb-1.5">
                  كلمة مرور الإدارة {!isPrimaryDeveloper && '(تتضمن VBL/9)'}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  autoFocus
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={!isPrimaryDeveloper ? 'أدخل كلمة المرور المحتوية على VBL/9' : '••••••••'}
                  className="w-full bg-[#09090b] border border-white/[0.09] focus:border-[#ff2e93]/70 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 rounded-full bg-[#ff2e93] hover:bg-[#ff47a1] text-white font-black flex items-center justify-center gap-2 cursor-pointer shadow-[0_8px_24px_rgba(255,46,147,0.35)] transition-all"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                <span>دخول إلى لوحة التحكم</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED STUDIO WORKSPACE (Floating Pill Rail + Rounded Workspace Canvas) ---
  return (
    <div
      className="fixed inset-0 z-[90] bg-[#141416] text-zinc-100 overflow-hidden p-2 sm:p-3.5 md:p-4 flex items-stretch gap-2.5 sm:gap-4"
      dir="ltr"
    >
      {/* Floating Left Matte Pill Rail + Connected Popover Menus */}
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isSuperAdmin={isSuper}
        permissions={adminSession?.permissions}
        onTriggerTmdbSync={handleTriggerTmdbSync}
        isSyncingTmdb={isSyncingTmdb || Boolean(tmdbSyncStatus?.isSyncing)}
        tmdbConfigured={Boolean(tmdbSyncStatus?.configured)}
        counts={{
          movies: movieCount,
          series: seriesCount,
          categories: categories.length,
          users: analytics?.totals?.users,
        }}
      />

      {/* Main Rounded Matte Obsidian Workspace Card */}
      <div
        className="flex-1 flex flex-col min-w-0 h-full rounded-[24px] sm:rounded-[28px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-hidden"
        dir="rtl"
      >
        {/* Workspace Header */}
        <header className="px-4 sm:px-6 pt-3.5 pb-3 border-b border-white/[0.07] bg-[#0d0d10] flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="text-zinc-500 hidden sm:inline whitespace-nowrap">MASHHAD Studio</span>
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline shrink-0" />
              <span className="text-zinc-400 hidden md:inline whitespace-nowrap">{activeGroup.label}</span>
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 hidden md:inline shrink-0" />
              <span className="font-black text-white text-sm truncate">{activeNavMeta.label}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-zinc-400 px-2">
                <Shield className="w-3.5 h-3.5 text-[#ff45a2]" />
                <span>{adminSession?.email || normalizedUserEmail || PRIMARY_ADMIN_EMAIL}</span>
                {adminSession?.roleTitle && !adminSession.isSuperAdmin && (
                  <>
                    <span className="text-zinc-600">·</span>
                    <span className="text-[#ff5ec4] font-sans font-bold">{adminSession.roleTitle}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => loadCoreData()}
                className="w-8 h-8 rounded-full bg-[#17171b] hover:bg-[#222227] border border-white/[0.08] text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                title="تحديث البيانات"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-[#ff45a2]' : ''}`}
                />
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-full bg-[#17171b] hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 border border-white/[0.08] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                title="تسجيل خروج المشرف"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-[#0a0a0c] font-black text-xs flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                title="العودة للموقع"
              >
                <X className="w-3.5 h-3.5" />
                <span>الموقع</span>
              </button>
            </div>
          </div>

          {/* Group Sibling Sub-Tabs for 1-Click Switching */}
          {groupSiblingTabs.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {groupSiblingTabs.map((tab) => {
                const TabIcon = tab.icon;
                const isTabActive = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                      isTabActive
                        ? 'bg-[#26262b] border-[#ff2e93]/45 text-white font-black'
                        : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] font-semibold'
                    }`}
                  >
                    <TabIcon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isTabActive ? 'text-[#ff45a2]' : 'text-zinc-500'
                      }`}
                    />
                    <span>{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Scrollable Workspace Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeSection === 'dashboard' && (
                  <DashboardOverviewSection
                    analytics={analytics}
                    isLoading={isLoadingData}
                    tmdbSyncStatus={tmdbSyncStatus}
                    isSyncingTmdb={isSyncingTmdb}
                    onTriggerTmdbSync={handleTriggerTmdbSync}
                    onRefresh={() => loadCoreData()}
                    onNavigate={setActiveSection}
                    onPlayMedia={
                      onPlayMovie
                        ? (m) => {
                            onPlayMovie(m);
                            onClose();
                          }
                        : undefined
                    }
                  />
                )}

                {activeSection === 'movies' && (
                  <MediaCatalogSection
                    mode="movie"
                    mediaItems={mediaItems}
                    categories={categories}
                    token={token}
                    isLoading={isLoadingData}
                    onRefresh={handleMediaUpdated}
                    onAddNew={() => setActiveSection('add_movie')}
                    onPlayMedia={
                      onPlayMovie
                        ? (m) => {
                            onPlayMovie(m);
                            onClose();
                          }
                        : undefined
                    }
                  />
                )}

                {activeSection === 'add_movie' && (
                  <MediaUploadSection
                    token={token}
                    categories={categories}
                    people={people}
                    onSaved={handleMediaUpdated}
                    onNavigateManage={() => setActiveSection('movies')}
                    onPlayMedia={
                      onPlayMovie
                        ? (m) => {
                            onPlayMovie(m);
                            onClose();
                          }
                        : undefined
                    }
                  />
                )}

                {activeSection === 'series' && (
                  <MediaCatalogSection
                    mode="series"
                    mediaItems={mediaItems}
                    categories={categories}
                    token={token}
                    isLoading={isLoadingData}
                    onRefresh={handleMediaUpdated}
                    onAddNew={() => setActiveSection('add_series')}
                    onManageSeasons={(id) => {
                      setSelectedSeriesId(id);
                      setActiveSection('seasons_episodes');
                    }}
                    onPlayMedia={
                      onPlayMovie
                        ? (m) => {
                            onPlayMovie(m);
                            onClose();
                          }
                        : undefined
                    }
                  />
                )}

                {(activeSection === 'add_series' || activeSection === 'seasons_episodes') && (
                  <SeriesManagerSection
                    activeSubMode={activeSection}
                    token={token}
                    mediaItems={mediaItems}
                    categories={categories}
                    selectedSeriesId={selectedSeriesId}
                    onSelectSeriesId={setSelectedSeriesId}
                    onRefresh={handleMediaUpdated}
                    onSwitchToSeasons={() => setActiveSection('seasons_episodes')}
                    onPlayMedia={
                      onPlayMovie
                        ? (m) => {
                            onPlayMovie(m);
                            onClose();
                          }
                        : undefined
                    }
                  />
                )}

                {(activeSection === 'video_library' || activeSection === 'playback_links') && (
                  <VideoLibrarySourcesSection
                    mode={activeSection}
                    token={token}
                    mediaItems={mediaItems}
                    onRefreshMedia={handleMediaUpdated}
                  />
                )}

                {(activeSection === 'categories' ||
                  activeSection === 'cast_directors' ||
                  activeSection === 'comments_ratings' ||
                  activeSection === 'notifications') && (
                  <CommunityCatalogSections
                    mode={activeSection}
                    token={token}
                    categories={categories}
                    people={people}
                    onRefreshCategories={() => {
                      fetchCategories(token).then(setCategories).catch(() => {});
                      onSettingsChanged?.();
                    }}
                    onRefreshPeople={() => fetchPeople(token).then(setPeople).catch(() => {})}
                    onCategoriesUpdated={() => onSettingsChanged?.()}
                  />
                )}

                {(activeSection === 'users' ||
                  activeSection === 'analytics' ||
                  activeSection === 'views_management') && (
                  <UsersAnalyticsSections
                    mode={activeSection}
                    token={token}
                    onViewsReset={handleMediaUpdated}
                  />
                )}

                {(activeSection === 'banners_home' ||
                  activeSection === 'player_settings' ||
                  activeSection === 'admins_permissions' ||
                  activeSection === 'audit_logs' ||
                  activeSection === 'site_settings') && (
                  <SettingsGovernanceSections
                    mode={activeSection}
                    token={token}
                    mediaItems={mediaItems}
                    isSuperAdmin={isSuper}
                    onSettingsUpdated={() => onSettingsChanged?.()}
                    onAdminsChanged={() => onSettingsChanged?.()}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};
