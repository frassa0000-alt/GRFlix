import React from 'react';
import { InfoPageId } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { InfoPageLayout } from './InfoPageLayout';

interface AboutPageProps {
  onBackHome: () => void;
  onNavigatePage: (page: InfoPageId) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBackHome, onNavigatePage }) => {
  const { lang, t } = useLanguage();

  const pillars = [
    {
      titleAr: '01. رؤية MASHHAD',
      titleEn: '01. The MASHHAD Vision',
      bodyAr:
        'تأسست MASHHAD لتقديم مكتبة أفلام ومسلسلات منظمة في بيئة بصرية داكنة مريحة للعين، تجمع بين سرعة الوصول إلى الأعمال المفضلة والتركيز على متعة المشاهدة دون فوضى أو تعقيد.',
      bodyEn:
        'MASHHAD was built to present a curated library of movies and series inside a calm, dark-first viewing environment focused on effortless discovery and uninterrupted watching.',
    },
    {
      titleAr: '02. تجربة تشغيل متكاملة',
      titleEn: '02. Complete Playback Experience',
      bodyAr:
        'يوفر مشغل الفيديو المدمج تحكماً مرناً في دقة العرض، سرعة التشغيل، الترجمة، وحفظ نقطة التوقف تلقائياً لتتمكن من إكمال المشاهدة في أي وقت ومن أي شاشة سواء على الهاتف أو الكمبيوتر.',
      bodyEn:
        'Our built-in player delivers flexible quality selection, playback speed controls, subtitle support, and automatic progress tracking so you can pick up right where you left off on mobile or desktop.',
    },
    {
      titleAr: '03. مكتبة متجددة وتنبيهات فورية',
      titleEn: '03. Curated Catalog & Release Alerts',
      bodyAr:
        'تصنيف واضح للأفلام والمسلسلات والأنواع المتنوعة، مع ميزة التنبيهات لمتابعة الحلقات الجديدة والإضافات الحديثة فور توفرها على المنصة.',
      bodyEn:
        'Clear categorization across films, TV series, and genres, paired with personal release alerts to notify you as soon as new episodes or titles arrive.',
    },
  ];

  const specs = [
    {
      labelAr: 'اسم المنصة',
      labelEn: 'Platform Name',
      valAr: 'MASHHAD',
      valEn: 'MASHHAD',
    },
    {
      labelAr: 'الأجهزة المدعومة',
      labelEn: 'Supported Devices',
      valAr: 'الهواتف الذكية، الأجهزة اللوحية، وأجهزة الكمبيوتر',
      valEn: 'Smartphones, Tablets & Desktop Browsers',
    },
    {
      labelAr: 'اللغات المتوفرة',
      labelEn: 'Languages',
      valAr: 'العربية والإنجليزية',
      valEn: 'Arabic & English',
    },
    {
      labelAr: 'بريد التواصل والدعم',
      labelEn: 'Support Contact',
      valAr: 'goldenflix.cinema@gmail.com',
      valEn: 'goldenflix.cinema@gmail.com',
    },
  ];

  return (
    <InfoPageLayout
      pageId="about"
      title={t('من نحن — MASHHAD', 'About MASHHAD')}
      subtitle={t(
        'منصة رقمية مخصصة لعشاق السينما والمسلسلات، تجمع بين البساطة في التصميم وجودة العرض العالية.',
        'A digital streaming destination crafted for film and series enthusiasts, uniting clean design with refined playback.'
      )}
      updatedLabel={t('نبذة عن المنصة', 'Platform Overview')}
      onBackHome={onBackHome}
      onNavigatePage={onNavigatePage}
    >
      <div className="divide-y divide-white/[0.07]">
        {pillars.map((pillar, idx) => (
          <section
            key={idx}
            className={`${idx === 0 ? 'pb-6' : 'py-6'} space-y-2 max-w-2xl`}
          >
            <h2 className="text-base sm:text-lg font-black text-white">
              {lang === 'en' ? pillar.titleEn : pillar.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {lang === 'en' ? pillar.bodyEn : pillar.bodyAr}
            </p>
          </section>
        ))}

        {/* Structured Platform Info Table */}
        <section className="pt-6 space-y-4">
          <h2 className="text-base sm:text-lg font-black text-white">
            {t('04. معلومات سريعة عن المنصة', '04. Quick Platform Facts')}
          </h2>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 border-t border-white/[0.07] pt-4">
            {specs.map((spec, idx) => (
              <div key={idx} className="space-y-1">
                <dt className="text-xs font-bold text-zinc-400">
                  {lang === 'en' ? spec.labelEn : spec.labelAr}
                </dt>
                <dd
                  dir={spec.valAr.includes('@') ? 'ltr' : undefined}
                  className="text-sm font-bold text-zinc-100"
                >
                  {spec.valAr.includes('@') ? (
                    <a
                      href={`mailto:${spec.valAr}`}
                      className="text-[#ea1d24] hover:underline"
                    >
                      {spec.valAr}
                    </a>
                  ) : lang === 'en' ? (
                    spec.valEn
                  ) : (
                    spec.valAr
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </InfoPageLayout>
  );
};
