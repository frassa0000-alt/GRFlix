import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MediaItem,
  ActiveTab,
  BottomNavTab,
  WatchProgress,
  AppUserProfile,
  AdminSectionId,
  SiteSettingsConfig,
  NotificationItem,
} from './types';
import { fetchPublishedMoviesUnified, deleteMovieFromDatabases } from './services/movieService';
import {
  fetchPublicSiteSettings,
  fetchPublicNotifications,
  recordMediaView,
} from './services/adminService';
import {
  getStoredAdminToken,
  clearStoredAdminSession,
  getStoredVerifiedUser,
  setStoredVerifiedUser,
  verifyAuthEmailLink,
  exchangeSupabaseMagicSession,
  loginAdmin,
} from './services/api';
import {
  getFavorites,
  toggleFavorite,
  getWatchHistory,
  removeMediaFromLocalUserData,
} from './services/storage';
import { onAuthUserChanged } from './services/firebase';
import { TopHeader } from './components/layout/TopHeader';
import { SideMenuDrawer } from './components/layout/SideMenuDrawer';
import { HeroBanner, HeroSlideItem } from './components/home/HeroBanner';
import { ContinueWatchingSection } from './components/home/ContinueWatchingSection';
import { ContentSection } from './components/home/ContentSection';
import { RecommendationSection } from './components/home/RecommendationSection';
import { QuickExploreCards } from './components/home/QuickExploreCards';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { VideoPlayer } from './components/player/VideoPlayer';
import { MediaDetailModal } from './components/modals/MediaDetailModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { AuthModal } from './components/auth/AuthModal';
import { AdminDashboardModal } from './components/admin/AdminDashboardModal';
import { CategoriesView } from './components/views/CategoriesView';
import { HistoryView } from './components/views/HistoryView';
import { FavoritesView } from './components/views/FavoritesView';
import { MediaCard } from './components/cards/MediaCard';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';

