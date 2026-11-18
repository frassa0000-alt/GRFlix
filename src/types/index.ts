export type MediaType = 'movie' | 'series' | 'anime';

export type GenreType =
  | 'action'
  | 'horror'
  | 'drama'
  | 'sci-fi'
  | 'comedy'
  | 'adventure'
  | 'anime'
  | 'history'
  | 'biography'
  | 'crime'
  | 'fantasy'
  | 'documentary'
  | 'romance';

export interface VideoSourceOption {
  id?: string;
  label: string;
  url: string;
  format?: 'mp4' | 'hls' | 'webm' | 'youtube' | string;
  quality?: string;
  isDefault?: boolean;
}

export interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  description?: string;
  duration: string;
  videoUrl: string;
  thumbnailUrl?: string;
  fileSizeBytes?: number;
  introStart?: number;
  introEnd?: number;
  subtitleUrl?: string;
  nextEpisodeId?: string;
  sources?: VideoSourceOption[];
}

export interface Season {
  seasonNumber: number;
  title: string;
  episodes: Episode[];
}

export interface MediaItem {
  id: string;
  title: string;
  titleAr: string;
  originalTitle?: string;
  type: MediaType;
  year: number;
  rating: number;
  duration?: string;
  posterUrl: string;
  bannerUrl?: string;
  description: string;
  genres: (GenreType | string)[];
  videoUrl: string;
  videoQuality?: string;
  ageRating?: string;
  isPublished: boolean;
  isComingSoon?: boolean;
  fileSizeBytes?: number;
  storagePath?: string;
  storageType?: 'firebase' | 'server' | 'youtube' | 'external';
  isFeatured?: boolean;
  isLatest?: boolean;
  isMostWatched?: boolean;
  displayOrder?: number;
  viewsCount?: number;
  director?: string;
  cast?: string[];
  createdAt: number;
  updatedAt?: number;
  seasons?: Season[];
  introStart?: number;
  introEnd?: number;
  subtitleUrl?: string;
  sources?: VideoSourceOption[];
}

export interface WatchProgress {
  mediaId: string;
  episodeId?: string;
  seasonNumber?: number;
  currentTime: number;
  duration: number;
  percentage: number;
  updatedAt: number;
}

export interface AppUserProfile {
  uid: string;
  id: string;
  name: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  picture: string;
  photoURL?: string;
  joinedAt: number;
  role: 'member' | 'admin' | string;
  disabled?: boolean;
  favoriteGenre?: string;
  bio?: string;
  watchTimeMinutes?: number;
}

export type GoogleUserProfile = AppUserProfile;

export interface AdminAuth {
  isAuthenticated: boolean;
  email: string;
  token?: string;
}

export type ActiveTab =
  | 'home'
  | 'latest'
  | 'trending'
  | 'top_rated'
  | 'anime'
  | 'series'
  | 'movies'
  | 'favorites'
  | 'action'
  | 'drama'
  | 'horror'
  | 'comedy'
  | 'sci-fi'
  | 'adventure'
  | 'crime'
  | 'romance';
export type BottomNavTab =
  | 'home'
  | 'search'
  | 'movies'
  | 'series'
  | 'categories'
  | 'favorites'
  | 'settings'
  | 'profile'
  | 'history';

export type InfoPageId = 'support' | 'privacy' | 'about' | 'terms';

export type AdminSectionId =
  | 'dashboard'
  | 'movies'
  | 'add_movie'
  | 'series'
  | 'add_series'
  | 'seasons_episodes'
  | 'video_library'
  | 'categories'
  | 'cast_directors'
  | 'users'
  | 'comments_ratings'
  | 'notifications'
  | 'analytics'
  | 'views_management'
  | 'banners_home'
  | 'playback_links'
  | 'player_settings'
  | 'admins_permissions'
  | 'audit_logs'
  | 'site_settings';

export interface CategoryItem {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  isVisible: boolean;
  order: number;
  createdAt: number;
}

