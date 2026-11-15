import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  updateProfile,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
  ActionCodeSettings,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocFromServer,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUserProfile } from '../types';

const EMAIL_LINK_STORAGE_KEY = 'goldenflix_firebase_email_for_signin';

// Resolve optional Vercel/Vite environment overrides; fallback to firebase-applet-config.json
const envVars = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const hasCustomFirebaseEnv = Boolean(
  envVars.VITE_FIREBASE_API_KEY &&
    envVars.VITE_FIREBASE_AUTH_DOMAIN &&
    envVars.VITE_FIREBASE_PROJECT_ID
);

export const activeFirebaseConfig = hasCustomFirebaseEnv
  ? {
      apiKey: String(envVars.VITE_FIREBASE_API_KEY).trim(),
      authDomain: String(envVars.VITE_FIREBASE_AUTH_DOMAIN).trim(),
      projectId: String(envVars.VITE_FIREBASE_PROJECT_ID).trim(),
      storageBucket: String(envVars.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
      messagingSenderId: String(envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
      appId: String(envVars.VITE_FIREBASE_APP_ID || '').trim(),
      firestoreDatabaseId: String(envVars.VITE_FIREBASE_DATABASE_ID || '').trim(),
    }
  : firebaseConfig;

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length
  ? initializeApp({
      apiKey: activeFirebaseConfig.apiKey,
      authDomain: activeFirebaseConfig.authDomain,
      projectId: activeFirebaseConfig.projectId,
      storageBucket: activeFirebaseConfig.storageBucket,
      messagingSenderId: activeFirebaseConfig.messagingSenderId,
      appId: activeFirebaseConfig.appId,
    })
  : getApp();

export const auth = getAuth(firebaseApp);
auth.useDeviceLanguage();

// Initialize Firestore with specific database ID if provided
export const db = activeFirebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseApp, activeFirebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Initialize Firebase Storage
export const storage = getStorage(firebaseApp);

// Ensure local persistence for secure session maintenance across browser reloads
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Could not set Firebase persistence:', err);
});

/**
 * Dynamic return / redirect URL matching the current deployment origin (Vercel / AI Studio / localhost)
 */
export function getAuthContinueUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return 'https://gr-flix.vercel.app/';
}

export function getAuthActionCodeSettings(handleCodeInApp = false): ActionCodeSettings {
  return {
    url: getAuthContinueUrl(),
    handleCodeInApp,
  };
}

// Validate Connection to Firestore on startup as required by Firebase integration guidelines
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline connection check: please verify network connectivity.');
    }
  }
}
testFirestoreConnection();

export const DEVELOPER_ADMIN_EMAIL = 'frassa.wwindows@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Convert Firebase User and Firestore data to AppUserProfile
 */
