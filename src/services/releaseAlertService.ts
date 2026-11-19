import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  isFirestoreConnectivityError,
  OperationType,
} from './firebase';
import {
  MediaAlertSubscription,
  MediaItem,
  MediaType,
  UserReleaseNotification,
} from '../types';

const ALERTS_STORAGE_KEY = 'goldenflix_media_alerts_v1';
const RELEASE_NOTIFS_STORAGE_KEY = 'goldenflix_release_notifications_v1';

const isSafeId = (id: string): boolean =>
  typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);

const clampStr = (val: unknown, maxLen: number): string =>
  String(val || '').trim().slice(0, maxLen);

const canUseCloudForUser = (uid?: string): uid is string =>
  Boolean(uid && auth.currentUser && auth.currentUser.uid === uid && isSafeId(uid));

export const countMediaEpisodes = (media: MediaItem): number => {
  if (!Array.isArray(media.seasons)) return 0;
  return media.seasons.reduce((sum, s) => sum + (Array.isArray(s.episodes) ? s.episodes.length : 0), 0);
};

export const getLatestEpisodeInfo = (
  media: MediaItem
): { seasonNumber: number; episodeNumber: number; title: string } | null => {
  if (!Array.isArray(media.seasons) || media.seasons.length === 0) return null;
  for (let si = media.seasons.length - 1; si >= 0; si--) {
    const season = media.seasons[si];
    const eps = Array.isArray(season?.episodes) ? season.episodes : [];
    if (eps.length > 0) {
      const lastEp = eps[eps.length - 1];
      return {
        seasonNumber: Number(season.seasonNumber) || si + 1,
        episodeNumber: Number(lastEp?.episodeNumber) || eps.length,
        title: clampStr(lastEp?.title, 120),
      };
    }
  }
  return null;
};

export const hasPlayableMediaVideo = (media: MediaItem): boolean => {
  if (Boolean(media.videoUrl && media.videoUrl.trim().length > 0)) return true;
  if (Array.isArray(media.sources) && media.sources.some((s) => Boolean(s?.url && s.url.trim()))) {
    return true;
  }
  if (
    Array.isArray(media.seasons) &&
    media.seasons.some((s) =>
      (s.episodes || []).some((ep) => Boolean(ep?.videoUrl && ep.videoUrl.trim()))
    )
  ) {
    return true;
  }
  return false;
};

export const isMediaComingSoon = (media: MediaItem): boolean => {
  if (hasPlayableMediaVideo(media)) return false;
  return Boolean(media.isComingSoon) || media.type !== 'series';
};

export const getStoredMediaAlerts = (): MediaAlertSubscription[] => {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredMediaAlerts = (alerts: MediaAlertSubscription[]): void => {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // ignore quota errors
  }
};

