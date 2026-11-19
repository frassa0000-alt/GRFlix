import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';

interface CinemaIntroProps {
  onComplete: () => void;
}

type IntroPhase =
  | 'idle'
  | 'rainbow'
  | 'strawberry'
  | 'gingham'
  | 'charge'
  | 'burst'
  | 'reveal'
  | 'fadeout';

const BURST_RAYS = Array.from({ length: 18 }, (_, i) => {
  const colors = [
    '#F7C600',
    '#F97316',
    '#EF4444',
    '#EC4899',
    '#A855F7',
    '#3B82F6',
    '#06B6D4',
    '#4ADE80',
    '#FACC15',
  ];
  return {
    id: i,
    angle: i * 20 + (i % 2 === 0 ? -4 : 4),
    color: colors[i % colors.length],
    thickness: i % 3 === 0 ? 12 : i % 2 === 0 ? 8 : 5,
    delay: (i % 4) * 0.015,
  };
});

const SPARK_STARS = [
  { id: 's1', x: -12, y: -32, size: 7, delay: 0.48 },
  { id: 's2', x: 18, y: -38, size: 6, delay: 0.54 },
  { id: 's3', x: 36, y: -20, size: 8, delay: 0.6 },
  { id: 's4', x: 42, y: 8, size: 6, delay: 0.52 },
  { id: 's5', x: 24, y: 32, size: 7, delay: 0.64 },
  { id: 's6', x: -6, y: 34, size: 5, delay: 0.58 },
  { id: 's7', x: -24, y: 12, size: 6, delay: 0.66 },
  { id: 's8', x: 8, y: -14, size: 5, delay: 0.7 },
];

