import React, { useState } from 'react';
import { Mail, Copy, Check, ChevronDown, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { InfoPageId } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { InfoPageLayout } from './InfoPageLayout';

interface SupportPageProps {
  onBackHome: () => void;
  onNavigatePage: (page: InfoPageId) => void;
}

const SUPPORT_EMAIL = 'goldenflix.cinema@gmail.com';

export const SupportPage: React.FC<SupportPageProps> = ({ onBackHome, onNavigatePage }) => {
  const { lang, t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [senderName, setSenderName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [formNotice, setFormNotice] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const faqs = [
    {
      qAr: 'ما هي طرق التواصل الرسمية مع فريق الدعم الفني؟',
      qEn: 'How can I contact the technical support team?',
      aAr: `يمكنك مراسلة فريق الدعم مباشرة عبر البريد الإلكتروني الرسمي ${SUPPORT_EMAIL}، مع توضيح نوع الجهاز (هاتف أو كمبيوتر) ووصف المشكلة ليتم الرد عليك ومساعدتك في أقرب وقت.`,
      aEn: `You can reach our support team directly via ${SUPPORT_EMAIL}. Please include your device type (mobile or desktop) and a brief description so we can assist promptly.`,
    },
    {
      qAr: 'الفيديو يتوقف أو يتأخر في التحميل، ماذا أفعل؟',
      qEn: 'Video playback buffers or fails to start. What should I do?',
      aAr: 'من داخل مشغل الفيديو افتح قائمة الجودات واختر جودة مناسبة لسرعة اتصالك مثل 360p أو 480p، وتأكد من استقرار اتصال الإنترنت أو جرّب تحديث الصفحة وإعادة المحاولة.',
      aEn: 'Open the quality selector inside the video player and choose a resolution matching your connection speed (such as 360p or 480p), verify your internet connection, or refresh the page.',
    },
    {
      qAr: 'واجهت مشكلة في تسجيل الدخول أو تأكيد البريد الإلكتروني',
      qEn: 'I have trouble signing in or verifying my email',
      aAr: 'تأكد من كتابة البريد الإلكتروني بشكل صحيح وتحقق من مجلد الرسائل غير المرغوب فيها (Spam) عند طلب رابط التأكيد. إذا استمرت المشكلة راسلنا من نفس البريد الإلكتروني.',
      aEn: 'Verify your email spelling and check your Spam/Junk folder when requesting a verification link. If the issue persists, contact us from the same email address.',
    },
    {
      qAr: 'كيف أبلغ عن رابط معطّل أو أقترح إضافة فيلم أو مسلسل؟',
      qEn: 'How do I report a broken link or suggest a movie/series?',
      aAr: 'أرسل اسم العمل وسنة الإنتاج ووصفاً مختصراً للمشكلة أو الاقتراح عبر نموذج المراسلة أدناه أو مباشرة إلى البريد الإلكتروني الموضح.',
      aEn: 'Send the title name, release year, and a short note using the message form below or directly via email.',
    },
  ];

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleComposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = senderName.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanName || !cleanSubject || !cleanMessage) {
      setFormNotice({
        type: 'error',
        text: t(
          'يرجى إدخال الاسم وموضوع الرسالة وتفاصيل الاستفسار قبل الإرسال.',
          'Please enter your name, subject, and message details before sending.'
        ),
      });
      return;
    }

    const mailSubject = encodeURIComponent(`[MASHHAD Support] ${cleanSubject}`);
    const mailBody = encodeURIComponent(
      `${lang === 'en' ? 'Name' : 'الاسم'}: ${cleanName}\n\n${cleanMessage}`
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${mailSubject}&body=${mailBody}`;

    setFormNotice({
      type: 'success',
      text: t(
        `تم تجهيز رسالتك وفتح تطبيق البريد لإرسالها إلى ${SUPPORT_EMAIL}.`,
        `Your email client has been opened to send your inquiry to ${SUPPORT_EMAIL}.`
      ),
    });
  };

  return (
    <InfoPageLayout
      pageId="support"
      title={t('الدعم الفني والمساعدة', 'Technical Support')}
      subtitle={t(
        'فريق MASHHAD جاهز لمساعدتك في حل أي مشكلة تقنية أثناء التصفح أو التشغيل، واستقبال اقتراحاتك وملاحظاتك.',
        'The MASHHAD team is ready to assist with any playback or account issue and receive your suggestions.'
      )}
      updatedLabel={t('متاح عبر البريد الإلكتروني الرسمي', 'Available via official support email')}
      onBackHome={onBackHome}
      onNavigatePage={onNavigatePage}
    >
      {/* Direct Support Contact Block */}
      <section aria-labelledby="support-contact-heading" className="space-y-4 pb-7 border-b border-white/[0.08]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <h2 id="support-contact-heading" className="text-base sm:text-lg font-black text-white">
              {t('01. البريد الإلكتروني للدعم الفني', '01. Official Support Email')}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {t(
                'للاستفسارات التقنية أو الإبلاغ عن الأعطال، تواصل معنا مباشرة على البريد التالي (زمن الرد المتوقع: 24 إلى 48 ساعة).',
                'For technical issues or reports, contact us directly at the email below (typical response: 24–48 hours).'
              )}
            </p>
            <p dir="ltr" className="text-sm sm:text-base font-bold text-[#ea1d24] pt-1 select-all inline-block">
              {SUPPORT_EMAIL}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#ea1d24] hover:bg-[#ff2b32] text-white text-xs sm:text-sm font-black transition-all duration-150 active:scale-[0.97] whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea1d24]/60"
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span>{t('مراسلة الدعم الفني', 'Email Support')}</span>
            </a>

            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#17121f] hover:bg-[#1e1729] border border-white/12 text-zinc-200 hover:text-white text-xs sm:text-sm font-bold transition-all duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea1d24]/60"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300">{t('تم النسخ', 'Copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#ea1d24] shrink-0" />
                  <span>{t('نسخ البريد', 'Copy Email')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Common Questions */}
      <section aria-labelledby="support-faq-heading" className="space-y-4 pb-7 border-b border-white/[0.08]">
        <h2 id="support-faq-heading" className="text-base sm:text-lg font-black text-white">
          {t('02. الأسئلة الشائعة وحل المشكلات', '02. Frequently Asked Questions')}
        </h2>

        <div className="divide-y divide-white/[0.07] border-t border-b border-white/[0.07]">
          {faqs.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-1">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full min-h-[48px] py-3 flex items-center justify-between gap-4 text-start text-xs sm:text-sm font-bold text-zinc-100 hover:text-[#F7C600] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C600]/60 rounded-lg"
                >
                  <span>{lang === 'en' ? item.qEn : item.qAr}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#F7C600]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-3.5 text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
                    {lang === 'en' ? item.aEn : item.aAr}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Support Message Composer */}
      <section aria-labelledby="support-form-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="support-form-heading" className="text-base sm:text-lg font-black text-white">
            {t('03. تجهيز رسالة دعم سريع', '03. Prepare a Support Message')}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t(
              `املأ الحقول التالية ليتم فتح رسالة جاهزة إلى ${SUPPORT_EMAIL}.`,
              `Fill out the fields below to open a pre-addressed message to ${SUPPORT_EMAIL}.`
            )}
          </p>
        </div>

        <form onSubmit={handleComposeSubmit} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="support-name" className="block text-xs font-bold text-zinc-300">
                {t('الاسم', 'Your Name')}
              </label>
              <input
                id="support-name"
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder={t('أدخل اسمك', 'Enter your name')}
                className="w-full h-11 px-3.5 rounded-xl bg-[#14141b] text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm border border-white/12 focus:border-[#F7C600]/75 focus:outline-none focus:ring-2 focus:ring-[#F7C600]/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="support-subject" className="block text-xs font-bold text-zinc-300">
                {t('موضوع الرسالة', 'Subject')}
              </label>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('مثال: مشكلة في تشغيل فيلم', 'Example: Playback issue')}
                className="w-full h-11 px-3.5 rounded-xl bg-[#14141b] text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm border border-white/12 focus:border-[#F7C600]/75 focus:outline-none focus:ring-2 focus:ring-[#F7C600]/20 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="support-message" className="block text-xs font-bold text-zinc-300">
              {t('تفاصيل المشكلة أو الاستفسار', 'Message Details')}
            </label>
            <textarea
              id="support-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t(
                'اكتب وصفاً واضحاً للمشكلة، اسم العمل، ونوع الجهاز المستخدم...',
                'Describe your issue clearly, including title name and device type...'
              )}
              className="w-full p-3.5 rounded-xl bg-[#14141b] text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm border border-white/12 focus:border-[#F7C600]/75 focus:outline-none focus:ring-2 focus:ring-[#F7C600]/20 transition-colors resize-y"
            />
          </div>

          {formNotice && (
            <div
              role="status"
              className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                formNotice.type === 'error'
                  ? 'bg-rose-500/12 border-rose-500/35 text-rose-200'
                  : 'bg-emerald-500/12 border-emerald-500/35 text-emerald-200'
              }`}
            >
              {formNotice.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{formNotice.text}</span>
            </div>
          )}

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#ea1d24] hover:bg-[#ff2b32] text-white text-xs sm:text-sm font-black transition-all duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea1d24]/60"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>{t('إرسال عبر البريد الإلكتروني', 'Send via Email')}</span>
          </button>
        </form>
      </section>
    </InfoPageLayout>
  );
};