export function formatUserProfile(
  user: User,
  firestoreData?: Partial<AppUserProfile>
): AppUserProfile {
  const isDefaultAdmin =
    user.email?.trim().toLowerCase() === DEVELOPER_ADMIN_EMAIL;

  const finalName =
    firestoreData?.displayName ||
    firestoreData?.name ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'مشاهد GoldenFlix';

  const defaultPhoto =
    user.photoURL ||
    firestoreData?.picture ||
    firestoreData?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      finalName
    )}&background=facc15&color=000&size=128&bold=true`;

  return {
    uid: user.uid,
    id: user.uid,
    name: finalName,
    displayName: finalName,
    email: user.email || '',
    emailVerified: user.emailVerified,
    picture: defaultPhoto,
    photoURL: defaultPhoto,
    joinedAt: firestoreData?.joinedAt || Date.now(),
    role: isDefaultAdmin ? 'مشرف المنصة' : 'عضو مسجل',
    favoriteGenre: firestoreData?.favoriteGenre || 'أفلام سينمائية',
    bio:
      firestoreData?.bio ||
      'مستمتع بمشاهدة أحدث الأعمال السينمائية بجودة فائقة على منصة GoldenFlix Cinema.',
    watchTimeMinutes: firestoreData?.watchTimeMinutes || 0,
  };
}

/**
 * Fetch user profile document from Firestore
 */
export async function getUserProfile(uid: string): Promise<Partial<AppUserProfile> | null> {
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
    return null;
  }
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as Partial<AppUserProfile>;
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('permission') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('insufficient permissions')
    ) {
      console.warn('Firestore profile read restricted (continuing with Firebase Auth profile):', msg);
      return null;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Sync authenticated Firebase User to Firestore users/{uid} cleanly matching security rules
 */
async function ensureFirestoreUserDocument(
  user: User,
  preferredName?: string,
  preferredPhoto?: string
): Promise<Partial<AppUserProfile> | null> {
  const cleanEmail = (user.email || '').trim().toLowerCase();
  const displayName =
    preferredName?.trim() ||
    user.displayName?.trim() ||
    cleanEmail.split('@')[0] ||
    'GoldenFlix Member';
  const rawPhotoURL =
    preferredPhoto ||
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=facc15&color=000&size=128&bold=true`;
  const photoURL =
    rawPhotoURL.length <= 950
      ? rawPhotoURL
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
          displayName
        )}&background=facc15&color=000&size=128&bold=true`;

  try {
    await user.getIdToken();
  } catch {
    // Non-fatal
  }

  let existingProfile = await getUserProfile(user.uid);
  const isVerifiedAdmin = cleanEmail === DEVELOPER_ADMIN_EMAIL && user.emailVerified;

  if (!existingProfile) {
    const newProfile: Partial<AppUserProfile> = {
      uid: user.uid,
      id: user.uid,
      name: displayName,
      displayName,
      email: cleanEmail,
      emailVerified: Boolean(user.emailVerified),
      picture: photoURL,
      photoURL,
      joinedAt: Date.now(),
      role: isVerifiedAdmin ? 'مشرف المنصة' : 'عضو مسجل',
      favoriteGenre: 'أفلام سينمائية',
      bio: 'مستمتع بمشاهدة أحدث الأعمال السينمائية على GoldenFlix Cinema.',
      watchTimeMinutes: 0,
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      existingProfile = newProfile;
    } catch (err) {
      console.warn('Could not create Firestore user doc (continuing with Auth session):', err);
    }
  } else if (user.emailVerified && existingProfile.emailVerified === false) {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        emailVerified: true,
        updatedAt: Date.now(),
      });
      existingProfile = { ...existingProfile, emailVerified: true };
    } catch {
      // Non-fatal
    }
  }

  return existingProfile;
}

/**
 * Register a new user with Email, Password, and Display Name via Firebase Auth
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AppUserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim() || cleanEmail.split('@')[0];

  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const user = userCredential.user;

  const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    cleanName
  )}&background=facc15&color=000&size=128&bold=true`;

  try {
    await updateProfile(user, { displayName: cleanName, photoURL });
  } catch (e) {
    console.warn('Could not update Auth profile displayName:', e);
  }

  const profileData = await ensureFirestoreUserDocument(user, cleanName, photoURL);
  return formatUserProfile(user, profileData || undefined);
}

/**
 * Sign in existing user with Email and Password via Firebase Auth
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AppUserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const user = userCredential.user;

  const firestoreProfile = await ensureFirestoreUserDocument(user);
  return formatUserProfile(user, firestoreProfile || undefined);
}

/**
 * 1-Click Sign-In with Google (Popup first, seamless Redirect fallback if blocked)
 */
export async function signInWithGoogle(): Promise<AppUserProfile | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const firestoreProfile = await ensureFirestoreUserDocument(user);
    return formatUserProfile(user, firestoreProfile || undefined);
  } catch (err: any) {
    const code = err?.code || '';
    // Automatic redirect fallback when browser/in-app webview blocks popups
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

/**
 * Complete pending Google redirect sign-in on page load (for mobile / popup-blocked environments)
 */
export async function completeGoogleRedirectResult(): Promise<AppUserProfile | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    const firestoreProfile = await ensureFirestoreUserDocument(result.user);
    return formatUserProfile(result.user, firestoreProfile || undefined);
  } catch (err: any) {
    console.warn('Google redirect completion notice:', err?.code || err?.message || err);
    throw err;
  }
}

/**
 * Passwordless Email Sign-In Link via Firebase Auth (fallback when server SMTP isn't deployed)
 */
export async function sendFirebaseSignInEmailLink(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  await sendSignInLinkToEmail(auth, cleanEmail, getAuthActionCodeSettings(true));
  try {
    localStorage.setItem(EMAIL_LINK_STORAGE_KEY, cleanEmail);
  } catch {
    // ignore storage errors
  }
}

