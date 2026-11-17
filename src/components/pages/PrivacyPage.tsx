import React from 'react';
import { InfoPageId } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { InfoPageLayout } from './InfoPageLayout';

interface PrivacyPageProps {
  onBackHome: () => void;
  onNavigatePage: (page: InfoPageId) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBackHome, onNavigatePage }) => {
  const { lang, t } = useLanguage();

  const sections = [
    {
      numAr: '01.',
      titleAr: 'المعلومات التي نقوم بجمعها',
      titleEn: '01. Information We Collect',
      bodyAr:
        'عند إنشاء حساب أو تسجيل الدخول في GoldenFlix، قد نطلب الاسم وعنوان البريد الإلكتروني وصورة الحساب الاختيارية لتمكين مزامنة حسابك. كما يتم حفظ قائمة المفضلة وسجل المشاهدة وإعدادات اللغة وتنبيهات الحلقات الجديدة لتسهيل استكمال المشاهدة لاحقاً.',
      bodyEn:
        'When you create an account or sign in to GoldenFlix, we may collect your name, email address, and optional avatar to manage your profile. Your favorites list, watch progress, language preference, and release alerts are stored to preserve your viewing continuity.',
    },
    {
      numAr: '02.',
      titleAr: 'كيفية استخدام البيانات',
      titleEn: '02. How We Use Information',
      bodyAr:
        'تُستخدم بياناتك حصرياً لتشغيل حسابك، حفظ نقطة التوقف في الأفلام والمسلسلات، تخصيص لغة الواجهة والجودة المفضلة، وإرسال تنبيهات الأعمال التي قمت بتفعيل متابعتها بإرادتك.',
      bodyEn:
        'Your data is used strictly to operate your account, resume playback from where you stopped, apply your interface language and preferred quality settings, and notify you about titles you opted to follow.',
    },
    {
      numAr: '03.',
      titleAr: 'التخزين المحلي وملفات التفضيل',
      titleEn: '03. Local Storage & Preferences',
      bodyAr:
        'يعتمد الموقع على التخزين المحلي في المتصفح (Local Storage) لحفظ جلسة الدخول، تفضيل اللغة، المفضلة، وتقدّم المشاهدة بحيث تعمل الواجهة بسرعة سواء على الهاتف أو الكمبيوتر. يمكنك مسح بيانات المتصفح في أي وقت.',
      bodyEn:
        'GoldenFlix uses browser Local Storage to preserve your session, language selection, favorites, and playback progress quickly across mobile and desktop devices. You may clear browser data at any time.',
    },
    {
      numAr: '04.',
      titleAr: 'حماية البيانات وعدم البيع لطرف ثالث',
      titleEn: '04. Data Protection & Third Parties',
      bodyAr:
        'نحن نحترم خصوصيتك ولا نقوم ببيع أو تأجير معلوماتك الشخصية لأي جهات تسويقية أو إعلانية. تقتصر المعالجة التقنية على خدمات المصادقة واستضافة البيانات الموثوقة لتشغيل المنصة بأمان.',
      bodyEn:
        'We respect your privacy and never sell or rent your personal data to marketing or advertising parties. Technical processing is limited to trusted authentication and storage providers needed to run the platform securely.',
    },
    {
      numAr: '05.',
      titleAr: 'حقوق المستخدم وطلبات الحذف',
      titleEn: '05. User Rights & Deletion Requests',
      bodyAr:
        'يحق لك في أي وقت مراجعة بيانات حسابك أو تعديلها من الملف الشخصي، أو طلب حذف حسابك وبياناتك نهائياً عبر التواصل معنا عبر البريد الإلكتروني الرسمي.',
      bodyEn:
        'You may review or update your profile information at any time, or request permanent deletion of your account and associated data by contacting our official support email.',
    },
    {
      numAr: '06.',
      titleAr: 'التواصل بخصوص الخصوصية',
      titleEn: '06. Privacy Contact',
      bodyAr:
        'لأي استفسار أو طلب يتعلق بسياسة الخصوصية وحماية البيانات، يُرجى مراسلتنا عبر البريد الإلكتروني: goldenflix.cinema@gmail.com.',
      bodyEn:
        'For any inquiry or request regarding privacy and data protection, please reach out to us at: goldenflix.cinema@gmail.com.',
    },
  ];

  return (
    <InfoPageLayout
      pageId="privacy"
      title={t('سياسة الخصوصية', 'Privacy Policy')}
      subtitle={t(
        'توضح هذه السياسة كيفية تعامل GoldenFlix مع بيانات المستخدمين وحماية خصوصيتهم أثناء استخدام المنصة.',
        'This policy explains how GoldenFlix handles user data and safeguards your privacy while using the platform.'
      )}
      updatedLabel={t('آخر تحديث: 2026', 'Last updated: 2026')}
      onBackHome={onBackHome}
      onNavigatePage={onNavigatePage}
    >
      <div className="divide-y divide-white/[0.07]">
        {sections.map((section, idx) => (
          <section
            key={idx}
            className={`${idx === 0 ? 'pb-6' : idx === sections.length - 1 ? 'pt-6' : 'py-6'} space-y-2 max-w-2xl`}
          >
            <h2 className="text-base sm:text-lg font-black text-white">
              {lang === 'en' ? section.titleEn : `${section.numAr} ${section.titleAr}`}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {lang === 'en' ? section.bodyEn : section.bodyAr}
            </p>
          </section>
        ))}
      </div>
    </InfoPageLayout>
  );
};
