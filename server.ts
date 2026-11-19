import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execFile, spawn } from 'child_process';
import { Readable } from 'stream';
import { promisify } from 'util';
import {
  assertSafePublicHttpUrl,
  buildStreamProxyUrl,
  detectStreamFormatFromUrlOrType,
  extractUniversalVideoStreams,
} from './src/server/universalExtractor.ts';

const execFileAsync = promisify(execFile);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Admin credentials (exclusively reserved for developer email)
const PRIMARY_ADMIN_EMAIL = 'frassa.wwindows@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fr010020';
const ADMIN_SECRET_TOKEN = 'goldenflix-cinema-super-admin-token-2025';

// Directories setup
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const VIDEOS_DIR = path.resolve(UPLOADS_DIR, 'videos');
const POSTERS_DIR = path.resolve(UPLOADS_DIR, 'posters');
const HLS_DIR = path.resolve(UPLOADS_DIR, 'hls');
const VARIANTS_DIR = path.resolve(UPLOADS_DIR, 'variants');
const MOVIES_FILE = path.resolve(DATA_DIR, 'movies.json');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const AUTH_LINKS_FILE = path.resolve(DATA_DIR, 'auth-links.json');
const MAIL_CONFIG_FILE = path.resolve(DATA_DIR, 'mail-config.json');
const CATEGORIES_FILE = path.resolve(DATA_DIR, 'categories.json');
const PEOPLE_FILE = path.resolve(DATA_DIR, 'people.json');
const COMMENTS_FILE = path.resolve(DATA_DIR, 'comments.json');
const NOTIFICATIONS_FILE = path.resolve(DATA_DIR, 'notifications.json');
const SITE_SETTINGS_FILE = path.resolve(DATA_DIR, 'site-settings.json');
const ADMINS_FILE = path.resolve(DATA_DIR, 'admins.json');
const AUDIT_LOGS_FILE = path.resolve(DATA_DIR, 'audit-logs.json');
const VIEWS_LOG_FILE = path.resolve(DATA_DIR, 'views-log.json');
const DELETED_MOVIES_FILE = path.resolve(DATA_DIR, 'deleted-movies.json');

[DATA_DIR, UPLOADS_DIR, VIDEOS_DIR, POSTERS_DIR, HLS_DIR, VARIANTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const DEFAULT_CATEGORIES = [
  { id: 'cat-action', slug: 'action', nameAr: 'أكشن', nameEn: 'Action', description: 'أفلام ومسلسلات الحركة والإثارة', isVisible: true, order: 1, createdAt: Date.now() },
  { id: 'cat-drama', slug: 'drama', nameAr: 'دراما', nameEn: 'Drama', description: 'أعمال درامية واجتماعية', isVisible: true, order: 2, createdAt: Date.now() },
  { id: 'cat-horror', slug: 'horror', nameAr: 'رعب', nameEn: 'Horror', description: 'أفلام الرعب والتشويق', isVisible: true, order: 3, createdAt: Date.now() },
  { id: 'cat-scifi', slug: 'sci-fi', nameAr: 'خيال علمي', nameEn: 'Sci-Fi', description: 'الخيال العلمي والمستقبل', isVisible: true, order: 4, createdAt: Date.now() },
  { id: 'cat-comedy', slug: 'comedy', nameAr: 'كوميديا', nameEn: 'Comedy', description: 'أعمال كوميدية وترفيهية', isVisible: true, order: 5, createdAt: Date.now() },
  { id: 'cat-adventure', slug: 'adventure', nameAr: 'مغامرة', nameEn: 'Adventure', description: 'المغامرات والرحلات', isVisible: true, order: 6, createdAt: Date.now() },
  { id: 'cat-anime', slug: 'anime', nameAr: 'أنمي', nameEn: 'Anime', description: 'مسلسلات وأفلام الأنمي', isVisible: true, order: 7, createdAt: Date.now() },
  { id: 'cat-crime', slug: 'crime', nameAr: 'جريمة', nameEn: 'Crime', description: 'الجريمة والغموض والتحقيق', isVisible: true, order: 8, createdAt: Date.now() },
  { id: 'cat-documentary', slug: 'documentary', nameAr: 'وثائقي', nameEn: 'Documentary', description: 'أفلام وثائقية حقيقية', isVisible: true, order: 9, createdAt: Date.now() },
  { id: 'cat-romance', slug: 'romance', nameAr: 'رومانسي', nameEn: 'Romance', description: 'أعمال رومانسية', isVisible: true, order: 10, createdAt: Date.now() },
  { id: 'cat-fantasy', slug: 'fantasy', nameAr: 'فانتازيا', nameEn: 'Fantasy', description: 'عالم الخيال والأساطير', isVisible: true, order: 11, createdAt: Date.now() },
];

const DEFAULT_SITE_SETTINGS = {
  siteName: 'GoldenFlix',
  siteTagline: 'عالم السينما والترفيه بين يديك',
  logoText: 'GoldenFlix',
  accentColor: '#facc15',
  backgroundColor: '#0c0c0e',
  homeSections: {
    showHeroBanner: true,
    showCategories: true,
    showQuickExplore: true,
    showLatestMovies: true,
    showRecommendations: true,
    showSeries: true,
    showMostWatched: true,
  },
  banners: [],
  playerSettings: {
    defaultSpeed: 1,
    defaultQuality: 'auto',
    autoPlayNextEpisode: true,
    allowExternalSubtitles: true,
    defaultSubtitleColor: '#ffffff',
    defaultSubtitleSize: 'md',
    skipIntroEnabled: true,
  },
  securitySettings: {
    requireEmailVerification: true,
    allowNewRegistrations: true,
    strictAdminVerification: true,
  },
  storageSettings: {
    maxVideoSizeMb: 4096,
    maxPosterSizeMb: 25,
    chunkSizeMb: 4,
    parallelStreams: 4,
  },
  notificationsSettings: {
    enableGlobalBanner: true,
    notifyOnNewRelease: true,
  },
};

const DEFAULT_ADMINS = [
  {
    id: 'admin-super-1',
    email: PRIMARY_ADMIN_EMAIL,
    name: 'مطور المنصة الرئيسي',
    roleTitle: 'مالك المنصة (Super Admin)',
    isSuperAdmin: true,
    isActive: true,
    permissions: {
      canUpload: true,
      canEditMedia: true,
      canDeleteMedia: true,
      canManageUsers: true,
      canManageSettings: true,
    },
    createdAt: Date.now(),
  },
];

const ensureJsonFile = (filePath: string, initialData: unknown) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf-8');
  }
};

ensureJsonFile(MOVIES_FILE, []);
ensureJsonFile(USERS_FILE, []);
ensureJsonFile(AUTH_LINKS_FILE, []);
ensureJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);
ensureJsonFile(PEOPLE_FILE, []);
ensureJsonFile(COMMENTS_FILE, []);
ensureJsonFile(NOTIFICATIONS_FILE, []);
ensureJsonFile(SITE_SETTINGS_FILE, DEFAULT_SITE_SETTINGS);
ensureJsonFile(ADMINS_FILE, DEFAULT_ADMINS);
ensureJsonFile(AUDIT_LOGS_FILE, []);
ensureJsonFile(VIEWS_LOG_FILE, []);
ensureJsonFile(DELETED_MOVIES_FILE, []);

const readJsonFile = <T>(filePath: string, fallback: T): T => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (err) {
    console.error(`Error reading ${path.basename(filePath)}:`, err);
    return fallback;
  }
};

const writeJsonFile = (filePath: string, data: unknown): void => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${path.basename(filePath)}:`, err);
  }
};

const appendAuditLog = (
  action: string,
  category: 'auth' | 'media' | 'series' | 'users' | 'settings' | 'security' | 'files' | 'system',
  details: string,
  adminEmail = PRIMARY_ADMIN_EMAIL
): void => {
  const logs = readJsonFile<any[]>(AUDIT_LOGS_FILE, []);
  logs.unshift({
    id: `log-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
    action,
    category,
    details,
    adminEmail,
    createdAt: Date.now(),
  });
  writeJsonFile(AUDIT_LOGS_FILE, logs.slice(0, 500));
};

// Helpers for persistent movie storage & site-wide deletion tombstones
const readMovies = (): any[] => {
  const data = readJsonFile<any[]>(MOVIES_FILE, []);
  return Array.isArray(data) ? data : [];
};

const writeMovies = (movies: any[]): void => {
  writeJsonFile(MOVIES_FILE, movies);
};

const readDeletedMovieIds = (): string[] => {
  const data = readJsonFile<string[]>(DELETED_MOVIES_FILE, []);
  return Array.isArray(data) ? data.filter((id) => typeof id === 'string' && id.trim()) : [];
};

const addDeletedMovieIds = (ids: string[]): void => {
  const clean = ids.map((id) => (id || '').trim()).filter(Boolean);
  if (clean.length === 0) return;
  const existing = readDeletedMovieIds();
  const merged = Array.from(new Set([...existing, ...clean]));
  writeJsonFile(DELETED_MOVIES_FILE, merged);
};

const removeDeletedMovieId = (id: string): void => {
  if (!id) return;
  const existing = readDeletedMovieIds();
  if (existing.includes(id)) {
    writeJsonFile(
      DELETED_MOVIES_FILE,
      existing.filter((x) => x !== id)
    );
  }
};

const isUrlReferencedInMovies = (url: string, moviesList: any[]): boolean => {
  if (!url) return false;
  return moviesList.some((m) => {
    if (m.videoUrl === url || m.posterUrl === url || m.bannerUrl === url) return true;
    if (Array.isArray(m.sources) && m.sources.some((s: any) => s?.url === url)) return true;
    if (Array.isArray(m.seasons)) {
      return m.seasons.some((sn: any) =>
        (sn.episodes || []).some(
          (ep: any) =>
            ep?.videoUrl === url ||
            (Array.isArray(ep?.sources) && ep.sources.some((s: any) => s?.url === url))
        )
      );
    }
    return false;
  });
};

const getVideoBaseName = (filename: string): string => {
  const safeName = path.basename(filename);
  const ext = path.extname(safeName);
  return safeName.slice(0, safeName.length - ext.length).replace(/[^a-zA-Z0-9._-]/g, '');
};

const cleanupGeneratedVideoAssets = (filename: string) => {
  const baseName = getVideoBaseName(filename);
  if (!baseName || baseName === '.' || baseName === '..') return;

  renditionJobs.delete(path.basename(filename));

  const hlsTarget = path.resolve(HLS_DIR, baseName);
  const variantsTarget = path.resolve(VARIANTS_DIR, baseName);

  for (const dirTarget of [hlsTarget, variantsTarget]) {
    if (fs.existsSync(dirTarget)) {
      try {
        fs.rmSync(dirTarget, { recursive: true, force: true });
      } catch (err) {
        console.warn('Could not clean generated media directory:', dirTarget, err);
      }
    }
  }
};

const unlinkLocalMediaFileIfUnused = (url: string | undefined, remainingMovies: any[]) => {
  if (!url || typeof url !== 'string') return;
  if (url.startsWith('/uploads/videos/')) {
    if (isUrlReferencedInMovies(url, remainingMovies)) return;
    const filename = path.basename(url.split('?')[0]);
    const videoFilePath = path.resolve(VIDEOS_DIR, filename);
    if (fs.existsSync(videoFilePath)) {
      try {
        fs.unlinkSync(videoFilePath);
      } catch (err) {
        console.warn('Could not delete video file:', err);
      }
    }
    cleanupGeneratedVideoAssets(filename);
  } else if (url.startsWith('/uploads/posters/')) {
    if (isUrlReferencedInMovies(url, remainingMovies)) return;
    const filename = path.basename(url.split('?')[0]);
    const posterFilePath = path.resolve(POSTERS_DIR, filename);
    if (fs.existsSync(posterFilePath)) {
      try {
        fs.unlinkSync(posterFilePath);
      } catch (err) {
        console.warn('Could not delete poster file:', err);
      }
    }
  }
};

const cleanupSiteWideReferencesForDeletedMedia = (deletedIds: string[]) => {
  if (deletedIds.length === 0) return;
  const idSet = new Set(deletedIds);

  // 1. Clean homepage banners referencing deleted media
  const settings = readJsonFile<any>(SITE_SETTINGS_FILE, DEFAULT_SITE_SETTINGS);
  if (Array.isArray(settings.banners)) {
    const nextBanners = settings.banners.filter((b: any) => !b?.mediaId || !idSet.has(b.mediaId));
    if (nextBanners.length !== settings.banners.length) {
      writeJsonFile(SITE_SETTINGS_FILE, { ...settings, banners: nextBanners });
    }
  }

  // 2. Clean comments referencing deleted media
  const comments = readJsonFile<any[]>(COMMENTS_FILE, []);
  const nextComments = comments.filter((c) => !c?.mediaId || !idSet.has(c.mediaId));
  if (nextComments.length !== comments.length) {
    writeJsonFile(COMMENTS_FILE, nextComments);
  }

  // 3. Clean view logs referencing deleted media
  const views = readJsonFile<any[]>(VIEWS_LOG_FILE, []);
  const nextViews = views.filter((v) => !v?.mediaId || !idSet.has(v.mediaId));
  if (nextViews.length !== views.length) {
    writeJsonFile(VIEWS_LOG_FILE, nextViews);
  }
};

const deleteMoviesAndCleanupSiteWide = (
  targets: Array<{
    id: string;
    titleAr?: string;
    type?: string;
    videoUrl?: string;
    posterUrl?: string;
    bannerUrl?: string;
    sources?: any[];
    seasons?: any[];
  }>
) => {
  const movies = readMovies();
  const targetIds = targets.map((t) => (t.id || '').trim()).filter(Boolean);
  if (targetIds.length === 0) return { deletedIds: [] as string[], deletedTitles: [] as string[] };

  const targetIdSet = new Set(targetIds);
  const remainingMovies = movies.filter((m) => !targetIdSet.has(m.id));
  const urlsToUnlink = new Set<string>();
  const deletedTitles: string[] = [];

  for (const t of targets) {
    const serverMatch = movies.find((m) => m.id === t.id);
    const merged = serverMatch || t;
    if (merged.titleAr) deletedTitles.push(merged.titleAr);
    if (merged.videoUrl) urlsToUnlink.add(merged.videoUrl);
    if (merged.posterUrl) urlsToUnlink.add(merged.posterUrl);
    if (merged.bannerUrl) urlsToUnlink.add(merged.bannerUrl);
    if (Array.isArray(merged.sources)) {
      merged.sources.forEach((s: any) => {
        if (s?.url) urlsToUnlink.add(s.url);
      });
    }
    if (Array.isArray(merged.seasons)) {
      merged.seasons.forEach((sn: any) => {
        (sn.episodes || []).forEach((ep: any) => {
          if (ep?.videoUrl) urlsToUnlink.add(ep.videoUrl);
          if (Array.isArray(ep?.sources)) {
            ep.sources.forEach((s: any) => {
              if (s?.url) urlsToUnlink.add(s.url);
            });
          }
        });
      });
    }
  }

  writeMovies(remainingMovies);
  urlsToUnlink.forEach((url) => unlinkLocalMediaFileIfUnused(url, remainingMovies));
  addDeletedMovieIds(targetIds);
  cleanupSiteWideReferencesForDeletedMedia(targetIds);

  return { deletedIds: targetIds, deletedTitles };
};

// Helpers for persistent user accounts & verification codes
interface ServerUser {
  id: string;
  name: string;
  displayName: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  disabled?: boolean;
  picture: string;
  photoURL: string;
  joinedAt: number;
  role: string;
  favoriteGenre: string;
  bio: string;
  watchTimeMinutes: number;
}

interface AuthLinkRecord {
  id: string;
  token: string;
  email: string;
  provider: 'smtp' | 'supabase' | 'resend';
  expiresAt: number;
  used: boolean;
  verifiedAt?: number;
  sessionDelivered?: boolean;
  createdAt: number;
}

const buildSafeUser = (user: ServerUser) => {
  const isDeveloper = (user.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
  return {
    uid: user.id,
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
    picture: user.picture,
    photoURL: user.photoURL,
    joinedAt: user.joinedAt,
    role: isDeveloper ? 'مشرف المنصة' : user.role || 'عضو مسجل',
    favoriteGenre: user.favoriteGenre,
    bio: user.bio,
    watchTimeMinutes: user.watchTimeMinutes,
  };
};

const readUsers = (): ServerUser[] => {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
};

const writeUsers = (users: ServerUser[]): void => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users file:', err);
  }
};

