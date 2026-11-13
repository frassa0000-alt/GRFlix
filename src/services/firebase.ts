import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  getDocFromServer,
  query,
  orderBy,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUserProfile } from '../types';

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length
  ? initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    })
  : getApp();

export const auth = getAuth(firebaseApp);

// Initialize Firestore with specific database ID if provided
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Initialize Firebase Storage
export const storage = getStorage(firebaseApp);

// Ensure local persistence for secure session maintenance across browser reloads
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Could not set Firebase persistence:', err);
});

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
    if (msg.includes('permission') || msg.includes('PERMISSION_DENIED') || msg.includes('insufficient permissions')) {
      console.warn('Firestore profile read restricted (continuing with Firebase Auth profile):', msg);
      return null;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Register a new user with Email, Password, and Display Name
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AppUserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim() || cleanEmail.split('@')[0];

  // 1. Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const user = userCredential.user;

  // 2. Set display name in Auth profile
  const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    cleanName
  )}&background=facc15&color=000&size=128&bold=true`;

  try {
    await updateProfile(user, { displayName: cleanName, photoURL });
  } catch (e) {
    console.warn('Could not update Auth profile displayName:', e);
  }

  // 3. Send email verification link
  try {
    await sendEmailVerification(user);
  } catch (e) {
    console.warn('Could not send verification email on registration:', e);
  }

  // 4. Save User Document to Firestore
  const isDefaultAdmin = cleanEmail === DEVELOPER_ADMIN_EMAIL;
  const profileData: Partial<AppUserProfile> = {
    uid: user.uid,
    id: user.uid,
    name: cleanName,
    displayName: cleanName,
    email: cleanEmail,
    emailVerified: false,
    picture: photoURL,
    photoURL,
    joinedAt: Date.now(),
    role: isDefaultAdmin ? 'مشرف المنصة' : 'عضو مسجل',
    favoriteGenre: 'أفلام ومسلسلات',
    bio: 'مستمتع بمشاهدة أحدث الأعمال السينمائية على GoldenFlix Cinema.',
    watchTimeMinutes: 0,
  };

  try {
    await setDoc(doc(db, 'users', user.uid), profileData);
  } catch (err) {
    console.error('Could not save user profile to Firestore:', err);
  }

  return formatUserProfile(user, profileData);
}

/**
 * Sign in existing user with Email and Password
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AppUserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const user = userCredential.user;

  // Fetch Firestore metadata
  const firestoreProfile = await getUserProfile(user.uid);
  return formatUserProfile(user, firestoreProfile || undefined);
}

/**
 * Instant 1-Click Sign-In with Google (Provisioned in Firebase Auth)
 */
export async function signInWithGoogle(): Promise<AppUserProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Ensure auth token is ready before initial Firestore document read/write
  try {
    await user.getIdToken();
  } catch {
    // Non-fatal
  }

  const cleanEmail = (user.email || '').trim().toLowerCase();
  const displayName = user.displayName || cleanEmail.split('@')[0] || 'عضو GoldenFlix';
  const photoURL =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=facc15&color=000&size=128&bold=true`;

  let existingProfile = await getUserProfile(user.uid);
  if (!existingProfile) {
    const isDefaultAdmin = cleanEmail === DEVELOPER_ADMIN_EMAIL;
    const newProfile: Partial<AppUserProfile> = {
      uid: user.uid,
      id: user.uid,
      name: displayName,
      displayName,
      email: cleanEmail,
      emailVerified: true,
      picture: photoURL,
      photoURL,
      joinedAt: Date.now(),
      role: isDefaultAdmin ? 'مشرف المنصة' : 'عضو مسجل',
      favoriteGenre: 'أفلام سينمائية',
      bio: 'مستمتع بمشاهدة أحدث الأعمال السينمائية على GoldenFlix Cinema.',
      watchTimeMinutes: 0,
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile, { merge: true });
      existingProfile = newProfile;
    } catch (err) {
      console.warn('Could not sync Google profile to Firestore (continuing with auth session):', err);
    }
  }

  return formatUserProfile(user, existingProfile || undefined);
}

/**
 * Send real Password Reset Email to user's inbox
 */
export async function resetPassword(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Resend Email Verification link to currently signed-in user
 */
export async function resendVerificationEmail(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('لا يوجد حساب مسجل حالياً لإرسال رابط التحقق إليه');
  }
  await sendEmailVerification(currentUser);
}

/**
 * Update user profile in Firebase Auth and Firestore
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
  if (currentUser && updates.displayName) {
    await updateProfile(currentUser, {
      displayName: updates.displayName,
      photoURL: updates.photoURL || currentUser.photoURL,
    });
  }

  // Only write to Firestore when authenticated via Firebase Auth as this owner UID
  if (currentUser && currentUser.uid === uid) {
    const path = `users/${uid}`;
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(
        userDocRef,
        {
          ...updates,
          email: currentUser.email || '',
          displayName: updates.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'عضو GoldenFlix',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }

    const updatedSnap = await getUserProfile(uid);
    return formatUserProfile(currentUser, updatedSnap || undefined);
  }

  // Server-link session fallback without Firebase Auth uid match
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
 * Translate Firebase Auth error codes to user-friendly Arabic explanations
 */
export function getFirebaseAuthErrorMessage(errorCode: string): string {
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
      return 'تعذر الاتصال بالخادم، تأكد من اتصالك بالإنترنت.';
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد الإلكتروني غير مفعل في إعدادات Firebase.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة تسجيل الدخول بحساب Google قبل إتمام العملية.';
    case 'auth/popup-blocked':
      return 'المتصفح منع فتح نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.';
    case 'auth/unauthorized-domain':
      return 'النطاق الحالي غير مضاف في قائمة النطاقات المصرح بها في Firebase Auth.';
    case 'auth/requires-recent-login':
      return 'يرجى إعادة تسجيل الدخول لتنفيذ هذا الإجراء الأمني.';
    default:
      return 'حدث خطأ أثناء المصادقة، يرجى المحاولة مرة أخرى.';
  }
}
