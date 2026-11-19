import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Film, Heart } from 'lucide-react';
import emptyCinemaBoxImg from '../../assets/images/empty_cinema_box_1794772467523.jpg';
import { useLanguage } from '../../contexts/LanguageContext';

interface EmptyCinemaStateProps {
  titleStart?: string;
  titleHighlight?: string;
  titleEnd?: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  showHeartAccent?: boolean;
}

export const EmptyCinemaState: React.FC<EmptyCinemaStateProps> = ({
  titleStart,
  titleHighlight,
  titleEnd,
  subtitle,
  ctaLabel,
  onCtaClick,
  showHeartAccent = true,
}) => {
  const { t, dir } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);

  const startText = titleStart ?? t('مكتبتك', 'Your Library is');
  const highlightText = titleHighlight ?? t('فارغة', 'Empty');
  const endText = titleEnd ?? t('حالياً', 'Right Now');
  const subtitleText =
    subtitle ??
    t(
      'ستجد هنا أفلامك ومسلسلاتك المفضلة بعد إضافتها',
      'Your favorite movies and series will appear here once added'
    );
  const buttonText = ctaLabel ?? t('تصفح المحتوى', 'Browse Content');

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative py-10 sm:py-14 px-4 flex flex-col items-center justify-center text-center overflow-hidden"
    >
      {/* Soft Crimson Radial Spotlight Glow Behind 3D Box */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#ea1d24]/12 blur-3xl" />

      {/* 3D Cinema Box Artwork */}
      <div className="relative w-52 h-52 sm:w-60 sm:h-60 mb-4 flex items-center justify-center select-none">
        {!imgFailed ? (
          <img
            src={emptyCinemaBoxImg}
            alt={t('مكتبة MASHHAD فارغة', 'Empty MASHHAD Library')}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-contain rounded-3xl mix-blend-lighten drop-shadow-[0_18px_36px_rgba(234,29,36,0.18)] animate-float"
          />
        ) : (
          <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-[#1d1726] to-[#0f0c14] border border-[#ea1d24]/30 flex items-center justify-center shadow-[0_16px_38px_rgba(234,29,36,0.16)]">
            <Film className="w-16 h-16 text-[#ea1d24]" />
          </div>
        )}
      </div>

      {/* Main Heading with Red Keyword Accent */}
      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug mb-2.5 text-balance">
        <span>{startText} </span>
        <span className="text-[#ea1d24]">{highlightText}</span>
        {endText ? <span> {endText}</span> : null}
      </h3>

      {/* Supporting Subtitle */}
      <p className="text-xs sm:text-sm text-zinc-400 max-w-xs sm:max-w-sm leading-relaxed mb-7">
        {subtitleText}{' '}
        {showHeartAccent && (
          <Heart
            className="inline-block w-3.5 h-3.5 text-[#ea1d24] fill-[#ea1d24] align-middle"
            aria-hidden="true"
          />
        )}
      </p>

      {/* Primary CTA Button */}
      {onCtaClick && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onCtaClick}
          className="min-h-[48px] inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-[#ea1d24] hover:bg-[#ff2b32] text-white font-black text-sm shadow-[0_10px_28px_rgba(234,29,36,0.36)] transition-all cursor-pointer"
        >
          <span>{buttonText}</span>
          <Play
            className={`w-4 h-4 fill-white ${dir === 'rtl' ? 'rotate-180' : ''}`}
          />
        </motion.button>
      )}
    </motion.div>
  );
};