const readAuthLinks = (): AuthLinkRecord[] => {
  try {
    if (!fs.existsSync(AUTH_LINKS_FILE)) return [];
    const raw = fs.readFileSync(AUTH_LINKS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading auth links file:', err);
    return [];
  }
};

const writeAuthLinks = (links: AuthLinkRecord[]): void => {
  try {
    fs.writeFileSync(AUTH_LINKS_FILE, JSON.stringify(links, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing auth links file:', err);
  }
};

// --- SUPABASE AUTH & REAL SMTP EMAIL INTEGRATION ---
interface RuntimeMailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  resendApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const readSavedMailConfig = (): RuntimeMailConfig => {
  try {
    if (!fs.existsSync(MAIL_CONFIG_FILE)) return {};
    const raw = fs.readFileSync(MAIL_CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeSavedMailConfig = (config: RuntimeMailConfig): void => {
  fs.writeFileSync(MAIL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
};

const isValidHttpUrl = (value: string): boolean => {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed.includes('your-project')) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidSmtpHost = (host: string): boolean => {
  const trimmed = (host || '').trim();
  if (!trimmed || /^\d+$/.test(trimmed)) return false;
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
};

const isValidSmtpPort = (port: number): boolean => {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

const isValidEmailLike = (value: string): boolean => {
  const trimmed = (value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const isValidFromHeader = (value: string): boolean => {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  const bracketMatch = trimmed.match(/<([^<>]+)>/);
  const target = bracketMatch ? bracketMatch[1].trim() : trimmed;
  return isValidEmailLike(target);
};

const isPlaceholderValue = (value: string): boolean => {
  const trimmed = (value || '').trim();
  return (
    !trimmed ||
    trimmed === 'xxxx xxxx xxxx xxxx' ||
    trimmed === 'your-anon-key' ||
    trimmed === 'your-service-role-key'
  );
};

// Active runtime provider state
let activeSupabaseUrl = '';
let activeSupabaseAnonKey = '';
let supabaseServer: SupabaseClient | null = null;
let isSupabaseConfigured = false;
let supabaseStatusError: string | null = null;

let activeResendApiKey = '';
let isResendConfigured = false;
let activeSmtpHost = '';
let activeSmtpPort = 465;
let activeSmtpUser = '';
let activeSmtpPass = '';
let activeSmtpSecure = true;
let activeSmtpFrom = '"GoldenFlix" <noreply@goldenflix.app>';
let mailTransporter: any = null;
let isSmtpConfigured = false;
let isSmtpVerified = false;
let smtpLastError: string | null = null;

const normalizeSmtpPass = (host: string, pass: string): string => {
  const trimmed = (pass || '').trim();
  if (!trimmed || isPlaceholderValue(trimmed)) return '';
  if (host.toLowerCase().includes('gmail')) {
    return trimmed.replace(/\s+/g, '');
  }
  return trimmed;
};

const translateSmtpError = (rawMessage: string): string => {
  const msg = (rawMessage || '').toLowerCase();
  if (msg.includes('535') || msg.includes('username and password not accepted') || msg.includes('invalid login')) {
    return 'فشل المصادقة (535): بريد الإرسال أو كلمة مرور التطبيقات غير صحيحة. تأكد من تفعيل التحقق بخطوتين واستخدام "كلمة مرور التطبيقات" المكونة من 16 حرفاً من Google وليس كلمة مرور الحساب العادية.';
  }
  if (msg.includes('econnrefused') || msg.includes('etimedout') || msg.includes('timeout')) {
    return 'تعذر الاتصال بخادم البريد (مهلة الاتصال انتهت). جرب استخدام مفتاح Resend API (يعمل عبر HTTPS مباشرة بدون حظر منافذ).';
  }
  if (msg.includes('wrong version number') || msg.includes('ssl') || msg.includes('tls')) {
    return 'خطأ في إعدادات التشفير SSL/TLS: تأكد أن المنفذ 465 مع SSL أو 587 بدون SSL مباشر.';
  }
  return rawMessage || 'تعذر الاتصال بخادم البريد الإلكتروني';
};

const getEffectiveMailConfig = (): RuntimeMailConfig => {
  const saved = readSavedMailConfig();
  const hasSavedConfig = fs.existsSync(MAIL_CONFIG_FILE);

  const rawEnvHost = (process.env.SMTP_HOST || '').trim();
  const envSmtpHost = isValidSmtpHost(rawEnvHost) ? rawEnvHost : '';

  const envSmtpPortRaw = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : NaN;
  const envSmtpPort = isValidSmtpPort(envSmtpPortRaw) ? envSmtpPortRaw : 465;

  const rawEnvUser = (process.env.SMTP_USER || '').trim();
  const envSmtpUser = isValidEmailLike(rawEnvUser) || (envSmtpHost && !envSmtpHost.includes('gmail') && rawEnvUser)
    ? rawEnvUser
    : '';

  const rawEnvPass = (process.env.SMTP_PASS || '').trim();
  const envSmtpPass =
    envSmtpHost && envSmtpUser && !isPlaceholderValue(rawEnvPass) ? rawEnvPass : '';

  const envSmtpFrom = (process.env.SMTP_FROM || '').trim();
  const envResendKey = (process.env.RESEND_API_KEY || '').trim();

  const rawEnvSupabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const envSupabaseUrl = isValidHttpUrl(rawEnvSupabaseUrl) ? rawEnvSupabaseUrl : '';
  const rawEnvSupabaseKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const envSupabaseAnonKey =
    envSupabaseUrl && !isPlaceholderValue(rawEnvSupabaseKey) && rawEnvSupabaseKey.length >= 20
      ? rawEnvSupabaseKey
      : '';

  const smtpHost = (hasSavedConfig ? (saved.smtpHost ?? '') : (saved.smtpHost ?? envSmtpHost)).trim();
  const smtpPort = hasSavedConfig
    ? (saved.smtpPort && isValidSmtpPort(Number(saved.smtpPort)) ? Number(saved.smtpPort) : 465)
    : (saved.smtpPort !== undefined && isValidSmtpPort(Number(saved.smtpPort)) ? Number(saved.smtpPort) : envSmtpPort);
  const smtpSecure =
    smtpPort === 465
      ? true
      : smtpPort === 587
      ? false
      : saved.smtpSecure !== undefined
      ? Boolean(saved.smtpSecure)
      : process.env.SMTP_SECURE === 'true';

  const smtpUser = (hasSavedConfig ? (saved.smtpUser ?? '') : (saved.smtpUser ?? envSmtpUser)).trim();
  const rawPass = (hasSavedConfig ? (saved.smtpPass ?? '') : (saved.smtpPass ?? envSmtpPass)).trim();
  const smtpPass = normalizeSmtpPass(smtpHost, rawPass);

  const rawFrom = (hasSavedConfig ? (saved.smtpFrom ?? '') : (saved.smtpFrom ?? envSmtpFrom)).trim();
  const smtpFrom = isValidFromHeader(rawFrom)
    ? rawFrom
    : isValidEmailLike(smtpUser)
    ? `"GoldenFlix" <${smtpUser}>`
    : '"GoldenFlix" <noreply@goldenflix.app>';

  const resendApiKey = (hasSavedConfig ? (saved.resendApiKey ?? '') : (saved.resendApiKey ?? envResendKey)).trim();
  const supabaseUrl = (hasSavedConfig ? (saved.supabaseUrl ?? '') : (saved.supabaseUrl ?? envSupabaseUrl)).trim();
  const supabaseAnonKey = (hasSavedConfig ? (saved.supabaseAnonKey ?? '') : (saved.supabaseAnonKey ?? envSupabaseAnonKey)).trim();

  return {
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    resendApiKey,
    supabaseUrl,
    supabaseAnonKey,
  };
};

const reloadMailProviders = async (): Promise<void> => {
  const cfg = getEffectiveMailConfig();

  // 1. Initialize Supabase Auth safely (never crash on malformed URLs)
  activeSupabaseUrl = cfg.supabaseUrl || '';
  activeSupabaseAnonKey = cfg.supabaseAnonKey || '';
  supabaseServer = null;
  isSupabaseConfigured = false;
  supabaseStatusError = null;

  if (activeSupabaseUrl || activeSupabaseAnonKey) {
    if (!isValidHttpUrl(activeSupabaseUrl)) {
      supabaseStatusError =
        'رابط SUPABASE_URL غير صالح (يجب أن يبدأ بـ https:// مثل https://your-project.supabase.co)';
      console.warn('[GoldenFlix Auth] Supabase skipped: invalid URL format.');
    } else if (isPlaceholderValue(activeSupabaseAnonKey)) {
      supabaseStatusError = 'مفتاح SUPABASE_ANON_KEY مفقود أو غير صالح';
      console.warn('[GoldenFlix Auth] Supabase skipped: missing anon key.');
    } else {
      try {
        supabaseServer = createClient(activeSupabaseUrl, activeSupabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        isSupabaseConfigured = true;
        supabaseStatusError = null;
        console.log('[GoldenFlix Auth] Supabase Auth client initialized successfully.');
      } catch (err: any) {
        supabaseStatusError = err?.message || 'فشل تهيئة Supabase Auth';
        console.warn('[GoldenFlix Auth] Supabase Auth init warning:', supabaseStatusError);
      }
    }
  } else {
    supabaseStatusError = 'بيانات SUPABASE_URL و SUPABASE_ANON_KEY غير مزودة (اختياري عند استخدام SMTP)';
  }

  // 1.5 Resend API setup
  activeResendApiKey = cfg.resendApiKey || '';
  isResendConfigured = Boolean(activeResendApiKey && activeResendApiKey.startsWith('re_'));

  // 2. Initialize SMTP safely (validate host & port range 1-65535 before creating transporter)
  activeSmtpHost = cfg.smtpHost || '';
  activeSmtpPort = Number(cfg.smtpPort) || 465;
  activeSmtpUser = cfg.smtpUser || '';
  activeSmtpPass = cfg.smtpPass || '';
  activeSmtpSecure = Boolean(cfg.smtpSecure);
  activeSmtpFrom = cfg.smtpFrom || '"GoldenFlix" <noreply@goldenflix.app>';

  mailTransporter = null;
  isSmtpConfigured = false;
  isSmtpVerified = false;
  smtpLastError = null;

  if (!activeSmtpHost && !activeSmtpUser && !activeSmtpPass) {
    smtpLastError = 'لم يتم تزويد إعدادات خادم SMTP بعد. يرجى ضبط SMTP_USER و SMTP_PASS من لوحة تحكم المطور أو ملف .env';
    console.log('[GoldenFlix Mailer] SMTP credentials not set. Configure in Developer Dashboard or .env.');
    return;
  }

  if (!isValidSmtpHost(activeSmtpHost)) {
    smtpLastError = `عنوان خادم البريد (SMTP_HOST) غير صالح: "${activeSmtpHost || 'فارغ'}" — مثال صحيح: smtp.gmail.com`;
    console.warn('[GoldenFlix Mailer] Invalid SMTP_HOST configured:', activeSmtpHost);
    return;
  }

  if (!isValidSmtpPort(activeSmtpPort)) {
    smtpLastError = `رقم المنفذ (SMTP_PORT) غير صالح: ${activeSmtpPort} — يجب أن يكون بين 1 و 65535 (مثل 465 أو 587)`;
    console.warn('[GoldenFlix Mailer] Invalid SMTP_PORT configured:', activeSmtpPort);
    return;
  }

  if (!activeSmtpUser || isPlaceholderValue(activeSmtpPass)) {
    smtpLastError = 'يرجى إدخال بريد المرسل (SMTP_USER) وكلمة مرور التطبيقات (SMTP_PASS) الصالحة';
    console.warn('[GoldenFlix Mailer] Incomplete SMTP credentials.');
    return;
  }

  if (!isValidEmailLike(activeSmtpUser) && activeSmtpHost.includes('gmail')) {
    smtpLastError = `بريد المرسل (SMTP_USER) غير صالح: "${activeSmtpUser}" — يرجى إدخال بريد إلكتروني صحيح مثل frassa.wwindows@gmail.com`;
    console.warn('[GoldenFlix Mailer] Invalid SMTP_USER email format:', activeSmtpUser);
    return;
  }

  isSmtpConfigured = true;
  try {
    mailTransporter = nodemailer.createTransport({
      host: activeSmtpHost,
      port: activeSmtpPort,
      secure: activeSmtpSecure,
      auth: {
        user: activeSmtpUser,
        pass: activeSmtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    await mailTransporter.verify();
    isSmtpVerified = true;
    smtpLastError = null;
    console.log(`[GoldenFlix Mailer] SMTP Server verified and connected (${activeSmtpHost}:${activeSmtpPort}) for ${activeSmtpUser}`);
  } catch (err: any) {
    isSmtpVerified = false;
    smtpLastError = translateSmtpError(err?.message || 'فشل التحقق من بيانات خادم SMTP');
    console.warn(`[GoldenFlix Mailer] SMTP verification warning on ${activeSmtpHost}:${activeSmtpPort}:`, err?.message || smtpLastError);
  }
};

reloadMailProviders();

// Cryptographically secure verification link token generator
const generateSecureAuthToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Build accurate public base URL from incoming request or APP_URL env
const getRequestBaseUrl = (req: Request): string => {
  const originHeader = (req.headers.origin || '').toString().trim();
  if (isValidHttpUrl(originHeader) && !originHeader.includes('MY_APP_URL')) {
    return originHeader.replace(/\/+$/, '');
  }

  const forwardedHost = (req.headers['x-forwarded-host'] || req.get('host') || '').toString().trim();
  const forwardedProto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString().split(',')[0].trim();
  if (forwardedHost && !forwardedHost.includes('MY_APP_URL')) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
  }

  const envAppUrl = (process.env.APP_URL || '').trim();
  if (isValidHttpUrl(envAppUrl) && !envAppUrl.includes('MY_APP_URL')) {
    return envAppUrl.replace(/\/+$/, '');
  }

  return `http://localhost:${PORT}`;
};

// Real email dispatch function delivering clickable activation / magic login links
const sendVerificationLinkEmail = async (
  email: string,
  verificationUrl: string,
  recipientName: string,
  redirectBaseUrl: string,
  purposeLabel = 'تفعيل والدخول إلى الحساب'
): Promise<{ provider: 'smtp' | 'supabase' | 'resend'; messageId?: string }> => {
  const cleanEmail = email.trim().toLowerCase();

  // Strict email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error(`عنوان البريد الإلكتروني غير صالح: ${cleanEmail}`);
  }

  const subject = `رابط الدخول المباشر إلى منصة GoldenFlix`;
  const htmlContent = `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0c0c0e; color: #ffffff; padding: 30px; border-radius: 16px; max-width: 540px; margin: 0 auto; border: 1px solid #27272a;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #facc15; font-size: 26px; margin: 0; font-weight: 900; letter-spacing: -0.5px;">Golden<span style="color: #ffffff;">Flix</span></h1>
          <p style="color: #a1a1aa; font-size: 13px; margin-top: 6px;">عالم الترفيه بين يديك</p>
        </div>
        <div style="background-color: #18181b; padding: 24px; border-radius: 12px; border: 1px solid #3f3f46; text-align: center;">
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">مرحباً ${recipientName || 'بك'}</h2>
          <p style="color: #d4d4d8; font-size: 14px; line-height: 1.7;">
            اضغط على الزر التالي ليتم ${purposeLabel} مباشرة وبشكل تلقائي في منصة GoldenFlix بدون الحاجة لإدخال أي رموز:
          </p>
          <div style="margin: 28px 0;">
            <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; font-size: 15px; font-weight: 900; color: #000000; background: linear-gradient(135deg, #facc15, #eab308); padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 18px rgba(250, 204, 21, 0.35);">
              تفعيل والدخول إلى الحساب الآن
            </a>
          </div>
          <p style="color: #a1a1aa; font-size: 12px; line-height: 1.6; word-break: break-all;">
            أو انسخ الرابط التالي وافتحه في متصفحك:<br/>
            <a href="${verificationUrl}" style="color: #facc15; text-decoration: underline;">${verificationUrl}</a>
          </p>
          <p style="color: #f59e0b; font-size: 12px; font-weight: bold; margin-bottom: 0; margin-top: 16px;">
            تنتهي صلاحية هذا الرابط خلال 15 دقيقة ويستخدم لمرة واحدة فقط.
          </p>
        </div>
        <p style="color: #71717a; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
          تم إرسال هذه الرسالة إلى: ${cleanEmail}<br/>
          إذا لم تطلب هذا الرابط، يمكنك تجاهل هذه الرسالة بأمان.<br/>
          GoldenFlix © ${new Date().getFullYear()} - جميع الحقوق محفوظة.
        </p>
      </div>
    `;

  let smtpAttemptError: string | null = null;

  // 1. Prefer verified SMTP so our branded Arabic direct-login link reaches the user's inbox
  if (mailTransporter && isSmtpConfigured) {
    try {
      console.log(`[GoldenFlix Mailer] Dispatching login link email to ${cleanEmail} via SMTP (${activeSmtpHost}:${activeSmtpPort})...`);
      const info = await mailTransporter.sendMail({
        from: activeSmtpFrom,
        to: cleanEmail,
        subject,
        html: htmlContent,
      });

      isSmtpVerified = true;
      smtpLastError = null;
      console.log(`[GoldenFlix Mailer] Direct login link sent to ${cleanEmail} (MessageID: ${info.messageId})`);
      return { provider: 'smtp', messageId: info.messageId };
    } catch (err: any) {
      smtpAttemptError = translateSmtpError(err?.message || 'خطأ في خادم البريد');
      smtpLastError = smtpAttemptError;
      isSmtpVerified = false;
      console.warn(`[GoldenFlix Mailer] SMTP delivery failed to ${cleanEmail}:`, err?.message || smtpAttemptError);
      if (!isResendConfigured && (!supabaseServer || !isSupabaseConfigured)) {
        throw new Error(smtpAttemptError);
      }
    }
  }

  // 2. Resend HTTPS API (if configured)
  if (isResendConfigured && activeResendApiKey) {
    try {
      const lowerFrom = (activeSmtpFrom || '').toLowerCase();
      const usesUnverifiedPublicDomain =
        lowerFrom.includes('noreply@goldenflix.cinema') ||
        lowerFrom.includes('@gmail.com') ||
        lowerFrom.includes('@yahoo.') ||
        lowerFrom.includes('@outlook.') ||
        lowerFrom.includes('@hotmail.') ||
        lowerFrom.includes('@icloud.');
      const fromAddress = usesUnverifiedPublicDomain
        ? 'GoldenFlix <onboarding@resend.dev>'
        : activeSmtpFrom;
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeResendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [cleanEmail],
          subject,
          html: htmlContent,
        }),
      });
      const resendJson: any = await resendRes.json().catch(() => ({}));
      if (resendRes.ok && resendJson.id) {
        console.log(`[GoldenFlix Mailer] Direct login link sent to ${cleanEmail} via Resend (ID: ${resendJson.id})`);
        return { provider: 'resend', messageId: resendJson.id };
      }
      throw new Error(resendJson.message || `خطأ من خدمة Resend (${resendRes.status})`);
    } catch (err: any) {
      console.warn('[GoldenFlix Mailer] Resend API failure:', err.message);
      if (!supabaseServer || !isSupabaseConfigured) {
        throw new Error(`فشل إرسال البريد عبر Resend: ${err.message}`);
      }
    }
  }

  // 3. Supabase Auth Magic Link delivery if configured
  if (supabaseServer && isSupabaseConfigured) {
    try {
      console.log(`[GoldenFlix Mailer] Sending magic link to ${cleanEmail} via Supabase Auth (redirect: ${redirectBaseUrl})...`);
      const { error } = await supabaseServer.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectBaseUrl,
        },
      });

      if (!error) {
        console.log(`[GoldenFlix Mailer] Magic link successfully dispatched by Supabase Auth to ${cleanEmail}`);
        return { provider: 'supabase' };
      }
      throw new Error(error.message || 'فشل إرسال رابط الدخول عبر Supabase Auth');
    } catch (err: any) {
      console.warn('[GoldenFlix Mailer] Supabase dispatch exception:', err.message);
      throw new Error(`فشل إرسال البريد عبر Supabase Auth: ${err.message}`);
    }
  }

  // 4. No provider succeeded -> Fail honestly with clear Arabic instructions
  const detailedError = smtpLastError && !smtpLastError.includes('لم يتم تزويد')
    ? `تعذر إرسال الرابط: ${smtpLastError}`
    : 'لم يتم إعداد مزود إرسال بريد إلكتروني نشط بعد (SMTP أو Resend أو Supabase). اضغط على زر الإعداد بالأسفل لتفعيله أو استخدم الدخول السريع بحساب Google.';

  throw new Error(detailedError);
};

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Range, Authorization, x-upload-id, x-chunk-offset, x-chunk-index'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Admin & Collaborator Auth Helpers
const COLLABORATOR_TOKEN_PREFIX = 'gfcol.';
const COLLABORATOR_PASSWORD_REQUIRED_PART = 'VBL/9';
const SUPER_ADMIN_PERMISSIONS = {
  canUpload: true,
  canEditMedia: true,
  canDeleteMedia: true,
  canManageUsers: true,
  canManageSettings: true,
};

interface ResolvedAdminSession {
  authenticated: boolean;
  email: string;
  name: string;
  roleTitle: string;
  isSuperAdmin: boolean;
  permissions: {
    canUpload: boolean;
    canEditMedia: boolean;
    canDeleteMedia: boolean;
    canManageUsers: boolean;
    canManageSettings: boolean;
  };
}

const sanitizeAdminRecord = (a: any) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  roleTitle: a.roleTitle || 'محرر محتوى',
  isSuperAdmin: Boolean(a.isSuperAdmin),
  isActive: a.isActive !== false,
  hasPassword: Boolean(a.isSuperAdmin || a.passwordHash),
  passwordHint: a.isSuperAdmin ? 'حساب المالك الرئيسي' : a.passwordHint || 'يتضمن VBL/9',
  permissions: {
    canUpload: Boolean(a.permissions?.canUpload),
    canEditMedia: Boolean(a.permissions?.canEditMedia),
    canDeleteMedia: Boolean(a.permissions?.canDeleteMedia),
    canManageUsers: Boolean(a.permissions?.canManageUsers),
    canManageSettings: Boolean(a.permissions?.canManageSettings),
  },
  createdAt: a.createdAt || Date.now(),
});

const signCollaboratorToken = (email: string, id: string): string => {
  const payload = Buffer.from(
    JSON.stringify({
      id,
      email: email.toLowerCase(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    }),
    'utf-8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', ADMIN_SECRET_TOKEN)
    .update(payload)
    .digest('base64url');
  return `${COLLABORATOR_TOKEN_PREFIX}${payload}.${sig}`;
};

const verifyAdminTokenValue = (token: string): ResolvedAdminSession | null => {
  if (!token) return null;
  if (token === ADMIN_SECRET_TOKEN) {
    return {
      authenticated: true,
      email: PRIMARY_ADMIN_EMAIL,
      name: 'مطور المنصة الرئيسي',
      roleTitle: 'مالك المنصة (Super Admin)',
      isSuperAdmin: true,
      permissions: { ...SUPER_ADMIN_PERMISSIONS },
    };
  }

  if (!token.startsWith(COLLABORATOR_TOKEN_PREFIX)) return null;
  const body = token.slice(COLLABORATOR_TOKEN_PREFIX.length);
  const parts = body.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SECRET_TOKEN)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!parsed?.email || !parsed?.exp || Date.now() > Number(parsed.exp)) {
      return null;
    }
    const cleanEmail = String(parsed.email).trim().toLowerCase();
    const list = readJsonFile<any[]>(ADMINS_FILE, DEFAULT_ADMINS);
    const member = list.find((a) => String(a.email || '').trim().toLowerCase() === cleanEmail);
    if (!member || member.isActive === false) return null;

    return {
      authenticated: true,
      email: member.email,
      name: member.name || member.email,
      roleTitle: member.roleTitle || 'محرر محتوى',
      isSuperAdmin: Boolean(member.isSuperAdmin),
      permissions: member.isSuperAdmin
        ? { ...SUPER_ADMIN_PERMISSIONS }
        : {
            canUpload: Boolean(member.permissions?.canUpload),
            canEditMedia: Boolean(member.permissions?.canEditMedia),
            canDeleteMedia: Boolean(member.permissions?.canDeleteMedia),
            canManageUsers: Boolean(member.permissions?.canManageUsers),
            canManageSettings: Boolean(member.permissions?.canManageSettings),
          },
    };
  } catch {
    return null;
  }
};

const getSessionActor = (req: Request): string =>
  ((req as any).adminSession?.email as string) || PRIMARY_ADMIN_EMAIL;

// Admin Auth Middleware
const requireAdmin = (req: Request, res: Response, next: () => void) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول كمسؤول' });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const session = verifyAdminTokenValue(token);
  if (!session) {
    return res.status(403).json({ error: 'صلاحيات غير كافية أو انتهت الجلسة: هذا الحساب غير مصرح له' });
  }
  (req as any).adminSession = session;
  next();
};

