import React from 'react';
import { Play } from 'lucide-react';
import { InfoPageId } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface SiteFooterProps {
  activePage: InfoPageId | null;
  onOpenPage: (page: InfoPageId) => void;
  onGoHome: () => void;
  siteName?: string;
}

const FOOTER_LINKS: {
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

export const SiteFooter: React.FC<SiteFooterProps> = ({
  activePage,
  onOpenPage,
  onGoHome,
  siteName = 'MASHHAD',
}) => {
  const { lang, dir, t } = useLanguage();

  const rawBrand =
    (siteName || 'MASHHAD')
      .replace(/\s+cinema\b/gi, '')
      .replace(/\s+(سينما|سيما)\b/g, '')
      .trim() || 'MASHHAD';

  const cleanBrand = /^(goldenflix|goldenfelix|جولدن(\s+فليكس)?)$/i.test(rawBrand)
    ? 'MASHHAD'
    : rawBrand;

  const isDefaultBrand = cleanBrand.toLowerCase() === 'mashhad';

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, pageId: InfoPageId) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpenPage(pageId);
  };

  return (
    <footer
      dir={dir}
      className="relative w-full mt-auto bg-[#0b0810]/95 border-t border-white/[0.08] text-zinc-400"
    >
      {/* Subtle Cinema Red Rim Accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ea1d24]/50 to-transparent"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24 md:py-9 space-y-6">
        {/* Top Row: Brand Identity + Primary Footer Links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand Wordmark */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-start">
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center gap-2 py-1 text-white transition-transform duration-150 active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea1d24]/60 rounded-lg"
              aria-label={cleanBrand}
            >
              <Play className="w-4 h-4 fill-[#ea1d24] text-[#ea1d24] shrink-0" />
              {isDefaultBrand ? (
                <span className="text-lg font-black tracking-wider leading-none">
                  <span className="text-[#ea1d24]">MASH</span>
                  <span className="text-white">HAD</span>
                </span>
              ) : (
                <span className="text-lg font-black tracking-tight text-[#ea1d24] leading-none">
                  {cleanBrand}
                </span>
              )}
            </button>
            <span className="hidden sm:inline-block h-3.5 w-px bg-white/15" aria-hidden="true" />
            <span className="text-xs text-zinc-400">
              {t('منصة المشاهدة السينمائية', 'Cinema Streaming Platform')}
            </span>
          </div>

          {/* 4 Required Footer Links */}
          <nav
            aria-label={t('روابط المعلومات والدعم', 'Site information links')}
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-7 md:gap-x-8"
          >
            {FOOTER_LINKS.map((link) => {
              const isActive = activePage === link.id;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative inline-flex items-center min-h-[40px] px-1.5 text-xs sm:text-[13px] font-bold whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea1d24]/60 rounded-md ${
                    isActive
                      ? 'text-[#ea1d24]'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <span>{lang === 'en' ? link.labelEn : link.labelAr}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-1.5 bottom-1.5 h-[1.5px] bg-[#ea1d24] rounded-full"
                    />
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Hairline Divider + Copyright */}
        <div className="pt-5 border-t border-white/[0.06] flex items-center justify-center text-center">
          <p className="text-xs text-zinc-400 font-medium">
            {t(
              `© 2026 ${cleanBrand}. جميع الحقوق محفوظة.`,
              `© 2026 ${cleanBrand}. All rights reserved.`
            )}
          </p>
        </div>
      </div>
    </footer>
  );
};
