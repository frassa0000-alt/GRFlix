import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  UserCheck,
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
import { MashhadLogo } from '../common/MashhadLogo';
import { AnimatedBrandSearchBar } from './AnimatedBrandSearchBar';
import { LoginRobotBuddy } from './LoginRobotBuddy';
import { hasMissedLoginForOneDay } from '../../utils/mishmishActivity';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AppUserProfile) => void;
  onOpenDeveloperAccount: () => void;
  onOpenEmailSettings?: () => void;
  onOpenInfoPage?: (page: InfoPageId) => void;
  initialTab?: 'login' | 'register';
  currentUserEmail?: string | null;
  hasAdminAccess?: boolean;
  allowNewRegistrations?: boolean;
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
  hasAdminAccess = false,
  allowNewRegistrations = true,
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
  const [isAbsentOneDay, setIsAbsentOneDay] = useState<boolean>(() =>
    hasMissedLoginForOneDay()
  );

  const isDeveloperEmail =
    email.trim().toLowerCase() === 'frassa.wwindows@gmail.com' ||
    (currentUserEmail || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com' ||
    Boolean(hasAdminAccess);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setAcceptedTerms(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsAbsentOneDay(hasMissedLoginForOneDay());
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

  // 1. Standard Email & Password Login
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

  // 2. Standard Sign Up
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (!allowNewRegistrations) {
      setErrorMessage(
        t(
          'تسجيل الحسابات الجديدة متوقف مؤقتاً من قبل الإدارة.',
          'New account registrations are temporarily closed.'
        )
      );
      return;
    }

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

  const activeStep = acceptedTerms ? 2 : 1;

  const onboardingSteps = [
    {
      num: 1,
      label:
        activeTab === 'register'
          ? t('تسجيل حسابك الجديد', 'Sign up your account')
          : activeTab === 'forgot_password'
          ? t('استعادة كلمة المرور', 'Reset your password')
          : t('تسجيل الدخول إلى حسابك', 'Sign in to your account'),
    },
    {
      num: 2,
      label: t('الموافقة على شروط المنصة', 'Accept platform terms'),
    },
    {
      num: 3,
      label: t('استمتع بالمشاهدة الفورية', 'Start watching movies'),
    },
  ];

  const renderTermsConsent = () => (
    <div className="pt-0.5 space-y-1.5">
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => {
            setAcceptedTerms(e.target.checked);
            if (e.target.checked && errorMessage) {
              setErrorMessage(null);
            }
          }}
          className="w-4 h-4 rounded border-white/20 bg-[#141418] accent-white cursor-pointer shrink-0"
        />
        <span className="text-[11.5px] font-bold text-zinc-300 leading-snug">
          {t('أوافق على شروط الموقع الخاصة بنا', 'I agree to the site terms & policies')}
        </span>
      </label>

      {onOpenInfoPage && (
        <div className="flex items-center gap-2 text-[10.5px] text-zinc-400 ps-6">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenInfoPage('terms');
            }}
            className="text-zinc-200 hover:text-white hover:underline font-bold cursor-pointer"
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
            className="text-zinc-200 hover:text-white hover:underline font-bold cursor-pointer"
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
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto select-none animate-fade-in font-sans"
    >
      {/* Split-Screen Authentication Card Matching Reference Design */}
      <div
        className={`relative w-full max-w-[900px] min-h-[540px] bg-[#050507] border border-white/[0.08] rounded-3xl shadow-[0_32px_90px_rgba(0,0,0,0.95)] overflow-hidden my-auto animate-scale-up grid grid-cols-1 md:grid-cols-12 ${
          dir === 'ltr' ? 'text-left' : 'text-right'
        }`}
      >
        {isLoading && (
          <div className="absolute top-0 inset-x-0 h-0.5 bg-zinc-900 overflow-hidden z-30">
            <div className="h-full w-full bg-gradient-to-r from-[#ea1d24] via-white to-[#ea1d24] animate-pulse" />
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className={`absolute top-3.5 ${
            dir === 'ltr' ? 'right-3.5' : 'left-3.5'
          } w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-20`}
          title={t('إغلاق', 'Close')}
          aria-label={t('إغلاق', 'Close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* PANEL 1: Luminous Top Aura Gradient Showcase Side */}
        <div
          className="relative md:col-span-6 p-6 sm:p-8 flex flex-col justify-end overflow-hidden min-h-[220px] md:min-h-[580px] border-b md:border-b-0 md:border-e border-white/[0.06]"
          style={{
            background:
              'radial-gradient(120% 72% at 50% -6%, rgba(255,255,255,0.94) 0%, rgba(182,118,245,0.72) 24%, rgba(107,33,168,0.56) 46%, rgba(30,10,48,0.34) 68%, #040306 88%)',
          }}
        >
          {/* Subtle Crimson Rim Infusion tying our Logo to the Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-44 rounded-full bg-[#ea1d24]/18 blur-3xl"
          />

          <div className="relative z-10 w-full max-w-[300px] mx-auto flex flex-col items-center text-center pt-10 sm:pt-16 md:pt-0 pb-2">
            {/* Brand Logo + Name */}
            <div className="inline-flex items-center gap-2.5 mb-4">
              <MashhadLogo
                className="w-8 h-8 shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
                roundedClassName="rounded-full"
              />
              <span className="text-lg font-black tracking-tight text-white">
                MASHHAD
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {t('ابدأ رحلتك معنا', 'Get Started with Us')}
            </h2>
            <p className="text-xs text-zinc-300/90 font-medium mt-1.5 max-w-[240px] leading-relaxed">
              {t(
                'أكمل هذه الخطوات البسيطة للوصول إلى مكتبة MASHHAD الكاملة.',
                'Complete these easy steps to access your MASHHAD account.'
              )}
            </p>

            {/* Compact Animated MASHHAD Glowing Search Bar */}
            <div className="mt-4 flex justify-center">
              <AnimatedBrandSearchBar />
            </div>

            {/* 3 Clean Step Cards Matching Reference */}
            <div className="w-full space-y-2.5 mt-4 hidden sm:block">
              {onboardingSteps.map((step) => {
                const isActive = activeStep === step.num;
                return (
                  <div
                    key={step.num}
                    className={`w-full rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                      isActive
                        ? 'bg-white text-black shadow-[0_12px_30px_rgba(0,0,0,0.45)]'
                        : 'bg-white/[0.08] border border-white/[0.06] text-zinc-300 backdrop-blur-md'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums ${
                        isActive
                          ? 'bg-black text-white'
                          : 'bg-white/[0.14] text-zinc-300'
                      }`}
                    >
                      {step.num}
                    </span>
                    <span className="text-xs font-bold truncate">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PANEL 2: Pure Pitch-Black Form Panel */}
        <div className="md:col-span-6 p-6 sm:p-8 bg-[#050507] flex flex-col justify-center">
          <div className="w-full max-w-[360px] mx-auto space-y-4">
            {/* Compact Interactive Robot Character + Heading */}
            <div className="text-center space-y-1.5">
              <div className="flex justify-center pb-0.5">
                <LoginRobotBuddy
                  isLoading={isLoading}
                  initialAbsentCry={isAbsentOneDay}
                />
              </div>
              <h1 className="text-xl sm:text-[22px] font-black text-white tracking-tight">
                {activeTab === 'login' && t('تسجيل الدخول', 'Sign In Account')}
                {activeTab === 'register' && t('إنشاء حساب جديد', 'Sign Up Account')}
                {activeTab === 'forgot_password' &&
                  t('استعادة كلمة المرور', 'Reset Password')}
              </h1>
              <p className="text-xs text-zinc-400 font-medium">
                {activeTab === 'login' &&
                  t(
                    'أدخل بياناتك الشخصية لتسجيل الدخول إلى حسابك.',
                    'Enter your personal data to sign in to your account.'
                  )}
                {activeTab === 'register' &&
                  t(
                    'أدخل بياناتك الشخصية لإنشاء حسابك الجديد.',
                    'Enter your personal data to create your account.'
                  )}
                {activeTab === 'forgot_password' &&
                  t(
                    'أدخل بريدك الإلكتروني المسجل لاستلام رابط الاستعادة.',
                    'Enter your registered email to receive a reset link.'
                  )}
              </p>
            </div>

            {/* Outlined Provider Buttons Row ("Google" + "Guest") Matching Reference */}
            {activeTab !== 'forgot_password' && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="h-11 px-3 rounded-xl bg-transparent hover:bg-white/[0.05] border border-white/[0.14] hover:border-white/30 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 px-3 rounded-xl bg-transparent hover:bg-white/[0.05] border border-white/[0.14] hover:border-white/30 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <UserCheck className="w-4 h-4 text-zinc-300 shrink-0" />
                    <span className="truncate">{t('تصفح كزائر', 'Guest')}</span>
                  </button>
                </div>

                {/* Hairline "Or" Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.09]" />
                  <span className="text-[11px] font-bold text-zinc-500">
                    {t('أو', 'Or')}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.09]" />
                </div>
              </>
            )}

            {/* Alerts */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="leading-snug">{successMessage}</span>
              </div>
            )}

            {/* 1. LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-200">
                    {t('البريد الإلكتروني', 'Email')}
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 bg-[#141418] border border-white/[0.08] focus:border-white/40 rounded-xl px-3.5 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-zinc-200">
                      {t('كلمة المرور', 'Password')}
                    </label>
                    <button
                      type="button"
                      onClick={() => switchTab('forgot_password')}
                      className="text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {t('نسيت كلمة المرور؟', 'Forgot password?')}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={t('أدخل كلمة المرور', 'Enter your password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full h-11 bg-[#141418] border border-white/[0.08] focus:border-white/40 rounded-xl text-xs font-bold text-white placeholder-zinc-500 focus:outline-none transition-colors ${
                        dir === 'ltr' ? 'pl-3.5 pr-10' : 'pr-3.5 pl-10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={t('إظهار أو إخفاء كلمة المرور', 'Toggle password visibility')}
                      className={`absolute top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer ${
                        dir === 'ltr' ? 'right-2.5' : 'left-2.5'
                      }`}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {renderTermsConsent()}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-black text-xs sm:text-[13px] shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{t('تسجيل الدخول', 'Sign In')}</span>
                </button>
              </form>
            )}

            {/* 2. REGISTER FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                {(() => {
                  const liveCheck =
                    displayName.trim().length > 0 ? validateUsername(displayName) : null;
                  const hasLiveError = Boolean(liveCheck && !liveCheck.valid);
                  return (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-200">
                        {t('اسم المستخدم', 'Username')}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        required
                        maxLength={24}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="eg. ahmed_99"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={`w-full h-11 bg-[#141418] border rounded-xl px-3.5 text-xs font-latin-slim font-normal tracking-normal text-white placeholder-zinc-500 focus:outline-none transition-colors ${
                          dir === 'rtl' && !displayName ? 'text-right' : 'text-left'
                        } ${
                          hasLiveError
                            ? 'border-rose-500/70 focus:border-rose-400'
                            : 'border-white/[0.08] focus:border-white/40'
                        }`}
                      />
                      {hasLiveError && (
                        <p className="text-[11px] text-rose-400 leading-snug">
                          {lang === 'en' ? liveCheck?.errorEn : liveCheck?.errorAr}
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-200">
                    {t('البريد الإلكتروني', 'Email')}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 bg-[#141418] border border-white/[0.08] focus:border-white/40 rounded-xl px-3.5 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-200">
                      {t('كلمة المرور', 'Password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder={t('أدخل كلمة المرور', 'Password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full h-11 bg-[#141418] border border-white/[0.08] focus:border-white/40 rounded-xl text-xs font-bold text-white placeholder-zinc-500 focus:outline-none transition-colors ${
                          dir === 'ltr' ? 'pl-3.5 pr-9' : 'pr-3.5 pl-9'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={t('إظهار أو إخفاء كلمة المرور', 'Toggle password visibility')}
                        className={`absolute top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer ${
                          dir === 'ltr' ? 'right-2' : 'left-2'
                        }`}
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-200">
                      {t('تأكيد المرور', 'Confirm')}
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder={t('تأكيد كلمة المرور', 'Confirm')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full h-11 bg-[#141418] border rounded-xl px-3.5 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none transition-colors ${
                        confirmPassword && !isPasswordsMatching
                          ? 'border-rose-500/80'
                          : 'border-white/[0.08] focus:border-white/40'
                      }`}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400">
                  {t('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.', 'Must be at least 6 characters.')}
                </p>

                {renderTermsConsent()}

                <button
                  type="submit"
                  disabled={isLoading || !isPasswordsMatching}
                  className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-black text-xs sm:text-[13px] shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{t('إنشاء الحساب', 'Sign Up')}</span>
                </button>
              </form>
            )}

            {/* 3. FORGOT PASSWORD FORM */}
            {activeTab === 'forgot_password' && (
              <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-200">
                    {t('البريد الإلكتروني المسجل', 'Registered Email')}
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 bg-[#141418] border border-white/[0.08] focus:border-white/40 rounded-xl px-3.5 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-black text-xs sm:text-[13px] shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{t('إرسال رابط الاستعادة', 'Send Reset Link')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="w-full py-1.5 text-center text-xs font-bold text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{t('العودة لتسجيل الدخول', 'Back to Log in')}</span>
                  {dir === 'ltr' ? (
                    <ArrowLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </form>
            )}

            {/* Bottom Account Mode Switcher Matching Reference ("Already have an account? Log in") */}
            {activeTab !== 'forgot_password' && (
              <div className="text-center pt-1 space-y-2.5">
                <p className="text-xs text-zinc-400 font-medium">
                  {activeTab === 'register' ? (
                    <>
                      {t('لديك حساب بالفعل؟', 'Already have an account?')}{' '}
                      <button
                        type="button"
                        onClick={() => switchTab('login')}
                        className="font-black text-white hover:underline cursor-pointer"
                      >
                        {t('تسجيل الدخول', 'Log in')}
                      </button>
                    </>
                  ) : (
                    <>
                      {t('ليس لديك حساب؟', "Don't have an account?")}{' '}
                      <button
                        type="button"
                        onClick={() => switchTab('register')}
                        className="font-black text-white hover:underline cursor-pointer"
                      >
                        {t('إنشاء حساب', 'Sign up')}
                      </button>
                    </>
                  )}
                </p>

                {isDeveloperEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDeveloperAccount();
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] text-[#ea1d24] hover:text-red-400 font-black cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('فتح لوحة المطور', 'Open Developer Console')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
