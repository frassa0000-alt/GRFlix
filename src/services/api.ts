import { MediaItem, AppUserProfile } from '../types';

const ADMIN_TOKEN_KEY = 'goldenflix_cinema_admin_token';
const ADMIN_EMAIL_KEY = 'goldenflix_cinema_admin_email';
const VERIFIED_USER_SESSION_KEY = 'goldenflix_verified_user_session';

export const getStoredVerifiedUser = (): AppUserProfile | null => {
  try {
    const raw = localStorage.getItem(VERIFIED_USER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.email ? parsed : null;
  } catch {
    return null;
  }
};

export const setStoredVerifiedUser = (user: AppUserProfile): void => {
  try {
    localStorage.setItem(VERIFIED_USER_SESSION_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota errors
  }
};

export const clearStoredVerifiedUser = (): void => {
  localStorage.removeItem(VERIFIED_USER_SESSION_KEY);
};

export const getStoredAdminToken = (): string | null => {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
};

export const setStoredAdminSession = (token: string, email: string): void => {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_EMAIL_KEY, email);
};

export const clearStoredAdminSession = (): void => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
};

// Fetch public published movies
export const fetchPublishedMovies = async (): Promise<MediaItem[]> => {
  try {
    const res = await fetch('/api/movies');
    if (!res.ok) {
      return [];
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return [];
    }
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch movies from server:', err);
    return [];
  }
};

// Fetch all movies (admin only)
export const fetchAdminMovies = async (token: string): Promise<MediaItem[]> => {
  try {
    const res = await fetch('/api/admin/movies', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      return [];
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return [];
    }
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch admin movies:', err);
    return [];
  }
};

const PRIMARY_ADMIN_EMAIL = 'frassa.wwindows@gmail.com';
const FALLBACK_ADMIN_TOKEN = 'goldenflix-cinema-super-admin-token-2025';
const ACCEPTED_ADMIN_PASSWORDS = new Set(['fr010020', 'GoldenFlix@Cinema2025']);

// Admin Login
export const loginAdmin = async (
  email: string,
  password: string
): Promise<{ token: string; email: string }> => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();
    const isHtmlOrEmpty = !text || text.trim().startsWith('<');

    if (!isHtmlOrEmpty) {
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (data && typeof data === 'object') {
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'فشل تسجيل الدخول');
        }
        setStoredAdminSession(data.token, data.email);
        return { token: data.token, email: data.email };
      }
    }
  } catch (err: any) {
    // Re-throw explicit API authentication errors (401/403/400)
    if (err instanceof Error && err.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
  }

  // Fallback for static / serverless / Firestore-only previews where /api/admin/login returns HTML or is unavailable
  if (cleanEmail !== PRIMARY_ADMIN_EMAIL) {
    throw new Error(`حساب المطور مخصص فقط للبريد الإلكتروني ${PRIMARY_ADMIN_EMAIL}`);
  }
  if (!ACCEPTED_ADMIN_PASSWORDS.has(cleanPass)) {
    throw new Error('كلمة المرور غير صحيحة');
  }

  setStoredAdminSession(FALLBACK_ADMIN_TOKEN, PRIMARY_ADMIN_EMAIL);
  return { token: FALLBACK_ADMIN_TOKEN, email: PRIMARY_ADMIN_EMAIL };
};

// Verify Admin Token
export const verifyAdminToken = async (token: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return token === FALLBACK_ADMIN_TOKEN;
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return token === FALLBACK_ADMIN_TOKEN;
    }
    const data = JSON.parse(text);
    return Boolean(data.authenticated);
  } catch {
    return token === FALLBACK_ADMIN_TOKEN;
  }
};