const requireSuperAdmin = (req: Request, res: Response, next: () => void) => {
  const session = (req as any).adminSession as ResolvedAdminSession | undefined;
  if (!session?.isSuperAdmin) {
    return res.status(403).json({ error: 'هذا الإجراء مقتصر على المطور الرئيسي للمنصة فقط' });
  }
  next();
};

const requirePermission =
  (perm: keyof ResolvedAdminSession['permissions']) =>
  (req: Request, res: Response, next: () => void) => {
    const session = (req as any).adminSession as ResolvedAdminSession | undefined;
    if (!session) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    if (session.isSuperAdmin || session.permissions?.[perm]) {
      return next();
    }
    return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء في لوحة الإدارة' });
  };

const requireAnyPermission =
  (...perms: Array<keyof ResolvedAdminSession['permissions']>) =>
  (req: Request, res: Response, next: () => void) => {
    const session = (req as any).adminSession as ResolvedAdminSession | undefined;
    if (!session) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    if (session.isSuperAdmin || perms.some((p) => session.permissions?.[p])) {
      return next();
    }
    return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء في لوحة الإدارة' });
  };

// --- AUTHENTICATION ROUTES ---
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPass = String(password).trim();

  if (cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    const isAuthorizedPassword =
      cleanPass === 'fr010020' ||
      cleanPass === ADMIN_PASSWORD ||
      cleanPass === 'GoldenFlix@Cinema2025';

    if (!isAuthorizedPassword) {
      appendAuditLog('محاولة دخول إدارية فاشلة', 'security', `كلمة مرور خاطئة للبريد ${cleanEmail}`, cleanEmail);
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    appendAuditLog('تسجيل دخول لوحة التحكم', 'auth', `دخول المشرف ${PRIMARY_ADMIN_EMAIL}`, PRIMARY_ADMIN_EMAIL);

    return res.json({
      success: true,
      token: ADMIN_SECRET_TOKEN,
      email: PRIMARY_ADMIN_EMAIL,
      name: 'مطور المنصة الرئيسي',
      roleTitle: 'مالك المنصة (Super Admin)',
      isSuperAdmin: true,
      permissions: { ...SUPER_ADMIN_PERMISSIONS },
      message: 'تم تسجيل دخول المشرف بنجاح',
    });
  }

  // Check invited co-editor / collaborator accounts
  const adminsList = readJsonFile<any[]>(ADMINS_FILE, DEFAULT_ADMINS);
  const memberIdx = adminsList.findIndex(
    (a) => String(a.email || '').trim().toLowerCase() === cleanEmail
  );
  const member = memberIdx >= 0 ? adminsList[memberIdx] : null;

  if (!member) {
    return res.status(403).json({
      error: 'هذا البريد غير مضاف في قائمة صلاحيات الإدارة.',
    });
  }

  if (member.isActive === false) {
    return res.status(403).json({
      error: 'تم إيقاف صلاحية الدخول لهذا الحساب الإداري من قِبل مالك المنصة.',
    });
  }

  let passOk = false;
  if (member.passwordHash) {
    passOk = bcrypt.compareSync(cleanPass, member.passwordHash);
  } else if (cleanPass === COLLABORATOR_PASSWORD_REQUIRED_PART) {
    // Migrate legacy collaborator without hash
    adminsList[memberIdx].passwordHash = bcrypt.hashSync(COLLABORATOR_PASSWORD_REQUIRED_PART, 10);
    adminsList[memberIdx].passwordHint = 'VBL/9';
    writeJsonFile(ADMINS_FILE, adminsList);
    passOk = true;
  }

  if (!passOk) {
    appendAuditLog('محاولة دخول إدارية فاشلة', 'security', `كلمة مرور خاطئة للمشرف المساعد ${cleanEmail}`, cleanEmail);
    return res.status(401).json({ error: 'كلمة مرور الإدارة غير صحيحة' });
  }

  const collabToken = signCollaboratorToken(cleanEmail, member.id);
  appendAuditLog('تسجيل دخول مشرف مساعد', 'auth', `دخول ${member.name || cleanEmail} (${member.roleTitle || 'محرر'})`, cleanEmail);

  return res.json({
    success: true,
    token: collabToken,
    email: member.email,
    name: member.name || member.email,
    roleTitle: member.roleTitle || 'محرر محتوى',
    isSuperAdmin: false,
    permissions: {
      canUpload: Boolean(member.permissions?.canUpload),
      canEditMedia: Boolean(member.permissions?.canEditMedia),
      canDeleteMedia: Boolean(member.permissions?.canDeleteMedia),
      canManageUsers: Boolean(member.permissions?.canManageUsers),
      canManageSettings: Boolean(member.permissions?.canManageSettings),
    },
    message: 'تم تسجيل دخول المشرف المساعد بنجاح',
  });
});

app.get('/api/admin/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.json({ authenticated: false });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const session = verifyAdminTokenValue(token);
  if (!session) {
    return res.json({ authenticated: false });
  }
  return res.json(session);
});

app.get('/api/admin/access-check', (req: Request, res: Response) => {
  const rawEmail = String(req.query?.email || '').trim().toLowerCase();
  if (!rawEmail) {
    return res.json({ allowed: false, isSuperAdmin: false });
  }
  if (rawEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return res.json({
      allowed: true,
      isSuperAdmin: true,
      name: 'مطور المنصة الرئيسي',
      roleTitle: 'مالك المنصة (Super Admin)',
      permissions: { ...SUPER_ADMIN_PERMISSIONS },
    });
  }
  const adminsList = readJsonFile<any[]>(ADMINS_FILE, DEFAULT_ADMINS);
  const member = adminsList.find(
    (a) => String(a.email || '').trim().toLowerCase() === rawEmail && a.isActive !== false
  );
  if (!member) {
    return res.json({ allowed: false, isSuperAdmin: false });
  }
  return res.json({
    allowed: true,
    isSuperAdmin: false,
    name: member.name || member.email,
    roleTitle: member.roleTitle || 'محرر محتوى',
    permissions: {
      canUpload: Boolean(member.permissions?.canUpload),
      canEditMedia: Boolean(member.permissions?.canEditMedia),
      canDeleteMedia: Boolean(member.permissions?.canDeleteMedia),
      canManageUsers: Boolean(member.permissions?.canManageUsers),
      canManageSettings: Boolean(member.permissions?.canManageSettings),
    },
  });
});

// --- USER AUTHENTICATION & DIRECT EMAIL VERIFICATION LINK SYSTEM ---

// 1. Register with Name, Email & Password -> Sends real clickable activation link
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const currentSettings = readJsonFile<any>(SITE_SETTINGS_FILE, DEFAULT_SITE_SETTINGS);
    if (currentSettings?.securitySettings?.allowNewRegistrations === false) {
      return res.status(403).json({ error: 'التسجيل الجديد مغلق مؤقتاً من قِبل إدارة المنصة' });
    }
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الاسم، والبريد الإلكتروني، وكلمة المرور مطلوبة' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صالح' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const users = readUsers();
    const existing = users.find((u) => u.email === cleanEmail);

    if (existing && existing.emailVerified) {
      return res.status(400).json({ error: 'يوجد حساب مسجل بالفعل ومفعل بهذا البريد الإلكتروني. يرجى تسجيل الدخول.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = existing ? existing.id : `user-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=facc15&color=000&size=128&bold=true`;

    const userRecord: ServerUser = {
      id: userId,
      name: cleanName,
      displayName: cleanName,
      email: cleanEmail,
      passwordHash,
      emailVerified: false,
      picture: avatarUrl,
      photoURL: avatarUrl,
      joinedAt: existing ? existing.joinedAt : Date.now(),
      role: cleanEmail === PRIMARY_ADMIN_EMAIL ? 'مشرف المنصة' : 'عضو مسجل',
      favoriteGenre: 'أفلام سينمائية',
      bio: 'مستمتع بمشاهدة أحدث الأعمال على GoldenFlix.',
      watchTimeMinutes: 0,
    };

    const baseUrl = getRequestBaseUrl(req);
    const token = generateSecureAuthToken();
    const verificationUrl = `${baseUrl}/?auth_token=${encodeURIComponent(token)}`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    // Dispatch real verification link email FIRST
    const emailRes = await sendVerificationLinkEmail(
      cleanEmail,
      verificationUrl,
      cleanName,
      baseUrl,
      'تأكيد بريدك وتفعيل حسابك والدخول'
    );

    const userIndex = users.findIndex((u) => u.email === cleanEmail);
    if (userIndex >= 0) {
      users[userIndex] = userRecord;
    } else {
      users.push(userRecord);
    }
    writeUsers(users);

    const links = readAuthLinks();
    links.forEach((item) => {
      if (item.email === cleanEmail) item.used = true;
    });

    const newLink: AuthLinkRecord = {
      id: `link-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      token,
      email: cleanEmail,
      provider: emailRes.provider,
      expiresAt,
      used: false,
      sessionDelivered: false,
      createdAt: Date.now(),
    };
    links.push(newLink);
    writeAuthLinks(links);

    return res.status(200).json({
      success: true,
      message: `تم إرسال رابط التفعيل والدخول المباشر إلى بريدك الإلكتروني بنجاح (${cleanEmail})`,
      email: cleanEmail,
      linkId: newLink.id,
      expiresInSeconds: 900,
      provider: emailRes.provider,
    });
  } catch (err: any) {
    console.warn('[GoldenFlix Auth] Registration email link dispatch unavailable:', err.message);
    return res.status(503).json({
      error: err.message || 'حدث خطأ أثناء إرسال رابط التفعيل إلى البريد الإلكتروني',
    });
  }
});

// 2. Send Direct Login / Verification Magic Link by email
app.post('/api/auth/send-login-link', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صالح' });
    }

    const users = readUsers();
    let user = users.find((u) => u.email === cleanEmail);
    let isNewProvisional = false;

    if (user?.disabled) {
      return res.status(403).json({ error: 'تم تعطيل هذا الحساب من قبل إدارة المنصة.' });
    }

    if (!user) {
      const defaultName = cleanEmail.split('@')[0];
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=facc15&color=000&size=128&bold=true`;
      user = {
        id: `user-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        name: defaultName,
        displayName: defaultName,
        email: cleanEmail,
        passwordHash,
        emailVerified: false,
        picture: avatarUrl,
        photoURL: avatarUrl,
        joinedAt: Date.now(),
        role: cleanEmail === PRIMARY_ADMIN_EMAIL ? 'مشرف المنصة' : 'عضو مسجل',
        favoriteGenre: 'أفلام سينمائية',
        bio: 'مستمتع بمشاهدة أحدث الأعمال على GoldenFlix.',
        watchTimeMinutes: 0,
      };
      isNewProvisional = true;
    }

    const links = readAuthLinks();
    const now = Date.now();

    const latestForEmail = [...links]
      .filter((item) => item.email === cleanEmail)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (latestForEmail && now - latestForEmail.createdAt < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - (now - latestForEmail.createdAt)) / 1000);
      return res.status(429).json({
        error: `يرجى الانتظار ${waitSec} ثانية قبل إعادة إرسال رابط جديد`,
        waitSeconds: waitSec,
      });
    }

    const baseUrl = getRequestBaseUrl(req);
    const token = generateSecureAuthToken();
    const verificationUrl = `${baseUrl}/?auth_token=${encodeURIComponent(token)}`;
    const expiresAt = now + 15 * 60 * 1000;

    // Send real email link FIRST
    const emailRes = await sendVerificationLinkEmail(
      cleanEmail,
      verificationUrl,
      user.name || cleanEmail.split('@')[0],
      baseUrl,
      'تسجيل دخولك إلى حسابك'
    );

    if (isNewProvisional) {
      users.push(user);
      writeUsers(users);
    }

    links.forEach((item) => {
      if (item.email === cleanEmail) item.used = true;
    });

    const newLink: AuthLinkRecord = {
      id: `link-${now}-${Math.round(Math.random() * 1e4)}`,
      token,
      email: cleanEmail,
      provider: emailRes.provider,
      expiresAt,
      used: false,
      sessionDelivered: false,
      createdAt: now,
    };
    links.push(newLink);
    writeAuthLinks(links);

    return res.json({
      success: true,
      message: `تم إرسال رابط الدخول المباشر إلى بريدك الإلكتروني بنجاح (${cleanEmail})`,
      email: cleanEmail,
      linkId: newLink.id,
      expiresInSeconds: 900,
      provider: emailRes.provider,
    });
  } catch (err: any) {
    console.warn('[GoldenFlix Auth] Direct login link dispatch unavailable:', err.message);
    return res.status(503).json({
      error: err.message || 'فشل إرسال رابط الدخول إلى البريد الإلكتروني',
    });
  }
});

// 3. Verify Email Link Token (Called immediately when user clicks link in email)
app.post('/api/auth/verify-link', async (req: Request, res: Response) => {
  try {
    const rawToken = req.body?.token;
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    if (!token || token.length < 16) {
      return res.status(400).json({ error: 'رابط الدخول غير صالح أو ناقص' });
    }

    const links = readAuthLinks();
    const linkRecord = links.find((item) => item.token === token);

    if (!linkRecord) {
      return res.status(400).json({ error: 'رابط الدخول غير صالح أو منتهي الصلاحية' });
    }

    if (linkRecord.used) {
      return res.status(400).json({ error: 'تم استخدام رابط الدخول هذا مسبقاً، يرجى طلب رابط جديد عند الحاجة' });
    }

    if (Date.now() > linkRecord.expiresAt) {
      linkRecord.used = true;
      writeAuthLinks(links);
      return res.status(400).json({ error: 'انتهت صلاحية رابط الدخول (15 دقيقة). يرجى طلب رابط جديد.' });
    }

    linkRecord.used = true;
    linkRecord.verifiedAt = Date.now();
    writeAuthLinks(links);

    const users = readUsers();
    const user = users.find((u) => u.email === linkRecord.email);
    if (!user) {
      return res.status(404).json({ error: 'لم يتم العثور على بيانات الحساب، يرجى التسجيل مجدداً' });
    }

    user.emailVerified = true;
    writeUsers(users);

    return res.json({
      success: true,
      message: 'تم تأكيد بريدك الإلكتروني وتسجيل دخولك بنجاح!',
      user: buildSafeUser(user),
    });
  } catch (err: any) {
    console.warn('[GoldenFlix Auth] Link verification error:', err?.message || err);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء تأكيد رابط الدخول' });
  }
});

// 4. Check Link Status for cross-tab / cross-device auto-login after user clicks email link
app.get('/api/auth/link-status', (req: Request, res: Response) => {
  const linkId = (req.query?.linkId || '').toString().trim();
  if (!linkId) {
    return res.json({ verified: false });
  }

  const links = readAuthLinks();
  const linkRecord = links.find((item) => item.id === linkId);
  if (!linkRecord || !linkRecord.used || !linkRecord.verifiedAt || linkRecord.sessionDelivered) {
    return res.json({ verified: false });
  }

  const users = readUsers();
  const user = users.find((u) => u.email === linkRecord.email && u.emailVerified);
  if (!user) {
    return res.json({ verified: false });
  }

  linkRecord.sessionDelivered = true;
  writeAuthLinks(links);

  return res.json({
    verified: true,
    user: buildSafeUser(user),
  });
});

// 5. Exchange Supabase Magic Link access_token when redirected back to app
app.post('/api/auth/supabase-session', async (req: Request, res: Response) => {
  try {
    const accessToken = (req.body?.accessToken || '').toString().trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'رمز جلسة الرابط مفقود' });
    }

    if (!supabaseServer || !isSupabaseConfigured) {
      return res.status(503).json({ error: 'خدمة Supabase Auth غير مفعلة على الخادم' });
    }

    const { data, error } = await supabaseServer.auth.getUser(accessToken);
    if (error || !data?.user?.email) {
      return res.status(401).json({ error: 'رابط تسجيل الدخول عبر Supabase غير صالح أو منتهي الصلاحية' });
    }

    const cleanEmail = data.user.email.trim().toLowerCase();
    const users = readUsers();
    let user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      const displayName =
        (data.user.user_metadata?.full_name || data.user.user_metadata?.name || cleanEmail.split('@')[0]).toString().trim();
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=facc15&color=000&size=128&bold=true`;
      user = {
        id: `user-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        name: displayName,
        displayName,
        email: cleanEmail,
        passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
        emailVerified: true,
        picture: avatarUrl,
        photoURL: avatarUrl,
        joinedAt: Date.now(),
        role: cleanEmail === PRIMARY_ADMIN_EMAIL ? 'مشرف المنصة' : 'عضو مسجل',
        favoriteGenre: 'أفلام سينمائية',
        bio: 'مستمتع بمشاهدة أحدث الأعمال على GoldenFlix.',
        watchTimeMinutes: 0,
      };
      users.push(user);
    } else {
      user.emailVerified = true;
    }
    writeUsers(users);

    return res.json({
      success: true,
      message: 'تم تأكيد بريدك الإلكتروني وتسجيل دخولك بنجاح!',
      user: buildSafeUser(user),
    });
  } catch (err: any) {
    console.warn('[GoldenFlix Auth] Supabase magic link exchange error:', err?.message || err);
    return res.status(500).json({ error: 'تعذر إتمام تسجيل الدخول عبر الرابط' });
  }
});

// 6. Login with Email & Password (Blocks unverified users and dispatches verification link)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = readUsers();
    const user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    if (user.disabled) {
      return res.status(403).json({ error: 'تم تعطيل هذا الحساب من قبل إدارة المنصة.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // Strict mandate: User cannot enter unless email is verified
    if (!user.emailVerified) {
      const baseUrl = getRequestBaseUrl(req);
      const token = generateSecureAuthToken();
      const verificationUrl = `${baseUrl}/?auth_token=${encodeURIComponent(token)}`;
      const links = readAuthLinks();
      let newLinkId = '';

      try {
        const emailRes = await sendVerificationLinkEmail(
          cleanEmail,
          verificationUrl,
          user.name,
          baseUrl,
          'تأكيد بريدك وتفعيل حسابك والدخول'
        );
        links.forEach((item) => {
          if (item.email === cleanEmail) item.used = true;
        });
        const newLink: AuthLinkRecord = {
          id: `link-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
          token,
          email: cleanEmail,
          provider: emailRes.provider,
          expiresAt: Date.now() + 15 * 60 * 1000,
          used: false,
          sessionDelivered: false,
          createdAt: Date.now(),
        };
        newLinkId = newLink.id;
        links.push(newLink);
        writeAuthLinks(links);
      } catch (sendErr: any) {
        console.warn('[GoldenFlix Auth] Could not send verification link during login:', sendErr.message);
        return res.status(503).json({
          error: sendErr.message || 'الحساب غير مفعل وتعذر إرسال رابط التفعيل حالياً',
        });
      }

      return res.status(403).json({
        error: 'حسابك غير مفعل بعد. تم إرسال رابط تفعيل ودخول مباشر جديد إلى بريدك الإلكتروني.',
        requiresVerification: true,
        email: cleanEmail,
        name: user.name,
        linkId: newLinkId,
      });
    }

    return res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      user: buildSafeUser(user),
    });
  } catch (err: any) {
    console.warn('[GoldenFlix Auth] Login error:', err?.message || err);
    return res.status(500).json({ error: 'فشل تسجيل الدخول، يرجى المحاولة لاحقاً' });
  }
});

