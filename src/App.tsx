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
  MediaAlertSubscription,
  UserReleaseNotification,
  InfoPageId,
} from './types';
import {
  fetchAllMoviesUnified,
  fetchPublishedMoviesUnified,
  deleteMovieFromDatabases,
} from './services/movieService';
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
  clearStoredVerifiedUser,
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
import {
  getStoredMediaAlerts,
  getStoredReleaseNotifications,
  syncAlertsAndNotificationsFromCloud,
  toggleMediaAlertSubscription,
  removeMediaAlertSubscription,
  evaluateMediaReleaseAlerts,
  markReleaseNotificationRead,
  markAllReleaseNotificationsRead,
  hasPlayableMediaVideo,
} from './services/releaseAlertService';
import {
  onAuthUserChanged,
  completeGoogleRedirectResult,
  completeFirebaseEmailLinkSignIn,
  refreshCurrentFirebaseUser,
  getFirebaseAuthErrorMessage,
} from './services/firebase';
import { useLanguage } from './contexts/LanguageContext';
import { TopHeader } from './components/layout/TopHeader';
import { SideMenuDrawer } from './components/layout/SideMenuDrawer';
import { HeroBanner, HeroSlideItem } from './components/home/HeroBanner';
import { ContinueWatchingSection } from './components/home/ContinueWatchingSection';
import { ContentSection } from './components/home/ContentSection';
import { RecommendationSection } from './components/home/RecommendationSection';
import { SurprisePickBar } from './components/home/SurprisePickBar';
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
import { EmptyCinemaState } from './components/common/EmptyCinemaState';
import { SiteFooter } from './components/layout/SiteFooter';
import { SupportPage } from './components/pages/SupportPage';
import { PrivacyPage } from './components/pages/PrivacyPage';
import { AboutPage } from './components/pages/AboutPage';
import { TermsPage } from './components/pages/TermsPage';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Star,
  Flame,
  Film,
  Tv,
  Heart,
  LayoutGrid,
  Clapperboard,
  ArrowLeft,
  ArrowRight,
  Plus,
  BellRing,
  Calendar,
  RotateCcw,
} from 'lucide-react';

