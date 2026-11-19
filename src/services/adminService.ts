import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
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
import {
  ApiUnavailableError,
  getStoredVerifiedUser,
  isApiUnavailableError,
} from './api';
import {
  auth,
  db,
  DEVELOPER_ADMIN_EMAIL,
  isFirestoreConnectivityError,
} from './firebase';

const LOCAL_NOTIFICATIONS_KEY = 'goldenflix_platform_notifications';
const LOCAL_USERS_SHADOW_KEY = 'goldenflix_admin_users_local';
const LOCAL_USERS_DELETED_KEY = 'goldenflix_admin_users_deleted';

const isUnavailableHttpStatus = (status: number): boolean =>
  status === 404 || status === 405 || status === 502 || status === 503 || status === 504;

const canUseAdminFirestore = (): boolean => {
  const user = auth.currentUser;
  return Boolean(
    user &&
      user.email?.trim().toLowerCase() === DEVELOPER_ADMIN_EMAIL &&
      user.emailVerified === true
  );
};

const readLocalJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeLocalJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
};

const parseJsonSafe = async (res: Response, fallbackMsg: string): Promise<any> => {
  if (isUnavailableHttpStatus(res.status)) {
    throw new ApiUnavailableError(fallbackMsg);
  }
  const text = await res.text();
  if (!text || text.trim().startsWith('<')) {
    throw new ApiUnavailableError(fallbackMsg);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiUnavailableError(fallbackMsg);
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallbackMsg);
  }
  return data;
};

const fetchApiSafe = async (
  url: string,
  options: RequestInit | undefined,
  fallbackMsg: string
): Promise<any> => {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiUnavailableError(fallbackMsg);
  }
  return parseJsonSafe(res, fallbackMsg);
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
  extractedStreams?: Array<{
    url: string;
    proxiedUrl: string;
    format: string;
    quality: string;
    label: string;
    preferProxy?: boolean;
  }>;
  bestPlayableUrl?: string;
  embedUrl?: string;
  proxiedEmbedUrl?: string;
  title?: string;
  posterUrl?: string;
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

export const fetchPublicCategories = async (): Promise<CategoryItem[]> => {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) return [];
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return [];
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

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

const mergeNotificationLists = (
  primary: NotificationItem[],
  secondary: NotificationItem[]
): NotificationItem[] => {
  const map = new Map<string, NotificationItem>();
  for (const item of [...secondary, ...primary]) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

const readFirestorePlatformNotifications = async (): Promise<NotificationItem[]> => {
  try {
    const snap = await getDoc(doc(db, 'siteSettings', 'notifications'));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data?.items) ? (data.items as NotificationItem[]) : [];
  } catch (err) {
    if (!isFirestoreConnectivityError(err)) {
      console.warn('Firestore notifications read notice:', err);
    }
    return [];
  }
};

const syncFirestorePlatformNotifications = async (items: NotificationItem[]): Promise<void> => {
  writeLocalJson(LOCAL_NOTIFICATIONS_KEY, items);
  if (!canUseAdminFirestore()) return;
  try {
    await setDoc(doc(db, 'siteSettings', 'notifications'), {
      items: items.slice(0, 100),
      updatedAt: Date.now(),
    });
  } catch (err) {
    if (!isFirestoreConnectivityError(err)) {
      console.warn('Firestore notifications sync notice:', err);
    }
  }
};

export const fetchAdminNotifications = async (token: string): Promise<NotificationItem[]> => {
  const localItems = readLocalJson<NotificationItem[]>(LOCAL_NOTIFICATIONS_KEY, []);
  const firestoreItemsPromise = readFirestorePlatformNotifications();

  try {
    const serverItems = await fetchApiSafe(
      '/api/admin/notifications',
      { headers: authHeaders(token) },
      'تعذر جلب الإشعارات'
    );
    const serverList = Array.isArray(serverItems) ? (serverItems as NotificationItem[]) : [];
    const firestoreItems = await firestoreItemsPromise;
    const merged = mergeNotificationLists(serverList, firestoreItems);
    writeLocalJson(LOCAL_NOTIFICATIONS_KEY, merged);
    return merged;
  } catch (err) {
    if (!isApiUnavailableError(err) && !canUseAdminFirestore()) {
      throw err;
    }
    const firestoreItems = await firestoreItemsPromise;
    const merged = mergeNotificationLists(firestoreItems, localItems);
    writeLocalJson(LOCAL_NOTIFICATIONS_KEY, merged);
    return merged;
  }
};