export default function App() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // User Authentication State (Verified Email Session + Firebase Auth)
  const [authUser, setAuthUser] = useState<AppUserProfile | null>(() => getStoredVerifiedUser());
  const isDeveloperUser =
    (authUser?.email || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<'login' | 'register'>('login');
  const [isUserProfileOpen, setIsUserProfileOpen] = useState<boolean>(false);
  const [authLinkNotice, setAuthLinkNotice] = useState<{
    type: 'loading' | 'success' | 'error';
    message: string;
  } | null>(null);

  const handleOpenLogin = useCallback(() => {
    setAuthModalInitialTab('login');
    setIsAuthModalOpen(true);
  }, []);

  const handleOpenRegister = useCallback(() => {
    setAuthModalInitialTab('register');
    setIsAuthModalOpen(true);
  }, []);

  // Subscribe to Firebase Auth session state without wiping verified email-link sessions
  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      if (user) {
        setStoredVerifiedUser(user);
        setAuthUser(user);
      } else {
        const saved = getStoredVerifiedUser();
        setAuthUser(saved);
      }
    });
    return () => unsubscribe();
  }, []);

  // Automatically verify and log in when user clicks an email link (?auth_token= or Supabase #access_token=)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authToken = searchParams.get('auth_token');
    const emailTest = searchParams.get('email_test');

    const rawHash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = new URLSearchParams(rawHash);
    const supabaseAccessToken = hashParams.get('access_token');

    if (emailTest === 'ok') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthLinkNotice({
        type: 'success',
        message: 'تم اختبار رابط البريد الإلكتروني بنجاح! خدمة إرسال الروابط جاهزة وتعمل.',
      });
      return;
    }

    if (!authToken && !supabaseAccessToken) return;

    window.history.replaceState({}, document.title, window.location.pathname);

    const completeLinkSignIn = async () => {
      setAuthLinkNotice({
        type: 'loading',
        message: 'جارٍ تأكيد الرابط وتسجيل دخولك إلى حسابك تلقائياً...',
      });
      try {
        const res = authToken
          ? await verifyAuthEmailLink(authToken)
          : await exchangeSupabaseMagicSession(supabaseAccessToken as string);

        if (res.user) {
          setStoredVerifiedUser(res.user);
          setAuthUser(res.user);
          setIsAuthModalOpen(false);
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('goldenflix_auth_channel');
            channel.postMessage({ type: 'AUTH_VERIFIED', user: res.user });
            channel.close();
          }
          setAuthLinkNotice({
            type: 'success',
            message: res.message || 'تم تأكيد بريدك الإلكتروني وتسجيل دخولك بنجاح!',
          });
        }
      } catch (err: any) {
        setAuthLinkNotice({
          type: 'error',
          message: err?.message || 'تعذر تفعيل الرابط، قد يكون منتهي الصلاحية أو مستخدماً من قبل.',
        });
      }
    };

    completeLinkSignIn();
  }, []);

  useEffect(() => {
    if (!authLinkNotice || authLinkNotice.type === 'loading') return;
    const timer = setTimeout(() => {
      setAuthLinkNotice(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [authLinkNotice]);

  // Navigation states
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [bottomNavTab, setBottomNavTab] = useState<BottomNavTab>('home');

  // Modals & Player state
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [playingMedia, setPlayingMedia] = useState<MediaItem | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'upload' | 'manage' | 'email_settings' | AdminSectionId
  >('dashboard');
  const [siteSettings, setSiteSettings] = useState<SiteSettingsConfig | null>(null);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState<boolean>(false);

  const loadSiteSettings = useCallback(async () => {
    const cfg = await fetchPublicSiteSettings();
    if (cfg) {
      setSiteSettings(cfg);
      if (cfg.siteName) {
        document.title = cfg.siteName;
      }
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const list = await fetchPublicNotifications();
    setNotifications(list);
  }, []);

  // Load media data from Firestore and Server
  const refreshData = useCallback(async () => {
    try {
      const data = await fetchPublishedMoviesUnified();
      setMediaItems(data);
      const validSet = new Set(data.map((m) => m.id));
      const rawFavs = getFavorites();
      const rawHist = getWatchHistory();
      const staleFavIds = rawFavs.filter((id) => !validSet.has(id));
      const staleHistIds = rawHist.filter((h) => !validSet.has(h.mediaId)).map((h) => h.mediaId);
      if (staleFavIds.length > 0 || staleHistIds.length > 0) {
        removeMediaFromLocalUserData([...staleFavIds, ...staleHistIds]);
      }
      setFavorites(rawFavs.filter((id) => validSet.has(id)));
      setHistory(rawHist.filter((h) => validSet.has(h.mediaId)));
    } catch (err) {
      console.error('Failed to load movies:', err);
      setFavorites(getFavorites());
      setHistory(getWatchHistory());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    loadSiteSettings();
    loadNotifications();
  }, [refreshData, loadSiteSettings, loadNotifications]);

  // Synchronized navigation between Top Header, Category Capsules, Side Drawer, and 5-tab Mobile Bottom Nav
  const handleTopTabSelect = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'favorites') {
      setBottomNavTab('favorites');
    } else if (tab === 'movies') {
      setBottomNavTab('movies');
    } else if (tab === 'series') {
      setBottomNavTab('series');
    } else {
      setBottomNavTab('home');
    }
  }, []);

  const handleBottomTabSelect = useCallback((tab: BottomNavTab) => {
    if (tab === 'profile') {
      setIsUserProfileOpen(true);
      return;
    }

    setBottomNavTab(tab);
    if (tab === 'favorites') {
      setActiveTab('favorites');
    } else if (tab === 'movies') {
      setActiveTab('movies');
    } else if (tab === 'series') {
      setActiveTab('series');
    } else if (tab === 'home') {
      setActiveTab('home');
    }
  }, []);

  const handleToggleFav = (id?: string) => {
    if (!id) return;
    const updated = toggleFavorite(id);
    setFavorites(updated);
  };

  const handleStartPlay = (media: MediaItem) => {
    setPlayingMedia(media);
    setSelectedMedia(null);
    recordMediaView(media.id, undefined, authUser?.email);
  };

  // Real Admin-Driven Hero Slides: active banners from siteSettings.banners + media.isFeatured
  const heroSlides = useMemo<HeroSlideItem[]>(() => {
    const slides: HeroSlideItem[] = [];
    const includedMediaIds = new Set<string>();

    const activeBanners = (siteSettings?.banners || [])
      .filter((b) => b.isActive !== false)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    for (const banner of activeBanners) {
      const linked = banner.mediaId
        ? mediaItems.find((m) => m.id === banner.mediaId)
        : undefined;
      if (linked) includedMediaIds.add(linked.id);

      const imageUrl =
        banner.imageUrl || linked?.bannerUrl || linked?.posterUrl || '';
      if (!imageUrl && !linked) continue;

      slides.push({
        id: `banner-${banner.id}`,
        title: banner.title || linked?.titleAr || linked?.title || 'GoldenFlix Cinema',
        subtitle: banner.subtitle || linked?.description || '',
        imageUrl,
        ctaLabel: banner.ctaLabel || 'مشاهدة الآن',
        media: linked,
      });
    }

    const adminFeaturedMedia = [...mediaItems]
      .filter((m) => m.isFeatured && !includedMediaIds.has(m.id))
      .sort((a, b) => {
        const orderDiff = (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999);
        if (orderDiff !== 0) return orderDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

    for (const m of adminFeaturedMedia) {
      includedMediaIds.add(m.id);
      slides.push({
        id: `featured-${m.id}`,
        title: m.titleAr || m.title,
        subtitle: m.description,
        imageUrl: m.bannerUrl || m.posterUrl,
        ctaLabel: m.type === 'series' ? 'مشاهدة المسلسل' : 'مشاهدة الفيلم',
        media: m,
      });
    }

    // Fallback exclusively from real database items when no explicit featured banner has been set yet
    if (slides.length === 0 && mediaItems.length > 0) {
      const newest = [...mediaItems]
        .sort((a, b) => {
          const orderDiff = (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999);
          if (orderDiff !== 0) return orderDiff;
          return (b.createdAt || 0) - (a.createdAt || 0);
        })
        .slice(0, 5);

      for (const m of newest) {
        slides.push({
          id: `auto-${m.id}`,
          title: m.titleAr || m.title,
          subtitle: m.description,
          imageUrl: m.bannerUrl || m.posterUrl,
          ctaLabel: m.type === 'series' ? 'مشاهدة المسلسل' : 'مشاهدة الفيلم',
          media: m,
        });
      }
    }

    return slides.slice(0, 6);
  }, [siteSettings?.banners, mediaItems]);

  // Real Home Lists
  const latestMovies = useMemo(
    () =>
      [...mediaItems]
        .filter((m) => m.type === 'movie' || !m.type)
        .sort((a, b) => {
          const latestBoost = (b.isLatest ? 1 : 0) - (a.isLatest ? 1 : 0);
          if (latestBoost !== 0) return latestBoost;
          return (b.createdAt || 0) - (a.createdAt || 0);
        }),
    [mediaItems]
  );

  const seriesItems = useMemo(
    () =>
      [...mediaItems]
        .filter((m) => m.type === 'series' || (m.genres && m.genres.includes('series')))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [mediaItems]
  );

  const mostWatched = useMemo(() => {
    const score = (m: MediaItem) =>
      (m.isMostWatched ? 100000 : 0) + (m.viewsCount || 0) * 10 + (m.rating || 0);
    return [...mediaItems]
      .filter((m) => m.isMostWatched || (m.viewsCount || 0) > 0 || (m.rating || 0) >= 8.0)
      .sort((a, b) => score(b) - score(a));
  }, [mediaItems]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    return mediaItems.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        m.titleAr.toLowerCase().includes(query) ||
        m.genres.some((g) => g.toLowerCase().includes(query)) ||
        m.description.toLowerCase().includes(query)
    );
  }, [mediaItems, searchQuery]);

  // Tab filtered items
  const tabFilteredItems = useMemo(() => {
    if (activeTab === 'latest') {
      return [...mediaItems].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    if (activeTab === 'trending') {
      const list = mostWatched.length > 0 ? mostWatched : [...mediaItems];
      return [...list].sort(
        (a, b) =>
          (b.viewsCount || 0) * 10 +
          (b.rating || 0) -
          ((a.viewsCount || 0) * 10 + (a.rating || 0))
      );
    }
    if (activeTab === 'top_rated') {
      return [...mediaItems].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (activeTab === 'anime') {
      return mediaItems.filter((m) => m.type === 'anime' || m.genres.includes('anime'));
    }
    if (activeTab === 'series') {
      return mediaItems.filter((m) => m.type === 'series' || (m.genres && m.genres.includes('series')));
    }
    if (activeTab === 'movies') {
      return mediaItems.filter((m) => m.type === 'movie' || !m.type);
    }

    const genreAliases: Record<string, string[]> = {
      action: ['action', 'أكشن', 'اكشن', 'حركة'],
      drama: ['drama', 'دراما'],
      horror: ['horror', 'رعب', 'تشويق'],
      comedy: ['comedy', 'كوميديا', 'كوميدي'],
      'sci-fi': ['sci-fi', 'scifi', 'خيال علمي', 'خيال'],
      adventure: ['adventure', 'مغامرات', 'مغامرة'],
      crime: ['crime', 'جريمة', 'غموض'],
      romance: ['romance', 'رومانسي', 'رومانسية'],
    };

    const aliases = genreAliases[activeTab];
    if (aliases) {
      return mediaItems.filter((m) =>
        (m.genres || []).some((g) => {
          const norm = String(g).toLowerCase().trim();
          return aliases.some((a) => norm === a || norm.includes(a));
        })
      );
    }

    return [];
  }, [mediaItems, activeTab, mostWatched]);

  // Ensure developer admin session stays cleared for non-developer users
  useEffect(() => {
    if (!isDeveloperUser) {
      clearStoredAdminSession();
      setIsAdminModalOpen(false);
    }
  }, [isDeveloperUser]);

  const handleOpenDeveloperSuite = useCallback(() => {
    if (!isDeveloperUser) {
      setIsSideMenuOpen(false);
      setAuthModalInitialTab('login');
      setIsAuthModalOpen(true);
      return;
    }
    setIsAuthModalOpen(false);
    setIsSideMenuOpen(false);
    setAdminInitialTab('dashboard');
    setIsAdminModalOpen(true);
  }, [isDeveloperUser]);

  const handleOpenEmailSettings = useCallback(() => {
    if (!isDeveloperUser) {
      setIsSideMenuOpen(false);
      setAuthModalInitialTab('login');
      setIsAuthModalOpen(true);
      return;
    }
    setIsAuthModalOpen(false);
    setIsSideMenuOpen(false);
    setAdminInitialTab('email_settings');
    setIsAdminModalOpen(true);
  }, [isDeveloperUser]);

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#070709] text-zinc-100 flex flex-col overflow-x-hidden selection:bg-amber-400 selection:text-black"
    >
      {/* Top Cinema Header */}
      <TopHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSideMenu={() => setIsSideMenuOpen(true)}
        onOpenGoogleLogin={handleOpenLogin}
        googleUser={authUser}
        activeTab={activeTab}
        bottomNavTab={bottomNavTab}
        onSelectTab={handleTopTabSelect}
        onSelectBottomTab={handleBottomTabSelect}
        notifications={notifications}
        siteName={siteSettings?.siteName}
      />

      {/* Email Verification Notification Toast */}
      {authLinkNotice && (
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3">
          <div
            className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2.5 shadow-lg ${
              authLinkNotice.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : authLinkNotice.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {authLinkNotice.type === 'loading' && (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              )}
              {authLinkNotice.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {authLinkNotice.type === 'error' && (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-bold leading-snug">{authLinkNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setAuthLinkNotice(null)}
              aria-label="إغلاق التنبيه"
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Stage */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24 md:pb-14">
        {/* A. Active Search Results */}
        {searchQuery.trim().length > 0 ? (
          <div className="py-3 space-y-4">
            <div className="flex items-center justify-between text-xs sm:text-sm text-zinc-400">
              <span>نتائج البحث عن: "{searchQuery}"</span>
              <span className="font-bold text-amber-400 tabular-nums">({searchResults.length})</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-20 text-center text-zinc-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-bold text-zinc-300">لم يتم العثور على أي نتائج</p>
                <p className="text-xs text-zinc-500 mt-1">
                  جرب البحث بكلمة أخرى أو تصفح الأقسام المتاحة
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {searchResults.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    inGrid={true}
                    onSelect={(m) => setSelectedMedia(m)}
                    isFavorite={favorites.includes(item.id)}
                    onToggleFavorite={handleToggleFav}
                  />
                ))}
              </div>
            )}
          </div>
        ) : bottomNavTab === 'categories' ? (
          /* B. Categories View */
          <CategoriesView
            mediaItems={mediaItems}
            onSelectMedia={(item) => setSelectedMedia(item)}
            favorites={favorites}
            onToggleFavorite={handleToggleFav}
          />
        ) : bottomNavTab === 'history' ? (
          /* C. Watch History View */
          <HistoryView
            history={history}
            mediaItems={mediaItems}
            onPlay={handleStartPlay}
            onRefreshHistory={refreshData}
          />
        ) : bottomNavTab === 'favorites' ? (
          /* D. Favorites View */
          <FavoritesView
            favorites={favorites}
            mediaItems={mediaItems}
            onSelectMedia={(item) => setSelectedMedia(item)}
            onToggleFavorite={handleToggleFav}
          />
        ) : activeTab !== 'home' ? (
          /* E. Top/Mobile Category Tab Filtered View (Movies, Series, Latest, Trending, Top Rated, Anime) */
          <div className="py-2 space-y-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between text-xs sm:text-sm text-zinc-400">
                  <h2 className="font-black text-white text-base sm:text-lg">
                    {activeTab === 'latest'
                      ? 'أحدث الإضافات'
                      : activeTab === 'trending'
                      ? 'الأكثر مشاهدة'
                      : activeTab === 'top_rated'
                      ? 'الأعلى تقييماً'
                      : activeTab === 'series'
                      ? 'المسلسلات'
                      : activeTab === 'movies'
                      ? 'الأفلام السينمائية'
                      : activeTab === 'action'
                      ? 'أكشن وحركة'
                      : activeTab === 'drama'
                      ? 'دراما'
                      : activeTab === 'horror'
                      ? 'رعب وتشويق'
                      : activeTab === 'comedy'
                      ? 'كوميديا'
                      : activeTab === 'sci-fi'
                      ? 'خيال علمي'
                      : activeTab === 'adventure'
                      ? 'مغامرات'
                      : activeTab === 'crime'
                      ? 'جريمة وغموض'
                      : activeTab === 'romance'
                      ? 'رومانسي'
                      : 'التصنيف المختار'}
                  </h2>
                  <span className="text-amber-400 font-mono font-bold tabular-nums">
                    ({tabFilteredItems.length})
                  </span>
                </div>

                {tabFilteredItems.length === 0 ? (
                  <div className="py-20 text-center text-zinc-500 bg-zinc-900/30 rounded-2xl border border-white/[0.06]">
                    <Film className="w-12 h-12 mx-auto mb-2 text-zinc-600" />
                    <p className="text-sm font-bold text-zinc-300">
                      لا توجد أعمال منشورة في هذا القسم حالياً
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {tabFilteredItems.map((item) => (
                      <MediaCard
                        key={item.id}
                        item={item}
                        inGrid={true}
                        onSelect={(m) => setSelectedMedia(m)}
                        isFavorite={favorites.includes(item.id)}
                        onToggleFavorite={handleToggleFav}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          /* F. LUXURY GOLDENFLIX HOMEPAGE */
          <motion.div
            key="home-screen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Loading Skeleton on initial boot */}
            {isLoading && mediaItems.length === 0 ? (
              <div className="space-y-6">
                <div className="w-full h-[330px] sm:h-[400px] md:h-[470px] rounded-2xl sm:rounded-3xl bg-zinc-900/70 animate-pulse border border-white/[0.06]" />
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4">
                  {[0, 1, 2, 3, 4].map((slot) => (
                    <div
                      key={slot}
                      className="aspect-[2/3] rounded-2xl bg-zinc-900/60 animate-pulse border border-white/[0.05]"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* 1. Large Cinematic Hero Banner (Admin Banners + Featured Items) */}
                {heroSlides.length > 0 && siteSettings?.homeSections?.showHeroBanner !== false && (
                  <HeroBanner
                    slides={heroSlides}
                    onPlayMedia={(item) => handleStartPlay(item)}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                  />
                )}

                {/* 2. Continue Watching (Real User Watch Progress) */}
                <ContinueWatchingSection
                  history={history}
                  mediaItems={mediaItems}
                  onPlayMedia={(item) => handleStartPlay(item)}
                  onSelectMedia={(item) => setSelectedMedia(item)}
                  onViewHistory={() => handleBottomTabSelect('history')}
                />

                {/* 4. Quick Explore Animated Cards */}
                {siteSettings?.homeSections?.showQuickExplore !== false && (
                  <QuickExploreCards
                    activeTab={activeTab}
                    onSelectTab={handleTopTabSelect}
                    latestCount={mediaItems.length}
                    trendingCount={mostWatched.length > 0 ? mostWatched.length : mediaItems.length}
                    topRatedCount={
                      mediaItems.filter((m) => (m.rating || 0) >= 8).length || mediaItems.length
                    }
                  />
                )}

                {/* Empty Library State if database currently has no published media */}
                {mediaItems.length === 0 && (
                  <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-white/[0.08] p-8 my-6">
                    <div className="w-16 h-16 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-400/25">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-white mb-2">مكتبة الأفلام فارغة حالياً</h3>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
                      {isDeveloperUser
                        ? 'يمكنك إضافة أول فيلم أو مسلسل إلى المنصة من لوحة التحكم الإدارية.'
                        : 'ستتوفر أحدث الأفلام والمسلسلات قريباً على منصة GoldenFlix.'}
                    </p>
                    {isDeveloperUser && (
                      <button
                        type="button"
                        onClick={handleOpenDeveloperSuite}
                        className="min-h-[44px] inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                      >
                        <span>فتح لوحة التحكم ورفع المحتوى</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 5. Latest Movies Section */}
                {latestMovies.length > 0 && siteSettings?.homeSections?.showLatestMovies !== false && (
                  <ContentSection
                    title="أحدث الأفلام"
                    iconType="movies"
                    items={latestMovies}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFav}
                    onViewAll={() => handleTopTabSelect('movies')}
                    variant="poster"
                  />
                )}

                {/* 6. Smart Recommendations from Real User History */}
                {history.length > 0 &&
                  mediaItems.length > 0 &&
                  siteSettings?.homeSections?.showRecommendations !== false && (
                    <RecommendationSection
                      history={history}
                      mediaItems={mediaItems}
                      onSelectMedia={(item) => setSelectedMedia(item)}
                      favorites={favorites}
                      onToggleFavorite={handleToggleFav}
                    />
                  )}

                {/* 7. Latest Series Section */}
                {seriesItems.length > 0 && siteSettings?.homeSections?.showSeries !== false && (
                  <ContentSection
                    title="أحدث المسلسلات"
                    iconType="series"
                    items={seriesItems}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFav}
                    onViewAll={() => handleTopTabSelect('series')}
                    variant="poster"
                  />
                )}

                {/* 8. Most Watched Section */}
                {mostWatched.length > 0 && siteSettings?.homeSections?.showMostWatched !== false && (
                  <ContentSection
                    title="الأكثر مشاهدة"
                    iconType="trending"
                    items={mostWatched}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFav}
                    onViewAll={() => handleTopTabSelect('trending')}
                    variant="landscape"
                  />
                )}
              </>
            )}
          </motion.div>
        )}
      </main>

      {/* Luxury Cinema Footer */}
      <footer className="hidden md:block w-full border-t border-white/[0.06] bg-[#050507]">
        <div className="max-w-7xl mx-auto px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-black text-white">
              Golden<span className="text-amber-400">Flix</span>
            </span>
            <span className="text-zinc-600" aria-hidden="true">|</span>
            <span>{siteSettings?.siteTagline || 'منصة المشاهدة السينمائية الفاخرة'}</span>
          </div>

          <div className="flex items-center gap-5 font-bold">
            <button
              type="button"
              onClick={() => handleTopTabSelect('home')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => handleTopTabSelect('movies')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              الأفلام
            </button>
            <button
              type="button"
              onClick={() => handleTopTabSelect('series')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              المسلسلات
            </button>
            <button
              type="button"
              onClick={() => handleBottomTabSelect('categories')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              التصنيفات
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation: الرئيسية · الأفلام · المسلسلات · حسابي */}
      <BottomNavigation
        currentTab={bottomNavTab}
        onSelectTab={handleBottomTabSelect}
        user={authUser}
        isProfileOpen={isUserProfileOpen}
      />

      {/* Side Menu Drawer */}
      <SideMenuDrawer
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={handleTopTabSelect}
        onSelectBottomTab={handleBottomTabSelect}
        favoritesCount={favorites.length}
        historyCount={history.length}
        onOpenAdminDashboard={handleOpenDeveloperSuite}
        googleUser={authUser}
        onOpenLogin={handleOpenLogin}
        onOpenRegister={handleOpenRegister}
        onOpenProfileModal={() => setIsUserProfileOpen(true)}
      />

      {/* Real Email Verification Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalInitialTab}
        currentUserEmail={authUser?.email || null}
        onSuccess={(user) => {
          setStoredVerifiedUser(user);
          setAuthUser(user);
          setIsUserProfileOpen(true);
        }}
        onOpenDeveloperAccount={handleOpenDeveloperSuite}
        onOpenEmailSettings={handleOpenEmailSettings}
      />

      {/* User Profile Modal ("حسابي") */}
      <UserProfileModal
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        user={authUser}
        onOpenAuthModal={handleOpenLogin}
        onUserUpdated={(u) => setAuthUser(u)}
        favoritesCount={favorites.length}
        historyCount={history.length}
      />

      {/* Video Player Modal / Fullscreen */}
      {playingMedia && (
        <VideoPlayer
          media={playingMedia}
          playerDefaults={siteSettings?.playerSettings}
          onClose={() => {
            setPlayingMedia(null);
            refreshData();
          }}
        />
      )}

      {/* Media Detail Sheet Modal */}
      <MediaDetailModal
        media={selectedMedia}
        isOpen={Boolean(selectedMedia)}
        onClose={() => setSelectedMedia(null)}
        onPlay={(media) => handleStartPlay(media)}
        isFavorite={selectedMedia ? favorites.includes(selectedMedia.id) : false}
        onToggleFavorite={() => selectedMedia && handleToggleFav(selectedMedia.id)}
        isAdmin={isDeveloperUser}
        onDeleteMovie={
          isDeveloperUser
            ? async (movie) => {
                try {
                  let token = getStoredAdminToken();
                  if (!token) {
                    const session = await loginAdmin('frassa.wwindows@gmail.com', 'fr010020');
                    token = session.token;
                  }
                  setMediaItems((prev) => prev.filter((m) => m.id !== movie.id));
                  setFavorites((prev) => prev.filter((id) => id !== movie.id));
                  setHistory((prev) => prev.filter((h) => h.mediaId !== movie.id));
                  setSelectedMedia(null);
                  if (playingMedia?.id === movie.id) {
                    setPlayingMedia(null);
                  }
                  await deleteMovieFromDatabases(movie, token);
                  await Promise.all([refreshData(), loadSiteSettings()]);
                } catch (err: any) {
                  console.error(err?.message || 'فشل حذف الفيلم');
                  refreshData();
                }
              }
            : undefined
        }
        onOpenAdminDashboard={
          isDeveloperUser
            ? () => {
                setSelectedMedia(null);
                setIsAdminModalOpen(true);
              }
            : undefined
        }
      />

      {/* Admin Dashboard Modal (exclusively mounted for frassa.wwindows@gmail.com) */}
      {isDeveloperUser && (
        <AdminDashboardModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onMoviesChanged={refreshData}
          onSettingsChanged={() => {
            loadSiteSettings();
            loadNotifications();
          }}
          onPlayMovie={(movie) => handleStartPlay(movie)}
          initialTab={adminInitialTab}
          currentUserEmail={authUser?.email || null}
        />
      )}
    </div>
  );
}
