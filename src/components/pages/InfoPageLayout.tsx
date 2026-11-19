import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { InfoPageId } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface InfoPageLayoutProps {
  pageId: InfoPageId;
  title: string;
  subtitle: string;
  updatedLabel: string;
  onBackHome: () => void;
  onNavigatePage: (page: InfoPageId) => void;
  children: React.ReactNode;
}

const SIBLING_PAGES: {
  id: InfoPageId;
  href: string;
  labelAr: string;
  labelEn: string;
}[] = [
  { id: 'support', href: '/support', labelAr: 'الدعم الفني', labelEn: 'Technical Support' },
  { id: 'privacy', href: '/privacy', labelAr: 'سياسة الخصوصية', labelEn: 'Privacy Policy' },
  { id: 'about', href: '/about', labelAr: 'من نحن', labelEn: 'About Us' },
  { id: 'terms', href: '/terms', labelAr: 'شروط الاستخدام', labelEn: 'Terms of Use' },
];

export const InfoPageLayout: React.FC<InfoPageLayoutProps> = ({
  pageId,
  title,
  subtitle,
  updatedLabel,
  onBackHome,
  onNavigatePage,
  children,
}) => {
  const { lang, dir, t } = useLanguage();
  const BackArrow = dir === 'ltr' ? ArrowLeft : ArrowRight;

  return (
    <motion.article
      key={pageId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl mx-auto py-4 sm:py-6 space-y-8"
    >
      {/* Top Navigation & Sibling Page Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 self-start min-h-[42px] px-4 py-2 rounded-xl bg-[#17121f] hover:bg-[#1e1729] border border-white/12 hover:border-[#ea1d24]/60 text-xs sm:text-sm font-bold text-zinc-200 hover:text-white transition-all duration-150 active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea1d24]/60 whitespace-nowrap"
        >
          <BackArrow className="w-4 h-4 text-[#ea1d24] shrink-0" />
          <span>{t('العودة إلى الرئيسية', 'Back to Home')}</span>
        </button>

        <nav
          aria-label={t('صفحات المعلومات', 'Information pages')}
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {SIBLING_PAGES.map((item) => {
            const active = item.id === pageId;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onNavigatePage(item.id);
                }}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea1d24]/60 ${
                  active
                    ? 'bg-[#ea1d24] text-white font-black'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {lang === 'en' ? item.labelEn : item.labelAr}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Editorial Header */}
      <header className="space-y-3 max-w-2xl">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-medium">
          <span className="text-[#ea1d24] font-black tracking-wider">MASHHAD</span>
          <span aria-hidden="true">·</span>
          <span>{updatedLabel}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight text-balance leading-tight">
          {title}
        </h1>

        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
          {subtitle}
        </p>
      </header>

      {/* Main Content Container */}
      <div className="rounded-2xl bg-[#16121d]/95 border border-white/[0.08] p-5 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.55)] space-y-8">
        {children}
      </div>

      {/* Clean Support Contact Footnote */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-2">
          <span>{t('للاستفسارات المباشرة أو الملاحظات:', 'For direct inquiries or feedback:')}</span>
          <a
            href="mailto:goldenflix.cinema@gmail.com"
            dir="ltr"
            className="inline-flex items-center gap-1.5 font-bold text-[#ea1d24] hover:underline transition-transform active:scale-[0.98]"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>goldenflix.cinema@gmail.com</span>
          </a>
        </div>
        <span className="text-zinc-500 font-black tracking-wider">MASHHAD</span>
      </div>
    </motion.article>
  );
};