export const fetchPublicNotifications = async (): Promise<NotificationItem[]> => {
  const localItems = readLocalJson<NotificationItem[]>(LOCAL_NOTIFICATIONS_KEY, []);
  try {
    const data = await fetchApiSafe('/api/notifications', undefined, '');
    if (Array.isArray(data) && data.length > 0) {
      return data.filter((n) => n.isActive !== false);
    }
  } catch {
    // Fallback to Firestore / local cache
  }
  const firestoreItems = await readFirestorePlatformNotifications();
  const merged = mergeNotificationLists(firestoreItems, localItems);
  return merged.filter((n) => n.isActive !== false);
};

export const createAdminNotification = async (
  token: string,
  data: Partial<NotificationItem>
): Promise<NotificationItem> => {
  const localItems = readLocalJson<NotificationItem[]>(LOCAL_NOTIFICATIONS_KEY, []);
  const firestoreItems = await readFirestorePlatformNotifications();
  const currentList = mergeNotificationLists(firestoreItems, localItems);

  try {
    const parsed = await fetchApiSafe(
      '/api/admin/notifications',
      {
        method: 'POST',
        headers: authHeaders(token, true),
        body: JSON.stringify(data),
      },
      'تعذر إرسال الإشعار'
    );
    const created = parsed.notification as NotificationItem;
    await syncFirestorePlatformNotifications([created, ...currentList.filter((n) => n.id !== created.id)]);
    return created;
  } catch (err) {
    if (!isApiUnavailableError(err)) {
      throw err;
    }
    const title = String(data.title || '').trim();
    const message = String(data.message || '').trim();
    if (!title || !message) {
      throw new Error('عنوان الإشعار ونصه مطلوبان');
    }
    const created: NotificationItem = {
      id: `notif-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      title,
      message,
      type: data.type || 'info',
      target: data.target === 'members' ? 'members' : 'all',
      isActive: true,
      createdAt: Date.now(),
    };
    await syncFirestorePlatformNotifications([created, ...currentList]);
    return created;
  }
};

export const updateAdminNotification = async (
  token: string,
  id: string,
  data: Partial<NotificationItem>
): Promise<NotificationItem> => {
  const localItems = readLocalJson<NotificationItem[]>(LOCAL_NOTIFICATIONS_KEY, []);
  const firestoreItems = await readFirestorePlatformNotifications();
  const currentList = mergeNotificationLists(firestoreItems, localItems);

  try {
    const parsed = await fetchApiSafe(
      `/api/admin/notifications/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: authHeaders(token, true),
        body: JSON.stringify(data),
      },
      'تعذر تعديل الإشعار'
    );
    const updated = parsed.notification as NotificationItem;
    const nextList = currentList.map((n) => (n.id === id ? updated : n));
    await syncFirestorePlatformNotifications(nextList);
    return updated;
  } catch (err) {
    if (!isApiUnavailableError(err)) {
      throw err;
    }
    const existing = currentList.find((n) => n.id === id);
    if (!existing) {
      throw new Error('الإشعار غير موجود');
    }
    const updated: NotificationItem = { ...existing, ...data, id: existing.id };
    const nextList = currentList.map((n) => (n.id === id ? updated : n));
    await syncFirestorePlatformNotifications(nextList);
    return updated;
  }
};

