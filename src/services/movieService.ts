import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, storage, handleFirestoreError, OperationType } from './firebase';
import { MediaItem } from '../types';
import { generateRandomRating, getEffectiveMediaRating } from '../utils/rating';
import {
  createMovie,
  updateMovie,
  deleteMovie,
  bulkDeleteMovies,
  uploadPosterFile,
  fetchAdminMovies,
  fetchPublishedMovies,
  fetchDeletedMovieIds,
  ApiUnavailableError,
  isApiUnavailableError,
} from './api';
import {
  addLocalDeletedMediaIds,
  getLocalDeletedMediaIds,
  removeLocalDeletedMediaId,
  removeMediaFromLocalUserData,
} from './storage';

export interface UploadProgressInfo {
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  speedFormatted: string;
  etaFormatted: string;
  phase: 'uploading' | 'paused' | 'verifying' | 'saving' | 'completed';
}

export interface UploadController {
  cancel: () => void;
  pause?: () => void;
  resume?: () => void;
  isCancelled: boolean;
  isPaused?: boolean;
}

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
};

/**
 * Extract real video duration (in Arabic minutes string) from a local video File using HTML5 metadata
 */
export const extractVideoDurationFromFile = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objUrl = URL.createObjectURL(file);
      let settled = false;

      const finish = (val: string) => {
        if (settled) return;
        settled = true;
        try {
          URL.revokeObjectURL(objUrl);
        } catch {
          // ignore
        }
        resolve(val);
      };

      const timeout = window.setTimeout(() => finish(''), 4000);

      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
          const totalSec = Math.round(video.duration);
          const mins = Math.max(1, Math.floor(totalSec / 60));
          finish(`${mins} دقيقة`);
        } else {
          finish('');
        }
      };

      video.onerror = () => {
        window.clearTimeout(timeout);
        finish('');
      };

      video.src = objUrl;
    } catch {
      resolve('');
    }
  });
};

/**
 * Strip `undefined` recursively before sending documents to Firebase Firestore
 */
const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        clean[k] = stripUndefinedDeep(v);
      }
    }
    return clean as T;
  }
  return value;
};

export const formatAdminErrorMessage = (err: unknown, fallback: string): string => {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (!raw) return fallback;

  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const errMsg = String(parsed?.error || '');
      const email = String(parsed?.authInfo?.email || '');
      if (
        errMsg.includes('Missing or insufficient permissions') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('insufficient permissions')
      ) {
        if (!email) {
          return 'الخادم غير متاح حالياً، وللحفظ أو الحذف عبر السحابة يرجى تسجيل الدخول بحساب المطور (frassa.wwindows@gmail.com) عبر زر Google في الملف الشخصي.';
        }
        if (email.toLowerCase() !== 'frassa.wwindows@gmail.com') {
          return 'لا تملك صلاحية التعديل أو الحذف في قاعدة البيانات السحابية. يرجى تسجيل الدخول بحساب المطور (frassa.wwindows@gmail.com).';
        }
        return 'تعذر تنفيذ العملية في قاعدة البيانات السحابية. تأكد من صحة البيانات المدخلة أو أعد المحاولة.';
      }
      if (errMsg) return errMsg;
    } catch {
      // fall through
    }
  }

  return raw || fallback;
};