export const CinemaIntro: React.FC<CinemaIntroProps> = ({ onComplete }) => {
  const { lang, t } = useLanguage();
  const [phase, setPhase] = useState<IntroPhase>('idle');
  const [mascotLanded, setMascotLanded] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setPhase('reveal');
      setMascotLanded(true);
      const t1 = window.setTimeout(() => setPhase('fadeout'), 700);
      const t2 = window.setTimeout(() => onCompleteRef.current(), 1050);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    const timers: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    schedule(() => setPhase('rainbow'), 1250);
    schedule(() => setPhase('strawberry'), 1850);
    schedule(() => setPhase('gingham'), 2450);
    schedule(() => setPhase('charge'), 3050);
    schedule(() => setPhase('burst'), 3450);
    schedule(() => setPhase('reveal'), 3950);
    schedule(() => setMascotLanded(true), 4550);
    schedule(() => setPhase('fadeout'), 6150);
    schedule(() => onCompleteRef.current(), 6550);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const isLightStage = phase === 'reveal';
  const isFadingOut = phase === 'fadeout';

  return (
    <motion.div
      dir="ltr"
      initial={{ opacity: 1 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden flex items-center justify-center select-none transition-colors duration-200 ${
        isLightStage ? 'bg-[#F5F5F7]' : isFadingOut ? 'bg-[#0c0c10]' : 'bg-black'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={t('مقدمة GoldenFlix', 'GoldenFlix Intro')}
    >
      {/* Ambient Aura Behind Character During Morph Stages */}
      {phase === 'rainbow' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 0.42, scale: 1.15 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(244,114,182,0.55) 0%, rgba(56,189,248,0.35) 55%, transparent 75%)',
          }}
        />
      )}

      {phase === 'strawberry' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 0.45, scale: 1.2 }}
          className="pointer-events-none absolute w-60 h-60 sm:w-80 sm:h-80 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(34,197,94,0.35) 0%, rgba(244,143,177,0.28) 50%, transparent 75%)',
          }}
        />
      )}

      {phase === 'gingham' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 0.45, scale: 1.2 }}
          className="pointer-events-none absolute w-60 h-60 sm:w-80 sm:h-80 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(30,64,175,0.22) 55%, transparent 75%)',
          }}
        />
      )}

      {/* PHASE 1 & 2: Playful Morphing Mascot + Right Sparkle Cluster */}
      {(phase === 'idle' ||
        phase === 'rainbow' ||
        phase === 'strawberry' ||
        phase === 'gingham' ||
        phase === 'charge') && (
        <div className="relative flex items-center justify-center">
          <motion.div
            animate={
              phase === 'idle'
                ? {
                    y: [0, -7, 0],
                    rotate: [0, 6, 4, 0],
                    scale: [0.94, 1, 1],
                  }
                : phase === 'rainbow'
                ? {
                    y: [-2, 3, -1],
                    rotate: [0, -6, 3],
                    scale: [1, 1.07, 1],
                  }
                : phase === 'strawberry'
                ? {
                    scaleX: [1, 1.15, 0.96, 1.04],
                    scaleY: [1, 0.86, 1.05, 0.96],
                    rotate: [-4, 4, 0],
                  }
                : phase === 'gingham'
                ? {
                    scaleX: [1.04, 0.92, 1.06, 1],
                    scaleY: [0.96, 1.08, 0.95, 1],
                    rotate: [2, -5, 0],
                  }
                : {
                    scale: [1, 0.84, 0.76],
                    y: [0, 6, 10],
                    rotate: [0, 8, -4],
                  }
            }
            transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-28 h-32 sm:w-36 sm:h-40 flex items-center justify-center"
          >
            <svg viewBox="0 0 140 160" className="w-full h-full overflow-visible">
              <defs>
                {/* Smooth Iridescent Rainbow Gradient */}
                <linearGradient id="gfIntroRainbow" x1="15%" y1="10%" x2="88%" y2="90%">
                  <stop offset="0%" stopColor="#F472B6" />
                  <stop offset="35%" stopColor="#FBBF24" />
                  <stop offset="68%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>

                {/* Blue & White Gingham Checkered Pattern */}
                <pattern
                  id="gfIntroGingham"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(8)"
                >
                  <rect width="20" height="20" fill="#EFF6FF" />
                  <rect width="10" height="20" fill="#60A5FA" fillOpacity="0.55" />
                  <rect width="20" height="10" fill="#3B82F6" fillOpacity="0.55" />
                  <rect width="10" height="10" fill="#1D4ED8" fillOpacity="0.72" />
                </pattern>

                <clipPath id="gfIntroMascotClip">
                  <ellipse cx="70" cy="80" rx="52" ry="60" />
                </clipPath>
              </defs>

              {/* Soft outer white glow on black stage */}
              <ellipse
                cx="70"
                cy="80"
                rx="55"
                ry="63"
                fill="rgba(255,255,255,0.08)"
                className="blur-md"
              />

              {/* Mascot Body Surface */}
              {phase === 'rainbow' ? (
                <ellipse cx="70" cy="80" rx="52" ry="60" fill="url(#gfIntroRainbow)" />
              ) : phase === 'strawberry' ? (
                <g clipPath="url(#gfIntroMascotClip)">
                  <ellipse cx="70" cy="80" rx="52" ry="60" fill="#F48FB1" />
                  {/* Splash green base */}
                  <path
                    d="M 16 112 Q 36 96 52 110 Q 70 92 88 108 Q 104 95 126 112 L 126 146 L 16 146 Z"
                    fill="#22C55E"
                  />
                  {/* Playful dashed stitch inner contour */}
                  <ellipse
                    cx="70"
                    cy="80"
                    rx="46"
                    ry="54"
                    fill="none"
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth="2.5"
                    strokeDasharray="6 5"
                  />
                </g>
              ) : phase === 'gingham' ? (
                <ellipse cx="70" cy="80" rx="52" ry="60" fill="url(#gfIntroGingham)" />
              ) : (
                <ellipse cx="70" cy="80" rx="52" ry="60" fill="#FFFFFF" />
              )}

              {/* Expressive Tilted Eyes */}
              <motion.g
                animate={
                  phase === 'idle'
                    ? { x: [0, 10, 12, 0], y: [0, -2, 0] }
                    : phase === 'strawberry'
                    ? { x: [0, -3, 2, 0], y: [0, -4, 0] }
                    : phase === 'gingham'
                    ? { x: [0, 8, 6], y: [0, 2, 0] }
                    : phase === 'charge'
                    ? { y: [0, 6], scaleY: [1, 0.85] }
                    : { x: 0, y: 0 }
                }
                transition={{ duration: 0.65, ease: 'easeInOut' }}
              >
                <rect
                  x="60"
                  y="44"
                  width="9.5"
                  height="23"
                  rx="4.75"
                  fill="#0A0A0D"
                  transform="rotate(-14 65 55)"
                />
                <rect
                  x="81"
                  y="42"
                  width="9.5"
                  height="23"
                  rx="4.75"
                  fill="#0A0A0D"
                  transform="rotate(-14 86 53)"
                />
              </motion.g>
            </svg>
          </motion.div>

          {/* Right-Side Sparkling Shape Burst During Idle Beat */}
          {phase === 'idle' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.4, x: 76, y: -12 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.4, 1.08, 0.95, 0.3],
                x: [68, 86, 92, 82],
              }}
              transition={{ delay: 0.38, duration: 0.82, times: [0, 0.3, 0.72, 1] }}
              className="pointer-events-none absolute flex items-center justify-center"
            >
              {/* Morphing white glowing blob trio */}
              <svg width="68" height="68" viewBox="0 0 68 68" className="overflow-visible">
                <circle cx="34" cy="24" r="10.5" fill="#FFFFFF" />
                <circle cx="23" cy="39" r="9.5" fill="#FFFFFF" />
                <circle cx="44" cy="40" r="10" fill="#FFFFFF" />
              </svg>

              {/* Twinkling 4-point diamond stars */}
              {SPARK_STARS.map((star) => (
                <motion.span
                  key={star.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                  transition={{ delay: star.delay, duration: 0.5 }}
                  className="absolute block bg-white"
                  style={{
                    left: `calc(50% + ${star.x}px)`,
                    top: `calc(50% + ${star.y}px)`,
                    width: star.size,
                    height: star.size,
                    clipPath: 'polygon(50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%, 38% 38%)',
                  }}
                />
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* PHASE 3: Vibrant Color Ray Starburst Explosion */}
      {phase === 'burst' && (
        <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
          {BURST_RAYS.map((ray) => (
            <motion.div
              key={ray.id}
              initial={{ scaleX: 0.15, opacity: 0.9 }}
              animate={{ scaleX: 1.55, opacity: [0.95, 1, 0.8] }}
              transition={{ delay: ray.delay, duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute origin-left"
              style={{
                left: '50%',
                top: '50%',
                width: '72vmax',
                height: ray.thickness,
                marginTop: -(ray.thickness / 2),
                background: `linear-gradient(90deg, ${ray.color} 0%, ${ray.color} 72%, transparent 100%)`,
                transform: `rotate(${ray.angle}deg)`,
              }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: [0.25, 1.65, 2.3], opacity: [1, 1, 0.9] }}
            transition={{ duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none relative w-44 h-44 sm:w-64 sm:h-64 rounded-full"
            style={{
              background:
                'radial-gradient(circle, #FDE047 0%, #FB7185 38%, #FF2E54 68%, rgba(255,46,84,0) 90%)',
              boxShadow: '0 0 60px 18px rgba(255, 59, 92, 0.65)',
            }}
          />
        </div>
      )}

      {/* PHASE 4: Crisp Bright Stage With GoldenFlix Reveal & Bouncing Mascot Landing */}
      <AnimatePresence>
        {(isLightStage || isFadingOut) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.14 }}
            className="relative z-10 flex flex-col items-center justify-center px-4 text-center"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-baseline justify-center text-[42px] sm:text-[66px] md:text-[78px] font-black tracking-tight leading-none text-[#0B0B0F]"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif' }}
            >
              <span>G</span>

              {/* Target Letter "o" Where Mascot Drops & Settles */}
              <span className="relative inline-flex items-center justify-center mx-[0.01em]">
                <motion.span
                  animate={
                    mascotLanded
                      ? { scaleY: [1, 0.68, 1.05, 1], opacity: [1, 0.15, 0] }
                      : { scaleY: 1, opacity: 1 }
                  }
                  transition={{ duration: 0.28 }}
                  className="inline-block"
                >
                  o
                </motion.span>

                {/* Impact Shockwave Ring Beneath Landing Point */}
                {mascotLanded && (
                  <motion.span
                    initial={{ scale: 0.3, opacity: 0.9 }}
                    animate={{ scale: 1.55, opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="pointer-events-none absolute -bottom-[0.04em] w-[1.15em] h-[0.34em] rounded-full border-[2.5px] border-[#0B0B0F]/70"
                  />
                )}

                {/* Dropping White Mascot Character */}
                <motion.span
                  initial={{ y: '-26vh', x: '0.65em', scale: 0.95, opacity: 0 }}
                  animate={{
                    y: ['-26vh', '0.02em', '-0.16em', '0.02em'],
                    x: ['0.65em', '0em', '0em', '0em'],
                    scaleX: [0.95, 1.18, 0.94, 1],
                    scaleY: [1.05, 0.78, 1.06, 1],
                    opacity: [0, 1, 1, 1],
                  }}
                  transition={{
                    delay: 0.22,
                    duration: 0.62,
                    times: [0, 0.62, 0.8, 1],
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <svg
                    viewBox="0 0 100 108"
                    className="w-[0.76em] h-[0.82em] overflow-visible drop-shadow-[0_6px_12px_rgba(0,0,0,0.16)]"
                  >
                    <ellipse
                      cx="50"
                      cy="55"
                      rx="42"
                      ry="46"
                      fill="#FFFFFF"
                      stroke="#E4E4E7"
                      strokeWidth="2.5"
                    />
                    <motion.g
                      animate={{ rotate: [0, -10, 6, 0], x: [0, 2, -1, 0] }}
                      transition={{ delay: 0.82, duration: 0.7, ease: 'easeInOut' }}
                      style={{ transformOrigin: '52px 44px' }}
                    >
                      <rect
                        x="42"
                        y="26"
                        width="7.5"
                        height="18"
                        rx="3.75"
                        fill="#0B0B0F"
                        transform="rotate(-14 46 35)"
                      />
                      <rect
                        x="58"
                        y="24"
                        width="7.5"
                        height="18"
                        rx="3.75"
                        fill="#0B0B0F"
                        transform="rotate(-14 62 33)"
                      />
                    </motion.g>
                  </svg>
                </motion.span>
              </span>

              <span>lden</span>
              <span className="text-[#EAB308]">Flix</span>
            </motion.div>

            {/* Subtle Brand Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 0.72, y: 0 }}
              transition={{ delay: 0.68, duration: 0.38 }}
              className="mt-3 text-xs sm:text-sm font-bold text-zinc-600 tracking-wide"
            >
              {lang === 'en' ? 'Cinema Streaming Platform' : 'منصة المشاهدة السينمائية'}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