export async function completeFirebaseEmailLinkSignIn(
  currentUrl: string
): Promise<AppUserProfile | null> {
  if (!isSignInWithEmailLink(auth, currentUrl)) {
    return null;
  }
  let email = '';
  try {
    email = localStorage.getItem(EMAIL_LINK_STORAGE_KEY) || '';
  } catch {
    // ignore
  }
  if (!email) {
    throw new Error('يرجى فتح رابط الدخول من نفس المتصفح الذي طلبت منه الرابط.');
  }
  const result = await signInWithEmailLink(auth, email, currentUrl);
  try {
    localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  } catch {
    // ignore
  }
  const firestoreProfile = await ensureFirestoreUserDocument(result.user);
  return formatUserProfile(result.user, firestoreProfile || undefined);
}

/**
 * Send real Password Reset Email to user's inbox with dynamic Vercel/origin redirect URL
 */
export async function resetPassword(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    await sendPasswordResetEmail(auth, cleanEmail, getAuthActionCodeSettings(false));
  } catch (err: any) {
    if (err?.code === 'auth/unauthorized-domain') {
      await sendPasswordResetEmail(auth, cleanEmail);
      return;
    }
    throw err;
  }
}

/**
 * Resend Email Verification link to currently signed-in user
 */
export async function resendVerificationEmail(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('لا يوجد حساب مسجل حالياً لإرسال رابط التحقق إليه');
  }
  await sendEmailVerification(currentUser, getAuthActionCodeSettings(false));
}

/**
 * Reload current Firebase user to detect newly confirmed email verification status
 */
export async function refreshCurrentFirebaseUser(): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  await currentUser.reload();
  const firestoreProfile = await ensureFirestoreUserDocument(currentUser);
  return formatUserProfile(currentUser, firestoreProfile || undefined);
}

/**
 * Upload user profile avatar to Server / Firebase Storage and return short valid URL
 */
export async function uploadUserAvatar(uid: string, file: File): Promise<string> {
  // 1. Try local Express image upload first if server is active
  try {
    const formData = new FormData();
    formData.append('poster', file);
    const res = await fetch('/api/upload/poster', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.url && typeof data.url === 'string') {
        return data.url;
      }
    }
  } catch {
    // Fallback to Firebase Storage on Vercel/static hosting
  }

  // 2. Firebase Storage upload (compatible with Vercel static hosting)
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'jpg';
  const avatarRef = ref(storage, `avatars/${uid}/avatar_${Date.now()}.${ext}`);
  await uploadBytes(avatarRef, file, { contentType: file.type || 'image/jpeg' });
  return await getDownloadURL(avatarRef);
}

/**
 * Update user profile in Firebase Auth and Firestore (name, picture/photoURL, bio, favoriteGenre)
 */
export async function updateUserProfile(
  uid: string,
  updates: {
    displayName?: string;
    bio?: string;
    favoriteGenre?: string;
    photoURL?: string;
  }
): Promise<AppUserProfile> {
  const currentUser = auth.currentUser;
  const safePhotoForCloud =
    updates.photoURL && updates.photoURL.length <= 950 ? updates.photoURL : undefined;

  if (currentUser && (updates.displayName || safePhotoForCloud)) {
    try {
      await updateProfile(currentUser, {
        displayName: updates.displayName || currentUser.displayName || undefined,
        photoURL: safePhotoForCloud || currentUser.photoURL || undefined,
      });
    } catch (e) {
      console.warn('Auth updateProfile notice:', e);
    }
  }

  // Only write to Firestore when authenticated via Firebase Auth as this owner UID
  if (currentUser && currentUser.uid === uid) {
    const nextDisplayName =
      updates.displayName ||
      currentUser.displayName ||
      currentUser.email?.split('@')[0] ||
      'عضو GoldenFlix';

    try {
      const userDocRef = doc(db, 'users', uid);
      const existingSnap = await getDoc(userDocRef);

      if (existingSnap.exists()) {
        const updatePayload: Record<string, any> = {
          displayName: nextDisplayName,
          name: nextDisplayName,
          updatedAt: Date.now(),
        };
        if (updates.bio !== undefined) updatePayload.bio = updates.bio;
        if (updates.favoriteGenre !== undefined) updatePayload.favoriteGenre = updates.favoriteGenre;
        if (safePhotoForCloud) {
          updatePayload.photoURL = safePhotoForCloud;
          updatePayload.picture = safePhotoForCloud;
        }
        await updateDoc(userDocRef, updatePayload);
      } else {
        await setDoc(userDocRef, {
          uid,
          id: uid,
          email: currentUser.email || '',
          displayName: nextDisplayName,
          name: nextDisplayName,
          bio: updates.bio || '',
          favoriteGenre: updates.favoriteGenre || 'أفلام سينمائية',
          photoURL: safePhotoForCloud || currentUser.photoURL || '',
          picture: safePhotoForCloud || currentUser.photoURL || '',
          emailVerified: Boolean(currentUser.emailVerified),
          role: 'عضو مسجل',
          joinedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      console.warn('Firestore profile update warning:', err);
    }

    const updatedSnap = await getUserProfile(uid);
    const formatted = formatUserProfile(currentUser, updatedSnap || undefined);
    if (updates.photoURL) {
      formatted.picture = updates.photoURL;
      formatted.photoURL = updates.photoURL;
    }
    return formatted;
  }

  // Non-Firebase session fallback
  return {
    uid,
    id: uid,
    name: updates.displayName || 'عضو GoldenFlix',
    displayName: updates.displayName || 'عضو GoldenFlix',
    email: '',
    emailVerified: true,
    picture: updates.photoURL || '',
    photoURL: updates.photoURL || '',
    joinedAt: Date.now(),
    role: 'عضو مسجل',
    favoriteGenre: updates.favoriteGenre || 'أفلام سينمائية',
    bio: updates.bio || '',
    watchTimeMinutes: 0,
  };
}

/**
 * Log out user safely and clear session
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Subscribe to real-time auth changes
 */
export function onAuthUserChanged(callback: (user: AppUserProfile | null) => void): () => void {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const firestoreProfile = await getUserProfile(firebaseUser.uid);
      const appUser = formatUserProfile(firebaseUser, firestoreProfile || undefined);
      callback(appUser);
    } catch {
      callback(formatUserProfile(firebaseUser));
    }
  });
}