export default function App() {
  const { lang, dir, t, getMediaTitle } = useLanguage();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [mediaAlerts, setMediaAlerts] = useState<MediaAlertSubscription[]>(() =>
    getStoredMediaAlerts()
  );
  const [releaseNotifications, setReleaseNotifications] = useState<UserReleaseNotification[]>(() =>
    getStoredReleaseNotifications()
  );
  const [releaseToast, setReleaseToast] = useState<UserReleaseNotification | null>(null);
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

  // Subscribe to Firebase Auth session state and handle Google Redirect / Email Verification reloads
  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      if (user) {
        setStoredVerifiedUser(user);
        setAuthUser(user);
      } else {
        const saved = getStoredVerifiedUser();
        // Preserve legacy Express email-link sessions (user-*) while clearing signed-out Firebase sessions
        if (saved && saved.uid && saved.uid.startsWith('user-')) {
          setAuthUser(saved);
        } else {
          clearStoredVerifiedUser();
          setAuthUser(null);
        }
      }
    });

    // Complete pending Google signInWithRedirect on mobile/popup-blocked browsers
    completeGoogleRedirectResult()
      .then((redirectUser) => {
        if (redirectUser) {
          setStoredVerifiedUser(redirectUser);
          setAuthUser(redirectUser);
          setIsAuthModalOpen(false);
          setAuthLinkNotice({
            type: 'success',
            message: t('تم تسجيل الدخول بحساب Google بنجاح!', 'Signed in with Google successfully!'),
          });
        }
      })
      .catch((err: any) => {
        const code = err?.code || '';
        setAuthLinkNotice({
          type: 'error',
          message: code
            ? getFirebaseAuthErrorMessage(code, lang)
            : err?.message || t('تعذر إتمام تسجيل الدخول بحساب Google', 'Google sign-in failed'),
        });
      });

    // Refresh unverified Firebase account status when user returns to tab after clicking email link
    const handleFocusRefresh = () => {
      refreshCurrentFirebaseUser()
        .then((refreshed) => {
          if (refreshed) {
            setStoredVerifiedUser(refreshed);
            setAuthUser(refreshed);
          }
        })
        .catch(() => {});
    };
    window.addEventListener('focus', handleFocusRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocusRefresh);
    };
  }, [lang, t]);

  // Automatically verify and log in when user clicks an email link (?auth_token=, Supabase #access_token=, or Firebase Action Link)
  useEffect(() => {
    const currentHref = window.location.href;
    const searchParams = new URLSearchParams(window.location.search);
    const authToken = searchParams.get('auth_token');
    const emailTest = searchParams.get('email_test');
    const firebaseMode = searchParams.get('mode');

    const rawHash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = new URLSearchParams(rawHash);
    const supabaseAccessToken = hashParams.get('access_token');

    if (emailTest === 'ok') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthLinkNotice({
        type: 'success',
        message: t(
          'تم اختبار رابط البريد الإلكتروني بنجاح! خدمة إرسال الروابط جاهزة وتعمل.',
          'Email link test succeeded! Email delivery is ready.'
        ),
      });
      return;
    }

    if (firebaseMode === 'verifyEmail' || firebaseMode === 'resetPassword') {
      window.history.replaceState({}, document.title, window.location.pathname);
      refreshCurrentFirebaseUser()
        .then((refreshed) => {
          if (refreshed) {
            setStoredVerifiedUser(refreshed);
            setAuthUser(refreshed);
          }
        })
        .catch(() => {});
      setAuthLinkNotice({
        type: 'success',
        message:
          firebaseMode === 'verifyEmail'
            ? t('تم تأكيد بريدك الإلكتروني بنجاح!', 'Your email has been verified!')
            : t('يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.', 'You can now sign in with your new password.'),
      });
      return;
    }

    if (!authToken && !supabaseAccessToken) {
      // Check Firebase passwordless email link
      completeFirebaseEmailLinkSignIn(currentHref)
        .then((fbLinkUser) => {
          if (fbLinkUser) {
            window.history.replaceState({}, document.title, window.location.pathname);
            setStoredVerifiedUser(fbLinkUser);
            setAuthUser(fbLinkUser);
            setIsAuthModalOpen(false);
            setAuthLinkNotice({
              type: 'success',
              message: t('تم تسجيل دخولك عبر رابط البريد بنجاح!', 'Signed in via email link!'),
            });
          }
        })
        .catch((err: any) => {
          setAuthLinkNotice({
            type: 'error',
            message: err?.message || t('تعذر تفعيل رابط الدخول', 'Could not verify sign-in link'),
          });
        });
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);

    const completeLinkSignIn = async () => {
      setAuthLinkNotice({
        type: 'loading',
        message: t(
          'جارٍ تأكيد الرابط وتسجيل دخولك إلى حسابك تلقائياً...',
          'Verifying your link and signing you in...'
        ),
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
            message:
              res.message ||
              t('تم تأكيد بريدك الإلكتروني وتسجيل دخولك بنجاح!', 'Email verified and signed in!'),
          });
        }
      } catch (err: any) {
        setAuthLinkNotice({
          type: 'error',
          message:
            err?.message ||
            t(
              'تعذر تفعيل الرابط، قد يكون منتهي الصلاحية أو مستخدماً من قبل.',
              'Could not verify link. It may be expired or already used.'
            ),
        });
      }
    };

    completeLinkSignIn();
  }, [t]);

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
  const [selectedTabYear, setSelectedTabYear] = useState<string>('all');
  const [activeInfoPage, setActiveInfoPage] = useState<InfoPageId | null>(() => {
    if (typeof window === 'undefined') return null;
    const slug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (slug === 'support' || slug === 'privacy' || slug === 'about' || slug === 'terms') {
      return slug;
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const slug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (slug === 'support' || slug === 'privacy' || slug === 'about' || slug === 'terms') {
        setActiveInfoPage(slug);
      } else {
        setActiveInfoPage(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenInfoPage = useCallback((page: InfoPageId) => {
    setSearchQuery('');
    setIsSideMenuOpen(false);
    setActiveInfoPage(page);
    if (typeof window !== 'undefined') {
      const targetPath = `/${page}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ infoPage: page }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleCloseInfoPage = useCallback(() => {
    setActiveInfoPage(null);
    if (typeof window !== 'undefined') {
      const slug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (slug === 'support' || slug === 'privacy' || slug === 'about' || slug === 'terms') {
        window.history.pushState({}, '', '/');
      }
    }
  }, []);

  useEffect(() => {
    setSelectedTabYear('all');
  }, [activeTab]);

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
        const cleanSiteTitle = cfg.siteName
          .replace(/\s+cinema\b/gi, '')
          .replace(/\s+(سينما|سيما)\b/g, '')
          .trim();
        document.title = cleanSiteTitle || 'GoldenFlix';
      }
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const list = await fetchPublicNotifications();
    setNotifications(list);
  }, []);

  // Load media data from Firestore and Server (owner sees all items including hidden ones)
  const refreshData = useCallback(async () => {
    try {
      let adminToken = isDeveloperUser ? getStoredAdminToken() || undefined : undefined;
      if (isDeveloperUser && !adminToken) {
        try {
          const session = await loginAdmin('frassa.wwindows@gmail.com', 'fr010020');
          adminToken = session.token;
        } catch {
          // Static hosting (e.g. Vercel) falls back cleanly to Firestore all-docs query
        }
      }
      const data = isDeveloperUser
        ? await fetchAllMoviesUnified(adminToken)
        : await fetchPublishedMoviesUnified();
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
  }, [isDeveloperUser]);

  useEffect(() => {
    refreshData();
    loadSiteSettings();
    loadNotifications();
  }, [refreshData, loadSiteSettings, loadNotifications]);

  // Refresh catalog and alerts softly when user returns to browser tab
  useEffect(() => {
    const handleTabFocus = () => {
      refreshData();
      loadNotifications();
    };
    window.addEventListener('focus', handleTabFocus);
    return () => window.removeEventListener('focus', handleTabFocus);
  }, [refreshData, loadNotifications]);

  // Sync personal release alerts and notifications from Firestore when user signs in
  useEffect(() => {
    let active = true;
    syncAlertsAndNotificationsFromCloud(authUser?.uid)
      .then(({ alerts, notifications: relNotifs }) => {
        if (!active) return;
        setMediaAlerts(alerts);
        setReleaseNotifications(relNotifs);
      })
      .catch((err) => console.warn('Alert cloud sync skipped:', err));
    return () => {
      active = false;
    };
  }, [authUser?.uid]);

  // Evaluate subscribed movies & series whenever catalog updates to detect new episodes or added videos
  useEffect(() => {
    if (mediaItems.length === 0) return;
    let active = true;
    evaluateMediaReleaseAlerts(mediaItems, authUser?.uid)
      .then(({ newNotifications, allNotifications, alerts }) => {
        if (!active) return;
        setReleaseNotifications(allNotifications);
        setMediaAlerts(alerts);
        if (newNotifications.length > 0) {
          setReleaseToast(newNotifications[0]);
        }
      })
      .catch((err) => console.warn('Release alert evaluation warning:', err));
    return () => {
      active = false;
    };
  }, [mediaItems, authUser?.uid]);

  useEffect(() => {
    if (!releaseToast) return;
    const timer = setTimeout(() => setReleaseToast(null), 9000);
    return () => clearTimeout(timer);
  }, [releaseToast]);

  const alertSubscribedIds = useMemo(
    () => mediaAlerts.map((a) => a.mediaId),
    [mediaAlerts]
  );

  // Synchronized navigation between Top Header, Category Capsules, Side Drawer, and Mobile Bottom Nav
  const handleTopTabSelect = useCallback(
    (tab: ActiveTab) => {
      handleCloseInfoPage();
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
    },
    [handleCloseInfoPage]
  );

  const handleBottomTabSelect = useCallback(
    (tab: BottomNavTab) => {
      if (tab === 'settings') {
        setIsSideMenuOpen(true);
        return;
      }

      if (tab === 'profile') {
        if (!authUser) {
          handleOpenLogin();
        } else {
          setIsUserProfileOpen(true);
        }
        return;
      }

      handleCloseInfoPage();

      if (tab === 'search') {
        setBottomNavTab('search');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setSearchQuery('');
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
    },
    [authUser, handleOpenLogin, handleCloseInfoPage]
  );

  const handleToggleFav = (id?: string) => {
    if (!id) return;
    const updated = toggleFavorite(id);
    setFavorites(updated);
  };

  const handleToggleMediaAlert = useCallback(
    async (target: MediaItem | string) => {
      const media =
        typeof target === 'string'
          ? mediaItems.find((m) => m.id === target)
          : target;
      if (!media) return;

      try {
        const result = await toggleMediaAlertSubscription(media, authUser?.uid);
        setMediaAlerts(result.alerts);

        if (
          result.subscribed &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'default'
        ) {
          Notification.requestPermission().catch(() => {});
        }

        const displayTitle = getMediaTitle(media);
        setAuthLinkNotice({
          type: 'success',
          message: result.subscribed
            ? t(
                `تم تفعيل التنبيه لـ "${displayTitle}" ✓ — سيصلك إشعار عند توفر حلقات جديدة أو إضافة العمل.`,
                `Alert enabled for "${displayTitle}" ✓ — You will be notified when new episodes or the video are added.`
              )
            : t(
                `تم إلغاء التنبيه لـ "${displayTitle}".`,
                `Alert disabled for "${displayTitle}".`
              ),
        });
      } catch (err) {
        console.error('Failed toggling media alert:', err);
      }
    },
    [mediaItems, authUser?.uid, getMediaTitle, t]
  );

  const handleSelectReleaseNotification = useCallback(
    async (notif: UserReleaseNotification) => {
      try {
        const updated = await markReleaseNotificationRead(notif.id, authUser?.uid);
        setReleaseNotifications(updated);
      } catch {
        // local already updated
      }
      const found = mediaItems.find((m) => m.id === notif.mediaId);
      if (found) {
        setSelectedMedia(found);
      }
      setReleaseToast(null);
    },
    [authUser?.uid, mediaItems]
  );

  const handleMarkAllReleaseRead = useCallback(async () => {
    try {
      const updated = await markAllReleaseNotificationsRead(authUser?.uid);
      setReleaseNotifications(updated);
    } catch {
      // ignore
    }
  }, [authUser?.uid]);

  const handleRemoveMediaAlert = useCallback(
    async (mediaId: string) => {
      try {
        const updated = await removeMediaAlertSubscription(mediaId, authUser?.uid);
        setMediaAlerts(updated);
      } catch {
        // ignore
      }
    },
    [authUser?.uid]
  );

  const handleOpenAlertMedia = useCallback(
    (mediaId: string) => {
      const found = mediaItems.find((m) => m.id === mediaId);
      if (found) {
        setSelectedMedia(found);
      }
    },
    [mediaItems]
  );

  const handleStartPlay = (media: MediaItem) => {
    if (!hasPlayableMediaVideo(media)) {
      setSelectedMedia(media);
      return;
    }
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
        title: banner.title || linked?.titleAr || linked?.title || 'GoldenFlix',
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

  const { availableTabYears, tabYearCounts } = useMemo(() => {
    const counts: Record<number, number> = {};
    tabFilteredItems.forEach((item) => {
      const yr = Number(item.year);
      if (Number.isInteger(yr) && yr >= 1900 && yr <= 2100) {
        counts[yr] = (counts[yr] || 0) + 1;
      }
    });
    const years = Object.keys(counts)
      .map(Number)
      .sort((a, b) => b - a);
    return { availableTabYears: years, tabYearCounts: counts };
  }, [tabFilteredItems]);

  const displayedTabItems = useMemo(() => {
    if (selectedTabYear === 'all') return tabFilteredItems;
    const yr = Number(selectedTabYear);
    return tabFilteredItems.filter((item) => Number(item.year) === yr);
  }, [tabFilteredItems, selectedTabYear]);

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
      dir={dir}
      className="relative min-h-screen w-full bg-[#050507] text-zinc-100 flex flex-col overflow-x-hidden selection:bg-[#F7C600] selection:text-black"
    >
      {/* Cinema Obsidian Backdrop with Golden Light Curves & Translucent 35mm Film Strips */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050507]" aria-hidden="true">
        {/* Ambient Deep Gold Corner Glows */}
        <div
          className="absolute -top-28 -right-24 w-[420px] h-[420px] rounded-full opacity-60"
          style={{
            background:
              'radial-gradient(circle, rgba(247,198,0,0.16) 0%, rgba(180,125,0,0.06) 42%, transparent 72%)',
          }}
        />
        <div
          className="absolute -bottom-28 -left-24 w-[480px] h-[480px] rounded-full opacity-75"
          style={{
            background:
              'radial-gradient(circle, rgba(247,198,0,0.19) 0%, rgba(180,125,0,0.07) 44%, transparent 74%)',
          }}
        />

        {/* Full-Viewport SVG: Luminous Golden Arcs + Perforated 35mm Cinema Film Strips */}
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            {/* Golden Rim Line Gradients */}
            <linearGradient id="gfGoldCurveTop" x1="0%" y1="65%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F7C600" stopOpacity="0.85" />
              <stop offset="42%" stopColor="#F7C600" stopOpacity="0.22" />
              <stop offset="78%" stopColor="#F7C600" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#F7C600" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="gfGoldCurveBottom" x1="0%" y1="100%" x2="100%" y2="25%">
              <stop offset="0%" stopColor="#F7C600" stopOpacity="0.95" />
              <stop offset="32%" stopColor="#F7C600" stopOpacity="0.28" />
              <stop offset="75%" stopColor="#F7C600" stopOpacity="0.52" />
              <stop offset="100%" stopColor="#F7C600" stopOpacity="0.12" />
            </linearGradient>

            <linearGradient id="gfArcSurfaceWash" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F7C600" stopOpacity="0.06" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.025" />
              <stop offset="100%" stopColor="#F7C600" stopOpacity="0.05" />
            </linearGradient>

            {/* Diagonal 35mm Perforated Film Strip Pattern */}
            <pattern id="gfFilmStripPattern" width="76" height="58" patternUnits="userSpaceOnUse">
              {/* Outer film rails */}
              <rect x="0" y="0" width="76" height="58" fill="rgba(225, 162, 20, 0.21)" />
              {/* Top sprocket holes */}
              <rect x="5" y="4" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="19" y="4" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="33" y="4" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="47" y="4" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="61" y="4" width="7" height="5.5" rx="1" fill="#050507" />
              {/* Main cinema frame */}
              <rect x="4" y="13.5" width="32" height="31" rx="2" fill="#050507" />
              <rect x="42" y="13.5" width="32" height="31" rx="2" fill="#050507" />
              {/* Bottom sprocket holes */}
              <rect x="5" y="48.5" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="19" y="48.5" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="33" y="48.5" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="47" y="48.5" width="7" height="5.5" rx="1" fill="#050507" />
              <rect x="61" y="48.5" width="7" height="5.5" rx="1" fill="#050507" />
            </pattern>

            <radialGradient id="gfFadeTopLeft" cx="15%" cy="10%" r="44%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="60%" stopColor="white" stopOpacity="0.45" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="gfMaskTopLeft">
              <rect width="1440" height="900" fill="url(#gfFadeTopLeft)" />
            </mask>

            <radialGradient id="gfFadeBottomRight" cx="88%" cy="88%" r="46%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="60%" stopColor="white" stopOpacity="0.45" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="gfMaskBottomRight">
              <rect width="1440" height="900" fill="url(#gfFadeBottomRight)" />
            </mask>

            <filter id="gfSoftGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle Diagonal Curved Light Wash */}
          <path
            d="M -120 420 Q 520 120 1560 90 L 1560 720 Q 740 820 -120 790 Z"
            fill="url(#gfArcSurfaceWash)"
          />

          {/* Top-Left Translucent Diagonal Film Strip */}
          <g mask="url(#gfMaskTopLeft)" opacity="0.9">
            <g transform="translate(-80, 140) rotate(-26)">
              <rect x="0" y="0" width="740" height="58" fill="url(#gfFilmStripPattern)" />
            </g>
          </g>

          {/* Bottom-Right Translucent Diagonal Film Strip */}
          <g mask="url(#gfMaskBottomRight)" opacity="0.9">
            <g transform="translate(820, 860) rotate(-32)">
              <rect x="0" y="0" width="840" height="58" fill="url(#gfFilmStripPattern)" />
            </g>
          </g>

          {/* Upper Sweeping Golden Curve */}
          <path
            d="M -60 400 Q 480 150 1490 95"
            fill="none"
            stroke="url(#gfGoldCurveTop)"
            strokeWidth="2.4"
            filter="url(#gfSoftGlow)"
          />

          {/* Lower Sweeping Golden Curve & Light Flare */}
          <path
            d="M -80 790 Q 640 620 1500 500"
            fill="none"
            stroke="url(#gfGoldCurveBottom)"
            strokeWidth="2.6"
            filter="url(#gfSoftGlow)"
          />
          <path
            d="M 680 920 Q 1080 835 1480 810"
            fill="none"
            stroke="url(#gfGoldCurveTop)"
            strokeWidth="1.8"
            opacity="0.7"
            filter="url(#gfSoftGlow)"
          />
        </svg>
      </div>
      {/* Top Cinema Header */}
      <TopHeader
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) handleCloseInfoPage();
        }}
        onOpenSideMenu={() => setIsSideMenuOpen(true)}
        onOpenGoogleLogin={() => {
          if (authUser) {
            setIsUserProfileOpen(true);
          } else {
            handleOpenLogin();
          }
        }}
        googleUser={authUser}
        activeTab={activeTab}
        bottomNavTab={bottomNavTab}
        onSelectTab={handleTopTabSelect}
        onSelectBottomTab={handleBottomTabSelect}
        notifications={notifications}
        releaseNotifications={releaseNotifications}
        mediaAlerts={mediaAlerts}
        onSelectReleaseNotification={handleSelectReleaseNotification}
        onMarkAllReleaseRead={handleMarkAllReleaseRead}
        onRemoveMediaAlert={handleRemoveMediaAlert}
        onOpenAlertMedia={handleOpenAlertMedia}
        siteName={siteSettings?.siteName}
      />

      {/* New Release / Episode Alert Toast */}
      {releaseToast && (
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3">
          <div className="p-3 rounded-2xl border bg-[#14120a] border-[#F7C600]/55 text-zinc-100 text-xs flex items-center justify-between gap-2.5 shadow-[0_14px_32px_rgba(247,198,0,0.18)]">
            <button
              type="button"
              onClick={() => handleSelectReleaseNotification(releaseToast)}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-start cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[#F7C600] text-black flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-[#F7C600] truncate">{releaseToast.title}</p>
                <p className="text-[11px] text-zinc-300 truncate">{releaseToast.message}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setReleaseToast(null)}
              aria-label={t('إغلاق الإشعار', 'Dismiss alert')}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-10 md:pb-14">
        {/* A. Active Search View or Results */}
        {searchQuery.trim().length > 0 || bottomNavTab === 'search' ? (
          <div className="py-3 space-y-5">
            {bottomNavTab === 'search' && (
              <div className="relative flex items-center w-full">
                <Search
                  className={`w-4.5 h-4.5 text-[#F7C600] absolute pointer-events-none ${
                    dir === 'ltr' ? 'left-4' : 'right-4'
                  }`}
                />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('ابحث عن فيلم أو مسلسل أو تصنيف...', 'Search movies, series, or genres...')}
                  className={`w-full h-12 bg-[#14151a] text-zinc-100 placeholder-zinc-500 text-sm font-medium rounded-2xl border border-white/12 focus:border-[#F7C600]/75 focus:outline-none focus:ring-2 focus:ring-[#F7C600]/20 transition-all ${
                    dir === 'ltr' ? 'pl-11 pr-10' : 'pr-11 pl-10'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={t('مسح البحث', 'Clear search')}
                    className={`absolute p-2 text-zinc-400 hover:text-white cursor-pointer ${
                      dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {searchQuery.trim().length > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs sm:text-sm text-zinc-400">
                  <span>{t(`نتائج البحث عن: "${searchQuery}"`, `Search results for: "${searchQuery}"`)}</span>
                  <span className="font-bold text-amber-400 tabular-nums">({searchResults.length})</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="py-20 text-center text-zinc-500">
                    <Search className="w-12 h-12 mx-auto mb-2 text-zinc-600" />
                    <p className="text-sm font-bold text-zinc-300">
                      {t('لم يتم العثور على أي نتائج', 'No matching results found')}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {t(
                        'جرب البحث بكلمة أخرى أو تصفح الأقسام المتاحة',
                        'Try searching another keyword or browse available sections.'
                      )}
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
                        isAlertSubscribed={alertSubscribedIds.includes(item.id)}
                        onToggleAlert={handleToggleMediaAlert}
                        watchProgress={history.find((h) => h.mediaId === item.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm text-zinc-400">
                  <span className="font-bold text-zinc-200">{t('أعمال مقترحة للبحث', 'Suggested Titles')}</span>
                  <span className="text-[11px] text-zinc-500">
                    {t('اكتب للبحث الفوري', 'Type to filter instantly')}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {(mostWatched.length > 0 ? mostWatched : mediaItems).slice(0, 12).map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      inGrid={true}
                      onSelect={(m) => setSelectedMedia(m)}
                      isFavorite={favorites.includes(item.id)}
                      onToggleFavorite={handleToggleFav}
                      isAlertSubscribed={alertSubscribedIds.includes(item.id)}
                      onToggleAlert={handleToggleMediaAlert}
                      watchProgress={history.find((h) => h.mediaId === item.id)}
                    />
                  ))}
                </div>
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
            alertSubscribedIds={alertSubscribedIds}
            onToggleAlert={handleToggleMediaAlert}
            history={history}
          />
        ) : bottomNavTab === 'history' ? (
          /* C. Watch History View */
          <HistoryView
            history={history}
            mediaItems={mediaItems}
            onPlay={handleStartPlay}
            onRefreshHistory={refreshData}
            onBrowseContent={() => handleTopTabSelect('home')}
          />
        ) : bottomNavTab === 'favorites' ? (
          /* D. Favorites View */
          <FavoritesView
            favorites={favorites}
            mediaItems={mediaItems}
            onSelectMedia={(item) => setSelectedMedia(item)}
            onToggleFavorite={handleToggleFav}
            alertSubscribedIds={alertSubscribedIds}
            onToggleAlert={handleToggleMediaAlert}
            history={history}
            onBrowseContent={() => handleTopTabSelect('home')}
          />
        ) : activeInfoPage === 'support' ? (
          <SupportPage
            onBackHome={() => {
              handleTopTabSelect('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigatePage={handleOpenInfoPage}
          />
        ) : activeInfoPage === 'privacy' ? (
          <PrivacyPage
            onBackHome={() => {
              handleTopTabSelect('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigatePage={handleOpenInfoPage}
          />
        ) : activeInfoPage === 'about' ? (
          <AboutPage
            onBackHome={() => {
              handleTopTabSelect('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigatePage={handleOpenInfoPage}
          />
        ) : activeInfoPage === 'terms' ? (
          <TermsPage
            onBackHome={() => {
              handleTopTabSelect('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigatePage={handleOpenInfoPage}
          />
        ) : activeTab !== 'home' ? (
          /* E. Top/Mobile Category Tab Filtered View */
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
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-white text-base sm:text-lg">
                      {activeTab === 'latest'
                        ? t('أحدث الإضافات', 'Latest Releases')
                        : activeTab === 'trending'
                        ? t('الأكثر مشاهدة', 'Most Watched')
                        : activeTab === 'top_rated'
                        ? t('الأعلى تقييماً', 'Top Rated')
                        : activeTab === 'series'
                        ? t('المسلسلات', 'TV Series')
                        : activeTab === 'movies'
                        ? t('الأفلام السينمائية', 'Movies')
                        : activeTab === 'action'
                        ? t('أكشن وحركة', 'Action')
                        : activeTab === 'drama'
                        ? t('دراما', 'Drama')
                        : activeTab === 'horror'
                        ? t('رعب وتشويق', 'Horror & Thriller')
                        : activeTab === 'comedy'
                        ? t('كوميديا', 'Comedy')
                        : activeTab === 'sci-fi'
                        ? t('خيال علمي', 'Sci-Fi')
                        : activeTab === 'adventure'
                        ? t('مغامرات', 'Adventure')
                        : activeTab === 'crime'
                        ? t('جريمة وغموض', 'Crime & Mystery')
                        : activeTab === 'romance'
                        ? t('رومانسي', 'Romance')
                        : t('التصنيف المختار', 'Selected Category')}
                    </h2>
                    <span className="text-amber-400 font-mono font-bold tabular-nums">
                      ({displayedTabItems.length})
                    </span>
                  </div>

                  {/* Production Year Dropdown Filter (Quick Select on All Viewports) */}
                  {availableTabYears.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center">
                        <Calendar
                          className={`w-3.5 h-3.5 text-[#F7C600] absolute pointer-events-none ${
                            dir === 'ltr' ? 'left-3' : 'right-3'
                          }`}
                        />
                        <select
                          value={selectedTabYear}
                          onChange={(e) => setSelectedTabYear(e.target.value)}
                          aria-label={t('تصفية حسب سنة الإنتاج', 'Filter by release year')}
                          className={`h-9 bg-[#14141a] hover:bg-[#1b1b24] text-zinc-100 text-xs font-bold rounded-xl border border-white/10 focus:border-[#F7C600]/70 focus:outline-none transition-colors cursor-pointer ${
                            dir === 'ltr' ? 'pl-8 pr-4' : 'pr-8 pl-4'
                          }`}
                        >
                          <option value="all">
                            {t('سنة الإنتاج: الكل', 'Release Year: All')} ({tabFilteredItems.length})
                          </option>
                          {availableTabYears.map((yr) => (
                            <option key={yr} value={String(yr)}>
                              {yr} ({tabYearCounts[yr] || 0})
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedTabYear !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setSelectedTabYear('all')}
                          title={t('عرض جميع السنوات', 'Show all years')}
                          className="h-9 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-[#F7C600] border border-white/10 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('الكل', 'All')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {displayedTabItems.length === 0 ? (
                  <EmptyCinemaState
                    titleStart={t('مكتبتك', 'This Section is')}
                    titleHighlight={t('فارغة', 'Empty')}
                    titleEnd={t('حالياً', 'Right Now')}
                    subtitle={
                      selectedTabYear !== 'all'
                        ? t(
                            `لا توجد أعمال متاحة لسنة الإنتاج ${selectedTabYear} في هذا القسم.`,
                            `No titles available for release year ${selectedTabYear} in this section.`
                          )
                        : t(
                            'لا توجد أعمال منشورة في هذا القسم حالياً، يمكنك تصفح باقي المحتوى المتاح',
                            'No titles are published in this section yet. Browse other available titles'
                          )
                    }
                    ctaLabel={
                      selectedTabYear !== 'all'
                        ? t('عرض جميع السنوات', 'Show All Years')
                        : t('تصفح المحتوى', 'Browse Content')
                    }
                    onCtaClick={() =>
                      selectedTabYear !== 'all'
                        ? setSelectedTabYear('all')
                        : handleTopTabSelect('home')
                    }
                    showHeartAccent={false}
                  />
                ) : (
                  <div className="flex flex-col lg:flex-row items-start gap-5">
                    {/* Desktop Year Filter Sidebar */}
                    {availableTabYears.length > 0 && (
                      <aside
                        aria-label={t('تصفية حسب سنة الإنتاج', 'Filter by release year')}
                        className="hidden lg:block w-56 shrink-0 sticky top-24 rounded-2xl bg-[#101016]/95 border border-white/[0.08] p-3.5 shadow-xl space-y-2.5"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                          <div className="flex items-center gap-1.5 text-xs font-black text-white">
                            <Calendar className="w-4 h-4 text-[#F7C600]" />
                            <span>{t('سنة الإنتاج', 'Release Year')}</span>
                          </div>
                          {selectedTabYear !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setSelectedTabYear('all')}
                              className="text-[11px] font-bold text-[#F7C600] hover:underline cursor-pointer"
                            >
                              {t('إعادة ضبط', 'Reset')}
                            </button>
                          )}
                        </div>

                        <div className="space-y-1 max-h-[58vh] overflow-y-auto no-scrollbar">
                          <button
                            type="button"
                            onClick={() => setSelectedTabYear('all')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              selectedTabYear === 'all'
                                ? 'bg-[#F7C600] text-black font-black shadow-sm shadow-[#F7C600]/25'
                                : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
                            }`}
                          >
                            <span>{t('جميع السنوات', 'All Years')}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                                selectedTabYear === 'all'
                                  ? 'bg-black/15 text-black'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {tabFilteredItems.length}
                            </span>
                          </button>

                          {availableTabYears.map((yr) => {
                            const activeYear = selectedTabYear === String(yr);
                            return (
                              <button
                                key={yr}
                                type="button"
                                onClick={() => setSelectedTabYear(String(yr))}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                                  activeYear
                                    ? 'bg-[#F7C600] text-black font-black shadow-sm shadow-[#F7C600]/25'
                                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.05]'
                                }`}
                              >
                                <span>{yr}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                                    activeYear
                                      ? 'bg-black/15 text-black'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {tabYearCounts[yr] || 0}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </aside>
                    )}

                    <div
                      className={`flex-1 min-w-0 w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${
                        availableTabYears.length > 0 ? 'xl:grid-cols-5' : 'lg:grid-cols-5 xl:grid-cols-6'
                      } gap-3 sm:gap-4`}
                    >
                      {displayedTabItems.map((item) => (
                        <MediaCard
                          key={item.id}
                          item={item}
                          inGrid={true}
                          variant={activeTab === 'series' ? 'series_avatar' : 'poster'}
                          onSelect={(m) => setSelectedMedia(m)}
                          isFavorite={favorites.includes(item.id)}
                          onToggleFavorite={handleToggleFav}
                          isAlertSubscribed={alertSubscribedIds.includes(item.id)}
                          onToggleAlert={handleToggleMediaAlert}
                          watchProgress={history.find((h) => h.mediaId === item.id)}
                        />
                      ))}
                    </div>
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
                {/* 1. Hero Banner (Featured Slides OR Curved Gold Welcome Card) */}
                {siteSettings?.homeSections?.showHeroBanner !== false && (
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

                {/* 3. Main Categories 4-Card Row Matching Mockup */}
                <section aria-label={t('الأقسام الرئيسية', 'Main Categories')} className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 fill-[#F7C600] text-[#F7C600] shrink-0" />
                      <span className="h-4 w-[2px] rounded-full bg-white/35" aria-hidden="true" />
                      <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
                        {t('الأقسام الرئيسية', 'Main Categories')}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBottomTabSelect('categories')}
                      className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-zinc-200 hover:text-white bg-[#17171c] hover:bg-[#1f1f27] px-3 py-1.5 rounded-full border border-white/10 hover:border-[#F7C600]/45 transition-all cursor-pointer shrink-0"
                    >
                      <span>{t('عرض الكل', 'View All')}</span>
                      {dir === 'ltr' ? (
                        <ArrowRight className="w-3.5 h-3.5 text-[#F7C600]" />
                      ) : (
                        <ArrowLeft className="w-3.5 h-3.5 text-[#F7C600]" />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:gap-3.5">
                    {[
                      {
                        id: 'movies',
                        label: t('الأفلام', 'Movies'),
                        icon: Film,
                        onClick: () => handleTopTabSelect('movies'),
                      },
                      {
                        id: 'series',
                        label: t('المسلسلات', 'Series'),
                        icon: Tv,
                        onClick: () => handleTopTabSelect('series'),
                      },
                      {
                        id: 'favorites',
                        label: t('المفضلة', 'Favorites'),
                        icon: Heart,
                        onClick: () => handleBottomTabSelect('favorites'),
                      },
                      {
                        id: 'categories',
                        label: t('التصنيفات', 'Categories'),
                        icon: LayoutGrid,
                        onClick: () => handleBottomTabSelect('categories'),
                      },
                    ].map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <motion.button
                          key={cat.id}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={cat.onClick}
                          className="group relative flex flex-col items-center justify-center gap-2 py-4 sm:py-6 px-1.5 sm:px-3 rounded-2xl bg-gradient-to-b from-[#17171e] via-[#111116] to-[#15120a] border border-white/[0.08] border-b-[#F7C600]/65 shadow-[0_10px_24px_-12px_rgba(247,198,0,0.45),inset_0_-12px_20px_-14px_rgba(247,198,0,0.28)] hover:border-[#F7C600]/75 transition-all cursor-pointer"
                        >
                          <CatIcon className="w-5 h-5 sm:w-7 sm:h-7 text-zinc-200 group-hover:text-[#F7C600] transition-colors shrink-0" />
                          <span className="text-[11px] sm:text-sm font-bold text-zinc-100 group-hover:text-white whitespace-nowrap truncate max-w-full">
                            {cat.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </section>

                {/* 4. Compact Surprise Pick Bar (shown when library has titles) */}
                {mediaItems.length > 0 && siteSettings?.homeSections?.showQuickExplore !== false && (
                  <SurprisePickBar
                    mediaItems={mediaItems}
                    onPlayMedia={(item) => handleStartPlay(item)}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                  />
                )}

                {/* Empty Library State inside Most Watched Mockup Card */}
                {mediaItems.length === 0 && (
                  <section aria-label={t('الأكثر مشاهدة', 'Most Watched')} className="space-y-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 fill-[#F7C600] text-[#F7C600] shrink-0" />
                        <span className="h-4 w-[2px] rounded-full bg-white/35" aria-hidden="true" />
                        <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
                          {t('الأكثر مشاهدة', 'Most Watched')}
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBottomTabSelect('categories')}
                        className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-zinc-200 hover:text-white bg-[#17171c] hover:bg-[#1f1f27] px-3 py-1.5 rounded-full border border-white/10 hover:border-[#F7C600]/45 transition-all cursor-pointer shrink-0"
                      >
                        <span>{t('عرض الكل', 'View All')}</span>
                        {dir === 'ltr' ? (
                          <ArrowRight className="w-3.5 h-3.5 text-[#F7C600]" />
                        ) : (
                          <ArrowLeft className="w-3.5 h-3.5 text-[#F7C600]" />
                        )}
                      </button>
                    </div>

                    <div className="w-full rounded-3xl bg-[#101014]/95 border border-white/[0.08] py-12 sm:py-16 px-6 flex flex-col items-center justify-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
                      <Clapperboard className="w-12 h-12 sm:w-14 sm:h-14 text-zinc-600/85 mb-3" />
                      <h3 className="text-sm sm:text-base font-bold text-zinc-300">
                        {t('لا توجد محتويات حالياً', 'No content available right now')}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        {t('يمكنك العودة لاحقاً', 'Please check back later')}
                      </p>

                      {isDeveloperUser && (
                        <button
                          type="button"
                          onClick={handleOpenDeveloperSuite}
                          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F7C600] hover:bg-[#ffd52e] text-black text-xs font-black shadow-[0_8px_20px_rgba(247,198,0,0.3)] transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{t('فتح لوحة التحكم ورفع المحتوى', 'Open Admin Dashboard & Upload')}</span>
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* 5. Latest Movies Section */}
                {latestMovies.length > 0 && siteSettings?.homeSections?.showLatestMovies !== false && (
                  <ContentSection
                    title={t('أحدث الأفلام', 'Latest Movies')}
                    iconType="movies"
                    items={latestMovies}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFav}
                    alertSubscribedIds={alertSubscribedIds}
                    onToggleAlert={handleToggleMediaAlert}
                    history={history}
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
                      alertSubscribedIds={alertSubscribedIds}
                      onToggleAlert={handleToggleMediaAlert}
                    />
                  )}

                {/* 7. Latest Series Section */}
                {seriesItems.length > 0 && siteSettings?.homeSections?.showSeries !== false && (
                  <ContentSection
                    title={t('أحدث المسلسلات', 'Latest Series')}
                    iconType="series"
                    items={seriesItems}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFav}
                    alertSubscribedIds={alertSubscribedIds}
                    onToggleAlert={handleToggleMediaAlert}
                    history={history}
                    onViewAll={() => handleTopTabSelect('series')}
                    variant="series_avatar"
                  />
                )}

                {/* 8. Most Watched Section */}
                {mostWatched.length > 0 && siteSettings?.homeSections?.showMostWatched !== false && (
                  <ContentSection
                    title={t('الأكثر مشاهدة', 'Most Watched')}
                    iconType="trending"
                    items={mostWatched}
                    onSelectMedia={(item) => setSelectedMedia(item)}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFav}
                    alertSubscribedIds={alertSubscribedIds}
                    onToggleAlert={handleToggleMediaAlert}
                    history={history}
                    onViewAll={() => handleTopTabSelect('trending')}
                    variant="landscape"
                  />
                )}
              </>
            )}
          </motion.div>
        )}
      </main>

      {/* GoldenFlix Footer across all pages & viewports */}
      <SiteFooter
        activePage={activeInfoPage}
        onOpenPage={handleOpenInfoPage}
        onGoHome={() => {
          handleTopTabSelect('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        siteName={siteSettings?.siteName}
      />

      {/* Mobile Bottom Navigation: الرئيسية · البحث · المفضلة · الإعدادات */}
      <BottomNavigation
        currentTab={bottomNavTab}
        onSelectTab={handleBottomTabSelect}
        isSettingsOpen={isSideMenuOpen}
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

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        user={authUser}
        onOpenAuthModal={handleOpenLogin}
        onUserUpdated={(u) => setAuthUser(u)}
        favoritesCount={favorites.length}
        historyCount={history.length}
        onOpenFavorites={() => handleBottomTabSelect('favorites')}
        onOpenHistory={() => handleBottomTabSelect('history')}
      />

      {/* Video Player Modal / Fullscreen */}
      {playingMedia && (
        <VideoPlayer
          media={playingMedia}
          playerDefaults={siteSettings?.playerSettings}
          onClose={() => {
            setPlayingMedia(null);
            setHistory(getWatchHistory());
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
        isAlertSubscribed={selectedMedia ? alertSubscribedIds.includes(selectedMedia.id) : false}
        onToggleAlert={() => selectedMedia && handleToggleMediaAlert(selectedMedia)}
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
