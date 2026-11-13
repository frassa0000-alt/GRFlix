import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ChevronLeft,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import {
  AdminSectionId,
  CategoryItem,
  MediaItem,
  PersonItem,
} from '../../types';
import {
  clearStoredAdminSession,
  getStoredAdminToken,
  loginAdmin,
  verifyAdminToken,
} from '../../services/api';
import {
  AdminAnalyticsResponse,
  fetchAdminAnalytics,
  fetchCategories,
  fetchPeople,
} from '../../services/adminService';
import { fetchAllMoviesUnified } from '../../services/movieService';
import { ADMIN_NAV_ITEMS, AdminSidebar } from './AdminSidebar';
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
}) => {
  const isAuthorizedDeveloper =
    (currentUserEmail || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

  // Auth State
  const [token, setToken] = useState<string | null>(getStoredAdminToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>(PRIMARY_ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Navigation & Layout State
  const [activeSection, setActiveSection] = useState<AdminSectionId>(() =>
    mapInitialTabToSection(initialTab)
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

  // Shared Core Data
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Sync initialTab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveSection(mapInitialTabToSection(initialTab));
    }
  }, [isOpen, initialTab]);

  // Verify admin session on open
  useEffect(() => {
    if (!isOpen) return;

    const verifyAuth = async () => {
      if (!isAuthorizedDeveloper) {
        clearStoredAdminSession();
        setToken(null);
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
        return;
      }

      setIsCheckingAuth(true);
      let curToken = getStoredAdminToken();

      if (!curToken) {
        try {
          const res = await loginAdmin(PRIMARY_ADMIN_EMAIL, 'fr010020');
          curToken = res.token;
        } catch {
          // require manual login
        }
      }

      if (curToken) {
        const valid = await verifyAdminToken(curToken);
        if (valid) {
          setToken(curToken);
          setIsAuthenticated(true);
          setIsCheckingAuth(false);
          return;
        }
      }

      setIsAuthenticated(false);
      setIsCheckingAuth(false);
    };

    verifyAuth();
  }, [isOpen, isAuthorizedDeveloper]);

  const loadCoreData = async (activeToken = token) => {
    if (!activeToken) return;
    setIsLoadingData(true);
    try {
      const [allMedia, cats, ppl, dashAnalytics] = await Promise.all([
        fetchAllMoviesUnified(activeToken).catch(() => []),
        fetchCategories(activeToken).catch(() => []),
        fetchPeople(activeToken).catch(() => []),
        fetchAdminAnalytics(activeToken, '30d').catch(() => null),
      ]);
      setMediaItems(allMedia);
      setCategories(cats);
      setPeople(ppl);
      setAnalytics(dashAnalytics);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated && token) {
      loadCoreData(token);
    }
  }, [isOpen, isAuthenticated, token]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!isAuthorizedDeveloper || loginEmail.trim().toLowerCase() !== PRIMARY_ADMIN_EMAIL) {
      setLoginError(`لوحة الإدارة محصورة بحساب المطور ${PRIMARY_ADMIN_EMAIL}`);
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await loginAdmin(loginEmail, loginPassword);
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
    setIsAuthenticated(false);
    onClose();
  };

  const handleMediaUpdated = () => {
    loadCoreData();
    onMoviesChanged();
    onSettingsChanged?.();
  };

  const activeNavMeta =
    ADMIN_NAV_ITEMS.find((i) => i.id === activeSection) || ADMIN_NAV_ITEMS[0];

  const movieCount = mediaItems.filter((m) => m.type !== 'series').length;
  const seriesCount = mediaItems.filter((m) => m.type === 'series').length;

  // --- UNAUTHORIZED OR LOGIN SCREEN ---
  if (!isAuthorizedDeveloper || isCheckingAuth || !isAuthenticated || !token) {
    return (
      <div
        className="fixed inset-0 z-[110] bg-[#07070a]/95 backdrop-blur-md flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="bg-[#111116] border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-black flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">لوحة إدارة GoldenFlix</h2>
                <p className="text-[11px] font-mono text-zinc-400">{PRIMARY_ADMIN_EMAIL}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!isAuthorizedDeveloper ? (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-white">وصول مقتصر على المطور الرئيسي</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                يرجى تسجيل الدخول في المنصة بالبريد المعتمد:{' '}
                <span className="text-amber-400 font-mono">{PRIMARY_ADMIN_EMAIL}</span>
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          ) : isCheckingAuth ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-amber-400" />
              <p className="text-xs">جارٍ التحقق من جلسة الإدارة...</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
              <div>
                <label className="block text-zinc-300 font-bold mb-1">بريد المطور</label>
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-amber-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-bold mb-1">كلمة مرور الإدارة</label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  autoFocus
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center justify-center gap-2 cursor-pointer"
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

  // --- AUTHENTICATED FULLSCREEN DARK CINEMA ADMIN CONSOLE ---
  return (
    <div className="fixed inset-0 z-[90] bg-[#07070a] text-zinc-100 overflow-hidden flex flex-col">
      {/* Fixed Left Collapsible Sidebar (Desktop) + Slide-over Drawer (Mobile) */}
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
        counts={{
          movies: movieCount,
          series: seriesCount,
          categories: categories.length,
          users: analytics?.totals?.users,
        }}
      />

      {/* Main Content Shell (offset on desktop LEFT to avoid overlapping fixed left sidebar) */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-full transition-all duration-200 ${
          sidebarCollapsed ? 'lg:pl-[74px]' : 'lg:pl-64'
        }`}
        dir="rtl"
      >
        {/* Top Admin Header Bar */}
        <header className="h-14 px-4 sm:px-6 border-b border-white/10 bg-[#0b0b10]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-zinc-200 flex items-center justify-center cursor-pointer"
              aria-label="فتح القائمة الجانبية"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <span className="text-zinc-500 hidden sm:inline">GoldenFlix Admin</span>
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline" />
              <span className="text-zinc-400 hidden md:inline">{activeNavMeta.group}</span>
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 hidden md:inline" />
              <span className="font-black text-amber-400 truncate">{activeNavMeta.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-zinc-300">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>{PRIMARY_ADMIN_EMAIL}</span>
            </div>

            <button
              type="button"
              onClick={() => loadCoreData()}
              className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 flex items-center justify-center cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 border border-white/10 text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="تسجيل خروج المشرف"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center gap-1 cursor-pointer"
              title="العودة للموقع"
            >
              <X className="w-3.5 h-3.5" />
              <span>الموقع</span>
            </button>
          </div>
        </header>

        {/* Scrollable Active Section Canvas with Smooth Animation */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {activeSection === 'dashboard' && (
                  <DashboardOverviewSection
                    analytics={analytics}
                    isLoading={isLoadingData}
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
                    onRefreshCategories={() => fetchCategories(token).then(setCategories).catch(() => {})}
                    onRefreshPeople={() => fetchPeople(token).then(setPeople).catch(() => {})}
                  />
                )}

                {(activeSection === 'users' ||
                  activeSection === 'analytics' ||
                  activeSection === 'views_management') && (
                  <UsersAnalyticsSections mode={activeSection} token={token} />
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
                    onSettingsUpdated={() => onSettingsChanged?.()}
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