const uploadMovieVideoToFirebase = (
  file: File,
  onProgress: (info: UploadProgressInfo) => void,
  controller?: UploadController
): Promise<{
  videoUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  storageType: 'firebase' | 'server';
}> => {
  return new Promise((resolve, reject) => {
    const ext = (file.name.split('.').pop() || 'mp4').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'mp4';
    const storagePath = `movies/videos/video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'video/mp4',
    });

    const startTime = Date.now();
    if (controller) {
      controller.isPaused = false;
      controller.pause = () => {
        if (controller.isCancelled) return;
        task.pause();
        controller.isPaused = true;
      };
      controller.resume = () => {
        if (controller.isCancelled) return;
        task.resume();
        controller.isPaused = false;
      };
      controller.cancel = () => {
        controller.isCancelled = true;
        task.cancel();
      };
    }

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.state === 'paused') {
          const pct = snapshot.totalBytes > 0 ? Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)) : 0;
          onProgress({
            percent: pct,
            loadedBytes: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            speedFormatted: 'تم إيقاف الرفع مؤقتاً',
            etaFormatted: 'اضغط استكمال للمتابعة',
            phase: 'paused',
          });
          return;
        }
        const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
        const speedBps = snapshot.bytesTransferred / elapsedSec;
        const speedMb = (speedBps / (1024 * 1024)).toFixed(1);
        const remaining = Math.max(0, snapshot.totalBytes - snapshot.bytesTransferred);
        const etaSec = speedBps > 0 ? Math.ceil(remaining / speedBps) : 0;
        const percent =
          snapshot.totalBytes > 0
            ? Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
            : 0;

        onProgress({
          percent,
          loadedBytes: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          speedFormatted: speedBps > 0 ? `${speedMb} MB/ث (التخزين السحابي)` : 'جارٍ الاتصال بالسحابة...',
          etaFormatted:
            etaSec > 60
              ? `متبقي ${Math.ceil(etaSec / 60)} دقيقة`
              : etaSec > 0
              ? `متبقي ${etaSec} ثانية`
              : 'لحظات...',
          phase: 'uploading',
        });
      },
      (err) => {
        if (controller?.isCancelled || err?.code === 'storage/canceled') {
          reject(new Error('تم إلغاء عملية الرفع من قبلك'));
          return;
        }
        reject(new Error('تعذر رفع الفيديو إلى الخادم أو التخزين السحابي'));
      },
      async () => {
        try {
          const videoUrl = await getDownloadURL(task.snapshot.ref);
          onProgress({
            percent: 100,
            loadedBytes: file.size,
            totalBytes: file.size,
            speedFormatted: 'اكتمل النقل بنجاح',
            etaFormatted: 'تم التحقق من الفيديو',
            phase: 'verifying',
          });
          resolve({
            videoUrl,
            storagePath,
            fileSizeBytes: file.size,
            storageType: 'firebase',
          });
        } catch {
          reject(new Error('تعذر الحصول على رابط الفيديو السحابي'));
        }
      }
    );
  });
};

/**
 * Legacy/Small-File single-stream XHR uploader
 */
const uploadMovieVideoSingleStream = async (
  file: File,
  token: string,
  onProgress: (info: UploadProgressInfo) => void,
  controller?: UploadController
): Promise<{
  videoUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  storageType: 'firebase' | 'server';
}> => {
  return await new Promise((resolve, reject) => {
    let serverLoaded = 0;
    let serverTime = Date.now();
    let serverSpeed = 0;

    const xhr = new XMLHttpRequest();
    if (controller) {
      controller.cancel = () => {
        controller.isCancelled = true;
        xhr.abort();
        reject(new Error('تم إلغاء عملية الرفع من قبلك'));
      };
    }

    const formData = new FormData();
    formData.append('video', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (controller?.isCancelled) return;
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
        const now = Date.now();
        const delta = (now - serverTime) / 1000;
        if (delta >= 0.2) {
          serverSpeed = (e.loaded - serverLoaded) / delta;
          serverLoaded = e.loaded;
          serverTime = now;
        }

        const speedMb = (serverSpeed / (1024 * 1024)).toFixed(1);
        const remainingBytes = Math.max(0, e.total - e.loaded);
        const etaSec = serverSpeed > 0 ? Math.ceil(remainingBytes / serverSpeed) : 0;

        onProgress({
          percent,
          loadedBytes: e.loaded,
          totalBytes: e.total,
          speedFormatted: serverSpeed > 0 ? `${speedMb} MB/ث` : 'جارٍ النقل بأقصى سرعة...',
          etaFormatted: etaSec > 60 ? `متبقي ${Math.ceil(etaSec / 60)} دقيقة` : etaSec > 0 ? `متبقي ${etaSec} ثانية` : 'لحظات...',
          phase: 'uploading',
        });
      }
    });

    xhr.addEventListener('load', () => {
      const rawText = xhr.responseText || '';
      const isHtmlOrEmpty = !rawText || rawText.trim().startsWith('<');
      if (xhr.status >= 200 && xhr.status < 300) {
        if (isHtmlOrEmpty) {
          reject(new ApiUnavailableError('استجابة غير صالحة من الخادم'));
          return;
        }
        try {
          const res = JSON.parse(rawText);
          if (res.success && res.videoUrl) {
            onProgress({
              percent: 100,
              loadedBytes: file.size,
              totalBytes: file.size,
              speedFormatted: 'اكتمل النقل بنجاح',
              etaFormatted: 'تم التحقق من الفيديو',
              phase: 'verifying',
            });
            resolve({
              videoUrl: res.videoUrl,
              storagePath: res.fileName || '',
              fileSizeBytes: res.fileSizeBytes || file.size,
              storageType: 'server',
            });
          } else {
            reject(new Error(res.error || 'فشل معالجة الفيديو في الخادم'));
          }
        } catch {
          reject(new ApiUnavailableError('استجابة غير صالحة من الخادم'));
        }
      } else if (xhr.status === 404 || xhr.status === 405 || xhr.status >= 502 || isHtmlOrEmpty) {
        reject(new ApiUnavailableError(`خدمة الرفع غير متاحة (${xhr.status})`));
      } else {
        try {
          const res = JSON.parse(rawText);
          reject(new Error(res.error || `خطأ في الرفع (${xhr.status})`));
        } catch {
          reject(new Error(`فشل رفع الفيديو (رمز الحالة: ${xhr.status})`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new ApiUnavailableError('انقطع الاتصال أثناء الرفع، تأكد من اتصالك بالإنترنت وأعد المحاولة'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('تم إلغاء عملية الرفع'));
    });

    xhr.open('POST', '/api/admin/upload-video');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

/**
 * Upload Video Directly with Real Pause / Resume / Cancel:
 * Splits large videos into 4MB raw binary chunks uploaded across 4 parallel HTTP connections
 * directly into disk offsets with automatic per-chunk retry and instant pause/resume gates.
 */
export const uploadMovieVideo = async (
  file: File,
  token: string,
  onProgress: (info: UploadProgressInfo) => void,
  controller?: UploadController
): Promise<{
  videoUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  storageType: 'firebase' | 'server';
}> => {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
  const CONCURRENCY = 4; // 4 parallel binary streams

  // For small files (<= 4MB), single stream is instantaneous
  if (file.size <= CHUNK_SIZE) {
    try {
      return await uploadMovieVideoSingleStream(file, token, onProgress, controller);
    } catch (err) {
      if (!controller?.isCancelled && isApiUnavailableError(err)) {
        return uploadMovieVideoToFirebase(file, onProgress, controller);
      }
      throw err;
    }
  }

  const abortController = new AbortController();
  let activeUploadId = '';
  let paused = false;
  let pausedAt = 0;
  let totalPausedMs = 0;
  let resumeWaiters: Array<() => void> = [];

  const waitIfPaused = async () => {
    while (paused && !controller?.isCancelled && !abortController.signal.aborted) {
      await new Promise<void>((resolve) => {
        resumeWaiters.push(resolve);
      });
    }
  };

  let uploadedBytes = 0;
  let nextChunkPointer = 0;
  const startTime = Date.now();
  let lastProgressEmit = 0;

  const emitProgress = (force = false) => {
    const now = Date.now();
    if (!force && now - lastProgressEmit < 150) return;
    lastProgressEmit = now;

    if (paused) {
      const percent = Math.min(99, Math.round((uploadedBytes / file.size) * 100));
      onProgress({
        percent,
        loadedBytes: uploadedBytes,
        totalBytes: file.size,
        speedFormatted: 'تم إيقاف الرفع مؤقتاً',
        etaFormatted: 'اضغط استكمال للمتابعة',
        phase: 'paused',
      });
      return;
    }

    const activeElapsedMs = Math.max(200, now - startTime - totalPausedMs);
    const elapsedSec = activeElapsedMs / 1000;
    const speedBps = uploadedBytes / elapsedSec;
    const speedMb = (speedBps / (1024 * 1024)).toFixed(1);
    const remainingBytes = Math.max(0, file.size - uploadedBytes);
    const etaSec = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : 0;
    const percent = Math.min(99, Math.round((uploadedBytes / file.size) * 100));

    onProgress({
      percent,
      loadedBytes: uploadedBytes,
      totalBytes: file.size,
      speedFormatted: speedBps > 0 ? `${speedMb} MB/ث (رفع متوازي ×4)` : 'جارٍ الاتصال...',
      etaFormatted:
        etaSec > 60
          ? `متبقي ${Math.ceil(etaSec / 60)} دقيقة`
          : etaSec > 0
          ? `متبقي ${etaSec} ثانية`
          : 'لحظات...',
      phase: 'uploading',
    });
  };

  if (controller) {
    controller.isPaused = false;
    controller.pause = () => {
      if (paused || controller.isCancelled) return;
      paused = true;
      pausedAt = Date.now();
      controller.isPaused = true;
      emitProgress(true);
    };
    controller.resume = () => {
      if (!paused || controller.isCancelled) return;
      paused = false;
      if (pausedAt > 0) {
        totalPausedMs += Date.now() - pausedAt;
        pausedAt = 0;
      }
      controller.isPaused = false;
      const waiters = resumeWaiters.splice(0);
      waiters.forEach((fn) => fn());
      emitProgress(true);
    };
    controller.cancel = () => {
      controller.isCancelled = true;
      paused = false;
      const waiters = resumeWaiters.splice(0);
      waiters.forEach((fn) => fn());
      abortController.abort();
      if (activeUploadId) {
        fetch('/api/admin/upload-video/abort', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uploadId: activeUploadId }),
        }).catch(() => {});
      }
    };
  }

  // 1. Initialize parallel upload session on server
  let initData: any = null;
  try {
    const initRes = await fetch('/api/admin/upload-video/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'video/mp4',
      }),
      signal: abortController.signal,
    });

    const initText = await initRes.text();
    if (!initRes.ok || !initText || initText.trim().startsWith('<')) {
      try {
        return await uploadMovieVideoSingleStream(file, token, onProgress, controller);
      } catch (singleErr) {
        if (!controller?.isCancelled && isApiUnavailableError(singleErr)) {
          return uploadMovieVideoToFirebase(file, onProgress, controller);
        }
        throw singleErr;
      }
    }

    initData = JSON.parse(initText);
    activeUploadId = initData?.uploadId || '';
    if (!activeUploadId) {
      throw new ApiUnavailableError('خدمة الرفع الجزئي غير متوفرة');
    }
  } catch (err: any) {
    if (controller?.isCancelled || abortController.signal.aborted) {
      throw new Error('تم إلغاء عملية الرفع من قبلك');
    }
    if (err instanceof TypeError || isApiUnavailableError(err) || err instanceof SyntaxError) {
      return uploadMovieVideoToFirebase(file, onProgress, controller);
    }
    throw err;
  }

  // 2. Build chunk queue
  const chunks: Array<{ index: number; start: number; end: number }> = [];
  for (let start = 0, index = 0; start < file.size; start += CHUNK_SIZE, index++) {
    chunks.push({
      index,
      start,
      end: Math.min(start + CHUNK_SIZE, file.size),
    });
  }

  emitProgress(true);

  const uploadSingleChunkWithRetry = async (chunk: { index: number; start: number; end: number }) => {
    const blob = file.slice(chunk.start, chunk.end);
    const chunkLen = chunk.end - chunk.start;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      await waitIfPaused();
      if (controller?.isCancelled || abortController.signal.aborted) {
        throw new Error('تم إلغاء عملية الرفع من قبلك');
      }
      try {
        const res = await fetch('/api/admin/upload-video/chunk', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'x-upload-id': activeUploadId,
            'x-chunk-offset': String(chunk.start),
            'x-chunk-index': String(chunk.index),
          },
          body: blob,
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `فشل رفع الجزء ${chunk.index + 1}`);
        }

        uploadedBytes += chunkLen;
        emitProgress(true);
        return;
      } catch (err: any) {
        if (controller?.isCancelled || abortController.signal.aborted || err?.name === 'AbortError') {
          throw new Error('تم إلغاء عملية الرفع من قبلك');
        }
        lastErr = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 350 * attempt));
        }
      }
    }
    throw lastErr || new Error('تعذر رفع جزء من الفيديو');
  };

  // 3. Run 4 parallel worker loops with pause check before acquiring each chunk
  try {
    const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
      while (nextChunkPointer < chunks.length) {
        await waitIfPaused();
        if (controller?.isCancelled || abortController.signal.aborted) {
          throw new Error('تم إلغاء عملية الرفع من قبلك');
        }
        if (nextChunkPointer >= chunks.length) break;
        const idx = nextChunkPointer++;
        const chunk = chunks[idx];
        await uploadSingleChunkWithRetry(chunk);
      }
    });

    await Promise.all(workers);

    onProgress({
      percent: 99,
      loadedBytes: file.size,
      totalBytes: file.size,
      speedFormatted: 'تثبيت الملف...',
      etaFormatted: 'لحظة واحدة...',
      phase: 'verifying',
    });

    const completeRes = await fetch('/api/admin/upload-video/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uploadId: activeUploadId }),
      signal: abortController.signal,
    });

    const completeData = await completeRes.json();
    if (!completeRes.ok || !completeData.success) {
      throw new Error(completeData.error || 'فشل إتمام رفع الفيديو');
    }

    onProgress({
      percent: 100,
      loadedBytes: file.size,
      totalBytes: file.size,
      speedFormatted: 'اكتمل النقل بنجاح',
      etaFormatted: 'تم التحقق من الفيديو',
      phase: 'verifying',
    });

    return {
      videoUrl: completeData.videoUrl,
      storagePath: completeData.fileName || '',
      fileSizeBytes: completeData.fileSizeBytes || file.size,
      storageType: 'server',
    };
  } catch (err: any) {
    if (activeUploadId) {
      fetch('/api/admin/upload-video/abort', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uploadId: activeUploadId }),
      }).catch(() => {});
    }
    throw err;
  }
};

/**
 * Upload Poster / Banner image with maximum speed and fallback
 */
export const uploadMoviePoster = async (
  file: File,
  token: string
): Promise<{ posterUrl: string; storagePath?: string }> => {
  try {
    const serverPosterUrl = await uploadPosterFile(file, token);
    return { posterUrl: serverPosterUrl };
  } catch (err) {
    console.warn('Server poster upload failed, attempting Firebase Storage fallback:', err);
    const ext = file.name.split('.').pop() || 'jpg';
    const safeFilename = `poster_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const storagePath = `movies/posters/${safeFilename}`;
    const storageReference = ref(storage, storagePath);
    const snapshot = await uploadBytesResumable(storageReference, file, {
      contentType: file.type || 'image/jpeg',
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return { posterUrl: downloadUrl, storagePath };
  }
};

/**
 * Save Movie / Series record to BOTH Server Database and Firebase Firestore
 */
export const saveMovieToDatabases = async (
  movieData: Partial<MediaItem>,
  token: string
): Promise<MediaItem> => {
  const mediaType = movieData.type === 'series' || movieData.type === 'anime' ? movieData.type : 'movie';
  const movieId =
    movieData.id || `${mediaType}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const now = Date.now();

  const finalMovie: MediaItem = {
    id: movieId,
    title: movieData.title || movieData.titleAr || 'Untitled Media',
    titleAr: movieData.titleAr || movieData.title || 'عمل سينمائي',
    originalTitle: movieData.originalTitle || movieData.title || '',
    type: mediaType,
    description: movieData.description || '',
    posterUrl: movieData.posterUrl || '',
    bannerUrl: movieData.bannerUrl || movieData.posterUrl || '',
    videoUrl: movieData.videoUrl || '',
    videoQuality: movieData.videoQuality || '1080p',
    ageRating: movieData.ageRating || '+16',
    duration: movieData.duration || (mediaType === 'series' ? 'مسلسل' : '120 دقيقة'),
    year: Number(movieData.year) || new Date().getFullYear(),
    rating: Number(movieData.rating) || generateRandomRating(),
    genres: Array.isArray(movieData.genres) && movieData.genres.length > 0 ? movieData.genres : ['action'],
    isPublished: movieData.isPublished !== false,
    isFeatured: Boolean(movieData.isFeatured),
    isLatest: movieData.isLatest !== false,
    isMostWatched: Boolean(movieData.isMostWatched),
    isComingSoon: Boolean(movieData.isComingSoon) && !(movieData.videoUrl || '').trim(),
    displayOrder: Number(movieData.displayOrder) || 0,
    viewsCount: Number(movieData.viewsCount) || 0,
    director: movieData.director || '',
    cast: Array.isArray(movieData.cast) ? movieData.cast : [],
    seasons: Array.isArray(movieData.seasons) ? movieData.seasons : [],
    sources: Array.isArray(movieData.sources) ? movieData.sources : [],
    introStart: typeof movieData.introStart === 'number' ? movieData.introStart : undefined,
    introEnd: typeof movieData.introEnd === 'number' ? movieData.introEnd : undefined,
    subtitleUrl: movieData.subtitleUrl || undefined,
    fileSizeBytes: Number(movieData.fileSizeBytes) || 0,
    storagePath: movieData.storagePath || '',
    storageType: movieData.storageType || 'server',
    createdAt: movieData.createdAt || now,
    updatedAt: now,
  };

  // 1. Save to Server Database when Express backend is active
  let targetMovie: MediaItem = finalMovie;
  let serverSaved = false;
  try {
    targetMovie = await createMovie(finalMovie, token);
    serverSaved = true;
  } catch (err) {
    if (!isApiUnavailableError(err)) {
      throw err;
    }
    console.warn('Server API unavailable during save, falling back to Firestore:', err);
  }

  removeLocalDeletedMediaId(targetMovie.id);

  // 2. Sync to Firebase Firestore
  try {
    await setDoc(doc(db, 'movies', targetMovie.id), stripUndefinedDeep(targetMovie));
  } catch (firestoreErr) {
    if (!serverSaved) {
      handleFirestoreError(firestoreErr, OperationType.WRITE, `movies/${targetMovie.id}`);
    }
    console.warn('Could not save to Firestore (Server record active):', firestoreErr);
  }

  return targetMovie;
};

/**
 * Update movie/series in Firestore and Server
 */
export const updateMovieInDatabases = async (
  id: string,
  updates: Partial<MediaItem>,
  token: string
): Promise<MediaItem> => {
  const now = Date.now();
  const updatePayload = stripUndefinedDeep({
    ...updates,
    updatedAt: now,
  });

  // 1. Update in Server API when active
  let serverResult: MediaItem | null = null;
  try {
    serverResult = await updateMovie(id, updatePayload, token);
  } catch (err) {
    if (!isApiUnavailableError(err)) {
      throw err;
    }
    console.warn('Server API unavailable during update, falling back to Firestore:', err);
  }

  // 2. Update in Firestore (use setDoc merge when full doc available, else updateDoc)
  try {
    const movieRef = doc(db, 'movies', id);
    if (serverResult) {
      await setDoc(movieRef, stripUndefinedDeep(serverResult), { merge: true });
    } else {
      try {
        await updateDoc(movieRef, updatePayload as Record<string, any>);
      } catch (updateErr: any) {
        if (updateErr?.code === 'not-found') {
          await setDoc(
            movieRef,
            stripUndefinedDeep({
              id,
              titleAr: updates.titleAr || updates.title || 'عمل سينمائي',
              ...updatePayload,
            }),
            { merge: true }
          );
        } else {
          throw updateErr;
        }
      }
    }
  } catch (err) {
    if (!serverResult) {
      handleFirestoreError(err, OperationType.UPDATE, `movies/${id}`);
    }
    console.warn('Firestore update warning:', err);
  }

  return serverResult || ({ id, ...updatePayload } as MediaItem);
};

/**
 * Delete movie/series from Server files, tombstones, banners/comments/views, Firebase Storage, Firestore, and local user data
 */
export const deleteMovieFromDatabases = async (
  movie: MediaItem,
  token: string
): Promise<void> => {
  addLocalDeletedMediaIds([movie.id]);
  removeMediaFromLocalUserData([movie.id]);

  let serverDeleted = false;
  try {
    await deleteMovie(movie.id, token, {
      titleAr: movie.titleAr,
      type: movie.type,
      videoUrl: movie.videoUrl,
      posterUrl: movie.posterUrl,
      bannerUrl: movie.bannerUrl,
      sources: movie.sources,
      seasons: movie.seasons,
    });
    serverDeleted = true;
  } catch (err) {
    if (!isApiUnavailableError(err)) {
      throw err;
    }
    console.warn('Server API unavailable during delete, falling back to Firestore:', err);
  }

  try {
    await deleteDoc(doc(db, 'movies', movie.id));
  } catch (err) {
    if (!serverDeleted) {
      handleFirestoreError(err, OperationType.DELETE, `movies/${movie.id}`);
    }
  }

  if (movie.storagePath && movie.storagePath.startsWith('movies/')) {
    try {
      const storageRef = ref(storage, movie.storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn('Firebase Storage delete warning:', err);
    }
  }
};

/**
 * Bulk delete multiple movies/series across the entire website in a single batch
 */
export const deleteMoviesBatchFromDatabases = async (
  movies: MediaItem[],
  token: string
): Promise<void> => {
  if (!movies.length) return;
  const ids = movies.map((m) => m.id).filter(Boolean);
  addLocalDeletedMediaIds(ids);
  removeMediaFromLocalUserData(ids);

  let serverDeleted = false;
  try {
    await bulkDeleteMovies(
      movies.map((m) => ({
        id: m.id,
        titleAr: m.titleAr,
        type: m.type,
        videoUrl: m.videoUrl,
        posterUrl: m.posterUrl,
        bannerUrl: m.bannerUrl,
        sources: m.sources,
        seasons: m.seasons,
      })),
      token
    );
    serverDeleted = true;
  } catch (err) {
    if (!isApiUnavailableError(err)) {
      throw err;
    }
    console.warn('Server API unavailable during bulk delete, falling back to Firestore:', err);
  }

  let firstFirestoreError: { err: unknown; id: string } | null = null;

  await Promise.all(
    movies.map(async (movie) => {
      try {
        await deleteDoc(doc(db, 'movies', movie.id));
      } catch (err) {
        if (!firstFirestoreError) {
          firstFirestoreError = { err, id: movie.id };
        }
      }
      if (movie.storagePath && movie.storagePath.startsWith('movies/')) {
        try {
          await deleteObject(ref(storage, movie.storagePath));
        } catch {
          // ignore
        }
      }
    })
  );

  if (!serverDeleted && firstFirestoreError) {
    handleFirestoreError(
      firstFirestoreError.err,
      OperationType.DELETE,
      `movies/${firstFirestoreError.id}`
    );
  }
};

/**
 * Fetch unified list of movies from Server API & Firestore (strictly excluding deleted tombstones)
 */
export const fetchAllMoviesUnified = async (token?: string): Promise<MediaItem[]> => {
  const moviesMap = new Map<string, MediaItem>();

  const [serverDeletedIds, serverMoviesResult] = await Promise.all([
    fetchDeletedMovieIds(),
    (token ? fetchAdminMovies(token) : fetchPublishedMovies()).catch((err) => {
      console.warn('Server API fetch warning:', err);
      return [] as MediaItem[];
    }),
  ]);

  const deletedSet = new Set<string>([
    ...getLocalDeletedMediaIds(),
    ...serverDeletedIds,
  ]);

  serverMoviesResult.forEach((m) => {
    if (m && m.id && !deletedSet.has(m.id)) {
      moviesMap.set(m.id, { ...m, rating: getEffectiveMediaRating(m) });
    }
  });

  try {
    const moviesCol = collection(db, 'movies');
    const q = query(moviesCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as MediaItem;
      const effectiveId = data?.id || docSnap.id;
      if (data && effectiveId && !deletedSet.has(effectiveId) && !moviesMap.has(effectiveId)) {
        const merged = { ...data, id: effectiveId };
        moviesMap.set(effectiveId, { ...merged, rating: getEffectiveMediaRating(merged) });
      }
    });
  } catch (err) {
    console.warn('Firestore fetch warning:', err);
  }

  const result = Array.from(moviesMap.values());
  result.sort((a, b) => {
    const orderA = Number(a.displayOrder) || 0;
    const orderB = Number(b.displayOrder) || 0;
    if (orderA > 0 && orderB > 0 && orderA !== orderB) return orderA - orderB;
    if (orderA > 0 && orderB === 0) return -1;
    if (orderB > 0 && orderA === 0) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return result;
};

/**
 * Fetch only published movies for public site visitors
 */
export const fetchPublishedMoviesUnified = async (): Promise<MediaItem[]> => {
  const all = await fetchAllMoviesUnified();
  return all.filter((m) => m.isPublished !== false);
};