// 5. System Status Diagnostic Endpoint: Inspect Supabase, SMTP, and Firebase connection
const buildDiagnosticsPayload = async () => {
  let currentSmtpVerified = isSmtpVerified;
  let currentSmtpError = smtpLastError;

  if (mailTransporter && !currentSmtpVerified && isSmtpConfigured) {
    try {
      await mailTransporter.verify();
      currentSmtpVerified = true;
      currentSmtpError = null;
      isSmtpVerified = true;
      smtpLastError = null;
    } catch (err: any) {
      currentSmtpError = err?.message || 'فشل التحقق من خادم SMTP';
    }
  }

  return {
    smtp: {
      configured: isSmtpConfigured,
      host: activeSmtpHost || null,
      port: activeSmtpPort || null,
      secure: activeSmtpSecure,
      user: activeSmtpUser || null,
      from: activeSmtpFrom || null,
      verified: currentSmtpVerified,
      error: currentSmtpError,
    },
    supabase: {
      configured: isSupabaseConfigured,
      url: isValidHttpUrl(activeSupabaseUrl) ? activeSupabaseUrl : null,
      connected: isSupabaseConfigured,
      error: supabaseStatusError,
    },
    resend: {
      configured: isResendConfigured,
    },
    firebase: {
      configured: true,
      projectId: 'arctic-xylopolist-whl8x',
    },
    realDeliveryReady: currentSmtpVerified || isResendConfigured || isSupabaseConfigured,
  };
};

app.get('/api/auth/system-status', async (_req: Request, res: Response) => {
  const payload = await buildDiagnosticsPayload();
  return res.json(payload);
});

// Admin: Get sanitized mail configuration
app.get('/api/admin/mail-config', requireAdmin, requirePermission('canManageSettings'), (_req: Request, res: Response) => {
  const cfg = getEffectiveMailConfig();
  return res.json({
    smtpHost: cfg.smtpHost || '',
    smtpPort: cfg.smtpPort || 465,
    smtpSecure: Boolean(cfg.smtpSecure),
    smtpUser: cfg.smtpUser || '',
    hasSmtpPass: Boolean(cfg.smtpPass && !isPlaceholderValue(cfg.smtpPass)),
    smtpFrom: cfg.smtpFrom || '',
    hasResendKey: Boolean(cfg.resendApiKey && cfg.resendApiKey.startsWith('re_')),
    supabaseUrl: cfg.supabaseUrl || '',
    hasSupabaseKey: Boolean(cfg.supabaseAnonKey && !isPlaceholderValue(cfg.supabaseAnonKey)),
  });
});

// Admin: Save and immediately verify SMTP / Resend / Supabase mail configuration
app.post('/api/admin/mail-config', requireAdmin, requirePermission('canManageSettings'), async (req: Request, res: Response) => {
  try {
    const existing = readSavedMailConfig();
    const {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFrom,
      resendApiKey,
      supabaseUrl,
      supabaseAnonKey,
    } = req.body || {};

    const cleanHost = (smtpHost ?? existing.smtpHost ?? '').toString().trim();
    const cleanPort = smtpPort !== undefined && smtpPort !== '' ? Number(smtpPort) : (existing.smtpPort ?? 465);
    const cleanUser = (smtpUser ?? existing.smtpUser ?? '').toString().trim();
    const rawPass = smtpPass && smtpPass.toString().trim() !== ''
      ? smtpPass.toString().trim()
      : (existing.smtpPass || '');
    const cleanPass = normalizeSmtpPass(cleanHost, rawPass);
    const cleanFrom = (smtpFrom ?? existing.smtpFrom ?? '').toString().trim();
    const cleanResendKey = resendApiKey && resendApiKey.toString().trim() !== ''
      ? resendApiKey.toString().trim()
      : (existing.resendApiKey || (process.env.RESEND_API_KEY || '').trim());
    const cleanSupabaseUrl = (supabaseUrl ?? existing.supabaseUrl ?? '').toString().trim();
    const cleanSupabaseKey = supabaseAnonKey && supabaseAnonKey.toString().trim() !== ''
      ? supabaseAnonKey.toString().trim()
      : (existing.supabaseAnonKey || '');

    if (cleanHost && cleanUser && !isValidSmtpHost(cleanHost)) {
      return res.status(400).json({
        error: `عنوان خادم البريد غير صالح: "${cleanHost}" (مثال: smtp.gmail.com)`,
      });
    }

    if (cleanHost && cleanUser && !isValidSmtpPort(cleanPort)) {
      return res.status(400).json({
        error: `رقم المنفذ غير صالح: ${cleanPort} (يجب أن يكون بين 1 و 65535 مثل 465 أو 587)`,
      });
    }

    if (cleanResendKey && !cleanResendKey.startsWith('re_')) {
      return res.status(400).json({
        error: 'مفتاح Resend API غير صالح: يجب أن يبدأ بـ re_',
      });
    }

    if (cleanSupabaseUrl && !isValidHttpUrl(cleanSupabaseUrl)) {
      return res.status(400).json({
        error: 'رابط Supabase غير صالح: يجب أن يبدأ بـ https:// مثل https://your-project.supabase.co',
      });
    }

    const effectiveSecure = cleanPort === 465 ? true : cleanPort === 587 ? false : Boolean(smtpSecure);

    const newConfig: RuntimeMailConfig = {
      smtpHost: cleanUser ? cleanHost : '',
      smtpPort: cleanPort,
      smtpSecure: effectiveSecure,
      smtpUser: cleanUser,
      smtpPass: cleanUser ? cleanPass : '',
      smtpFrom: cleanFrom || (cleanUser ? `"GoldenFlix" <${cleanUser}>` : ''),
      resendApiKey: cleanResendKey,
      supabaseUrl: cleanSupabaseUrl,
      supabaseAnonKey: cleanSupabaseKey,
    };

    writeSavedMailConfig(newConfig);
    await reloadMailProviders();
    const diagnostics = await buildDiagnosticsPayload();

    if (cleanUser && cleanHost && !diagnostics.smtp.verified) {
      return res.status(400).json({
        success: false,
        error: diagnostics.smtp.error || 'تم حفظ البيانات ولكن تعذر الاتصال بخادم SMTP، تأكد من البريد وكلمة مرور التطبيقات.',
        diagnostics,
      });
    }

    if (!diagnostics.realDeliveryReady) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال بيانات صالحة لأحد مزودي الإرسال (SMTP مع كلمة مرور التطبيقات، أو مفتاح Resend، أو Supabase).',
        diagnostics,
      });
    }

    return res.json({
      success: true,
      message: 'تم حفظ الإعدادات والتحقق من جاهزية إرسال البريد بنجاح!',
      diagnostics,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'حدث خطأ أثناء حفظ إعدادات البريد',
    });
  }
});

// Admin: Reset custom runtime mail config
app.delete('/api/admin/mail-config', requireAdmin, requirePermission('canManageSettings'), async (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(MAIL_CONFIG_FILE)) {
      fs.unlinkSync(MAIL_CONFIG_FILE);
    }
    await reloadMailProviders();
    const diagnostics = await buildDiagnosticsPayload();
    return res.json({ success: true, diagnostics });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'تعذر إعادة ضبط الإعدادات' });
  }
});

// Admin: Test sending real clickable verification link email
app.post('/api/admin/test-email', requireAdmin, requirePermission('canManageSettings'), async (req: Request, res: Response) => {
  const { testEmail } = req.body;
  if (!testEmail) {
    return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني للاختبار' });
  }
  try {
    const baseUrl = getRequestBaseUrl(req);
    const testLink = `${baseUrl}/?email_test=ok`;
    const result = await sendVerificationLinkEmail(
      testEmail,
      testLink,
      'مشرف المنصة',
      baseUrl,
      'اختبار رابط الدخول المباشر'
    );
    return res.json({
      success: true,
      message: `تم تسليم رسالة الاختبار (تحتوي على رابط مباشر) بنجاح إلى ${testEmail}`,
      provider: result.provider,
    });
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      error: err.message,
    });
  }
});

// --- MULTER FILE UPLOAD STORAGE CONFIG ---
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const safeName = `video-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const posterStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, POSTERS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = `poster-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // up to 4GB
});

const uploadPoster = multer({
  storage: posterStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // up to 25MB
});

// --- HIGH-SPEED PARALLEL CHUNKED BINARY UPLOAD SESSION STORE ---
interface ChunkUploadSession {
  id: string;
  filePath: string;
  fileName: string;
  originalName: string;
  totalSize: number;
  createdAt: number;
}
const activeChunkUploads = new Map<string, ChunkUploadSession>();

// Periodically clean up abandoned chunk sessions older than 6 hours
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [id, session] of activeChunkUploads.entries()) {
    if (session.createdAt < cutoff) {
      activeChunkUploads.delete(id);
      if (fs.existsSync(session.filePath)) {
        try {
          fs.unlinkSync(session.filePath);
        } catch {
          // ignore cleanup failure
        }
      }
    }
  }
}, 30 * 60 * 1000).unref();

// 1. Initialize parallel chunked upload (pre-creates destination video file directly on disk)
app.post('/api/admin/upload-video/init', requireAdmin, requirePermission('canUpload'), (req: Request, res: Response) => {
  try {
    const { fileName, fileSize } = req.body || {};
    const rawName = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'movie.mp4';
    const totalSize = Number(fileSize) || 0;
    if (totalSize <= 0 || totalSize > 4 * 1024 * 1024 * 1024) {
      return res.status(400).json({ error: 'حجم الملف غير صالح أو يتجاوز الحد الأقصى (4GB)' });
    }

    const ext = path.extname(rawName).toLowerCase() || '.mp4';
    const safeFileName = `video-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.resolve(VIDEOS_DIR, safeFileName);
    const uploadId = crypto.randomBytes(12).toString('hex');

    fs.writeFileSync(filePath, Buffer.alloc(0));

    activeChunkUploads.set(uploadId, {
      id: uploadId,
      filePath,
      fileName: safeFileName,
      originalName: rawName,
      totalSize,
      createdAt: Date.now(),
    });

    return res.json({
      success: true,
      uploadId,
      fileName: safeFileName,
    });
  } catch (err: any) {
    console.error('Chunk upload init error:', err);
    return res.status(500).json({ error: err.message || 'تعذر بدء جلسة الرفع السريع' });
  }
});

// 2. Write raw binary chunk directly at exact byte offset (zero multipart overhead, supports parallel chunks)
app.post(
  '/api/admin/upload-video/chunk',
  requireAdmin,
  requirePermission('canUpload'),
  express.raw({ type: 'application/octet-stream', limit: '16mb' }),
  async (req: Request, res: Response) => {
    const uploadId = (req.headers['x-upload-id'] || '').toString().trim();
    const offsetRaw = Number(req.headers['x-chunk-offset']);

    if (!uploadId || !Number.isFinite(offsetRaw) || offsetRaw < 0) {
      return res.status(400).json({ error: 'بيانات الجزء (Chunk) غير مكتملة' });
    }

    const session = activeChunkUploads.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'جلسة الرفع غير موجودة أو منتهية' });
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'بيانات الفيديو الثنائية غير صالحة' });
    }

    try {
      const fh = await fs.promises.open(session.filePath, 'r+');
      try {
        await fh.write(req.body, 0, req.body.length, offsetRaw);
      } finally {
        await fh.close();
      }
      return res.json({
        success: true,
        written: req.body.length,
        offset: offsetRaw,
      });
    } catch (err: any) {
      console.error('Chunk write error:', err);
      return res.status(500).json({ error: err.message || 'فشل كتابة جزء الفيديو على الخادم' });
    }
  }
);

// 3. Complete parallel chunked upload instantaneously (zero file copy/merge delay)
app.post('/api/admin/upload-video/complete', requireAdmin, requirePermission('canUpload'), (req: Request, res: Response) => {
  try {
    const uploadId = (req.body?.uploadId || '').toString().trim();
    const session = activeChunkUploads.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'جلسة الرفع غير موجودة' });
    }

    activeChunkUploads.delete(uploadId);
    if (!fs.existsSync(session.filePath)) {
      return res.status(404).json({ error: 'ملف الفيديو المرفوع غير موجود على الخادم' });
    }

    const stat = fs.statSync(session.filePath);
    // Start generating multi-quality variants & HLS streams in background without delaying response
    void ensureMediaRenditions(session.fileName);

    return res.json({
      success: true,
      videoUrl: `/uploads/videos/${session.fileName}`,
      fileName: session.fileName,
      originalName: session.originalName,
      fileSizeBytes: stat.size,
    });
  } catch (err: any) {
    console.error('Chunk upload complete error:', err);
    return res.status(500).json({ error: err.message || 'فشل إنهاء رفع الفيديو' });
  }
});

// 4. Abort & clean up partial file when user cancels upload
app.post('/api/admin/upload-video/abort', requireAdmin, requirePermission('canUpload'), (req: Request, res: Response) => {
  const uploadId = (req.body?.uploadId || '').toString().trim();
  const session = activeChunkUploads.get(uploadId);
  if (session) {
    activeChunkUploads.delete(uploadId);
    if (fs.existsSync(session.filePath)) {
      try {
        fs.unlinkSync(session.filePath);
      } catch {
        // ignore
      }
    }
  }
  return res.json({ success: true });
});

// Legacy single-request video upload endpoint (kept for small files & compatibility)
app.post('/api/admin/upload-video', requireAdmin, requirePermission('canUpload'), (req: Request, res: Response) => {
  uploadVideo.single('video')(req, res, (err: any) => {
    if (err) {
      console.error('Multer video upload error:', err);
      const isSizeLimit = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        error: isSizeLimit
          ? 'حجم ملف الفيديو يتجاوز الحد الأقصى المسموح به'
          : (err.message || 'فشل معالجة ملف الفيديو'),
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم استلام أي ملف فيديو' });
    }
    const videoUrl = `/uploads/videos/${req.file.filename}`;
    void ensureMediaRenditions(req.file.filename);
    return res.json({
      success: true,
      videoUrl,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileSizeBytes: req.file.size,
    });
  });
});

// Poster image upload endpoint with explicit Multer error catching
app.post('/api/admin/upload-poster', requireAdmin, requireAnyPermission('canUpload', 'canEditMedia'), (req: Request, res: Response) => {
  uploadPoster.single('poster')(req, res, (err: any) => {
    if (err) {
      console.error('Multer poster upload error:', err);
      const isSizeLimit = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        error: isSizeLimit
          ? 'حجم صورة البوستر يتجاوز الحد الأقصى المسموح به'
          : (err.message || 'فشل معالجة صورة البوستر'),
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم استلام أي صورة بوستر' });
    }
    const posterUrl = `/uploads/posters/${req.file.filename}`;
    return res.json({
      success: true,
      posterUrl,
      fileName: req.file.filename,
    });
  });
});

// --- REAL FFMPEG MULTI-QUALITY MP4 & ADAPTIVE HLS ENGINE ---
const TARGET_RENDITION_HEIGHTS = [100, 144, 240, 360, 480, 720, 1080] as const;

interface RenditionJobState {
  filename: string;
  baseName: string;
  valid: boolean;
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourceBitrate: number | null;
  processing: boolean;
  hlsReady: boolean;
  readyHeights: number[];
  processingHeights: number[];
  activePromise?: Promise<void>;
}

const renditionJobs = new Map<string, RenditionJobState>();

const formatHeightDisplay = (height: number | null): string => {
  if (!height || height <= 0) return 'الجودة الأصلية';
  if (height >= 2160) return '2160p 4K';
  if (height >= 1440) return '1440p';
  return `${height}p`;
};

const runFfmpeg = (args: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-300)}`));
      }
    });
  });
};

const probeVideoMetadata = async (
  filePath: string
): Promise<{ valid: boolean; width: number | null; height: number | null; bitrate: number | null }> => {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,bit_rate',
        '-show_entries',
        'format=bit_rate',
        '-of',
        'json',
        filePath,
      ],
      { timeout: 10000 }
    );
    const parsed = JSON.parse(stdout || '{}');
    const stream = Array.isArray(parsed.streams) ? parsed.streams[0] : null;
    const width = Number(stream?.width) || null;
    const height = Number(stream?.height) || null;
    const bitrate = Number(stream?.bit_rate || parsed?.format?.bit_rate) || null;
    if (!height || height <= 0) {
      return { valid: false, width: null, height: null, bitrate: null };
    }
    return { valid: true, width, height, bitrate };
  } catch {
    return { valid: false, width: null, height: null, bitrate: null };
  }
};

