import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogIn,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import { AppUserProfile, InfoPageId } from '../../types';
import {
  loginUserWithPassword,
  setStoredVerifiedUser,
} from '../../services/api';
import {
  registerWithEmail,
  loginWithEmail,
  resetPassword,
  signInWithGoogle,
  getFirebaseAuthErrorMessage,
} from '../../services/firebase';
import { useLanguage } from '../../contexts/LanguageContext';
import { validateUsername } from '../../utils/username';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AppUserProfile) => void;
  onOpenDeveloperAccount: () => void;
  onOpenEmailSettings?: () => void;
  onOpenInfoPage?: (page: InfoPageId) => void;
  initialTab?: 'login' | 'register';
  currentUserEmail?: string | null;
}

type AuthTab = 'login' | 'register' | 'forgot_password';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenDeveloperAccount,
  onOpenInfoPage,
  initialTab = 'login',
  currentUserEmail,
}) => {
  const { lang, dir, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Form Fields
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDeveloperEmail =
    email.trim().toLowerCase() === 'frassa.wwindows@gmail.com' ||
    (currentUserEmail || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setAcceptedTerms(false);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const resetFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const switchTab = (newTab: AuthTab) => {
    resetFeedback();
    setActiveTab(newTab);
  };

  // 1. Standard Email & Password Login (no verification code gating)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage(
        t('يرجى إدخال البريد الإلكتروني وكلمة المرور', 'Please enter your email and password.')
      );
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage(
        t(
          'يرجى الموافقة على شروط الموقع الخاصة بنا للمتابعة.',
          'Please agree to our site terms to continue.'
        )
      );
      return;
    }

    setIsLoading(true);
    try {
      const fbUser = await loginWithEmail(cleanEmail, password);
      setIsLoading(false);
      setStoredVerifiedUser(fbUser);
      onSuccess(fbUser);
      onClose();
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/operation-not-allowed'
      ) {
        try {
          const res = await loginUserWithPassword(cleanEmail, password);
          if (res.user) {
            setIsLoading(false);
            setStoredVerifiedUser(res.user);
            onSuccess(res.user);
            onClose();
            return;
          }
        } catch {
          // Ignore legacy check if not matched
        }
      }
      setIsLoading(false);
      setErrorMessage(
        code
          ? getFirebaseAuthErrorMessage(code, lang)
          : fbErr?.message ||
              t('تأكد من البريد الإلكتروني وكلمة المرور', 'Invalid email or password.')
      );
    }
  };

  // 2. Standard Sign Up (direct entry without code steps)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setErrorMessage(t('يرجى ملء جميع الحقول', 'Please fill in all fields.'));
      return;
    }

    const usernameCheck = validateUsername(cleanName);
    if (!usernameCheck.valid) {
      setErrorMessage(
        lang === 'en'
          ? usernameCheck.errorEn || 'Invalid username.'
          : usernameCheck.errorAr || 'اسم المستخدم غير صالح.'
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        t('كلمة المرور 6 أحرف على الأقل', 'Password must be at least 6 characters.')
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('كلمتا المرور غير متطابقتين', 'Passwords do not match.'));
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage(
        t(
          'يرجى الموافقة على شروط الموقع الخاصة بنا للمتابعة.',
          'Please agree to our site terms to continue.'
        )
      );
      return;
    }

    setIsLoading(true);
    try {
      const fbUser = await registerWithEmail(cleanEmail, password, cleanName);
      setIsLoading(false);
      setStoredVerifiedUser(fbUser);
      onSuccess(fbUser);
      onClose();
    } catch (fbErr: any) {
      setIsLoading(false);
      const code = fbErr?.code || '';
      setErrorMessage(
        code
          ? getFirebaseAuthErrorMessage(code, lang)
          : fbErr?.message || t('تعذر إنشاء الحساب', 'Could not create account.')
      );
    }
  };

  // 3. Forgot Password Reset Email
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(t('يرجى إدخال بريد إلكتروني صحيح', 'Please enter a valid email.'));
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(cleanEmail);
      setIsLoading(false);
      setSuccessMessage(
        t(
          `تم إرسال رابط إعادة التعيين إلى (${cleanEmail})`,
          `Reset link sent to ${cleanEmail}`
        )
      );
    } catch (fbErr: any) {
      setIsLoading(false);
      const code = fbErr?.code || '';
      setErrorMessage(
        code
          ? getFirebaseAuthErrorMessage(code, lang)
          : fbErr?.message || t('تعذر إرسال الرابط', 'Failed to send reset link.')
      );
    }
  };

  // 4. Google Sign-In
  const handleGoogleSignIn = async () => {
    resetFeedback();
    if (!acceptedTerms) {
      setErrorMessage(
        t(
          'يرجى الموافقة على شروط الموقع الخاصة بنا للمتابعة.',
          'Please agree to our site terms to continue.'
        )
      );
      return;
    }
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      setIsLoading(false);
      if (user) {
        setStoredVerifiedUser(user);
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setIsLoading(false);
      const code = err?.code || '';
      setErrorMessage(
        code
          ? getFirebaseAuthErrorMessage(code, lang)
          : err?.message || t('تعذر تسجيل الدخول عبر Google', 'Google sign-in failed.')
      );
    }
  };

  const isPasswordsMatching = confirmPassword ? password === confirmPassword : true;

  const renderTermsConsent = () => (
    <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800/90 space-y-1.5">
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => {
            setAcceptedTerms(e.target.checked);
            if (e.target.checked && errorMessage) {
              setErrorMessage(null);
            }
          }}
          className="mt-0.5 w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 accent-amber-400 cursor-pointer shrink-0"
        />
        <span className="text-[11px] font-bold text-zinc-200 leading-snug">
          {t('هل توافق على شروط الموقع الخاصة بنا؟', 'Do you agree to our site terms?')}
        </span>
      </label>

      {onOpenInfoPage && (
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 ps-5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenInfoPage('terms');
            }}
            className="text-amber-400 hover:text-amber-300 hover:underline font-bold cursor-pointer"
          >
            {t('شروط الاستخدام', 'Terms of Use')}
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenInfoPage('privacy');
            }}
            className="text-amber-400 hover:text-amber-300 hover:underline font-bold cursor-pointer"
          >
            {t('سياسة الخصوصية', 'Privacy Policy')}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto select-none animate-fade-in font-sans"
    >
      {/* Compact Simple Modal */}
      <div
        className={`relative w-full max-w-[338px] bg-[#111116] border border-amber-500/25 rounded-2xl p-4 shadow-[0_24px_60px_rgba(0,0,0,0.92)] overflow-hidden my-auto animate-scale-up ${
          dir === 'ltr' ? 'text-left' : 'text-right'
        }`}
      >
        {isLoading && (
          <div className="absolute top-0 inset-x-0 h-0.5 bg-zinc-800 overflow-hidden z-20">
            <div className="h-full w-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 animate-pulse" />
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          type="button"
          className={`absolute top-3 ${
            dir === 'ltr' ? 'right-3' : 'left-3'
          } w-7 h-7 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10`}
          title={t('إغلاق', 'Close')}
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Compact Brand Header */}
        <div className="text-center pb-3">
          <h2 className="text-base font-black text-white tracking-tight">
            Golden<span className="text-amber-400">Flix</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {activeTab === 'login' && t('تسجيل الدخول', 'Sign In')}
            {activeTab === 'register' && t('إنشاء حساب جديد', 'Create Account')}
            {activeTab === 'forgot_password' && t('استعادة كلمة المرور', 'Reset Password')}
          </p>
        </div>

        {/* Simple Mode Switcher */}
        {activeTab !== 'forgot_password' && (
          <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px] font-bold mb-3">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-amber-400 text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3 h-3" />
              <span>{t('دخول', 'Sign In')}</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-amber-400 text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3 h-3" />
              <span>{t('حساب جديد', 'Sign Up')}</span>
            </button>
          </div>
        )}

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-2.5 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-[11px] flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-2.5 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-2.5">
            <div className="relative">
              <input
                type="email"
                required
                autoFocus
                placeholder={t('البريد الإلكتروني', 'Email address')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl py-2 text-xs text-white focus:outline-none transition-colors ${
                  dir === 'ltr' ? 'pl-8 pr-3' : 'pr-3 pl-8'
                }`}
              />
              <Mail
                className={`w-3.5 h-3.5 text-zinc-500 absolute top-2.5 ${
                  dir === 'ltr' ? 'left-2.5' : 'left-2.5'
                }`}
              />
            </div>

            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={t('كلمة المرور', 'Password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl py-2 text-xs text-white focus:outline-none transition-colors ${
                    dir === 'ltr' ? 'px-3 pr-8' : 'px-3 pl-8'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer ${
                    dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className={`mt-1 ${dir === 'ltr' ? 'text-right' : 'text-left'}`}>
                <button
                  type="button"
                  onClick={() => switchTab('forgot_password')}
                  className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer hover:underline"
                >
                  {t('نسيت كلمة المرور؟', 'Forgot password?')}
                </button>
              </div>
            </div>

            {renderTermsConsent()}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-black font-black text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              <span>{t('دخول', 'Sign In')}</span>
            </button>
          </form>
        )}

        {/* 2. REGISTER */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-2">
            {(() => {
              const liveCheck =
                displayName.trim().length > 0 ? validateUsername(displayName) : null;
              const hasLiveError = Boolean(liveCheck && !liveCheck.valid);
              return (
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type="text"
                      dir="ltr"
                      required
                      maxLength={24}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t('اسم مستخدم', 'Username')}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={`w-full bg-zinc-950 border rounded-xl py-2 text-[11px] font-latin-slim font-normal tracking-normal text-white focus:outline-none transition-colors placeholder:text-[11px] placeholder:font-normal ${
                        dir === 'rtl' && !displayName ? 'text-right' : 'text-left'
                      } ${
                        hasLiveError
                          ? 'border-rose-500/70 focus:border-rose-400'
                          : 'border-zinc-800 focus:border-amber-400'
                      } ${dir === 'ltr' ? 'pl-3 pr-8' : 'pl-8 pr-3'}`}
                    />
                    <User
                      className={`w-3.5 h-3.5 text-zinc-500 absolute top-2.5 ${
                        dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                      }`}
                    />
                  </div>
                  {hasLiveError && (
                    <p className="text-[10px] text-rose-400 leading-snug px-1">
                      {lang === 'en' ? liveCheck?.errorEn : liveCheck?.errorAr}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="relative">
              <input
                type="email"
                required
                placeholder={t('البريد الإلكتروني', 'Email address')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl py-2 text-xs text-white focus:outline-none ${
                  dir === 'ltr' ? 'px-3 pr-8' : 'px-3 pl-8'
                }`}
              />
              <Mail
                className={`w-3.5 h-3.5 text-zinc-500 absolute top-2.5 ${
                  dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                }`}
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder={t('كلمة المرور (6+ أحرف)', 'Password (6+ chars)')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl py-2 text-xs text-white focus:outline-none ${
                  dir === 'ltr' ? 'px-3 pr-8' : 'px-3 pl-8'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer ${
                  dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                }`}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              placeholder={t('تأكيد كلمة المرور', 'Confirm password')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full bg-zinc-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none ${
                confirmPassword && !isPasswordsMatching
                  ? 'border-rose-500/80'
                  : 'border-zinc-800 focus:border-amber-400'
              }`}
            />

            {renderTermsConsent()}

            <button
              type="submit"
              disabled={isLoading || !isPasswordsMatching}
              className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-black font-black text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>{t('إنشاء الحساب', 'Create Account')}</span>
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD */}
        {activeTab === 'forgot_password' && (
          <form onSubmit={handleForgotSubmit} className="space-y-2.5">
            <input
              type="email"
              required
              autoFocus
              placeholder={t('أدخل بريدك المسجل', 'Enter registered email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('إرسال رابط الاستعادة', 'Send Reset Link')}</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="w-full py-1 text-center text-[11px] text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center gap-1"
            >
              <span>{t('العودة لتسجيل الدخول', 'Back to Sign In')}</span>
              {dir === 'ltr' ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </button>
          </form>
        )}

        {/* Google Sign-In (strictly "Google") */}
        {activeTab !== 'forgot_password' && (
          <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Google</span>
            </button>
          </div>
        )}

        {/* VIP Membership Notice + Guest Option */}
        <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/25 text-[10px]">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('اشتراك VIP', 'VIP Subscription')}</span>
            </div>
            <span className="text-amber-200/90 font-black">
              {t('يتفعل قريباً', 'Coming Soon')}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white transition-colors cursor-pointer"
            >
              {t('تصفح كزائر', 'Guest mode')}
            </button>
            {isDeveloperEmail && (
              <button
                type="button"
                onClick={() => {
                  onOpenDeveloperAccount();
                  onClose();
                }}
                className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
              >
                {t('حساب مطور', 'Developer')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
