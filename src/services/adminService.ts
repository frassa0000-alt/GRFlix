import {
  AdminMember,
  AuditLogEntry,
  CategoryItem,
  CommentItem,
  MediaItem,
  MediaType,
  NotificationItem,
  PersonItem,
  PhysicalVideoFile,
  SiteFileEntry,
  SiteSettingsConfig,
  ViewEvent,
  AppUserProfile,
} from '../types';

const parseJsonSafe = async (res: Response, fallbackMsg: string): Promise<any> => {
  const text = await res.text();
  if (!text || text.trim().startsWith('<')) {
    throw new Error(fallbackMsg);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(fallbackMsg);
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallbackMsg);
  }
  return data;
};

const authHeaders = (token: string, json = false): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

// --- ANALYTICS & VIEWS ---

export interface AdminAnalyticsResponse {
  totals: {
    movies: number;
    series: number;
    episodes: number;
    users: number;
    verifiedUsers: number;
    newUsersInRange: number;
    views: number;
    dailyViews: number;
    weeklyViews: number;
    monthlyViews: number;
    comments: number;
  };
  chartSeries: Array<{
    label: string;
    dateKey: string;
    views: number;
    newUsers: number;
  }>;
  latestContent: MediaItem[];
  topMovies: MediaItem[];
  topSeries: MediaItem[];
  recentLogs: AuditLogEntry[];
}

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export const fetchAdminAnalytics = async (
  token: string,
  range: AnalyticsRange = '30d'
): Promise<AdminAnalyticsResponse> => {
  const res = await fetch(`/api/admin/analytics?range=${encodeURIComponent(range)}`, {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر تحميل إحصائيات لوحة التحكم');
};

export interface AdminViewsResponse {
  logs: ViewEvent[];
  mediaStats: Array<{
    id: string;
    titleAr: string;
    type: MediaType;
    viewsCount: number;
    isMostWatched: boolean;
  }>;
}

export const fetchAdminViews = async (token: string): Promise<AdminViewsResponse> => {
  const res = await fetch('/api/admin/views', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر تحميل سجل المشاهدات');
};

export const resetAdminViews = async (token: string): Promise<void> => {
  const res = await fetch('/api/admin/views', {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر تصفير سجل المشاهدات');
};

export const recordMediaView = async (
  mediaId: string,
  episodeId?: string,
  userEmail?: string | null
): Promise<void> => {
  try {
    await fetch(`/api/media/${encodeURIComponent(mediaId)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodeId, userEmail: userEmail || undefined }),
    });
  } catch {
    // Non-blocking telemetry
  }
};

// --- PHYSICAL VIDEO LIBRARY & URL TESTER ---

export const fetchPhysicalVideosLibrary = async (
  token: string
): Promise<PhysicalVideoFile[]> => {
  const res = await fetch('/api/admin/videos-library', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر جلب مكتبة ملفات الفيديو');
};

export const fetchAllSiteFiles = async (token: string): Promise<SiteFileEntry[]> => {
  const res = await fetch('/api/admin/all-files', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر جلب جميع ملفات الموقع');
};

export interface PhysicalVideoDeleteResult {
  deletedMovieIds: string[];
  updatedMovies: MediaItem[];
}

export const deletePhysicalVideoFile = async (
  token: string,
  fileName: string
): Promise<PhysicalVideoDeleteResult> => {
  const res = await fetch(`/api/admin/videos-library/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res, 'تعذر حذف ملف الفيديو من الخادم');
  return {
    deletedMovieIds: Array.isArray(data.deletedMovieIds) ? data.deletedMovieIds : [],
    updatedMovies: Array.isArray(data.updatedMovies) ? data.updatedMovies : [],
  };
};

export const bulkDeletePhysicalVideoFiles = async (
  token: string,
  fileNames: string[]
): Promise<PhysicalVideoDeleteResult> => {
  const res = await fetch('/api/admin/videos-library/bulk-delete', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ fileNames }),
  });
  const data = await parseJsonSafe(res, 'تعذر حذف ملفات الفيديو المحددة');
  return {
    deletedMovieIds: Array.isArray(data.deletedMovieIds) ? data.deletedMovieIds : [],
    updatedMovies: Array.isArray(data.updatedMovies) ? data.updatedMovies : [],
  };
};

export interface StreamTestResult {
  ok: boolean;
  status?: number;
  contentType?: string;
  contentLength?: number;
  supportsRange?: boolean;
  format?: string;
  error?: string;
}

export const testStreamUrl = async (
  token: string,
  url: string
): Promise<StreamTestResult> => {
  const res = await fetch('/api/admin/test-stream-url', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ url }),
  });
  return parseJsonSafe(res, 'تعذر اختبار رابط البث');
};

// --- CATEGORIES ---