const writeMasterHlsPlaylist = (
  hlsTargetDir: string,
  sourceWidth: number | null,
  sourceHeight: number,
  sourceBitrate: number | null,
  readyHeights: number[]
) => {
  const aspectRatio = sourceWidth && sourceHeight ? sourceWidth / sourceHeight : 16 / 9;
  const estimateWidth = (h: number) => {
    const raw = Math.round(h * aspectRatio);
    return raw % 2 === 0 ? raw : raw + 1;
  };
  const bitrateForHeight = (h: number) => {
    if (h >= 2160) return 12000000;
    if (h >= 1440) return 8000000;
    if (h >= 1080) return 4800000;
    if (h >= 720) return 2600000;
    if (h >= 480) return 1300000;
    if (h >= 360) return 750000;
    if (h >= 240) return 420000;
    if (h >= 144) return 220000;
    return 140000;
  };

  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:3'];

  const origPl = path.resolve(hlsTargetDir, 'orig.m3u8');
  if (fs.existsSync(origPl)) {
    const bw = sourceBitrate && sourceBitrate > 100000 ? Math.round(sourceBitrate) : bitrateForHeight(sourceHeight);
    const w = sourceWidth || estimateWidth(sourceHeight);
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${w}x${sourceHeight},NAME="${sourceHeight}p"`);
    lines.push('orig.m3u8');
  }

  const sortedHeights = [...readyHeights].sort((a, b) => b - a);
  for (const h of sortedHeights) {
    const plName = `${h}p.m3u8`;
    if (fs.existsSync(path.resolve(hlsTargetDir, plName))) {
      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bitrateForHeight(h)},RESOLUTION=${estimateWidth(h)}x${h},NAME="${h}p"`
      );
      lines.push(plName);
    }
  }

  fs.writeFileSync(path.resolve(hlsTargetDir, 'master.m3u8'), `${lines.join('\n')}\n`, 'utf8');
};

const ensureMediaRenditions = async (filename: string): Promise<RenditionJobState> => {
  const safeFilename = path.basename(filename);
  const filePath = path.resolve(VIDEOS_DIR, safeFilename);
  const baseName = getVideoBaseName(safeFilename);

  const existing = renditionJobs.get(safeFilename);
  if (existing && (existing.activePromise || !existing.processing)) {
    if (existing.activePromise || existing.valid === false || existing.processing === false) {
      // Double check if original file was replaced
      if (fs.existsSync(filePath)) {
        return existing;
      }
    }
  }

  if (!fs.existsSync(filePath) || !baseName) {
    const emptyState: RenditionJobState = {
      filename: safeFilename,
      baseName,
      valid: false,
      sourceWidth: null,
      sourceHeight: null,
      sourceBitrate: null,
      processing: false,
      hlsReady: false,
      readyHeights: [],
      processingHeights: [],
    };
    return emptyState;
  }

  const probe = await probeVideoMetadata(filePath);
  if (!probe.valid || !probe.height) {
    const invalidState: RenditionJobState = {
      filename: safeFilename,
      baseName,
      valid: false,
      sourceWidth: null,
      sourceHeight: null,
      sourceBitrate: null,
      processing: false,
      hlsReady: false,
      readyHeights: [],
      processingHeights: [],
    };
    renditionJobs.set(safeFilename, invalidState);
    return invalidState;
  }

  const sourceHeight = probe.height;
  const hlsTargetDir = path.resolve(HLS_DIR, baseName);
  const variantsTargetDir = path.resolve(VARIANTS_DIR, baseName);
  fs.mkdirSync(hlsTargetDir, { recursive: true });
  fs.mkdirSync(variantsTargetDir, { recursive: true });

  const lowerHeights = TARGET_RENDITION_HEIGHTS.filter((h) => h < sourceHeight);
  const alreadyReadyHeights = lowerHeights.filter((h) => {
    const mp4File = path.resolve(variantsTargetDir, `${h}p.mp4`);
    const hlsPl = path.resolve(hlsTargetDir, `${h}p.m3u8`);
    return fs.existsSync(mp4File) && fs.statSync(mp4File).size > 0 && fs.existsSync(hlsPl);
  });
  const missingHeights = lowerHeights.filter((h) => !alreadyReadyHeights.includes(h));
  const masterExists = fs.existsSync(path.resolve(hlsTargetDir, 'master.m3u8')) &&
    fs.existsSync(path.resolve(hlsTargetDir, 'orig.m3u8'));

  if (masterExists && missingHeights.length === 0) {
    const completedState: RenditionJobState = {
      filename: safeFilename,
      baseName,
      valid: true,
      sourceWidth: probe.width,
      sourceHeight,
      sourceBitrate: probe.bitrate,
      processing: false,
      hlsReady: true,
      readyHeights: alreadyReadyHeights,
      processingHeights: [],
    };
    renditionJobs.set(safeFilename, completedState);
    return completedState;
  }

  const state: RenditionJobState = {
    filename: safeFilename,
    baseName,
    valid: true,
    sourceWidth: probe.width,
    sourceHeight,
    sourceBitrate: probe.bitrate,
    processing: true,
    hlsReady: masterExists,
    readyHeights: [...alreadyReadyHeights],
    processingHeights: [...missingHeights],
  };

  state.activePromise = (async () => {
    try {
      // 1. Generate fast Original HLS stream first (-c copy if compatible, fallback transcode)
      const origPlaylist = path.resolve(hlsTargetDir, 'orig.m3u8');
      if (!fs.existsSync(origPlaylist)) {
        try {
          await runFfmpeg([
            '-y',
            '-i',
            filePath,
            '-c',
            'copy',
            '-hls_time',
            '4',
            '-hls_playlist_type',
            'vod',
            '-hls_segment_filename',
            path.resolve(hlsTargetDir, 'orig_%03d.ts'),
            origPlaylist,
          ]);
        } catch {
          await runFfmpeg([
            '-y',
            '-i',
            filePath,
            '-map',
            '0:v:0',
            '-map',
            '0:a?',
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-hls_time',
            '4',
            '-hls_playlist_type',
            'vod',
            '-hls_segment_filename',
            path.resolve(hlsTargetDir, 'orig_%03d.ts'),
            origPlaylist,
          ]);
        }
      }

      if (!fs.existsSync(filePath)) return; // deleted mid-job
      writeMasterHlsPlaylist(hlsTargetDir, probe.width, sourceHeight, probe.bitrate, state.readyHeights);
      state.hlsReady = true;

      // 2. Encode each lower MP4 quality + its HLS rendition sequentially
      for (const h of missingHeights) {
        if (!fs.existsSync(filePath)) return; // stop immediately if deleted

        const mp4Out = path.resolve(variantsTargetDir, `${h}p.mp4`);
        const mp4Tmp = path.resolve(variantsTargetDir, `${h}p.tmp.mp4`);
        const hlsOut = path.resolve(hlsTargetDir, `${h}p.m3u8`);

        if (!fs.existsSync(mp4Out) || fs.statSync(mp4Out).size === 0) {
          await runFfmpeg([
            '-y',
            '-i',
            filePath,
            '-map',
            '0:v:0',
            '-map',
            '0:a?',
            '-vf',
            `scale=-2:${h}`,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-crf',
            '25',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            mp4Tmp,
          ]);

          if (!fs.existsSync(filePath)) {
            if (fs.existsSync(mp4Tmp)) fs.unlinkSync(mp4Tmp);
            return;
          }
          fs.renameSync(mp4Tmp, mp4Out);
        }

        if (!fs.existsSync(hlsOut)) {
          await runFfmpeg([
            '-y',
            '-i',
            mp4Out,
            '-c',
            'copy',
            '-hls_time',
            '4',
            '-hls_playlist_type',
            'vod',
            '-hls_segment_filename',
            path.resolve(hlsTargetDir, `${h}p_%03d.ts`),
            hlsOut,
          ]);
        }

        if (!fs.existsSync(filePath)) return;
        if (!state.readyHeights.includes(h)) {
          state.readyHeights = [...state.readyHeights, h].sort((a, b) => b - a);
        }
        state.processingHeights = state.processingHeights.filter((x) => x !== h);
        writeMasterHlsPlaylist(hlsTargetDir, probe.width, sourceHeight, probe.bitrate, state.readyHeights);
      }
    } catch (err) {
      console.warn(`Rendition pipeline note for ${safeFilename}:`, (err as Error).message);
    } finally {
      state.processing = false;
      state.processingHeights = [];
      state.activePromise = undefined;
    }
  })();

  renditionJobs.set(safeFilename, state);
  return state;
};

// Public stream inspector endpoint returning real Server engines + Qualities
app.get('/api/videos/:filename/streams', async (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename || '');
  const filePath = path.resolve(VIDEOS_DIR, filename);

  if (!filename || !fs.existsSync(filePath)) {
    return res.json({
      exists: false,
      valid: false,
      sourceHeight: null,
      processing: false,
      hlsMasterUrl: null,
      qualities: [],
      servers: [],
    });
  }

  try {
    const state = await ensureMediaRenditions(filename);
    const baseUrl = `/uploads/videos/${filename}`;
    const hlsMasterUrl = state.hlsReady && state.baseName
      ? `/uploads/hls/${state.baseName}/master.m3u8`
      : null;

    const qualities: Array<{
      id: string;
      height: number | null;
      label: string;
      url?: string;
      status: 'ready' | 'processing';
      isOriginal?: boolean;
    }> = [];

    if (state.valid && state.sourceHeight) {
      const lowerHeights = TARGET_RENDITION_HEIGHTS.filter((h) => h < state.sourceHeight!);
      for (const h of lowerHeights) {
        const isReady = state.readyHeights.includes(h);
        qualities.push({
          id: `mp4-${h}`,
          height: h,
          label: `${h}p`,
          url: isReady ? `/uploads/variants/${state.baseName}/${h}p.mp4` : undefined,
          status: isReady ? 'ready' : 'processing',
        });
      }

      qualities.push({
        id: `mp4-${state.sourceHeight}`,
        height: state.sourceHeight,
        label: formatHeightDisplay(state.sourceHeight),
        url: baseUrl,
        status: 'ready',
        isOriginal: true,
      });
    } else {
      qualities.push({
        id: 'mp4-original',
        height: null,
        label: 'الجودة الأصلية',
        url: baseUrl,
        status: 'ready',
        isOriginal: true,
      });
    }

    const servers: Array<{
      id: string;
      label: string;
      shortLabel: string;
      url: string;
      format: 'mp4' | 'hls';
      isDefault: boolean;
    }> = [
      {
        id: 'server-gr',
        label: 'مشغل GR • سيرفر الموقع الرئيسي (MP4 مباشر)',
        shortLabel: 'مشغل GR',
        url: baseUrl,
        format: 'mp4',
        isDefault: true,
      },
    ];

    if (hlsMasterUrl) {
      servers.push({
        id: 'server-g',
        label: 'مشغل G • البث التكيفي السريع (HLS)',
        shortLabel: 'مشغل G',
        url: hlsMasterUrl,
        format: 'hls',
        isDefault: false,
      });
    }

    return res.json({
      exists: true,
      valid: state.valid,
      sourceHeight: state.sourceHeight,
      processing: state.processing,
      hlsMasterUrl,
      qualities,
      servers,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'تعذر قراءة بيانات الجودات' });
  }
});

// Resolve real alternative non-YouTube sources stored across local uploads or media sources
app.get('/api/stream/resolve', (req: Request, res: Response) => {
  const mediaId = String(req.query.mediaId || '').trim();
  const episodeId = String(req.query.episodeId || '').trim();
  const rawUrl = String(req.query.url || '').trim();
  const videoId = extractServerYouTubeId(rawUrl || String(req.query.v || '').trim());

  const movies = readMovies();
  const nonYtCandidates: Array<{ label: string; url: string; format: string }> = [];

  const collectSources = (sources: any[], fallbackUrl?: string) => {
    if (fallbackUrl && !extractServerYouTubeId(fallbackUrl)) {
      nonYtCandidates.push({
        label: 'مشغل GR',
        url: fallbackUrl,
        format: fallbackUrl.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4',
      });
    }
    if (Array.isArray(sources)) {
      for (const s of sources) {
        if (s?.url && !extractServerYouTubeId(s.url) && s.format !== 'youtube') {
          nonYtCandidates.push({
            label: s.label || 'مشغل GR',
            url: s.url,
            format: s.format || (s.url.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4'),
          });
        }
      }
    }
  };

  for (const m of movies) {
    if (mediaId && m.id !== mediaId) continue;
    if (episodeId && Array.isArray(m.seasons)) {
      for (const sn of m.seasons) {
        const ep = (sn.episodes || []).find((e: any) => e.id === episodeId);
        if (ep) {
          collectSources(ep.sources || [], ep.videoUrl);
        }
      }
    }
    if (!episodeId) {
      collectSources(m.sources || [], m.videoUrl);
    }
  }

  return res.json({
    videoId: videoId || null,
    alternatives: nonYtCandidates,
  });
});

// --- UNIVERSAL EXTERNAL VIDEO EXTRACTOR & FORCED-PLAYBACK PROXY ENGINE ---

const PROXY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function rewriteHlsPlaylistUrls(playlistText: string, baseManifestUrl: string, referer?: string): string {
  const rewriteUri = (rawUri: string): string => {
    const trimmed = rawUri.trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('/api/stream/proxy')) {
      return trimmed;
    }
    try {
      const abs = new URL(trimmed, baseManifestUrl).href;
      assertSafePublicHttpUrl(abs);
      return buildStreamProxyUrl(abs, referer || baseManifestUrl);
    } catch {
      return trimmed;
    }
  };

  return playlistText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // Rewrite URI="..." attributes inside #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, etc.
        return line.replace(/URI=(["'])([^"']+)\1/gi, (_m, q, uri) => `URI=${q}${rewriteUri(uri)}${q}`);
      }
      return rewriteUri(trimmed);
    })
    .join('\n');
}

app.get('/api/stream/extract', async (req: Request, res: Response) => {
  const rawUrl = String(req.query.url || '').trim();
  const referer = String(req.query.referer || '').trim() || undefined;
  const fresh = req.query.fresh === '1' || req.query.fresh === 'true';

  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'يرجى تمرير رابط الفيديو في معلمة url' });
  }

  try {
    const result = await extractUniversalVideoStreams(rawUrl, { referer, forceFresh: fresh });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      inputUrl: rawUrl,
      finalUrl: rawUrl,
      kind: 'unresolved',
      streams: [],
      error: err?.message || 'تعذر معالجة الرابط الخارجي',
    });
  }
});

app.post('/api/stream/extract', async (req: Request, res: Response) => {
  const rawUrl = String(req.body?.url || '').trim();
  const referer = String(req.body?.referer || '').trim() || undefined;
  const fresh = Boolean(req.body?.fresh);

  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'يرجى تمرير رابط الفيديو' });
  }

  try {
    const result = await extractUniversalVideoStreams(rawUrl, { referer, forceFresh: fresh });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      inputUrl: rawUrl,
      finalUrl: rawUrl,
      kind: 'unresolved',
      streams: [],
      error: err?.message || 'تعذر معالجة الرابط الخارجي',
    });
  }
});

const handleStreamProxy = async (req: Request, res: Response) => {
  const rawUrl = String(req.query.url || '').trim();
  const rawReferer = String(req.query.referer || '').trim();

  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let targetUrl: URL;
  try {
    targetUrl = assertSafePublicHttpUrl(rawUrl);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Invalid target URL' });
  }

  const buildUpstreamHeaders = (mode: 'with_referer' | 'bare' | 'with_origin'): Record<string, string> => {
    const headers: Record<string, string> = {
      'User-Agent': PROXY_USER_AGENT,
      Accept: '*/*',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
    };
    if (req.headers.range) {
      headers['Range'] = String(req.headers.range);
    }
    if (mode === 'with_referer' && rawReferer) {
      try {
        const refUrl = new URL(rawReferer);
        headers['Referer'] = refUrl.href;
      } catch {
        headers['Referer'] = `${targetUrl.origin}/`;
      }
    } else if (mode === 'with_origin') {
      headers['Referer'] = `${targetUrl.origin}/`;
      headers['Origin'] = targetUrl.origin;
    }
    return headers;
  };

  const controller = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  try {
    const fetchMethod = req.method === 'HEAD' ? 'HEAD' : 'GET';
    const initialMode: 'with_referer' | 'bare' = rawReferer ? 'with_referer' : 'bare';
    let upstreamRes = await fetch(targetUrl.href, {
      method: fetchMethod,
      headers: buildUpstreamHeaders(initialMode),
      redirect: 'follow',
      signal: controller.signal,
    });

    if (upstreamRes.status === 403 || upstreamRes.status === 401) {
      await upstreamRes.body?.cancel().catch(() => {});
      const fallbackModes: Array<'bare' | 'with_origin'> =
        initialMode === 'with_referer' ? ['bare', 'with_origin'] : ['with_origin'];
      for (const fallbackMode of fallbackModes) {
        const retryRes = await fetch(targetUrl.href, {
          method: fetchMethod,
          headers: buildUpstreamHeaders(fallbackMode),
          redirect: 'follow',
          signal: controller.signal,
        });
        upstreamRes = retryRes;
        if (retryRes.status < 400) break;
        if (fallbackMode !== fallbackModes[fallbackModes.length - 1]) {
          await retryRes.body?.cancel().catch(() => {});
        }
      }
    }

    const finalUpstreamUrl = upstreamRes.url || targetUrl.href;
    const rawContentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const detectedFmt = detectStreamFormatFromUrlOrType(finalUpstreamUrl, rawContentType);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

    if (upstreamRes.status >= 400) {
      try {
        await upstreamRes.body?.cancel();
      } catch {
        // ignore
      }
      return res.status(upstreamRes.status).send(`Upstream returned HTTP ${upstreamRes.status}`);
    }

    // Rewrite HLS .m3u8 manifests so segments & encryption keys also route cleanly through CORS-safe proxy
    if (
      req.method !== 'HEAD' &&
      (detectedFmt === 'hls' || rawContentType.toLowerCase().includes('mpegurl'))
    ) {
      const manifestText = await upstreamRes.text();
      if (manifestText.trimStart().startsWith('#EXTM3U')) {
        const rewritten = rewriteHlsPlaylistUrls(
          manifestText,
          finalUpstreamUrl,
          rawReferer || finalUpstreamUrl
        );
        res.status(200);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(rewritten);
      }
      // Rare false positive (actually non-M3U8 text); send as-is
      res.status(upstreamRes.status);
      res.setHeader('Content-Type', rawContentType);
      return res.send(manifestText);
    }

    const forwardHeaderNames = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ];
    for (const hName of forwardHeaderNames) {
      const val = upstreamRes.headers.get(hName);
      if (val) {
        res.setHeader(hName, val);
      }
    }
    if (!upstreamRes.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.socket?.setNoDelay(true);
    res.status(upstreamRes.status);

    if (req.method === 'HEAD' || !upstreamRes.body) {
      return res.end();
    }

    const nodeStream = Readable.fromWeb(upstreamRes.body as unknown as import('stream/web').ReadableStream);
    nodeStream.on('error', () => {
      if (!res.writableEnded) res.end();
    });
    res.on('close', () => {
      if (!nodeStream.destroyed) nodeStream.destroy();
    });
    nodeStream.pipe(res);
  } catch (err: any) {
    if (controller.signal.aborted || err?.name === 'AbortError') {
      return;
    }
    if (!res.headersSent) {
      return res.status(502).json({ error: err?.message || 'Proxy stream failed' });
    }
  }
};