export const getStoredReleaseNotifications = (): UserReleaseNotification[] => {
  try {
    const raw = localStorage.getItem(RELEASE_NOTIFS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredReleaseNotifications = (list: UserReleaseNotification[]): void => {
  try {
    localStorage.setItem(RELEASE_NOTIFS_STORAGE_KEY, JSON.stringify(list.slice(0, 60)));
  } catch {
    // ignore quota errors
  }
};

const sanitizeAlertPayload = (sub: MediaAlertSubscription): Record<string, any> => {
  const payload: Record<string, any> = {
    mediaId: clampStr(sub.mediaId, 128),
    mediaTitle: clampStr(sub.mediaTitle, 200) || 'عمل سينمائي',
    mediaType: (['movie', 'series', 'anime'].includes(sub.mediaType)
      ? sub.mediaType
      : 'movie') as MediaType,
    knownEpisodeCount: Math.max(0, Number(sub.knownEpisodeCount) || 0),
    hadVideo: Boolean(sub.hadVideo),
    createdAt: Number(sub.createdAt) || Date.now(),
    updatedAt: Number(sub.updatedAt) || Date.now(),
  };
  if (sub.posterUrl) {
    payload.posterUrl = clampStr(sub.posterUrl, 2000);
  }
  if (typeof sub.knownUpdatedAt === 'number' && Number.isFinite(sub.knownUpdatedAt)) {
    payload.knownUpdatedAt = sub.knownUpdatedAt;
  }
  return payload;
};

const sanitizeNotificationPayload = (n: UserReleaseNotification): Record<string, any> => {
  const payload: Record<string, any> = {
    id: clampStr(n.id, 128),
    mediaId: clampStr(n.mediaId, 128),
    title: clampStr(n.title, 200) || 'تنبيه جديد',
    message: clampStr(n.message, 1000) || 'تم تحديث العمل المتابع',
    kind: (['new_episode', 'movie_added', 'media_updated'].includes(n.kind)
      ? n.kind
      : 'movie_added') as UserReleaseNotification['kind'],
    read: Boolean(n.read),
    createdAt: Number(n.createdAt) || Date.now(),
  };
  if (n.mediaTitle) payload.mediaTitle = clampStr(n.mediaTitle, 200);
  if (n.mediaType && ['movie', 'series', 'anime'].includes(n.mediaType)) {
    payload.mediaType = n.mediaType;
  }
  if (n.posterUrl) payload.posterUrl = clampStr(n.posterUrl, 2000);
  if (typeof n.episodeNumber === 'number' && Number.isFinite(n.episodeNumber)) {
    payload.episodeNumber = n.episodeNumber;
  }
  if (typeof n.seasonNumber === 'number' && Number.isFinite(n.seasonNumber)) {
    payload.seasonNumber = n.seasonNumber;
  }
  return payload;
};

export const syncAlertsAndNotificationsFromCloud = async (
  uid?: string
): Promise<{
  alerts: MediaAlertSubscription[];
  notifications: UserReleaseNotification[];
}> => {
  const localAlerts = getStoredMediaAlerts();
  const localNotifs = getStoredReleaseNotifications();

  if (!canUseCloudForUser(uid)) {
    return { alerts: localAlerts, notifications: localNotifs };
  }

  const alertsPath = `users/${uid}/alerts`;
  const notifsPath = `users/${uid}/notifications`;

  const alertMap = new Map<string, MediaAlertSubscription>();
  localAlerts.forEach((a) => {
    if (a?.mediaId) alertMap.set(a.mediaId, a);
  });

  try {
    const snap = await getDocs(collection(db, 'users', uid, 'alerts'));
    snap.forEach((docSnap) => {
      const data = docSnap.data() as MediaAlertSubscription;
      const key = data?.mediaId || docSnap.id;
      const existing = alertMap.get(key);
      if (!existing || (data.updatedAt || 0) >= (existing.updatedAt || 0)) {
        alertMap.set(key, { ...data, mediaId: key });
      }
    });
  } catch (err) {
    if (!isFirestoreConnectivityError(err)) {
      handleFirestoreError(err, OperationType.LIST, alertsPath);
    }
    console.warn('Firestore alerts sync offline fallback:', err);
  }

  const notifMap = new Map<string, UserReleaseNotification>();
  localNotifs.forEach((n) => {
    if (n?.id) notifMap.set(n.id, n);
  });

  try {
    const q = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as UserReleaseNotification;
      const id = data?.id || docSnap.id;
      const existing = notifMap.get(id);
      if (!existing || data.read) {
        notifMap.set(id, { ...data, id });
      }
    });
  } catch (err) {
    if (!isFirestoreConnectivityError(err)) {
      handleFirestoreError(err, OperationType.LIST, notifsPath);
    }
    console.warn('Firestore notifications sync offline fallback:', err);
  }

  const mergedAlerts = Array.from(alertMap.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  const mergedNotifs = Array.from(notifMap.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 60);

  saveStoredMediaAlerts(mergedAlerts);
  saveStoredReleaseNotifications(mergedNotifs);

  return { alerts: mergedAlerts, notifications: mergedNotifs };
};

export const toggleMediaAlertSubscription = async (
  media: MediaItem,
  uid?: string
): Promise<{ subscribed: boolean; alerts: MediaAlertSubscription[] }> => {
  const current = getStoredMediaAlerts();
  const exists = current.some((a) => a.mediaId === media.id);

  if (exists) {
    const updated = current.filter((a) => a.mediaId !== media.id);
    saveStoredMediaAlerts(updated);
    if (canUseCloudForUser(uid) && isSafeId(media.id)) {
      const path = `users/${uid}/alerts/${media.id}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'alerts', media.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
    return { subscribed: false, alerts: updated };
  }

  const now = Date.now();
  const newSub: MediaAlertSubscription = {
    mediaId: media.id,
    mediaTitle: clampStr(media.titleAr || media.title, 200) || 'عمل سينمائي',
    mediaType: media.type === 'series' || media.type === 'anime' ? media.type : 'movie',
    posterUrl: clampStr(media.posterUrl || media.bannerUrl, 2000) || '',
    knownEpisodeCount: countMediaEpisodes(media),
    hadVideo: hasPlayableMediaVideo(media),
    knownUpdatedAt: media.updatedAt || media.createdAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newSub, ...current.filter((a) => a.mediaId !== media.id)];
  saveStoredMediaAlerts(updated);

  if (canUseCloudForUser(uid) && isSafeId(media.id)) {
    const path = `users/${uid}/alerts/${media.id}`;
    try {
      await setDoc(doc(db, 'users', uid, 'alerts', media.id), sanitizeAlertPayload(newSub));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  return { subscribed: true, alerts: updated };
};

export const removeMediaAlertSubscription = async (
  mediaId: string,
  uid?: string
): Promise<MediaAlertSubscription[]> => {
  const updated = getStoredMediaAlerts().filter((a) => a.mediaId !== mediaId);
  saveStoredMediaAlerts(updated);

  if (canUseCloudForUser(uid) && isSafeId(mediaId)) {
    const path = `users/${uid}/alerts/${mediaId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'alerts', mediaId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
  return updated;
};

const showBrowserReleaseNotification = (n: UserReleaseNotification): void => {
  try {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification(n.title, {
        body: n.message,
        icon: n.posterUrl || undefined,
        tag: n.id,
      });
    }
  } catch {
    // Ignore environments blocking Notification constructor
  }
};

export const evaluateMediaReleaseAlerts = async (
  mediaItems: MediaItem[],
  uid?: string
): Promise<{
  newNotifications: UserReleaseNotification[];
  allNotifications: UserReleaseNotification[];
  alerts: MediaAlertSubscription[];
}> => {
  const alerts = getStoredMediaAlerts();
  const existingNotifs = getStoredReleaseNotifications();

  if (alerts.length === 0 || mediaItems.length === 0) {
    return { newNotifications: [], allNotifications: existingNotifs, alerts };
  }

  const mediaMap = new Map<string, MediaItem>();
  mediaItems.forEach((m) => {
    if (m?.id) mediaMap.set(m.id, m);
  });

  const existingNotifIds = new Set(existingNotifs.map((n) => n.id));
  const newlyTriggered: UserReleaseNotification[] = [];
  const updatedAlerts: MediaAlertSubscription[] = [];
  const changedAlertSubs: MediaAlertSubscription[] = [];
  const now = Date.now();

  for (const sub of alerts) {
    const current = mediaMap.get(sub.mediaId);
    if (!current) {
      updatedAlerts.push(sub);
      continue;
    }

    const currentTitle = clampStr(current.titleAr || current.title || sub.mediaTitle, 200);
    const currentEpCount = countMediaEpisodes(current);
    const currentHasVideo = hasPlayableMediaVideo(current);
    const currentUpdatedAt = Number(current.updatedAt || current.createdAt || now);

    let triggered: UserReleaseNotification | null = null;

    if ((current.type === 'series' || currentEpCount > 0) && currentEpCount > sub.knownEpisodeCount) {
      const diff = currentEpCount - sub.knownEpisodeCount;
      const latestEp = getLatestEpisodeInfo(current);
      const epLabel = latestEp
        ? `الموسم ${latestEp.seasonNumber} · الحلقة ${latestEp.episodeNumber}${
            latestEp.title ? ` (${latestEp.title})` : ''
          }`
        : `${diff} حلقة جديدة`;
      const notifId = `rel-ep-${current.id}-${currentEpCount}`;
      if (!existingNotifIds.has(notifId)) {
        triggered = {
          id: notifId,
          mediaId: current.id,
          mediaTitle: currentTitle,
          mediaType: current.type,
          posterUrl: clampStr(current.posterUrl || current.bannerUrl || sub.posterUrl, 2000),
          title: clampStr(`حلقة جديدة من ${currentTitle}`, 200),
          message: clampStr(
            diff > 1
              ? `تمت إضافة ${diff} حلقات جديدة (${epLabel}) وهي متوفرة الآن للمشاهدة.`
              : `توفرت ${epLabel} الآن للمشاهدة على MASHHAD.`,
            1000
          ),
          kind: 'new_episode',
          read: false,
          episodeNumber: latestEp?.episodeNumber || currentEpCount,
          seasonNumber: latestEp?.seasonNumber || 1,
          createdAt: now,
        };
      }
    } else if (!sub.hadVideo && currentHasVideo) {
      const notifId = `rel-mov-${current.id}-${currentUpdatedAt}`;
      if (!existingNotifIds.has(notifId)) {
        triggered = {
          id: notifId,
          mediaId: current.id,
          mediaTitle: currentTitle,
          mediaType: current.type,
          posterUrl: clampStr(current.posterUrl || current.bannerUrl || sub.posterUrl, 2000),
          title: clampStr(`تمت إضافة ${currentTitle}`, 200),
          message: clampStr(
            `أصبح ${current.type === 'series' ? 'المسلسل' : 'الفيلم'} متاحاً للمشاهدة الآن${
              current.videoQuality ? ` بجودة ${current.videoQuality}` : ''
            }.`,
            1000
          ),
          kind: 'movie_added',
          read: false,
          createdAt: now,
        };
      }
    }

    if (triggered) {
      newlyTriggered.push(triggered);
      existingNotifIds.add(triggered.id);
      const nextSub: MediaAlertSubscription = {
        ...sub,
        mediaTitle: currentTitle,
        posterUrl: clampStr(current.posterUrl || current.bannerUrl || sub.posterUrl, 2000),
        knownEpisodeCount: Math.max(sub.knownEpisodeCount, currentEpCount),
        hadVideo: sub.hadVideo || currentHasVideo,
        knownUpdatedAt: currentUpdatedAt,
        updatedAt: now,
      };
      updatedAlerts.push(nextSub);
      changedAlertSubs.push(nextSub);
    } else {
      updatedAlerts.push(sub);
    }
  }

  if (newlyTriggered.length === 0) {
    return { newNotifications: [], allNotifications: existingNotifs, alerts: updatedAlerts };
  }

  const allNotifications = [...newlyTriggered, ...existingNotifs]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 60);

  saveStoredMediaAlerts(updatedAlerts);
  saveStoredReleaseNotifications(allNotifications);

  newlyTriggered.forEach(showBrowserReleaseNotification);

  if (canUseCloudForUser(uid)) {
    for (const n of newlyTriggered) {
      if (!isSafeId(n.id) || !isSafeId(n.mediaId)) continue;
      const path = `users/${uid}/notifications/${n.id}`;
      try {
        await setDoc(doc(db, 'users', uid, 'notifications', n.id), sanitizeNotificationPayload(n));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
    for (const sub of changedAlertSubs) {
      if (!isSafeId(sub.mediaId)) continue;
      const path = `users/${uid}/alerts/${sub.mediaId}`;
      try {
        await updateDoc(doc(db, 'users', uid, 'alerts', sub.mediaId), {
          mediaTitle: clampStr(sub.mediaTitle, 200),
          posterUrl: clampStr(sub.posterUrl, 2000),
          knownEpisodeCount: sub.knownEpisodeCount,
          hadVideo: sub.hadVideo,
          knownUpdatedAt: sub.knownUpdatedAt || Date.now(),
          updatedAt: sub.updatedAt,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  }

  return { newNotifications: newlyTriggered, allNotifications, alerts: updatedAlerts };
};

export const markReleaseNotificationRead = async (
  notifId: string,
  uid?: string
): Promise<UserReleaseNotification[]> => {
  const updated = getStoredReleaseNotifications().map((n) =>
    n.id === notifId ? { ...n, read: true } : n
  );
  saveStoredReleaseNotifications(updated);

  if (canUseCloudForUser(uid) && isSafeId(notifId)) {
    const path = `users/${uid}/notifications/${notifId}`;
    try {
      await updateDoc(doc(db, 'users', uid, 'notifications', notifId), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
  return updated;
};

export const markAllReleaseNotificationsRead = async (
  uid?: string
): Promise<UserReleaseNotification[]> => {
  const current = getStoredReleaseNotifications();
  const unread = current.filter((n) => !n.read);
  const updated = current.map((n) => ({ ...n, read: true }));
  saveStoredReleaseNotifications(updated);

  if (canUseCloudForUser(uid) && unread.length > 0) {
    for (const n of unread) {
      if (!isSafeId(n.id)) continue;
      const path = `users/${uid}/notifications/${n.id}`;
      try {
        await updateDoc(doc(db, 'users', uid, 'notifications', n.id), { read: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  }
  return updated;
};

export const clearReleaseNotification = async (
  notifId: string,
  uid?: string
): Promise<UserReleaseNotification[]> => {
  const updated = getStoredReleaseNotifications().filter((n) => n.id !== notifId);
  saveStoredReleaseNotifications(updated);

  if (canUseCloudForUser(uid) && isSafeId(notifId)) {
    const path = `users/${uid}/notifications/${notifId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'notifications', notifId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
  return updated;
};
