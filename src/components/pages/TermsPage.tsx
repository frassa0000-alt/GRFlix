import React from 'react';
import { InfoPageId } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { InfoPageLayout } from './InfoPageLayout';

interface TermsPageProps {
  onBackHome: () => void;
  onNavigatePage: (page: InfoPageId) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBackHome, onNavigatePage }) => {
  const { lang, t } = useLanguage();

  const clauses = [
    {
      titleAr: '01. القبول بشروط الاستخدام',
      titleEn: '01. Acceptance of Terms',
      bodyAr:
        'باستخدامك لموقع MASHHAD أو تصفحك أيّاً من أقسامه ومحتوياته، فإنك توافق على الالتزام بهذه الشروط والأحكام وبسياسة الخصوصية المعمول بها في المنصة.',
      bodyEn:
        'By accessing or using MASHHAD, you agree to comply with these Terms of Use and our active Privacy Policy.',
    },
    {
      titleAr: '02. الاستخدام الشخصي المشروع',
      titleEn: '02. Permitted Personal Use',
      bodyAr:
        'الخدمة متاحة للاستخدام الشخصي غير التجاري فقط. يُحظر محاولة استخراج المحتوى بشكل آلي، أو التلاعب بآليات التشغيل والخوادم، أو إلحاق أي ضرر تقني بأداء المنصة.',
      bodyEn:
        'The platform is provided solely for personal, non-commercial viewing. Automated scraping, tampering with streaming infrastructure, or disrupting platform availability is strictly prohibited.',
    },
    {
      titleAr: '03. حسابات المستخدمين والأمان',
      titleEn: '03. User Accounts & Responsibility',
      bodyAr:
        'يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات الدخول الخاصة به وصحة البريد الإلكتروني المسجل. يحتفظ فريق MASHHAD بحق تعليق أي حساب يخالف قواعد الاستخدام الآمن.',
      bodyEn:
        'You are responsible for safeguarding your account credentials and maintaining an accurate email address. MASHHAD reserves the right to suspend accounts involved in abusive behavior.',
    },
    {
      titleAr: '04. الملكية الفكرية وحقوق النشر',
      titleEn: '04. Intellectual Property & Copyright',
      bodyAr:
        'جميع عناصر الهوية البصرية والتصميم والشعارات والبرمجيات الخاصة بـ MASHHAD محفوظة للمنصة. وفي حال وجود أي ملاحظة أو طلب بخصوص حقوق محتوى، يرجى مراسلتنا رسمياً ليتم التعامل معه فوراً.',
      bodyEn:
        'All MASHHAD branding, interface design, logos, and platform software belong to MASHHAD. For any copyright or content ownership inquiry, please contact us directly for prompt review.',
    },
    {
      titleAr: '05. استمرارية الخدمة والتعديلات',
      titleEn: '05. Service Availability & Updates',
      bodyAr:
        'نسعى لتوفير الخدمة بأعلى استقرار وجودة ممكنة، وقد نجري تحديثات تقنية أو تعديلات على قائمة المحتوى أو هذه الشروط من وقت لآخر بما يحسن تجربة المستخدم.',
      bodyEn:
        'We strive to maintain reliable availability and quality, and may perform technical updates or modify available content and these terms periodically to improve the experience.',
    },
    {
      titleAr: '06. التواصل بشأن الشروط',
      titleEn: '06. Legal & Terms Contact',
      bodyAr:
        'لأي استفسار حول شروط الاستخدام أو تقديم بلاغ رسمي، يمكنكم التواصل مباشرة عبر البريد الإلكتروني: goldenflix.cinema@gmail.com.',
      bodyEn:
        'For questions regarding these Terms of Use or formal notices, please contact: goldenflix.cinema@gmail.com.',
    },
  ];

  return (
    <InfoPageLayout
      pageId="terms"
      title={t('شروط الاستخدام', 'Terms of Use')}
      subtitle={t(
        'الضوابط والقواعد المنظمة لاستخدام منصة MASHHAD بما يضمن تجربة مشاهدة آمنة ومنظمة للجميع.',
        'The guidelines governing use of MASHHAD to keep the streaming experience safe and clear for everyone.'
      )}
      updatedLabel={t('سارية اعتباراً من 2026', 'Effective 2026')}
      onBackHome={onBackHome}
      onNavigatePage={onNavigatePage}
    >
      <div className="divide-y divide-white/[0.07]">
        {clauses.map((clause, idx) => (
          <section
            key={idx}
            className={`${idx === 0 ? 'pb-6' : idx === clauses.length - 1 ? 'pt-6' : 'py-6'} space-y-2 max-w-2xl`}
          >
            <h2 className="text-base sm:text-lg font-black text-white">
              {lang === 'en' ? clause.titleEn : clause.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {lang === 'en' ? clause.bodyEn : clause.bodyAr}
            </p>
          </section>
        ))}
      </div>
    </InfoPageLayout>
  );
};