app.options('/api/stream/proxy', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  return res.status(204).end();
});
app.head('/api/stream/proxy', handleStreamProxy);
app.get('/api/stream/proxy', handleStreamProxy);

// Header-stripped iframe fallback proxy (prevents "refused to connect" X-Frame-Options / CSP frame-ancestors blocks)
app.get('/api/stream/embed-proxy', async (req: Request, res: Response) => {
  const rawUrl = String(req.query.url || '').trim();
  const rawReferer = String(req.query.referer || '').trim();
  if (!rawUrl) {
    return res.status(400).send('Missing url');
  }

  let targetUrl: URL;
  try {
    targetUrl = assertSafePublicHttpUrl(rawUrl);
  } catch (err: any) {
    return res.status(400).send(err?.message || 'Invalid URL');
  }

  const MOBILE_SAFARI_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

  const buildEmbedHeaders = (mode: 'with_referer' | 'bare' | 'mobile_ua'): Record<string, string> => {
    const headers: Record<string, string> = {
      'User-Agent': mode === 'mobile_ua' ? MOBILE_SAFARI_UA : PROXY_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': mode === 'with_referer' ? 'cross-site' : 'none',
    };
    if (mode === 'with_referer') {
      headers['Referer'] = rawReferer || `${targetUrl.origin}/`;
    }
    return headers;
  };

  try {
    const modes: Array<'with_referer' | 'bare' | 'mobile_ua'> = rawReferer
      ? ['with_referer', 'bare', 'mobile_ua']
      : ['bare', 'with_referer', 'mobile_ua'];

    let upstreamRes: globalThis.Response | null = null;
    for (const mode of modes) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 11000);
      try {
        const candidateRes = await fetch(targetUrl.href, {
          method: 'GET',
          headers: buildEmbedHeaders(mode),
          redirect: 'follow',
          signal: controller.signal,
        });
        upstreamRes = candidateRes;
        if (candidateRes.status < 400) {
          break;
        }
        if (mode !== modes[modes.length - 1]) {
          await candidateRes.body?.cancel().catch(() => {});
        }
      } finally {
        clearTimeout(timer);
      }
    }

    if (!upstreamRes) {
      return res.status(502).send('تعذر الاتصال بالمصدر الخارجي');
    }

    const finalUrl = upstreamRes.url || targetUrl.href;
    const ct = upstreamRes.headers.get('content-type') || 'text/html; charset=utf-8';
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (ct.toLowerCase().includes('text/html')) {
      let html = await upstreamRes.text();
      const cfMitigated = (upstreamRes.headers.get('cf-mitigated') || '').toLowerCase();
      const lowerHtml = html.toLowerCase();
      const isCloudflareChallenge =
        cfMitigated.includes('challenge') ||
        ((upstreamRes.status === 403 || upstreamRes.status === 503) &&
          (lowerHtml.includes('challenges.cloudflare.com') ||
            lowerHtml.includes('_cf_chl_opt') ||
            lowerHtml.includes('<title>just a moment...</title>')));

      if (isCloudflareChallenge) {
        const safeHref = finalUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const jsonUrl = JSON.stringify(finalUrl);
        let displayHost = targetUrl.hostname;
        try {
          displayHost = new URL(finalUrl).hostname;
        } catch {
          // keep target hostname
        }

        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Arabic", "Helvetica Neue", system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; background: #09090d; color: #f4f4f5; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center; }
    .card { max-width: 440px; width: 100%; background: rgba(20,20,26,0.96); border: 1px solid rgba(255,255,255,0.1); border-radius: 22px; padding: 26px 22px; box-shadow: 0 24px 60px rgba(0,0,0,0.75); }
    .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 999px; background: rgba(247,198,0,0.14); border: 1px solid rgba(247,198,0,0.35); color: #F7C600; font-size: 11px; font-weight: 700; margin-bottom: 12px; }
    h2 { margin: 0 0 8px; font-size: 17px; font-weight: 800; color: #fff; }
    p { margin: 0 0 18px; font-size: 13px; line-height: 1.65; color: #a1a1aa; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    a.btn, button.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 18px; border-radius: 14px; font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; border: 0; }
    .primary { background: #F7C600; color: #09090d; flex: 1 1 180px; }
    .secondary { background: rgba(255,255,255,0.08); color: #f4f4f5; border: 1px solid rgba(255,255,255,0.12) !important; flex: 0 1 auto; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${displayHost}</div>
    <h2>هذا السيرفر يطلب تحقق أمان مباشر</h2>
    <p>يفرض الخادم الخارجي حماية ضد التضمين المباشر داخل المشغل. يمكنك فتح المشغل الأصلي مباشرة أو اختيار سيرفر آخر من الأعلى.</p>
    <div class="actions">
      <a class="btn primary" href="${safeHref}" target="_blank" rel="noopener noreferrer">فتح المشغل في نافذة جديدة</a>
      <button class="btn secondary" type="button" onclick="window.location.reload()">إعادة المحاولة</button>
    </div>
  </div>
  <script>
    try {
      window.parent && window.parent.postMessage({
        type: 'goldenflix-embed-status',
        status: 'cloudflare-blocked',
        url: ${jsonUrl}
      }, '*');
    } catch (e) {}
  </script>
</body>
</html>`);
      }

      // Strip restrictive CSP meta tags & X-Frame-Options meta tags
      html = html.replace(/<meta[^>]+http-equiv=["']?(?:content-security-policy|x-frame-options)["']?[^>]*>/gi, '');

      // Rewrite nested iframes to stay inside embed-proxy cleanly
      html = html.replace(
        /(<iframe\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
        (full, prefix, quote, srcVal) => {
          const clean = srcVal.trim();
          if (!clean || clean.startsWith('data:') || clean.startsWith('about:') || clean.startsWith('javascript:') || clean.includes('/api/stream/embed-proxy')) {
            return full;
          }
          try {
            const abs = new URL(clean, finalUrl).href;
            assertSafePublicHttpUrl(abs);
            const proxiedSub = `/api/stream/embed-proxy?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(finalUrl)}`;
            return `${prefix}${quote}${proxiedSub}${quote}`;
          } catch {
            return full;
          }
        }
      );

      // Inject <base> + gentle frame-buster protection so embedded video scripts don't navigate away
      const baseTag = `<base href="${finalUrl.replace(/"/g, '&quot;')}">`;
      const frameGuardScript = `<script>(function(){try{if(window.self!==window.top){window.addEventListener('DOMContentLoaded',function(){var v=document.querySelector('video');var s=v&&(v.currentSrc||v.src||(v.querySelector('source')&&v.querySelector('source').src));if(s&&/^https?:\\/\\//.test(s)){window.parent.postMessage({type:'goldenflix-extracted-stream',url:s,referer:${JSON.stringify(finalUrl)}},'*');}});}}catch(e){}})();</script>`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}\n${frameGuardScript}`);
      } else {
        html = `${baseTag}\n${frameGuardScript}\n${html}`;
      }

      res.status(upstreamRes.status < 400 ? upstreamRes.status : 200).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    res.status(upstreamRes.status).setHeader('Content-Type', ct);
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    return res.send(buf);
  } catch (err: any) {
    return res.status(502).send(`تعذر فتح الصفحة المدمجة: ${err?.message || 'Error'}`);
  }
});

// --- ULTRA-FAST HTTP 206 PARTIAL CONTENT RANGE STREAMING FOR VIDEOS (1MB buffer + ETag + Cache) ---
const streamVideoFileWithRange = (req: Request, res: Response, filePath: string, filename: string) => {
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('ملف الفيديو غير موجود');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const etag = `"${fileSize}-${Math.floor(stat.mtimeMs)}"`;

  if (req.headers['if-none-match'] === etag && !range) {
    return res.status(304).end();
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
  };
  const contentType = mimeTypes[ext] || 'video/mp4';

  // Disable Nagle latency so initial playback frames reach client immediately
  res.socket?.setNoDelay(true);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= fileSize || end >= fileSize || end < start) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, {
      start,
      end,
      highWaterMark: 1024 * 1024, // 1MB high-throughput stream buffer
    });

    res.on('close', () => {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
    });
    fileStream.on('error', () => {
      if (!res.writableEnded) res.end();
    });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    });

    fileStream.pipe(res);
  } else {
    const fileStream = fs.createReadStream(filePath, {
      highWaterMark: 1024 * 1024,
    });
    res.on('close', () => {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
    });
    fileStream.on('error', () => {
      if (!res.writableEnded) res.end();
    });

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    });
    fileStream.pipe(res);
  }
};

app.get('/uploads/videos/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.resolve(VIDEOS_DIR, filename);
  return streamVideoFileWithRange(req, res, filePath, filename);
});

app.get('/uploads/variants/:folder/:filename', (req: Request, res: Response) => {
  const folder = path.basename(req.params.folder).replace(/[^a-zA-Z0-9._-]/g, '');
  const filename = path.basename(req.params.filename);
  const filePath = path.resolve(VARIANTS_DIR, folder, filename);
  return streamVideoFileWithRange(req, res, filePath, filename);
});

app.use(
  '/uploads/hls',
  express.static(HLS_DIR, {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (filePath.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// Serve posters statically with long browser cache
app.use('/uploads/posters', express.static(POSTERS_DIR, { maxAge: '7d', etag: true }));

// --- MOVIES CRUD API ---

// Public: GET published movies for visitors
app.get('/api/movies', (_req: Request, res: Response) => {
  const movies = readMovies();
  const deletedSet = new Set(readDeletedMovieIds());
  const published = movies.filter((m) => m.isPublished !== false && !deletedSet.has(m.id));
  return res.json(published);
});

// Public: GET deleted movie IDs (tombstones so deleted items never reappear from cloud/cache)
app.get('/api/movies/deleted-ids', (_req: Request, res: Response) => {
  return res.json(readDeletedMovieIds());
});

// Admin: GET all movies & series (both published and hidden)
app.get('/api/admin/movies', requireAdmin, (_req: Request, res: Response) => {
  const movies = readMovies();
  return res.json(movies);
});

// Admin: POST create new movie or series
app.post('/api/admin/movies', requireAdmin, requireAnyPermission('canUpload', 'canEditMedia'), (req: Request, res: Response) => {
  const {
    id,
    title,
    titleAr,
    originalTitle,
    type,
    description,
    posterUrl,
    bannerUrl,
    videoUrl,
    videoQuality,
    ageRating,
    duration,
    year,
    rating,
    genres,
    isPublished,
    isFeatured,
    isLatest,
    isMostWatched,
    displayOrder,
    director,
    cast,
    seasons,
    sources,
    introStart,
    introEnd,
    subtitleUrl,
    fileSizeBytes,
    storagePath,
    storageType,
    isComingSoon,
  } = req.body;

  const mediaType = type === 'series' || type === 'anime' ? type : 'movie';
  const normalizedSeasons = Array.isArray(seasons) ? seasons : [];
  const firstEpisodeUrl = normalizedSeasons[0]?.episodes?.[0]?.videoUrl || '';
  const effectiveVideoUrl = (videoUrl || firstEpisodeUrl || '').toString().trim();
  const comingSoonFlag = Boolean(isComingSoon) && !effectiveVideoUrl;

  if (!titleAr || (mediaType === 'movie' && !effectiveVideoUrl && !comingSoonFlag)) {
    return res.status(400).json({ error: 'الاسم ورابط/ملف الفيديو مطلوبان للفيلم' });
  }

  const movies = readMovies();
  const now = Date.now();
  const newMovie = {
    id: id || `${mediaType}-${now}-${Math.round(Math.random() * 1e6)}`,
    title: title || titleAr,
    titleAr,
    originalTitle: originalTitle || title || '',
    type: mediaType,
    description: description || '',
    posterUrl: posterUrl || '',
    bannerUrl: bannerUrl || posterUrl || '',
    videoUrl: effectiveVideoUrl,
    videoQuality: videoQuality || '1080p Full HD',
    ageRating: ageRating || '+16',
    duration: duration || (mediaType === 'series' ? 'مسلسل' : '120 دقيقة'),
    year: Number(year) || new Date().getFullYear(),
    rating: Number(rating) || Math.round((6.3 + Math.random() * 3.3) * 10) / 10,
    genres: Array.isArray(genres) && genres.length > 0 ? genres : ['action'],
    isPublished: isPublished !== false,
    isFeatured: Boolean(isFeatured),
    isLatest: isLatest !== false,
    isMostWatched: Boolean(isMostWatched),
    isComingSoon: comingSoonFlag,
    displayOrder: Number(displayOrder) || 0,
    viewsCount: 0,
    director: director || '',
    cast: Array.isArray(cast) ? cast : [],
    seasons: normalizedSeasons,
    sources: Array.isArray(sources) ? sources : [],
    introStart: typeof introStart === 'number' ? introStart : undefined,
    introEnd: typeof introEnd === 'number' ? introEnd : undefined,
    subtitleUrl: subtitleUrl || undefined,
    fileSizeBytes: Number(fileSizeBytes) || 0,
    storagePath: storagePath || '',
    storageType: storageType || 'server',
    createdAt: now,
    updatedAt: now,
  };

  movies.unshift(newMovie);
  writeMovies(movies);
  removeDeletedMovieId(newMovie.id);
  appendAuditLog(
    mediaType === 'series' ? 'إضافة مسلسل جديد' : 'إضافة فيلم جديد',
    mediaType === 'series' ? 'series' : 'media',
    `تمت إضافة "${newMovie.titleAr}" (${newMovie.videoQuality})`,
    getSessionActor(req)
  );

  return res.status(201).json({
    success: true,
    movie: newMovie,
    message: mediaType === 'series' ? 'تم إنشاء المسلسل بنجاح' : 'تمت إضافة الفيلم بنجاح',
  });
});

// Admin: PUT update movie/series (edit metadata, seasons, sources, or toggle flags)
app.put('/api/admin/movies/:id', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const id = req.params.id;
  const movies = readMovies();
  const index = movies.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'العمل غير موجود' });
  }

  const current = movies[index];
  const updated = {
    ...current,
    ...req.body,
    id: current.id,
    updatedAt: Date.now(),
  };

  // Auto-sync main videoUrl if series has episodes and main videoUrl was empty
  if (!updated.videoUrl && Array.isArray(updated.seasons) && updated.seasons[0]?.episodes?.[0]?.videoUrl) {
    updated.videoUrl = updated.seasons[0].episodes[0].videoUrl;
  }

  movies[index] = updated;
  writeMovies(movies);
  appendAuditLog(
    'تحديث عمل',
    updated.type === 'series' ? 'series' : 'media',
    `تم تحديث "${updated.titleAr}"`,
    getSessionActor(req)
  );

  return res.json({
    success: true,
    movie: updated,
    message: 'تم تحديث البيانات بنجاح',
  });
});

// Admin: DELETE movie or series completely across server, files, banners, comments, views & tombstones
app.delete('/api/admin/movies/:id', requireAdmin, requirePermission('canDeleteMedia'), (req: Request, res: Response) => {
  const id = (req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({ error: 'معرف العمل مطلوب' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { deletedTitles } = deleteMoviesAndCleanupSiteWide([
    {
      id,
      titleAr: body.titleAr,
      type: body.type,
      videoUrl: body.videoUrl,
      posterUrl: body.posterUrl,
      bannerUrl: body.bannerUrl,
      sources: body.sources,
      seasons: body.seasons,
    },
  ]);

  appendAuditLog(
    'حذف عمل نهائياً من الموقع بالكامل',
    body.type === 'series' ? 'series' : 'media',
    `تم حذف "${deletedTitles[0] || id}" وجميع ملفاته وآثاره`,
    getSessionActor(req)
  );

  return res.json({
    success: true,
    deletedId: id,
    message: 'تم حذف العمل وملفاته من الموقع بالكامل بنجاح',
  });
});

// Admin: Bulk DELETE multiple movies/series at once across the whole site
app.post('/api/admin/movies/bulk-delete', requireAdmin, requirePermission('canDeleteMedia'), (req: Request, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: 'يرجى تحديد أعمال للحذف' });
  }

  const normalized = items
    .map((item: any) =>
      typeof item === 'string'
        ? { id: item }
        : {
            id: item?.id,
            titleAr: item?.titleAr,
            type: item?.type,
            videoUrl: item?.videoUrl,
            posterUrl: item?.posterUrl,
            bannerUrl: item?.bannerUrl,
            sources: item?.sources,
            seasons: item?.seasons,
          }
    )
    .filter((x: any) => x.id);

  const { deletedIds, deletedTitles } = deleteMoviesAndCleanupSiteWide(normalized);
  appendAuditLog(
    'حذف جماعي للأعمال',
    'media',
    `تم حذف ${deletedIds.length} أعمال نهائياً (${deletedTitles.slice(0, 3).join('، ')})`,
    getSessionActor(req)
  );

  return res.json({
    success: true,
    deletedIds,
    message: `تم حذف ${deletedIds.length} أعمال نهائياً من الموقع بالكامل`,
  });
});

// --- PUBLIC MEDIA VIEWS, COMMENTS, CATEGORIES, NOTIFICATIONS & SITE SETTINGS ---

app.post('/api/media/:id/view', (req: Request, res: Response) => {
  const id = req.params.id;
  const { episodeId, userEmail } = req.body || {};
  const movies = readMovies();
  const idx = movies.findIndex((m) => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'العمل غير موجود' });
  }

  movies[idx].viewsCount = (Number(movies[idx].viewsCount) || 0) + 1;
  writeMovies(movies);

  const views = readJsonFile<any[]>(VIEWS_LOG_FILE, []);
  views.unshift({
    id: `view-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    mediaId: id,
    mediaTitle: movies[idx].titleAr || movies[idx].title,
    mediaType: movies[idx].type || 'movie',
    episodeId: episodeId || undefined,
    userEmail: userEmail || undefined,
    timestamp: Date.now(),
  });
  writeJsonFile(VIEWS_LOG_FILE, views.slice(0, 2000));

  return res.json({ success: true, viewsCount: movies[idx].viewsCount });
});

app.get('/api/media/:id/comments', (req: Request, res: Response) => {
  const comments = readJsonFile<any[]>(COMMENTS_FILE, []);
  const visible = comments.filter((c) => c.mediaId === req.params.id && c.status === 'approved');
  return res.json(visible);
});

