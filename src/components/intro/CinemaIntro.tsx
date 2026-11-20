import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import { MASHHAD_LOGO_SRC } from '../common/MashhadLogo';

interface CinemaIntroProps {
  onComplete: () => void;
  siteName?: string;
}

type IntroPhase = 'rays' | 'rim' | 'ignite' | 'reveal' | 'fadeout';

export const CinemaIntro: React.FC<CinemaIntroProps> = ({
  onComplete,
  siteName = 'MASHHAD',
}) => {
  const { lang, t } = useLanguage();
  const [phase, setPhase] = useState<IntroPhase>('rays');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanedRaw = (siteName || 'MASHHAD')
    .replace(/\s+cinema\b/gi, '')
    .replace(/\s+(سينما|سيما)\b/g, '')
    .trim();

  const brandName =
    !cleanedRaw || /^(goldenflix|goldenfelix|جولدن(\s+فليكس)?)$/i.test(cleanedRaw)
      ? 'MASHHAD'
      : cleanedRaw;

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setPhase('reveal');
      const t1 = window.setTimeout(() => setPhase('fadeout'), 600);
      const t2 = window.setTimeout(() => onCompleteRef.current(), 900);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    const timers: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    schedule(() => setPhase('rim'), 550);
    schedule(() => setPhase('ignite'), 1350);
    schedule(() => setPhase('reveal'), 2050);
    schedule(() => setPhase('fadeout'), 3650);
    schedule(() => onCompleteRef.current(), 4050);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const isRimOrLater = phase !== 'rays';
  const isIgnited = phase === 'ignite' || phase === 'reveal' || phase === 'fadeout';
  const isRevealed = phase === 'reveal' || phase === 'fadeout';
  const isFadingOut = phase === 'fadeout';

  return (
    <motion.div
      dir="ltr"
      initial={{ opacity: 1 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden flex items-center justify-center select-none bg-[#04060a]"
      role="dialog"
      aria-modal="true"
      aria-label={t(`مقدمة ${brandName}`, `${brandName} Intro`)}
    >
      {/* Atmospheric Spotlight Canvas (Deep abyssal slate-teal -> subtle crimson cinema bloom, pure radial gradients) */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.15, scale: 0.85 }}
        animate={{
          opacity: isRevealed ? 0.95 : isIgnited ? 0.85 : isRimOrLater ? 0.65 : 0.2,
          scale: isRevealed ? 1.1 : 1,
        }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(30, 62, 82, 0.55) 0%, rgba(16, 26, 38, 0.42) 34%, rgba(22, 10, 18, 0.25) 56%, rgba(4, 6, 10, 0.98) 82%)',
        }}
      />

      {/* Volumetric Diagonal Light Shafts Sweeping From Behind the Emblem */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, rotate: -32, scale: 0.85 }}
        animate={{
          opacity: isRevealed ? 0.14 : isIgnited ? 0.45 : isRimOrLater ? 0.36 : 0.22,
          rotate: isIgnited ? -26 : -34,
          scale: isIgnited ? 1.15 : 0.95,
        }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute w-[520px] sm:w-[760px] h-[520px] sm:h-[760px] will-change-transform"
        style={{
          background:
            'conic-gradient(from 130deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.22) 14deg, transparent 34deg, transparent 82deg, rgba(234,29,36,0.2) 98deg, transparent 124deg, transparent 210deg, rgba(200,235,255,0.2) 228deg, transparent 254deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 45%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 45%, transparent 72%)',
        }}
      />

      {/* Central Lockup: Dark Rim Emblem -> Bright Flash -> Slides Left + Brand Wordmark Reveal */}
      <div className="relative z-10 flex items-center justify-center px-6">
        <motion.div
          layout
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center gap-3.5 sm:gap-5"
        >
          {/* Volumetric Emblem Stage */}
          <motion.div
            initial={{ scale: 0.78, opacity: 0.15 }}
            animate={{
              scale: isRevealed ? 0.88 : isIgnited ? 1.06 : isRimOrLater ? 1 : 0.88,
              opacity: 1,
            }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center shrink-0 will-change-transform"
          >
            {/* Specular Rim Halo */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: isIgnited ? 0.75 : isRimOrLater ? 0.55 : 0.2,
                scale: isIgnited ? 1.18 : 1.05,
              }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute -inset-4 rounded-full"
              style={{
                background: isIgnited
                  ? 'radial-gradient(circle, rgba(234,29,36,0.45) 0%, rgba(255,255,255,0.16) 45%, transparent 72%)'
                  : 'radial-gradient(circle, rgba(165,243,252,0.38) 0%, rgba(56,189,248,0.14) 50%, transparent 72%)',
              }}
            />

            {/* Main Brand Emblem Container */}
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-[22px] sm:rounded-[28px] overflow-hidden bg-[#0a0c12] ring-1 ring-white/25 shadow-[0_18px_50px_rgba(0,0,0,0.9)]">
              {/* Illuminated Real Brand Logo (Fades in cleanly at ignite phase) */}
              <motion.img
                src={MASHHAD_LOGO_SRC}
                alt={brandName}
                decoding="async"
                initial={{ opacity: 0, scale: 1.24 }}
                animate={{
                  opacity: isIgnited ? 1 : isRimOrLater ? 0.32 : 0.08,
                  scale: isIgnited ? 1.12 : 1.2,
                  filter: isIgnited ? 'brightness(1.05) saturate(1.1)' : 'brightness(0.35) saturate(0.2)',
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full object-cover pointer-events-none"
              />

              {/* Dark Rim-Lit Mask Overlay During Early Phases */}
              {!isIgnited && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-br from-cyan-200/20 via-transparent to-black/85 pointer-events-none"
                />
              )}

              {/* Diagonal Specular Light Sweep Across Emblem */}
              <motion.div
                aria-hidden="true"
                initial={{ x: '-140%', opacity: 0 }}
                animate={
                  phase === 'rim' || phase === 'ignite'
                    ? { x: '160%', opacity: [0, 0.85, 0] }
                    : { x: '-140%', opacity: 0 }
                }
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/75 to-transparent"
              />
            </div>
          </motion.div>

          {/* Wordmark & Subtitle Revealed Next to Emblem */}
          {isRevealed && (
            <motion.div
              initial={{ opacity: 0, width: 0, x: -14 }}
              animate={{ opacity: 1, width: 'auto', x: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden flex flex-col justify-center"
            >
              <motion.h1
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white whitespace-nowrap leading-none drop-shadow-[0_6px_22px_rgba(0,0,0,0.8)]"
              >
                {brandName}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 0.78, y: 0 }}
                transition={{ delay: 0.24, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="mt-1.5 text-[11px] sm:text-xs font-bold text-zinc-300 tracking-wide whitespace-nowrap"
              >
                {lang === 'en' ? 'Cinema Streaming Platform' : 'منصة المشاهدة السينمائية'}
              </motion.p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};