export class ApiUnavailableError extends Error {
  readonly isApiUnavailable = true;
  constructor(message: string) {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

export const isApiUnavailableError = (err: unknown): boolean =>
  Boolean(
    err &&
      typeof err === 'object' &&
      ((err as any).isApiUnavailable === true ||
        (err instanceof TypeError && String(err.message).toLowerCase().includes('fetch')))
  );

const safeParseJsonResponse = async (res: Response, fallbackError: string): Promise<any> => {
  const text = await res.text();
  if (!text || text.trim().startsWith('<')) {
    throw new ApiUnavailableError(fallbackError || 'استجابة غير متوقعة من الخادم');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiUnavailableError(fallbackError || 'فشل معالجة استجابة الخادم');
  }
};

// --- USER AUTHENTICATION & DIRECT EMAIL LINK VERIFICATION SERVICES ---

export interface RegisterLinkResponse {
  success: boolean;
  message: string;
  email: string;
  linkId: string;
  expiresInSeconds: number;
  provider?: string;
}

export interface VerifyLinkResponse {
  success: boolean;
  message: string;
  user: AppUserProfile;
}

export const registerUserWithLink = async (
  name: string,
  email: string,
  password: string
): Promise<RegisterLinkResponse> => {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await safeParseJsonResponse(res, 'فشل إرسال رابط التفعيل');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل تسجيل الحساب');
  }
  return data;
};

export const sendAuthLoginLink = async (
  email: string
): Promise<RegisterLinkResponse> => {
  const res = await fetch('/api/auth/send-login-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await safeParseJsonResponse(res, 'فشل إرسال رابط الدخول');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'تعذر إرسال رابط الدخول الآن');
  }
  return data;
};

export const verifyAuthEmailLink = async (
  token: string
): Promise<VerifyLinkResponse> => {
  const res = await fetch('/api/auth/verify-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await safeParseJsonResponse(res, 'فشل التحقق من رابط الدخول');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'رابط الدخول غير صالح أو منتهي الصلاحية');
  }
  return data;
};

export const checkAuthLinkStatus = async (
  linkId: string
): Promise<{ verified: boolean; user?: AppUserProfile }> => {
  try {
    const res = await fetch(`/api/auth/link-status?linkId=${encodeURIComponent(linkId)}`);
    if (!res.ok) return { verified: false };
    const data = await safeParseJsonResponse(res, '');
    return {
      verified: Boolean(data.verified),
      user: data.user,
    };
  } catch {
    return { verified: false };
  }
};

export const exchangeSupabaseMagicSession = async (
  accessToken: string
): Promise<VerifyLinkResponse> => {
  const res = await fetch('/api/auth/supabase-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });
  const data = await safeParseJsonResponse(res, 'فشل تسجيل الدخول عبر الرابط');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'رابط الدخول غير صالح أو منتهي الصلاحية');
  }
  return data;
};

export interface AuthDiagnosticsResponse {
  smtp: {
    configured: boolean;
    host: string | null;
    port: number | null;
    secure?: boolean;
    user: string | null;
    from?: string | null;
    verified: boolean;
    error: string | null;
  };
  supabase: {
    configured: boolean;
    url: string | null;
    connected: boolean;
    error: string | null;
  };
  resend?: {
    configured: boolean;
  };
  firebase: {
    configured: boolean;
    projectId: string;
  };
  realDeliveryReady: boolean;
}

export interface AdminMailConfigPayload {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass?: string;
  hasSmtpPass?: boolean;
  smtpFrom: string;
  resendApiKey?: string;
  hasResendKey?: boolean;
  supabaseUrl: string;
  supabaseAnonKey?: string;
  hasSupabaseKey?: boolean;
}

export const fetchAuthDiagnostics = async (): Promise<AuthDiagnosticsResponse> => {
  const res = await fetch('/api/auth/system-status');
  return safeParseJsonResponse(res, 'فشل جلب تشخيصات البريد');
};

export const fetchAdminMailConfig = async (token: string): Promise<AdminMailConfigPayload> => {
  const res = await fetch('/api/admin/mail-config', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await safeParseJsonResponse(res, 'فشل جلب إعدادات البريد');
  if (!res.ok) {
    throw new Error(data.error || 'فشل جلب إعدادات البريد');
  }
  return data;
};

export const saveAdminMailConfig = async (
  token: string,
  payload: AdminMailConfigPayload
): Promise<{ success: boolean; message?: string; error?: string; diagnostics?: AuthDiagnosticsResponse }> => {
  const res = await fetch('/api/admin/mail-config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await safeParseJsonResponse(res, 'فشل حفظ إعدادات البريد');
  if (!res.ok || !data.success) {
    const err: any = new Error(data.error || 'تعذر حفظ أو التحقق من إعدادات البريد');
    err.diagnostics = data.diagnostics;
    throw err;
  }
  return data;
};

export const loginUserWithPassword = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: AppUserProfile; requiresVerification?: boolean; linkId?: string }> => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await safeParseJsonResponse(res, 'فشل تسجيل الدخول');
  if (!res.ok) {
    if (data.requiresVerification) {
      const err: any = new Error(data.error || 'يرجى تأكيد الحساب أولاً عبر الرابط المرسل');
      err.requiresVerification = true;
      err.email = data.email || email;
      err.linkId = data.linkId;
      throw err;
    }
    throw new Error(data.error || 'بيانات الدخول غير صحيحة');
  }
  return data;
};

const isUnavailableHttpStatus = (status: number): boolean =>
  status === 404 || status === 405 || status === 502 || status === 503 || status === 504;

// Create movie
export const createMovie = async (
  movieData: Partial<MediaItem>,
  token: string
): Promise<MediaItem> => {
  let res: Response;
  try {
    res = await fetch('/api/admin/movies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(movieData),
    });
  } catch {
    throw new ApiUnavailableError('فشل حفظ الفيلم على الخادم');
  }

  if (isUnavailableHttpStatus(res.status)) {
    throw new ApiUnavailableError('فشل حفظ الفيلم على الخادم');
  }

  const data = await safeParseJsonResponse(res, 'فشل حفظ الفيلم على الخادم');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل حفظ الفيلم');
  }
  return data.movie;
};