export interface PersonItem {
  id: string;
  name: string;
  role: 'actor' | 'director' | 'both';
  bio?: string;
  avatarUrl?: string;
  nationality?: string;
  createdAt: number;
}

export interface CommentItem {
  id: string;
  mediaId: string;
  mediaTitle: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  rating: number;
  text: string;
  status: 'approved' | 'pending' | 'hidden';
  createdAt: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'new_release' | 'alert';
  target: 'all' | 'members';
  isActive: boolean;
  createdAt: number;
}

export interface MediaAlertSubscription {
  mediaId: string;
  mediaTitle: string;
  mediaType: MediaType;
  posterUrl?: string;
  knownEpisodeCount: number;
  hadVideo: boolean;
  knownUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserReleaseNotification {
  id: string;
  mediaId: string;
  mediaTitle?: string;
  mediaType?: MediaType;
  posterUrl?: string;
  title: string;
  message: string;
  kind: 'new_episode' | 'movie_added' | 'media_updated';
  read: boolean;
  episodeNumber?: number;
  seasonNumber?: number;
  createdAt: number;
}

export interface BannerSlideItem {
  id: string;
  mediaId?: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  ctaLabel?: string;
  isActive: boolean;
  order: number;
}

export interface PlayerSettingsConfig {
  defaultSpeed: number;
  defaultQuality: string;
  autoPlayNextEpisode: boolean;
  allowExternalSubtitles: boolean;
  defaultSubtitleColor: string;
  defaultSubtitleSize: 'sm' | 'md' | 'lg' | 'xl';
  skipIntroEnabled: boolean;
}

export interface SiteSettingsConfig {
  siteName: string;
  siteTagline: string;
  logoText: string;
  accentColor: string;
  backgroundColor: string;
  homeSections: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showQuickExplore: boolean;
    showLatestMovies: boolean;
    showRecommendations: boolean;
    showSeries: boolean;
    showMostWatched: boolean;
  };
  banners: BannerSlideItem[];
  playerSettings: PlayerSettingsConfig;
  securitySettings: {
    requireEmailVerification: boolean;
    allowNewRegistrations: boolean;
    strictAdminVerification: boolean;
  };
  storageSettings: {
    maxVideoSizeMb: number;
    maxPosterSizeMb: number;
    chunkSizeMb: number;
    parallelStreams: number;
  };
  notificationsSettings: {
    enableGlobalBanner: boolean;
    notifyOnNewRelease: boolean;
  };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  category: 'auth' | 'media' | 'series' | 'users' | 'settings' | 'security' | 'files' | 'system';
  details: string;
  adminEmail: string;
  createdAt: number;
}

export interface AdminPermissions {
  canUpload: boolean;
  canEditMedia: boolean;
  canDeleteMedia: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export interface AdminSessionInfo {
  token: string;
  email: string;
  name?: string;
  roleTitle?: string;
  isSuperAdmin: boolean;
  permissions: AdminPermissions;
}

export interface AdminMember {
  id: string;
  email: string;
  name: string;
  roleTitle: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  hasPassword?: boolean;
  password?: string;
  passwordHint?: string;
  permissions: AdminPermissions;
  createdAt: number;
}

export interface ViewEvent {
  id: string;
  mediaId: string;
  mediaTitle: string;
  mediaType: MediaType;
  episodeId?: string;
  userEmail?: string;
  timestamp: number;
}

export interface PhysicalVideoFile {
  fileName: string;
  videoUrl: string;
  sizeBytes: number;
  createdAt: number;
  modifiedAt: number;
  linkedMediaIds: string[];
  linkedMediaTitles: string[];
}

export interface SiteFileEntry {
  fileName: string;
  relativePath: string;
  folder: string;
  url: string;
  sizeBytes: number;
  createdAt: number;
  modifiedAt: number;
  isHiddenFile: boolean;
  linkedMediaTitles: string[];
}