/**
 * Translate Firebase Auth error codes to user-friendly Arabic / English messages
 */
export function getFirebaseAuthErrorMessage(
  errorCode: string,
  lang: 'ar' | 'en' = 'ar'
): string {
  const currentHost =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'gr-flix.vercel.app';

  if (lang === 'en') {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Invalid email address format. Please enter a valid email.';
      case 'auth/user-disabled':
        return 'This account has been disabled by the administrator.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password. Please verify your credentials.';
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. It must be at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a minute and try again.';
      case 'auth/network-request-failed':
        return 'Network error while connecting to Firebase Auth. Check your internet connection.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not enabled yet in Firebase Console (Authentication -> Sign-in method).';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'The Google sign-in window was closed before completing.';
      case 'auth/popup-blocked':
        return 'The browser blocked the sign-in popup. Please allow popups and try again.';
      case 'auth/unauthorized-domain':
        return `Domain "${currentHost}" is not in Firebase Auth Authorized Domains for project "${activeFirebaseConfig.projectId}". Add it in Firebase Console -> Authentication -> Settings -> Authorized domains.`;
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using another sign-in method.';
      case 'auth/requires-recent-login':
        return 'Please sign in again to complete this security action.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }

  switch (errorCode) {
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صالحة. يرجى إدخال بريد صحيح.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب من قبل الإدارة.';
    case 'auth/user-not-found':
      return 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'بيانات الحساب غير صحيحة، تأكد من البريد الإلكتروني وكلمة المرور.';
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجل بالفعل بحساب آخر. يرجى تسجيل الدخول.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف أو أرقام على الأقل.';
    case 'auth/too-many-requests':
      return 'تم حظر محاولات الدخول مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار دقيقة والمحاولة مجدداً.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بخادم المصادقة، تأكد من اتصالك بالإنترنت.';
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد الإلكتروني غير مفعل في Firebase Console. يرجى تفعيل Email/Password من Authentication -> Sign-in method.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'تم إغلاق نافذة تسجيل الدخول بحساب Google قبل إتمام العملية.';
    case 'auth/popup-blocked':
      return 'المتصفح منع فتح نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.';
    case 'auth/unauthorized-domain':
      return `النطاق الحالي (${currentHost}) غير مضاف في قائمة النطاقات المصرح بها في مشروع Firebase (${activeFirebaseConfig.projectId}). أضفه من Firebase Console -> Authentication -> Settings -> Authorized domains.`;
    case 'auth/account-exists-with-different-credential':
      return 'هذا البريد مسجل بالفعل بطريقة دخول أخرى. جرب تسجيل الدخول بالطريقة المرتبطة بحسابك.';
    case 'auth/requires-recent-login':
      return 'يرجى إعادة تسجيل الدخول لتنفيذ هذا الإجراء الأمني.';
    default:
      return 'حدث خطأ أثناء المصادقة، يرجى المحاولة مرة أخرى.';
  }
}