// Update movie
export const updateMovie = async (
  id: string,
  updates: Partial<MediaItem>,
  token: string
): Promise<MediaItem> => {
  let res: Response;
  try {
    res = await fetch(`/api/admin/movies/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
  } catch {
    throw new ApiUnavailableError('فشل تحديث بيانات الفيلم');
  }

  if (isUnavailableHttpStatus(res.status)) {
    throw new ApiUnavailableError('فشل تحديث بيانات الفيلم');
  }

  const data = await safeParseJsonResponse(res, 'فشل تحديث بيانات الفيلم');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل تحديث بيانات الفيلم');
  }
  return data.movie;
};

// Delete movie (including metadata so Firestore-only items also clean up physical files & references)
export const deleteMovie = async (
  id: string,
  token: string,
  mediaMeta?: Partial<MediaItem>
): Promise<void> => {
  let res: Response;
  try {
    res = await fetch(`/api/admin/movies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mediaMeta || {}),
    });
  } catch {
    throw new ApiUnavailableError('فشل حذف الفيلم');
  }

  if (isUnavailableHttpStatus(res.status)) {
    throw new ApiUnavailableError('فشل حذف الفيلم');
  }

  const data = await safeParseJsonResponse(res, 'فشل حذف الفيلم');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل حذف الفيلم');
  }
};

// Bulk delete multiple movies/series at once across the whole site
export const bulkDeleteMovies = async (
  moviesMeta: Partial<MediaItem>[],
  token: string
): Promise<string[]> => {
  let res: Response;
  try {
    res = await fetch('/api/admin/movies/bulk-delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: moviesMeta }),
    });
  } catch {
    throw new ApiUnavailableError('فشل حذف الأعمال المحددة');
  }

  if (isUnavailableHttpStatus(res.status)) {
    throw new ApiUnavailableError('فشل حذف الأعمال المحددة');
  }

  const data = await safeParseJsonResponse(res, 'فشل حذف الأعمال المحددة');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل حذف الأعمال المحددة');
  }
  return Array.isArray(data.deletedIds) ? data.deletedIds : [];
};

// Fetch deleted movie tombstones so deleted items never reappear from cloud/cache
export const fetchDeletedMovieIds = async (): Promise<string[]> => {
  try {
    const res = await fetch('/api/movies/deleted-ids');
    if (!res.ok) return [];
    const data = await safeParseJsonResponse(res, '');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// Upload video file with progress tracking
export const uploadVideoFile = (
  file: File,
  token: string,
  onProgress: (percent: number, loadedBytes: number, totalBytes: number) => void
): Promise<{ videoUrl: string; fileSizeBytes: number; originalName: string }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('video', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent, e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            resolve({
              videoUrl: res.videoUrl,
              fileSizeBytes: res.fileSizeBytes,
              originalName: res.originalName,
            });
          } else {
            reject(new Error(res.error || 'فشل رفع ملف الفيديو'));
          }
        } catch {
          reject(new Error('استجابة غير صالحة من الخادم'));
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new Error(res.error || `خطأ في الرفع: ${xhr.status}`));
        } catch {
          reject(new Error(`خطأ في الرفع: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('انقطع الاتصال أثناء رفع ملف الفيديو. يرجى المحاولة مرة أخرى.'));
    });

    xhr.open('POST', '/api/admin/upload-video');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

// Upload poster image
export const uploadPosterFile = async (file: File, token: string): Promise<string> => {
  const formData = new FormData();
  formData.append('poster', file);

  const res = await fetch('/api/admin/upload-poster', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await safeParseJsonResponse(res, 'فشل رفع صورة البوستر');
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل رفع صورة البوستر');
  }

  return data.posterUrl;
};

export interface ServerStreamQuality {
  id: string;
  height: number | null;
  label: string;
  url?: string;
  status: 'ready' | 'processing';
  isOriginal?: boolean;
}

export interface ServerStreamOption {
  id: string;
  label: string;
  shortLabel: string;
  url: string;
  format: 'mp4' | 'hls';
  isDefault: boolean;
}

export interface VideoStreamsResponse {
  exists: boolean;
  valid?: boolean;
  sourceHeight: number | null;
  processing: boolean;
  hlsMasterUrl: string | null;
  qualities: ServerStreamQuality[];
  servers: ServerStreamOption[];
}

// Fetch real available player servers & transcode qualities for local uploaded videos
export const fetchVideoStreams = async (
  fileName: string
): Promise<VideoStreamsResponse | null> => {
  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(fileName)}/streams`);
    if (!res.ok) return null;
    const data = await safeParseJsonResponse(res, '');
    return data && typeof data.exists === 'boolean' ? data : null;
  } catch {
    return null;
  }
};