export const fetchCategories = async (token: string): Promise<CategoryItem[]> => {
  const res = await fetch('/api/admin/categories', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر تحميل التصنيفات');
};

export const createCategory = async (
  token: string,
  data: Partial<CategoryItem>
): Promise<CategoryItem> => {
  const res = await fetch('/api/admin/categories', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر إضافة التصنيف');
  return parsed.category;
};

export const updateCategory = async (
  token: string,
  id: string,
  data: Partial<CategoryItem>
): Promise<CategoryItem> => {
  const res = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر تحديث التصنيف');
  return parsed.category;
};

export const deleteCategory = async (token: string, id: string): Promise<void> => {
  const res = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر حذف التصنيف');
};

// --- CAST & DIRECTORS ---

export const fetchPeople = async (token: string): Promise<PersonItem[]> => {
  const res = await fetch('/api/admin/people', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر جلب قائمة الممثلين والمخرجين');
};

export const createPerson = async (
  token: string,
  data: Partial<PersonItem>
): Promise<PersonItem> => {
  const res = await fetch('/api/admin/people', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر إضافة الفنان / المخرج');
  return parsed.person;
};

export const updatePerson = async (
  token: string,
  id: string,
  data: Partial<PersonItem>
): Promise<PersonItem> => {
  const res = await fetch(`/api/admin/people/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر تعديل البيانات');
  return parsed.person;
};

export const deletePerson = async (token: string, id: string): Promise<void> => {
  const res = await fetch(`/api/admin/people/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر حذف السجل');
};

// --- COMMENTS & RATINGS ---

export const fetchAdminComments = async (token: string): Promise<CommentItem[]> => {
  const res = await fetch('/api/admin/comments', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر تحميل التعليقات والتقييمات');
};

export const updateAdminComment = async (
  token: string,
  id: string,
  updates: Partial<CommentItem>
): Promise<CommentItem> => {
  const res = await fetch(`/api/admin/comments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(updates),
  });
  const parsed = await parseJsonSafe(res, 'تعذر تحديث التعليق');
  return parsed.comment;
};

export const deleteAdminComment = async (token: string, id: string): Promise<void> => {
  const res = await fetch(`/api/admin/comments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر حذف التعليق');
};

// --- NOTIFICATIONS ---

export const fetchAdminNotifications = async (token: string): Promise<NotificationItem[]> => {
  const res = await fetch('/api/admin/notifications', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر جلب الإشعارات');
};

export const fetchPublicNotifications = async (): Promise<NotificationItem[]> => {
  try {
    const res = await fetch('/api/notifications');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const createAdminNotification = async (
  token: string,
  data: Partial<NotificationItem>
): Promise<NotificationItem> => {
  const res = await fetch('/api/admin/notifications', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر إرسال الإشعار');
  return parsed.notification;
};

export const updateAdminNotification = async (
  token: string,
  id: string,
  data: Partial<NotificationItem>
): Promise<NotificationItem> => {
  const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر تعديل الإشعار');
  return parsed.notification;
};

export const deleteAdminNotification = async (token: string, id: string): Promise<void> => {
  const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر حذف الإشعار');
};

// --- USERS ---

export interface AdminUserRecord extends AppUserProfile {
  recentViewsCount?: number;
  lastSeenAt?: number;
}

export const fetchAdminUsers = async (token: string): Promise<AdminUserRecord[]> => {
  const res = await fetch('/api/admin/users', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر جلب قائمة المستخدمين');
};

export const updateAdminUser = async (
  token: string,
  id: string,
  updates: Partial<AdminUserRecord>
): Promise<AdminUserRecord> => {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(updates),
  });
  const parsed = await parseJsonSafe(res, 'تعذر تحديث حساب المستخدم');
  return parsed.user;
};

export const deleteAdminUser = async (token: string, id: string): Promise<void> => {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر حذف حساب المستخدم');
};

// --- ADMINS & PERMISSIONS ---

export const fetchAdminMembers = async (token: string): Promise<AdminMember[]> => {
  const res = await fetch('/api/admin/admins', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر جلب قائمة المديرين');
};

export const createAdminMember = async (
  token: string,
  data: Partial<AdminMember>
): Promise<AdminMember> => {
  const res = await fetch('/api/admin/admins', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر إضافة المشرف');
  return parsed.admin;
};

export const updateAdminMember = async (
  token: string,
  id: string,
  data: Partial<AdminMember>
): Promise<AdminMember> => {
  const res = await fetch(`/api/admin/admins/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر تحديث صلاحيات المشرف');
  return parsed.admin;
};

export const deleteAdminMember = async (token: string, id: string): Promise<void> => {
  const res = await fetch(`/api/admin/admins/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر حذف المشرف');
};

// --- AUDIT LOGS ---

export const fetchAuditLogs = async (token: string): Promise<AuditLogEntry[]> => {
  const res = await fetch('/api/admin/audit-logs', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر تحميل سجل العمليات');
};

export const clearAuditLogs = async (token: string): Promise<void> => {
  const res = await fetch('/api/admin/audit-logs', {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonSafe(res, 'تعذر مسح سجل العمليات');
};

// --- SITE SETTINGS ---

export const fetchPublicSiteSettings = async (): Promise<SiteSettingsConfig | null> => {
  try {
    const res = await fetch('/api/site-settings');
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const fetchAdminSiteSettings = async (
  token: string
): Promise<SiteSettingsConfig> => {
  const res = await fetch('/api/admin/site-settings', {
    headers: authHeaders(token),
  });
  return parseJsonSafe(res, 'تعذر تحميل إعدادات الموقع');
};

export const saveAdminSiteSettings = async (
  token: string,
  data: Partial<SiteSettingsConfig>
): Promise<SiteSettingsConfig> => {
  const res = await fetch('/api/admin/site-settings', {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(data),
  });
  const parsed = await parseJsonSafe(res, 'تعذر حفظ إعدادات الموقع');
  return parsed.settings;
};