export const deleteAdminNotification = async (token: string, id: string): Promise<void> => {
  const localItems = readLocalJson<NotificationItem[]>(LOCAL_NOTIFICATIONS_KEY, []);
  const firestoreItems = await readFirestorePlatformNotifications();
  const currentList = mergeNotificationLists(firestoreItems, localItems);
  const nextList = currentList.filter((n) => n.id !== id);

  try {
    await fetchApiSafe(
      `/api/admin/notifications/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: authHeaders(token),
      },
      'تعذر حذف الإشعار'
    );
    await syncFirestorePlatformNotifications(nextList);
  } catch (err) {
    if (!isApiUnavailableError(err)) {
      throw err;
    }
    await syncFirestorePlatformNotifications(nextList);
  }
};

// --- USERS ---

export interface AdminUserRecord extends AppUserProfile {
  recentViewsCount?: number;
  lastSeenAt?: number;
}

const mapFirestoreDocToUser = (docId: string, raw: Record<string, any>): AdminUserRecord => {
  const email = String(raw.email || '').trim();
  const displayName = String(
    raw.displayName || raw.name || (email ? email.split('@')[0] : 'مستخدم MASHHAD')
  ).trim();
  const photo = String(
    raw.picture ||
      raw.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=facc15&color=000&size=128&bold=true`
  );
  return {
    uid: String(raw.uid || docId),
    id: String(raw.id || docId),
    name: String(raw.name || displayName),
    displayName,
    email,
    emailVerified: Boolean(raw.emailVerified),
    picture: photo,
    photoURL: photo,
    joinedAt: Number(raw.joinedAt) || Date.now(),
    role:
      email.toLowerCase() === DEVELOPER_ADMIN_EMAIL
        ? 'مشرف المنصة'
        : String(raw.role || 'عضو مسجل'),
    disabled: Boolean(raw.disabled),
    favoriteGenre: raw.favoriteGenre,
    bio: raw.bio,
    watchTimeMinutes: Number(raw.watchTimeMinutes) || 0,
    recentViewsCount: Number(raw.recentViewsCount) || 0,
    lastSeenAt: Number(raw.updatedAt || raw.joinedAt) || Date.now(),
  };
};

const readFirestoreUsersSafe = async (): Promise<AdminUserRecord[]> => {
  if (!canUseAdminFirestore()) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => mapFirestoreDocToUser(d.id, d.data() as Record<string, any>));
  } catch (err) {
    if (!isFirestoreConnectivityError(err)) {
      console.warn('Firestore users list notice:', err);
    }
    return [];
  }
};

const mergeUserLists = (
  serverUsers: AdminUserRecord[],
  firestoreUsers: AdminUserRecord[],
  localShadowUsers: AdminUserRecord[],
  deletedIds: Set<string>
): AdminUserRecord[] => {
  const byEmailOrId = new Map<string, AdminUserRecord>();

  const upsert = (user: AdminUserRecord) => {
    if (!user) return;
    const id = String(user.id || user.uid || '');
    if (id && deletedIds.has(id)) return;
    const key = (user.email || '').trim().toLowerCase() || id;
    if (!key) return;
    const prev = byEmailOrId.get(key);
    if (!prev) {
      byEmailOrId.set(key, user);
    } else {
      byEmailOrId.set(key, {
        ...prev,
        ...user,
        id: user.id || prev.id,
        uid: user.uid || prev.uid,
        emailVerified: Boolean(prev.emailVerified || user.emailVerified),
        recentViewsCount: Math.max(prev.recentViewsCount || 0, user.recentViewsCount || 0),
        lastSeenAt: Math.max(prev.lastSeenAt || 0, user.lastSeenAt || 0),
      });
    }
  };

  serverUsers.forEach(upsert);
  firestoreUsers.forEach(upsert);
  localShadowUsers.forEach(upsert);

  const storedCurrent = getStoredVerifiedUser();
  if (storedCurrent && storedCurrent.email) {
    upsert({
      ...storedCurrent,
      lastSeenAt: Date.now(),
    });
  }

  return Array.from(byEmailOrId.values()).sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
};

export const fetchAdminUsers = async (token: string): Promise<AdminUserRecord[]> => {
  const deletedIds = new Set(readLocalJson<string[]>(LOCAL_USERS_DELETED_KEY, []));
  const localShadow = readLocalJson<AdminUserRecord[]>(LOCAL_USERS_SHADOW_KEY, []);
  const firestorePromise = readFirestoreUsersSafe();

  let serverUsers: AdminUserRecord[] = [];
  let serverError: unknown = null;

  try {
    const resData = await fetchApiSafe(
      '/api/admin/users',
      { headers: authHeaders(token) },
      'تعذر جلب قائمة المستخدمين'
    );
    serverUsers = Array.isArray(resData) ? (resData as AdminUserRecord[]) : [];
  } catch (err) {
    serverError = err;
  }

  const firestoreUsers = await firestorePromise;

  if (serverError && !isApiUnavailableError(serverError) && firestoreUsers.length === 0) {
    throw serverError;
  }

  const merged = mergeUserLists(serverUsers, firestoreUsers, localShadow, deletedIds);
  writeLocalJson(LOCAL_USERS_SHADOW_KEY, merged);
  return merged;
};

