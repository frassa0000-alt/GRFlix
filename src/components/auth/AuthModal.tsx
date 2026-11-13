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
  KeyRound,
  ShieldCheck,
  Send,
  Timer,
  LogIn,
  UserPlus,
  ArrowRight,
  Link2,
} from 'lucide-react';
import { AppUserProfile } from '../../types';
import {
  registerUserWithLink,
  sendAuthLoginLink,
  checkAuthLinkStatus,
  loginUserWithPassword,
  setStoredVerifiedUser,
} from '../../services/api';
import { signInWithGoogle, getFirebaseAuthErrorMessage } from '../../services/firebase';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AppUserProfile) => void;
  onOpenDeveloperAccount: () => void;
  onOpenEmailSettings?: () => void;
  initialTab?: 'login' | 'register';
  currentUserEmail?: string | null;
}

type AuthTab = 'login' | 'register' | 'link_sent' | 'forgot_password';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenDeveloperAccount,
  onOpenEmailSettings,
  initialTab = 'login',
  currentUserEmail,
}) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Form Fields
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Direct Email Link State & Timers (15-minute validity, 60s resend cooldown)
  const [pendingLinkId, setPendingLinkId] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [validitySeconds, setValiditySeconds] = useState<number>(900);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDeveloperEmail =
    email.trim().toLowerCase() === 'frassa.wwindows@gmail.com' ||
    (currentUserEmail || '').trim().toLowerCase() === 'frassa.wwindows@gmail.com';

  // Synchronize initialTab prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialTab]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // 15-minute link validity expiration timer
  useEffect(() => {
    if (activeTab !== 'link_sent' || validitySeconds <= 0) return;
    const timer = setInterval(() => {
      setValiditySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTab, validitySeconds]);

  // Auto-detect when user clicks the email link (via BroadcastChannel or server polling)
  useEffect(() => {
    if (!isOpen || activeTab !== 'link_sent') return;

    let isDisposed = false;
    let channel: BroadcastChannel | null = null;

    const completeLogin = (user: AppUserProfile) => {
      if (isDisposed) return;
      isDisposed = true;
      setStoredVerifiedUser(user);
      setSuccessMessage('تم تأكيد بريدك الإلكتروني والدخول إلى الحساب بنجاح!');
      setTimeout(() => {
        onSuccess(user);
        onClose();
      }, 450);
    };

    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('goldenflix_auth_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'AUTH_VERIFIED' && event.data?.user) {
          completeLogin(event.data.user);
        }
      };
    }

    const pollInterval = pendingLinkId
      ? setInterval(async () => {
          if (isDisposed) return;
          const status = await checkAuthLinkStatus(pendingLinkId);
          if (status.verified && status.user) {
            completeLogin(status.user);
          }
        }, 3000)
      : null;

    return () => {
      isDisposed = true;
      if (channel) channel.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, activeTab, pendingLinkId, onSuccess, onClose]);

  if (!isOpen) return null;

  const resetFormFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleTabSwitch = (newTab: AuthTab) => {
    resetFormFeedback();
    setActiveTab(newTab);
  };

  // 1. Submit Handler: Log In with Password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginUserWithPassword(cleanEmail, password);
      setIsLoading(false);
      if (res.user) {
        setStoredVerifiedUser(res.user);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setIsLoading(false);
      if (err.requiresVerification) {
        setSuccessMessage(err.message || 'تم إرسال رابط تفعيل ودخول مباشر إلى بريدك الإلكتروني');
        setPendingLinkId(err.linkId || null);
        setCooldownSeconds(60);
        setValiditySeconds(900);
        setActiveTab('link_sent');
        return;
      }
      setErrorMessage(err.message || 'فشل تسجيل الدخول، يرجى التأكد من البريد وكلمة المرور');
    }
  };

  // 2. Quick Direct Login Link from Email Input
  const handleSendDirectLoginLink = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('يرجى كتابة البريد الإلكتروني الحقيقي أولاً لإرسال رابط الدخول');
      return;
    }

    resetFormFeedback();
    setIsLoading(true);

    try {
      const res = await sendAuthLoginLink(cleanEmail);
      setIsLoading(false);
      setPendingLinkId(res.linkId || null);
      setCooldownSeconds(60);
      setValiditySeconds(res.expiresInSeconds || 900);
      setSuccessMessage(res.message);
      setActiveTab('link_sent');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'فشل إرسال رابط الدخول إلى بريدك الإلكتروني');
    }
  };

  // 3. Submit Handler: Register (Sign Up) -> Sends clickable activation & auto-login link
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setErrorMessage('يرجى ملء جميع الحقول المطلوبة لإنشاء الحساب');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('يرجى إدخال عنوان بريد إلكتروني حقيقي وصالح');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('كلمة المرور يجب أن تتكون من 6 خانات على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين، يرجى إعادة التأكد');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerUserWithLink(cleanName, cleanEmail, password);
      setIsLoading(false);
      setPendingLinkId(res.linkId || null);
      setSuccessMessage(res.message);
      setCooldownSeconds(60);
      setValiditySeconds(res.expiresInSeconds || 900);
      setActiveTab('link_sent');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'فشل إرسال رابط التفعيل إلى البريد الإلكتروني');
    }
  };

  // 4. Resend Email Link Handler
  const handleResendLink = async () => {
    if (cooldownSeconds > 0) return;
    resetFormFeedback();
    setIsLoading(true);

    try {
      const res = await sendAuthLoginLink(email.trim());
      setIsLoading(false);
      setPendingLinkId(res.linkId || null);
      setSuccessMessage(res.message);
      setCooldownSeconds(60);
      setValiditySeconds(res.expiresInSeconds || 900);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'تعذر إعادة إرسال رابط الدخول حالياً');
    }
  };

  // 5. Forgot Password / Recovery via Direct Email Link
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('يرجى إدخال عنوان بريد إلكتروني صالح');
      return;
    }

    setIsLoading(true);

    try {
      const res = await sendAuthLoginLink(cleanEmail);
      setIsLoading(false);
      setPendingLinkId(res.linkId || null);
      setCooldownSeconds(60);
      setValiditySeconds(res.expiresInSeconds || 900);
      setSuccessMessage('تم إرسال رابط الدخول المباشر لحسابك عبر البريد الإلكتروني!');
      setActiveTab('link_sent');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'تعذر إرسال رابط استعادة الدخول');
    }
  };

  // 6. Instant 1-Click Google Sign-In
  const handleGoogleSignIn = async () => {
    resetFormFeedback();
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      setIsLoading(false);
      setStoredVerifiedUser(user);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      const code = err?.code || '';
      setErrorMessage(code ? getFirebaseAuthErrorMessage(code) : err?.message || 'تعذر تسجيل الدخول عبر Google');
    }
  };

  const minutesRemaining = Math.floor(validitySeconds / 60);
  const secondsRemaining = validitySeconds % 60;
  const timeFormatted = `${minutesRemaining}:${secondsRemaining < 10 ? '0' : ''}${secondsRemaining}`;
  const isPasswordsMatching = confirmPassword ? password === confirmPassword : true;

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto select-none animate-fade-in font-sans">
      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-[390px] bg-[#121216] border border-amber-500/30 rounded-3xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden my-auto text-right">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Animated Loading Bar */}
        {isLoading && (
          <div className="absolute top-0 inset-x-0 h-1 bg-zinc-800 overflow-hidden z-20">
            <div className="h-full w-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 animate-pulse" />
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10 border border-zinc-750"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Logo & Header */}
        <div className="text-center pt-1 pb-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-0.5 shadow-md shadow-amber-500/25 mb-2">
            <div className="w-full h-full bg-[#121216] rounded-[14px] flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.5 3.5C4.5 2.65 5.43 2.13 6.16 2.57L20.16 11.07C20.86 11.49 20.86 12.51 20.16 12.93L6.16 21.43C5.43 21.87 4.5 21.35 4.5 20.5V3.5Z" />
              </svg>
            </div>
          </div>

          <h2 className="text-lg font-black text-white tracking-tight">
            Golden<span className="text-amber-400">Flix</span> Cinema
          </h2>

          <p className="text-xs text-zinc-400 mt-0.5 font-medium">
            {activeTab === 'login' && 'تسجيل الدخول إلى حسابك السينمائي'}
            {activeTab === 'register' && 'إنشاء حساب جديد عبر رابط التفعيل المباشر'}
            {activeTab === 'link_sent' && 'تم إرسال رابط الدخول المباشر إلى بريدك'}
            {activeTab === 'forgot_password' && 'استعادة كلمة المرور عبر البريد'}
          </p>
        </div>

        {/* Mode Switcher Tabs (Strictly Separates Log In vs Sign Up) */}
        {activeTab !== 'forgot_password' && activeTab !== 'link_sent' && (
          <div className="mb-4">
            <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>تسجيل الدخول</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('register')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إنشاء حساب جديد</span>
              </button>
            </div>
          </div>
        )}

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs space-y-2 animate-fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
            {isDeveloperEmail &&
              (errorMessage.includes('SMTP') ||
                errorMessage.includes('غير نشطة') ||
                errorMessage.includes('غير مُعد') ||
                errorMessage.includes('مزود إرسال') ||
                errorMessage.includes('حساب المطور')) && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenEmailSettings) {
                      onOpenEmailSettings();
                    } else {
                      onOpenDeveloperAccount();
                    }
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ضبط وتفعيل إرسال الروابط (للمطور)</span>
                </button>
              )}
          </div>
        )}

        {successMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* 1. SEPARATE LOG IN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-3 animate-fade-in">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                البريد الإلكتروني:
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none transition-all font-mono"
                />
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              </div>

              {/* Quick direct link login helper */}
              <div className="flex items-center justify-between mt-1.5 px-0.5">
                <span className="text-[10px] text-zinc-400">الدخول السريع عبر البريد؟</span>
                <button
                  type="button"
                  onClick={handleSendDirectLoginLink}
                  disabled={isLoading}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  <span>إرسال رابط الدخول المباشر</span>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-300">كلمة المرور:</label>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('forgot_password')}
                  className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-black font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 stroke-[2.5]" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>

            {/* Switch to Register */}
            <div className="text-center pt-2">
              <span className="text-xs text-zinc-400">ليس لديك حساب بعد؟ </span>
              <button
                type="button"
                onClick={() => handleTabSwitch('register')}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                إنشاء حساب جديد الآن
              </button>
            </div>
          </form>
        )}

        {/* 2. SEPARATE SIGN UP FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-2.5 animate-fade-in">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-0.5">
                الاسم الكامل:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد محمد"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none transition-all"
                />
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-0.5">
                البريد الإلكتروني الحقيقي:
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none transition-all font-mono"
                />
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-0.5">
                كلمة المرور (6 خانات على الأقل):
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-bold text-zinc-300">تأكيد كلمة المرور:</label>
                {confirmPassword && (
                  <span
                    className={`text-[10px] font-bold ${
                      isPasswordsMatching ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPasswordsMatching ? 'متطابقة' : 'غير متطابقة'}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="أعد إدخال كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-zinc-950 border rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none transition-all ${
                    confirmPassword && !isPasswordsMatching
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-zinc-800 focus:border-amber-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="py-1 flex items-center gap-1.5 text-[10px] text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>سيتم إرسال رابط تفعيل ودخول مباشر إلى بريدك الإلكتروني للدخول فوراً بضغطة واحدة.</span>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordsMatching}
              className="w-full mt-1 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-black font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ إنشاء الحساب وإرسال الرابط...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>إنشاء الحساب وإرسال رابط التفعيل</span>
                </>
              )}
            </button>

            {/* Switch to Login */}
            <div className="text-center pt-2">
              <span className="text-xs text-zinc-400">لديك حساب بالفعل؟ </span>
              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                تسجيل الدخول
              </button>
            </div>
          </form>
        )}

        {/* 3. DEDICATED DIRECT EMAIL LINK CONFIRMATION SCREEN */}
        {activeTab === 'link_sent' && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="p-4 rounded-2xl bg-zinc-950 border border-amber-500/30 space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center mx-auto">
                <Link2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-white">اضغط على الرابط المرسل إلى بريدك</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                أرسلنا رابط التفعيل والدخول المباشر إلى بريدك الإلكتروني التالي:
              </p>
              <div className="inline-block px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 text-xs font-mono font-bold border border-amber-400/25 max-w-full truncate">
                {email}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                افتح بريدك الإلكتروني واضغط على زر <span className="text-amber-300 font-bold">(تفعيل والدخول إلى الحساب الآن)</span> ليتم تسجيل دخولك تلقائياً دون الحاجة لكتابة أي رموز.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>في انتظار ضغطك على الرابط في بريدك للدخول تلقائياً...</span>
            </div>

            {/* Expiration and Cooldown Timer */}
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <div className="flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-amber-400" />
                <span>
                  صلاحية الرابط:{' '}
                  <span
                    className={`font-mono font-bold ${
                      validitySeconds < 120 ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {timeFormatted}
                  </span>
                </span>
              </div>

              <div>
                {cooldownSeconds > 0 ? (
                  <span className="text-zinc-500 font-mono text-[11px]">
                    إعادة الإرسال ({cooldownSeconds}ث)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendLink}
                    disabled={isLoading}
                    className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer text-xs"
                  >
                    إعادة إرسال الرابط
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleResendLink}
                disabled={isLoading || cooldownSeconds > 0}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-40 text-black font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ إرسال رابط جديد...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {cooldownSeconds > 0
                        ? `يمكنك إعادة الإرسال خلال ${cooldownSeconds} ثانية`
                        : 'إعادة إرسال رابط الدخول إلى بريدي'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer py-1"
              >
                تعديل البريد الإلكتروني أو العودة لتسجيل الدخول
              </button>
            </div>
          </div>
        )}

        {/* 4. FORGOT PASSWORD FORM */}
        {activeTab === 'forgot_password' && (
          <form onSubmit={handleForgotSubmit} className="space-y-3.5 animate-fade-in">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
              <h4 className="text-xs font-bold text-amber-300 mb-1">
                استعادة كلمة المرور عبر البريد
              </h4>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                أدخل عنوان بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور فوراً.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                البريد الإلكتروني المسجل:
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none transition-all font-mono"
                />
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-bold text-xs sm:text-sm rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ إرسال الرابط...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>إرسال رابط استعادة كلمة المرور</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('login')}
              className="w-full py-1 text-center text-xs text-sky-400 hover:text-sky-300 cursor-pointer flex items-center justify-center gap-1"
            >
              <span>الرجوع إلى تسجيل الدخول</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Instant 1-Click Google Sign-In Option */}
        {(activeTab === 'login' || activeTab === 'register') && (
          <div className="mt-3 pt-3 border-t border-zinc-850 space-y-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>الدخول الفوري بحساب Google</span>
            </button>
          </div>
        )}

        {/* Continue as Guest Button */}
        {activeTab !== 'link_sent' && (
          <div className="pt-2 text-center border-t border-zinc-850 mt-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-xl hover:bg-zinc-850"
            >
              المتابعة كزائر بدون تسجيل (تصفح حر)
            </button>
          </div>
        )}

        {/* Footer (Developer Account appears ONLY for frassa.wwindows@gmail.com) */}
        <div className="bg-[#0b0b0e] -mx-5 -mb-5 mt-3 py-2 px-4 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-500">
          <span>GoldenFlix Cinema v2.5</span>
          {isDeveloperEmail && (
            <button
              type="button"
              onClick={() => {
                onOpenDeveloperAccount();
                onClose();
              }}
              className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer hover:underline font-bold"
              title="بوابة حساب المطور المخصصة للبريد frassa.wwindows@gmail.com"
            >
              حساب مطور
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