app.post('/api/media/:id/comments', (req: Request, res: Response) => {
  const { userName, userEmail, rating, text } = req.body || {};
  if (!text || !text.toString().trim()) {
    return res.status(400).json({ error: 'يرجى كتابة نص التعليق' });
  }
  const movies = readMovies();
  const media = movies.find((m) => m.id === req.params.id);
  const comments = readJsonFile<any[]>(COMMENTS_FILE, []);
  const newComment = {
    id: `cmt-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    mediaId: req.params.id,
    mediaTitle: media?.titleAr || media?.title || 'محتوى المنصة',
    userName: (userName || 'مشاهد').toString().trim(),
    userEmail: userEmail || '',
    rating: Math.max(1, Math.min(10, Number(rating) || 8)),
    text: text.toString().trim().slice(0, 1000),
    status: 'approved',
    createdAt: Date.now(),
  };
  comments.unshift(newComment);
  writeJsonFile(COMMENTS_FILE, comments);
  return res.status(201).json({ success: true, comment: newComment });
});

app.get('/api/categories', (_req: Request, res: Response) => {
  const categories = readJsonFile<any[]>(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  return res.json(categories.filter((c) => c.isVisible !== false).sort((a, b) => (a.order || 0) - (b.order || 0)));
});

app.get('/api/notifications', (_req: Request, res: Response) => {
  const notifications = readJsonFile<any[]>(NOTIFICATIONS_FILE, []);
  return res.json(notifications.filter((n) => n.isActive !== false));
});

app.get('/api/site-settings', (_req: Request, res: Response) => {
  const settings = readJsonFile<any>(SITE_SETTINGS_FILE, DEFAULT_SITE_SETTINGS);
  return res.json({ ...DEFAULT_SITE_SETTINGS, ...settings });
});

const extractServerYouTubeId = (raw?: string): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (
      host !== 'youtu.be' &&
      host !== 'youtube.com' &&
      host !== 'm.youtube.com' &&
      host !== 'music.youtube.com' &&
      host !== 'youtube-nocookie.com' &&
      !host.endsWith('.youtube.com')
    ) {
      return null;
    }
    if (host === 'youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null;
    }
    const v = parsed.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v', 'e'].includes(segments[0])) {
      return /^[a-zA-Z0-9_-]{11}$/.test(segments[1]) ? segments[1] : null;
    }
  } catch {
    return null;
  }
  return null;
};

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();

app.get('/api/youtube-meta', async (req: Request, res: Response) => {
  const rawInput = String(req.query.url || req.query.v || '').trim();
  const videoId = extractServerYouTubeId(rawInput);
  if (!videoId) {
    return res.status(400).json({ error: 'معرف فيديو يوتيوب غير صالح' });
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  let title = '';
  let authorName = '';
  let description = '';
  let keywords: string[] = [];
  let youtubeGenre = '';
  let lengthSeconds: number | undefined;
  let publishYear: number | undefined;
  let thumbnailUrl = fallbackThumb;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);

  try {
    const [oembedRes, watchRes] = await Promise.allSettled([
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`, {
        signal: controller.signal,
      }),
      fetch(`${canonicalUrl}&hl=ar`, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        },
      }),
    ]);

    if (oembedRes.status === 'fulfilled' && oembedRes.value.ok) {
      const oembedJson: any = await oembedRes.value.json().catch(() => null);
      if (oembedJson) {
        title = typeof oembedJson.title === 'string' ? oembedJson.title.trim() : '';
        authorName =
          typeof oembedJson.author_name === 'string' ? oembedJson.author_name.trim() : '';
        if (typeof oembedJson.thumbnail_url === 'string' && oembedJson.thumbnail_url.trim()) {
          thumbnailUrl = oembedJson.thumbnail_url.trim();
        }
      }
    }

    if (watchRes.status === 'fulfilled' && watchRes.value.ok) {
      const html = await watchRes.value.text();

      if (!title) {
        const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
        const docTitle = html.match(/<title>([\s\S]*?)<\/title>/i);
        const rawTitle = ogTitle?.[1] || docTitle?.[1]?.replace(/\s*-\s*YouTube\s*$/i, '') || '';
        title = decodeHtmlEntities(rawTitle);
      }

      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      if (descMatch?.[1]) {
        description = decodeHtmlEntities(descMatch[1]);
      }

      const kwMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
      if (kwMatch?.[1]) {
        keywords = decodeHtmlEntities(kwMatch[1])
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20);
      }

      const genreMatch =
        html.match(/<meta[^>]+itemprop=["']genre["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/"category"\s*:\s*"([^"]+)"/i) ||
        html.match(/"genre"\s*:\s*"([^"]+)"/i);
      if (genreMatch?.[1]) {
        youtubeGenre = decodeHtmlEntities(genreMatch[1]);
      }

      const lenMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
      if (lenMatch?.[1]) {
        const secs = Number(lenMatch[1]);
        if (Number.isFinite(secs) && secs > 0) {
          lengthSeconds = secs;
        }
      }

      const pubMatch = html.match(/"publishDate"\s*:\s*"(\d{4})-\d{2}-\d{2}/);
      if (pubMatch?.[1]) {
        const yr = Number(pubMatch[1]);
        if (Number.isFinite(yr) && yr >= 1980 && yr <= new Date().getFullYear() + 1) {
          publishYear = yr;
        }
      }

      if (!authorName) {
        const channelMatch = html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
        if (channelMatch?.[1]) {
          authorName = decodeHtmlEntities(channelMatch[1]);
        }
      }
    }
  } catch {
    // Return whatever metadata we gathered gracefully
  } finally {
    clearTimeout(timer);
  }

  return res.json({
    videoId,
    title,
    authorName,
    description,
    keywords,
    youtubeGenre,
    lengthSeconds,
    publishYear,
    thumbnailUrl,
    canonicalUrl,
  });
});

// --- ADMIN DASHBOARD REAL ANALYTICS, USERS, LIBRARY, URL TESTER & GOVERNANCE ---

app.get('/api/admin/analytics', requireAdmin, (req: Request, res: Response) => {
  const range = (req.query.range || '30d').toString();
  const daysBack = range === '7d' ? 7 : range === '90d' ? 90 : range === 'all' ? 365 : 30;
  const now = Date.now();
  const rangeStart = range === 'all' ? 0 : now - daysBack * 24 * 60 * 60 * 1000;

  const movies = readMovies();
  const users = readUsers();
  const views = readJsonFile<any[]>(VIEWS_LOG_FILE, []);
  const comments = readJsonFile<any[]>(COMMENTS_FILE, []);
  const logs = readJsonFile<any[]>(AUDIT_LOGS_FILE, []);

  const totalMovies = movies.filter((m) => m.type !== 'series').length;
  const seriesItems = movies.filter((m) => m.type === 'series');
  const totalSeries = seriesItems.length;
  const totalEpisodes = seriesItems.reduce(
    (sum, s) =>
      sum +
      (Array.isArray(s.seasons)
        ? s.seasons.reduce((acc: number, sn: any) => acc + (sn.episodes?.length || 0), 0)
        : 0),
    0
  );

  const viewsInRange = views.filter((v) => (v.timestamp || 0) >= rangeStart);
  const totalViews =
    views.length > 0
      ? views.length
      : movies.reduce((sum, m) => sum + (Number(m.viewsCount) || 0), 0);

  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const dailyViews = views.filter((v) => v.timestamp >= dayAgo).length;
  const weeklyViews = views.filter((v) => v.timestamp >= weekAgo).length;
  const monthlyViews = views.filter((v) => v.timestamp >= monthAgo).length;
  const newUsersInRange = users.filter((u) => (u.joinedAt || 0) >= rangeStart).length;
  const verifiedUsersCount = users.filter((u) => u.emailVerified).length;

  // Build real daily buckets for chart (last 7 or 14 days from actual timestamps)
  const chartDays = range === '7d' ? 7 : 14;
  const chartSeries: { label: string; dateKey: string; views: number; newUsers: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().slice(0, 10);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    const dayViewCount = viewsInRange.filter((v) => new Date(v.timestamp).toISOString().slice(0, 10) === dateKey).length;
    const dayUserCount = users.filter((u) => new Date(u.joinedAt || 0).toISOString().slice(0, 10) === dateKey).length;
    chartSeries.push({ label, dateKey, views: dayViewCount, newUsers: dayUserCount });
  }

  const topMovies = [...movies]
    .filter((m) => m.type !== 'series')
    .sort((a, b) => (Number(b.viewsCount) || 0) - (Number(a.viewsCount) || 0))
    .slice(0, 5);

  const topSeries = [...seriesItems]
    .sort((a, b) => (Number(b.viewsCount) || 0) - (Number(a.viewsCount) || 0))
    .slice(0, 5);

  return res.json({
    totals: {
      movies: totalMovies,
      series: totalSeries,
      episodes: totalEpisodes,
      users: users.length,
      verifiedUsers: verifiedUsersCount,
      newUsersInRange,
      views: totalViews,
      dailyViews,
      weeklyViews,
      monthlyViews,
      comments: comments.length,
    },
    chartSeries,
    latestContent: movies.slice(0, 6),
    topMovies,
    topSeries,
    recentLogs: logs.slice(0, 10),
  });
});

app.get('/api/admin/views', requireAdmin, (_req: Request, res: Response) => {
  const views = readJsonFile<any[]>(VIEWS_LOG_FILE, []);
  const movies = readMovies();
  return res.json({
    logs: views.slice(0, 300),
    mediaStats: movies.map((m) => ({
      id: m.id,
      titleAr: m.titleAr,
      type: m.type || 'movie',
      viewsCount: Number(m.viewsCount) || 0,
      isMostWatched: Boolean(m.isMostWatched),
    })),
  });
});

app.delete('/api/admin/views', requireAdmin, requirePermission('canManageSettings'), (req: Request, res: Response) => {
  writeJsonFile(VIEWS_LOG_FILE, []);
  const movies = readMovies().map((m) => ({ ...m, viewsCount: 0 }));
  writeMovies(movies);
  appendAuditLog('تصفير سجل المشاهدات', 'settings', 'تم مسح سجل المشاهدات وإعادة تعيين العدادات', getSessionActor(req));
  return res.json({ success: true });
});

// Physical video library management (/uploads/videos)
app.get('/api/admin/videos-library', requireAdmin, (_req: Request, res: Response) => {
  try {
    const files = fs.existsSync(VIDEOS_DIR) ? fs.readdirSync(VIDEOS_DIR) : [];
    const movies = readMovies();

    const list = files
      .map((fileName) => {
        const fullPath = path.resolve(VIDEOS_DIR, fileName);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) return null;

        const videoUrl = `/uploads/videos/${fileName}`;
        const linked = movies.filter((m) => {
          if (m.videoUrl === videoUrl) return true;
          if (Array.isArray(m.sources) && m.sources.some((s: any) => s.url === videoUrl)) return true;
          if (Array.isArray(m.seasons)) {
            return m.seasons.some((sn: any) =>
              (sn.episodes || []).some((ep: any) => ep.videoUrl === videoUrl)
            );
          }
          return false;
        });

        return {
          fileName,
          videoUrl,
          sizeBytes: stat.size,
          createdAt: Math.floor(stat.birthtimeMs || stat.ctimeMs),
          modifiedAt: Math.floor(stat.mtimeMs),
          linkedMediaIds: linked.map((m) => m.id),
          linkedMediaTitles: linked.map((m) => m.titleAr || m.title),
        };
      })
      .filter(Boolean);

    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'تعذر قراءة مكتبة الفيديوهات' });
  }
});

// Admin: Scan all uploaded/hidden files across /uploads subdirectories
app.get('/api/admin/all-files', requireAdmin, (_req: Request, res: Response) => {
  try {
    const movies = readMovies();
    const collected: any[] = [];

    const walk = (dirPath: string, relBase: string) => {
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          const url = `/uploads/${relPath}`;
          const linked = movies.filter((m) => {
            if (m.videoUrl === url || m.posterUrl === url || m.bannerUrl === url || m.subtitleUrl === url) {
              return true;
            }
            if (Array.isArray(m.sources) && m.sources.some((s: any) => s.url === url)) return true;
            if (Array.isArray(m.seasons)) {
              return m.seasons.some((sn: any) =>
                (sn.episodes || []).some((ep: any) => ep.videoUrl === url || ep.subtitleUrl === url)
              );
            }
            return false;
          });
          const topFolder = relPath.includes('/') ? relPath.split('/')[0] : 'root';
          const isDotHidden = relPath.split('/').some((seg) => seg.startsWith('.'));
          const linkedHiddenMedia = linked.some((m) => m.isPublished === false);

          collected.push({
            fileName: entry.name,
            relativePath: relPath,
            folder: topFolder,
            url,
            sizeBytes: stat.size,
            createdAt: Math.floor(stat.birthtimeMs || stat.ctimeMs),
            modifiedAt: Math.floor(stat.mtimeMs),
            isHiddenFile: isDotHidden || linkedHiddenMedia || linked.length === 0,
            linkedMediaTitles: linked.map((m) => m.titleAr || m.title),
          });
        }
      }
    };

    walk(UPLOADS_DIR, '');
    collected.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
    return res.json(collected);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'تعذر قراءة ملفات الموقع' });
  }
});

const deletePhysicalVideosAndSyncSite = (fileNames: string[]) => {
  const deletedMovieIds: string[] = [];
  const updatedMoviesMap = new Map<string, any>();
  const videoUrlsToRemove = new Set<string>();

  for (const rawName of fileNames) {
    const filename = path.basename((rawName || '').trim());
    if (!filename) continue;
    videoUrlsToRemove.add(`/uploads/videos/${filename}`);
    const fullPath = path.resolve(VIDEOS_DIR, filename);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.warn('Could not delete physical video file:', err);
      }
    }
    cleanupGeneratedVideoAssets(filename);
  }

  if (videoUrlsToRemove.size > 0) {
    const movies = readMovies();
    const moviesToRemove: any[] = [];
    const nextMovies: any[] = [];

    for (const m of movies) {
      const nextSources = Array.isArray(m.sources)
        ? m.sources.filter((s: any) => !s?.url || !videoUrlsToRemove.has(s.url))
        : [];

      const nextSeasons = Array.isArray(m.seasons)
        ? m.seasons
            .map((sn: any) => {
              const keptEpisodes = (sn.episodes || [])
                .filter((ep: any) => !ep?.videoUrl || !videoUrlsToRemove.has(ep.videoUrl))
                .map((ep: any, idx: number, arr: any[]) => ({
                  ...ep,
                  episodeNumber: idx + 1,
                  nextEpisodeId: arr[idx + 1]?.id || undefined,
                }));
              return { ...sn, episodes: keptEpisodes };
            })
        : [];

      const remainingEpisodesCount = nextSeasons.reduce(
        (sum: number, sn: any) => sum + (sn.episodes?.length || 0),
        0
      );

      const primaryRemoved = Boolean(m.videoUrl && videoUrlsToRemove.has(m.videoUrl));
      const sourcesChanged = Array.isArray(m.sources) && nextSources.length !== m.sources.length;
      const episodesChanged =
        Array.isArray(m.seasons) &&
        m.seasons.reduce((s: number, sn: any) => s + (sn.episodes?.length || 0), 0) !== remainingEpisodesCount;

      if (m.type !== 'series') {
        const fallbackUrl = nextSources[0]?.url || (!primaryRemoved ? m.videoUrl : '');
        if (!fallbackUrl && (primaryRemoved || sourcesChanged)) {
          moviesToRemove.push(m);
          continue;
        }
        if (primaryRemoved || sourcesChanged) {
          const updated = {
            ...m,
            videoUrl: fallbackUrl,
            sources: nextSources,
            updatedAt: Date.now(),
          };
          nextMovies.push(updated);
          updatedMoviesMap.set(updated.id, updated);
          continue;
        }
      } else {
        if (episodesChanged || primaryRemoved || sourcesChanged) {
          if (remainingEpisodesCount === 0 && (!m.videoUrl || primaryRemoved) && nextSources.length === 0) {
            moviesToRemove.push(m);
            continue;
          }
          const nextPrimaryUrl =
            nextSeasons[0]?.episodes?.[0]?.videoUrl ||
            nextSources[0]?.url ||
            (!primaryRemoved ? m.videoUrl : '');
          const updated = {
            ...m,
            videoUrl: nextPrimaryUrl || '',
            sources: nextSources,
            seasons: nextSeasons,
            updatedAt: Date.now(),
          };
          nextMovies.push(updated);
          updatedMoviesMap.set(updated.id, updated);
          continue;
        }
      }

      nextMovies.push(m);
    }

    if (moviesToRemove.length > 0 || updatedMoviesMap.size > 0) {
      writeMovies(nextMovies);
    }

    if (moviesToRemove.length > 0) {
      const removedIds = moviesToRemove.map((m) => m.id);
      deletedMovieIds.push(...removedIds);
      addDeletedMovieIds(removedIds);
      moviesToRemove.forEach((m) => {
        unlinkLocalMediaFileIfUnused(m.posterUrl, nextMovies);
        unlinkLocalMediaFileIfUnused(m.bannerUrl, nextMovies);
      });
      cleanupSiteWideReferencesForDeletedMedia(removedIds);
    }
  }

  return {
    deletedMovieIds,
    updatedMovies: Array.from(updatedMoviesMap.values()),
  };
};

app.delete('/api/admin/videos-library/:filename', requireAdmin, requirePermission('canDeleteMedia'), (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  try {
    const result = deletePhysicalVideosAndSyncSite([filename]);
    appendAuditLog(
      'حذف فيديو من المكتبة والموقع',
      'files',
      `تم حذف ${filename}${result.deletedMovieIds.length ? ` وإزالة ${result.deletedMovieIds.length} أعمال مرتبطة` : ''}`,
      getSessionActor(req)
    );
    return res.json({
      success: true,
      ...result,
      message: 'تم حذف الفيديو وإزالة جميع ارتباطاته من الموقع بالكامل',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'تعذر حذف الملف' });
  }
});

app.post('/api/admin/videos-library/bulk-delete', requireAdmin, requirePermission('canDeleteMedia'), (req: Request, res: Response) => {
  const fileNames = Array.isArray(req.body?.fileNames) ? req.body.fileNames : [];
  if (fileNames.length === 0) {
    return res.status(400).json({ error: 'يرجى تحديد فيديوهات للحذف' });
  }
  try {
    const result = deletePhysicalVideosAndSyncSite(fileNames);
    appendAuditLog(
      'حذف جماعي لملفات الفيديو',
      'files',
      `تم حذف ${fileNames.length} ملفات فيديو من الخادم والموقع`,
      getSessionActor(req)
    );
    return res.json({
      success: true,
      ...result,
      message: `تم حذف ${fileNames.length} ملفات فيديو وإزالة ارتباطاتها من الموقع بالكامل`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'تعذر حذف الملفات' });
  }
});