const syncFirestoreUserUpdate = async (
  id: string,
  updates: Partial<AdminUserRecord>
): Promise<AdminUserRecord | null> => {
  if (!canUseAdminFirestore()) return null;
  try {
    const userRef = doc(db, 'users', id);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;

    const existing = snap.data() as Record<string, any>;
    const nextDisplayName = String(
      updates.displayName ?? existing.displayName ?? existing.name ?? 'عضو MASHHAD'
    ).slice(0, 120);

    // Strictly conform to firestore.rules isValidUserProfile allowed fields
    const firestorePayload: Record<string, any> = {
      email: String(existing.email || updates.email || ''),
      displayName: nextDisplayName,
      name: nextDisplayName,
      updatedAt: Date.now(),
    };
    if (updates.role !== undefined) {
      firestorePayload.role = String(updates.role).slice(0, 40);
    }
    if (updates.emailVerified !== undefined) {
      firestorePayload.emailVerified = Boolean(updates.emailVerified);
    }
    await updateDoc(userRef, firestorePayload);
    return mapFirestoreDocToUser(id, { ...existing, ...firestorePayload, disabled: updates.disabled });
  } catch (err) {
    if (!isFirestoreConnectivityError(err)) {
      console.warn('Firestore user update notice:', err);
    }
    return null;
  }
};

export const updateAdminUser = async (
  token: string,
  id: string,
  updates: Partial<AdminUserRecord>
): Promise<AdminUserRecord> => {
  const localShadow = readLocalJson<AdminUserRecord[]>(LOCAL_USERS_SHADOW_KEY, []);

  try {
    const parsed = await fetchApiSafe(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: authHeaders(token, true),
        body: JSON.stringify(updates),
      },
      'تعذر تحديث حساب المستخدم'
    );
    await syncFirestoreUserUpdate(id, updates);
    const updatedUser = parsed.user as AdminUserRecord;
    writeLocalJson(
      LOCAL_USERS_SHADOW_KEY,
      localShadow.map((u) => (u.id === id ? { ...u, ...updatedUser } : u))
    );
    return updatedUser;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const isMissingOnExpress = msg.includes('غير موجود');
    if (!isApiUnavailableError(err) && !isMissingOnExpress) {
      throw err;
    }

    const fsUpdated = await syncFirestoreUserUpdate(id, updates);
    const targetLocal = localShadow.find((u) => u.id === id || u.uid === id);
    if (!fsUpdated && !targetLocal) {
      throw new Error('المستخدم غير موجود');
    }

    const base = fsUpdated || targetLocal!;
    if (base.email.toLowerCase() === DEVELOPER_ADMIN_EMAIL && updates.disabled === true) {
      throw new Error('لا يمكن تعطيل حساب المطور الرئيسي للمنصة');
    }

    const updated: AdminUserRecord = {
      ...base,
      ...updates,
      id: base.id,
      uid: base.uid,
      name: updates.displayName ?? base.displayName,
    };

    writeLocalJson(
      LOCAL_USERS_SHADOW_KEY,
      localShadow.some((u) => u.id === id)
        ? localShadow.map((u) => (u.id === id ? updated : u))
        : [updated, ...localShadow]
    );
    return updated;
  }
};

export const deleteAdminUser = async (token: string, id: string): Promise<void> => {
  const localShadow = readLocalJson<AdminUserRecord[]>(LOCAL_USERS_SHADOW_KEY, []);
  const deletedIds = readLocalJson<string[]>(LOCAL_USERS_DELETED_KEY, []);
  const target = localShadow.find((u) => u.id === id || u.uid === id);

  if (target && target.email.toLowerCase() === DEVELOPER_ADMIN_EMAIL) {
    throw new Error('لا يمكن حذف حساب المطور الرئيسي للمنصة');
  }

  try {
    await fetchApiSafe(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: authHeaders(token),
      },
      'تعذر حذف حساب المستخدم'
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!isApiUnavailableError(err) && !msg.includes('غير موجود')) {
      throw err;
    }
  }

  if (canUseAdminFirestore()) {
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      if (!isFirestoreConnectivityError(err)) {
        console.warn('Firestore user delete notice:', err);
      }
    }
  }

  writeLocalJson(
    LOCAL_USERS_SHADOW_KEY,
    localShadow.filter((u) => u.id !== id && u.uid !== id)
  );
  if (!deletedIds.includes(id)) {
    writeLocalJson(LOCAL_USERS_DELETED_KEY, [...deletedIds, id]);
  }
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
