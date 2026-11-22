// Tracks user login activity timestamps in localStorage so Mishmish reacts when missed for >= 1 day

const MASHHAD_LAST_LOGIN_KEY = 'mashhad_last_login_at';
const MASHHAD_FIRST_SEEN_KEY = 'mashhad_first_seen_at';
export const MISHMISH_ABSENCE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day

export function ensureMishmishFirstSeen(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const existing = Number(localStorage.getItem(MASHHAD_FIRST_SEEN_KEY) || '0');
    if (Number.isFinite(existing) && existing > 0) {
      return existing;
    }
    const now = Date.now();
    localStorage.setItem(MASHHAD_FIRST_SEEN_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export function getMishmishLastLoginAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = Number(localStorage.getItem(MASHHAD_LAST_LOGIN_KEY) || '0');
    return Number.isFinite(val) && val > 0 ? val : null;
  } catch {
    return null;
  }
}

export function markMishmishLoginTimestamp(timestamp: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MASHHAD_LAST_LOGIN_KEY, String(timestamp));
    if (!localStorage.getItem(MASHHAD_FIRST_SEEN_KEY)) {
      localStorage.setItem(MASHHAD_FIRST_SEEN_KEY, String(timestamp));
    }
  } catch {
    // ignore storage quota restrictions
  }
}

/**
 * Returns true if the user has not logged in for at least 1 day (24 hours)
 * either since their last login or since their first visit to the site.
 */
export function hasMissedLoginForOneDay(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const lastLogin = getMishmishLastLoginAt();
    const referenceTs = lastLogin ?? ensureMishmishFirstSeen();
    return now - referenceTs >= MISHMISH_ABSENCE_THRESHOLD_MS;
  } catch {
    return false;
  }
}