// Real streaming URL tester & universal extractor probe (supports local /uploads/videos & ANY external platform/movie webpage)
app.post('/api/admin/test-stream-url', requireAdmin, async (req: Request, res: Response) => {
  const rawUrl = (req.body?.url || '').toString().trim();
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'يرجى إدخال رابط البث للاختبار' });
  }

  if (rawUrl.startsWith('/uploads/videos/')) {
    const filename = path.basename(rawUrl);
    const fullPath = path.resolve(VIDEOS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      return res.json({ ok: false, status: 404, error: 'الملف المحلي غير موجود على الخادم' });
    }
    const stat = fs.statSync(fullPath);
    return res.json({
      ok: true,
      status: 206,
      contentType: filename.endsWith('.webm') ? 'video/webm' : 'video/mp4',
      contentLength: stat.size,
      supportsRange: true,
      format: filename.endsWith('.webm') ? 'WebM' : 'MP4 (Range Ready)',
    });
  }

  try {
    const extraction = await extractUniversalVideoStreams(rawUrl, { forceFresh: true });
    if (extraction.streams.length > 0) {
      const best = extraction.streams[0];
      let status = 200;
      let supportsRange = best.format === 'hls';
      let contentType = best.format === 'hls' ? 'application/vnd.apple.mpegurl' : `video/${best.format}`;
      let contentLength = 0;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const probeRes = await fetch(best.url, {
          method: 'GET',
          headers: {
            Range: 'bytes=0-1023',
            'User-Agent': PROXY_USER_AGENT,
            Referer: best.referer || extraction.finalUrl,
          },
          signal: controller.signal,
        });
        clearTimeout(timer);
        status = probeRes.status;
        contentType = probeRes.headers.get('content-type') || contentType;
        const acceptRanges = probeRes.headers.get('accept-ranges') || '';
        contentLength = Number(probeRes.headers.get('content-length') || 0);
        supportsRange = supportsRange || probeRes.status === 206 || acceptRanges.toLowerCase().includes('bytes');
        await probeRes.body?.cancel().catch(() => {});
      } catch {
        // Proxy endpoint handles streaming cleanly even when direct Range probe times out
        supportsRange = true;
      }

      return res.json({
        ok: true,
        status,
        contentType,
        contentLength,
        supportsRange,
        format: `${best.format.toUpperCase()} مستخرج (${best.quality})`,
        extractedStreams: extraction.streams,
        bestPlayableUrl: best.preferProxy ? best.proxiedUrl : best.url,
        title: extraction.title,
        posterUrl: extraction.posterUrl,
      });
    }

    if (extraction.kind === 'youtube') {
      return res.json({
        ok: true,
        status: 200,
        supportsRange: true,
        format: 'YouTube',
      });
    }

    if (extraction.embedUrl) {
      return res.json({
        ok: true,
        status: 200,
        supportsRange: true,
        format: 'مشغل مدمج محمي (Embed Proxy)',
        embedUrl: extraction.embedUrl,
        proxiedEmbedUrl: extraction.proxiedEmbedUrl,
        title: extraction.title,
        posterUrl: extraction.posterUrl,
      });
    }

    return res.json({
      ok: false,
      error: extraction.diagnostics || 'تعذر استخراج بث مباشر من هذا الرابط',
    });
  } catch (err: any) {
    return res.json({
      ok: false,
      error: err?.name === 'AbortError' ? 'انتهت مهلة الاتصال بالرابط (Timeout)' : err?.message || 'تعذر الوصول إلى الرابط',
    });
  }
});

// Categories CRUD
app.get('/api/admin/categories', requireAdmin, (_req: Request, res: Response) => {
  const list = readJsonFile<any[]>(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  return res.json([...list].sort((a, b) => (a.order || 0) - (b.order || 0)));
});

app.post('/api/admin/categories', requireAdmin, requirePermission('canManageSettings'), (req: Request, res: Response) => {
  const { nameAr, nameEn, slug, description, isVisible, order } = req.body || {};
  if (!nameAr) return res.status(400).json({ error: 'اسم التصنيف بالعربية مطلوب' });
  const list = readJsonFile<any[]>(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  const newItem = {
    id: `cat-${Date.now()}`,
    slug: (slug || nameEn || nameAr).toString().trim().toLowerCase().replace(/\s+/g, '-'),
    nameAr: nameAr.toString().trim(),
    nameEn: (nameEn || nameAr).toString().trim(),
    description: (description || '').toString().trim(),
    isVisible: isVisible !== false,
    order: Number(order) || list.length + 1,
    createdAt: Date.now(),
  };
  list.push(newItem);
  writeJsonFile(CATEGORIES_FILE, list);
  appendAuditLog('إضافة تصنيف', 'settings', `تمت إضافة التصنيف "${newItem.nameAr}"`, getSessionActor(req));
  return res.status(201).json({ success: true, category: newItem });
});

app.put('/api/admin/categories/:id', requireAdmin, requirePermission('canManageSettings'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  const idx = list.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'التصنيف غير موجود' });
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
  writeJsonFile(CATEGORIES_FILE, list);
  appendAuditLog('تحديث تصنيف', 'settings', `تم تعديل التصنيف "${list[idx].nameAr}"`, getSessionActor(req));
  return res.json({ success: true, category: list[idx] });
});

app.delete('/api/admin/categories/:id', requireAdmin, requirePermission('canManageSettings'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  const target = list.find((c) => c.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'التصنيف غير موجود' });
  writeJsonFile(CATEGORIES_FILE, list.filter((c) => c.id !== req.params.id));
  appendAuditLog('حذف تصنيف', 'settings', `تم حذف التصنيف "${target.nameAr}"`, getSessionActor(req));
  return res.json({ success: true });
});

// Cast & Directors CRUD
app.get('/api/admin/people', requireAdmin, (_req: Request, res: Response) => {
  return res.json(readJsonFile<any[]>(PEOPLE_FILE, []));
});

app.post('/api/admin/people', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const { name, role, bio, avatarUrl, nationality } = req.body || {};
  if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const list = readJsonFile<any[]>(PEOPLE_FILE, []);
  const item = {
    id: `person-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    name: name.toString().trim(),
    role: role === 'director' || role === 'both' ? role : 'actor',
    bio: (bio || '').toString().trim(),
    avatarUrl: (avatarUrl || '').toString().trim(),
    nationality: (nationality || '').toString().trim(),
    createdAt: Date.now(),
  };
  list.unshift(item);
  writeJsonFile(PEOPLE_FILE, list);
  appendAuditLog('إضافة فنان/مخرج', 'media', `تمت إضافة "${item.name}"`, getSessionActor(req));
  return res.status(201).json({ success: true, person: item });
});

app.put('/api/admin/people/:id', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(PEOPLE_FILE, []);
  const idx = list.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'الشخصية غير موجودة' });
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
  writeJsonFile(PEOPLE_FILE, list);
  appendAuditLog('تحديث فنان/مخرج', 'media', `تم تعديل "${list[idx].name}"`, getSessionActor(req));
  return res.json({ success: true, person: list[idx] });
});

app.delete('/api/admin/people/:id', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(PEOPLE_FILE, []);
  writeJsonFile(PEOPLE_FILE, list.filter((p) => p.id !== req.params.id));
  appendAuditLog('حذف فنان/مخرج', 'media', `تم حذف السجل ${req.params.id}`, getSessionActor(req));
  return res.json({ success: true });
});

// Comments & Ratings Moderation
app.get('/api/admin/comments', requireAdmin, (_req: Request, res: Response) => {
  return res.json(readJsonFile<any[]>(COMMENTS_FILE, []));
});

app.put('/api/admin/comments/:id', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(COMMENTS_FILE, []);
  const idx = list.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'التعليق غير موجود' });
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
  writeJsonFile(COMMENTS_FILE, list);
  appendAuditLog('إدارة تعليق', 'media', `تحديث حالة التعليق ${req.params.id} إلى ${list[idx].status}`, getSessionActor(req));
  return res.json({ success: true, comment: list[idx] });
});

app.delete('/api/admin/comments/:id', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(COMMENTS_FILE, []);
  writeJsonFile(COMMENTS_FILE, list.filter((c) => c.id !== req.params.id));
  appendAuditLog('حذف تعليق', 'media', `تم حذف التعليق ${req.params.id}`, getSessionActor(req));
  return res.json({ success: true });
});

// Notifications CRUD
app.get('/api/admin/notifications', requireAdmin, (_req: Request, res: Response) => {
  return res.json(readJsonFile<any[]>(NOTIFICATIONS_FILE, []));
});

app.post('/api/admin/notifications', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const { title, message, type, target } = req.body || {};
  if (!title || !message) return res.status(400).json({ error: 'عنوان الإشعار ونصه مطلوبان' });
  const list = readJsonFile<any[]>(NOTIFICATIONS_FILE, []);
  const item = {
    id: `notif-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    title: title.toString().trim(),
    message: message.toString().trim(),
    type: type || 'info',
    target: target === 'members' ? 'members' : 'all',
    isActive: true,
    createdAt: Date.now(),
  };
  list.unshift(item);
  writeJsonFile(NOTIFICATIONS_FILE, list);
  appendAuditLog('إرسال إشعار منصة', 'system', `تم إرسال إشعار: "${item.title}"`, getSessionActor(req));
  return res.status(201).json({ success: true, notification: item });
});

app.put('/api/admin/notifications/:id', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(NOTIFICATIONS_FILE, []);
  const idx = list.findIndex((n) => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'الإشعار غير موجود' });
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
  writeJsonFile(NOTIFICATIONS_FILE, list);
  appendAuditLog('تعديل إشعار منصة', 'system', `تحديث الإشعار "${list[idx].title}"`, getSessionActor(req));
  return res.json({ success: true, notification: list[idx] });
});

app.delete('/api/admin/notifications/:id', requireAdmin, requirePermission('canEditMedia'), (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(NOTIFICATIONS_FILE, []);
  writeJsonFile(NOTIFICATIONS_FILE, list.filter((n) => n.id !== req.params.id));
  appendAuditLog('حذف إشعار منصة', 'system', `تم حذف الإشعار ${req.params.id}`, getSessionActor(req));
  return res.json({ success: true });
});

// Users Management (List, Update Status/Role, Delete)
app.get('/api/admin/users', requireAdmin, (_req: Request, res: Response) => {
  const users = readUsers();
  const views = readJsonFile<any[]>(VIEWS_LOG_FILE, []);
  const enriched = users.map((u) => {
    const userViews = views.filter((v) => v.userEmail && v.userEmail.toLowerCase() === u.email.toLowerCase());
    return {
      ...buildSafeUser(u),
      recentViewsCount: userViews.length,
      lastSeenAt: userViews[0]?.timestamp || u.joinedAt,
    };
  });
  return res.json(enriched);
});

app.put('/api/admin/users/:id', requireAdmin, requirePermission('canManageUsers'), (req: Request, res: Response) => {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const target = users[idx];
  const isPrimaryDev = target.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
  if (isPrimaryDev && req.body.disabled === true) {
    return res.status(400).json({ error: 'لا يمكن تعطيل حساب المطور الرئيسي للمنصة' });
  }

  users[idx] = {
    ...target,
    displayName: req.body.displayName ?? target.displayName,
    name: req.body.displayName ?? target.name,
    role: isPrimaryDev ? 'مشرف المنصة' : (req.body.role ?? target.role),
    disabled: isPrimaryDev ? false : (req.body.disabled !== undefined ? Boolean(req.body.disabled) : target.disabled),
    emailVerified: req.body.emailVerified !== undefined ? Boolean(req.body.emailVerified) : target.emailVerified,
  };
  writeUsers(users);
  appendAuditLog(
    'تحديث حساب مستخدم',
    'users',
    `تحديث الحساب ${target.email} (الحالة: ${users[idx].disabled ? 'معطل' : 'نشط'} / الدور: ${users[idx].role})`,
    getSessionActor(req)
  );
  return res.json({ success: true, user: buildSafeUser(users[idx]) });
});

app.delete('/api/admin/users/:id', requireAdmin, requirePermission('canManageUsers'), (req: Request, res: Response) => {
  const users = readUsers();
  const target = users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (target.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return res.status(400).json({ error: 'لا يمكن حذف حساب المطور الرئيسي للمنصة' });
  }
  writeUsers(users.filter((u) => u.id !== req.params.id));
  appendAuditLog('حذف حساب مستخدم', 'users', `تم حذف الحساب ${target.email} نهائياً`, getSessionActor(req));
  return res.json({ success: true });
});

// Admins & Permissions Management
app.get('/api/admin/admins', requireAdmin, (_req: Request, res: Response) => {
  const list = readJsonFile<any[]>(ADMINS_FILE, DEFAULT_ADMINS);
  return res.json(list.map(sanitizeAdminRecord));
});

app.post('/api/admin/admins', requireAdmin, requireSuperAdmin, (req: Request, res: Response) => {
  const { email, name, roleTitle, permissions, password } = req.body || {};
  if (!email || !name) return res.status(400).json({ error: 'الاسم والبريد الإلكتروني مطلوبان' });
  const cleanEmail = email.toString().trim().toLowerCase();
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صالح' });
  }
  const rawPass = (password !== undefined && password !== null && String(password).trim() !== ''
    ? String(password).trim()
    : COLLABORATOR_PASSWORD_REQUIRED_PART);

  if (!rawPass.includes(COLLABORATOR_PASSWORD_REQUIRED_PART)) {
    return res.status(400).json({
      error: `يجب أن تتضمن كلمة مرور تسجيل الدخول للإدارة الرمز (${COLLABORATOR_PASSWORD_REQUIRED_PART})`,
    });
  }

  const list = readJsonFile<any[]>(ADMINS_FILE, DEFAULT_ADMINS);
  if (list.some((a) => String(a.email || '').toLowerCase() === cleanEmail)) {
    return res.status(400).json({ error: 'هذا البريد مضاف بالفعل في قائمة الصلاحيات' });
  }

  const newAdmin = {
    id: `admin-${Date.now()}`,
    email: cleanEmail,
    name: name.toString().trim(),
    roleTitle: (roleTitle || 'محرر محتوى').toString().trim(),
    isSuperAdmin: false,
    isActive: true,
    passwordHash: bcrypt.hashSync(rawPass, 10),
    passwordHint: rawPass === COLLABORATOR_PASSWORD_REQUIRED_PART ? 'VBL/9' : 'يتضمن VBL/9',
    permissions: permissions || {
      canUpload: true,
      canEditMedia: true,
      canDeleteMedia: false,
      canManageUsers: false,
      canManageSettings: false,
    },
    createdAt: Date.now(),
  };
  list.push(newAdmin);
  writeJsonFile(ADMINS_FILE, list);
  appendAuditLog('إضافة صلاحية مدير', 'security', `تمت إضافة ${cleanEmail} بدور ${newAdmin.roleTitle}`, getSessionActor(req));
  return res.status(201).json({ success: true, admin: sanitizeAdminRecord(newAdmin) });
});

app.put('/api/admin/admins/:id', requireAdmin, requireSuperAdmin, (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(ADMINS_FILE, DEFAULT_ADMINS);
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'السجل غير موجود' });
  if (list[idx].isSuperAdmin) {
    return res.status(400).json({ error: 'صلاحيات المطور الرئيسي ثابتة ولا يمكن تقييدها' });
  }

  const { password, passwordHash: _ignoredHash, ...rest } = req.body || {};
  let nextPasswordHash = list[idx].passwordHash;
  let nextPasswordHint = list[idx].passwordHint;

  if (typeof password === 'string' && password.trim() !== '') {
    const cleanPass = password.trim();
    if (!cleanPass.includes(COLLABORATOR_PASSWORD_REQUIRED_PART)) {
      return res.status(400).json({
        error: `يجب أن تتضمن كلمة مرور تسجيل الدخول للإدارة الرمز (${COLLABORATOR_PASSWORD_REQUIRED_PART})`,
      });
    }
    nextPasswordHash = bcrypt.hashSync(cleanPass, 10);
    nextPasswordHint = cleanPass === COLLABORATOR_PASSWORD_REQUIRED_PART ? 'VBL/9' : 'يتضمن VBL/9';
  }

  list[idx] = {
    ...list[idx],
    ...rest,
    id: list[idx].id,
    isSuperAdmin: false,
    passwordHash: nextPasswordHash,
    passwordHint: nextPasswordHint,
  };
  writeJsonFile(ADMINS_FILE, list);
  appendAuditLog('تعديل صلاحيات إدارية', 'security', `تعديل صلاحيات ${list[idx].email}`, getSessionActor(req));
  return res.json({ success: true, admin: sanitizeAdminRecord(list[idx]) });
});

app.delete('/api/admin/admins/:id', requireAdmin, requireSuperAdmin, (req: Request, res: Response) => {
  const list = readJsonFile<any[]>(ADMINS_FILE, DEFAULT_ADMINS);
  const target = list.find((a) => a.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'السجل غير موجود' });
  if (target.isSuperAdmin) {
    return res.status(400).json({ error: 'لا يمكن إزالة المطور الرئيسي للمنصة' });
  }
  writeJsonFile(ADMINS_FILE, list.filter((a) => a.id !== req.params.id));
  appendAuditLog('سحب صلاحية إدارية', 'security', `تم سحب صلاحية ${target.email}`, getSessionActor(req));
  return res.json({ success: true });
});

// Audit Logs
app.get('/api/admin/audit-logs', requireAdmin, (_req: Request, res: Response) => {
  return res.json(readJsonFile<any[]>(AUDIT_LOGS_FILE, []));
});

app.delete('/api/admin/audit-logs', requireAdmin, requireSuperAdmin, (req: Request, res: Response) => {
  writeJsonFile(AUDIT_LOGS_FILE, []);
  appendAuditLog('تنظيف سجل العمليات', 'security', 'تمت إعادة تهيئة سجل العمليات الإدارية', getSessionActor(req));
  return res.json({ success: true });
});

// Site Settings (General, Banners/Home, Player, Security, Storage)
app.get('/api/admin/site-settings', requireAdmin, (_req: Request, res: Response) => {
  const settings = readJsonFile<any>(SITE_SETTINGS_FILE, DEFAULT_SITE_SETTINGS);
  return res.json({ ...DEFAULT_SITE_SETTINGS, ...settings });
});

app.put('/api/admin/site-settings', requireAdmin, requirePermission('canManageSettings'), (req: Request, res: Response) => {
  const current = readJsonFile<any>(SITE_SETTINGS_FILE, DEFAULT_SITE_SETTINGS);
  const merged = {
    ...DEFAULT_SITE_SETTINGS,
    ...current,
    ...req.body,
    homeSections: { ...DEFAULT_SITE_SETTINGS.homeSections, ...(current.homeSections || {}), ...(req.body?.homeSections || {}) },
    playerSettings: { ...DEFAULT_SITE_SETTINGS.playerSettings, ...(current.playerSettings || {}), ...(req.body?.playerSettings || {}) },
    securitySettings: { ...DEFAULT_SITE_SETTINGS.securitySettings, ...(current.securitySettings || {}), ...(req.body?.securitySettings || {}) },
    storageSettings: { ...DEFAULT_SITE_SETTINGS.storageSettings, ...(current.storageSettings || {}), ...(req.body?.storageSettings || {}) },
    notificationsSettings: { ...DEFAULT_SITE_SETTINGS.notificationsSettings, ...(current.notificationsSettings || {}), ...(req.body?.notificationsSettings || {}) },
  };
  writeJsonFile(SITE_SETTINGS_FILE, merged);
  appendAuditLog('تحديث إعدادات المنصة', 'settings', 'تم حفظ تعديلات الإعدادات العامة أو المشغل أو الواجهة', getSessionActor(req));
  return res.json({ success: true, settings: merged });
});

// JSON fallback for any unhandled /api route to ensure it never returns HTML
app.all('/api/*', (req: Request, res: Response) => {
  return res.status(404).json({ error: `المسار البرمجي غير موجود: ${req.method} ${req.path}` });
});

// Global Express Error Handler - catches any error in API routes and returns JSON
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return;
  }
  return res.status(err.status || 500).json({
    error: err.message || 'حدث خطأ في الخادم',
    code: err.code || 'INTERNAL_ERROR',
  });
});

// Setup Vite middleware in dev or static serving in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`GoldenFlix server running on http://0.0.0.0:${PORT}`);
  });
  server.requestTimeout = 0;
  server.keepAliveTimeout = 65000;
}

startServer();
