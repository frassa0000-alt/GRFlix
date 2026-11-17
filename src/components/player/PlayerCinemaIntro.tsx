import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface PlayerCinemaIntroProps {
  onComplete: () => void;
  isLandscape?: boolean;
}

type IntroSceneId =
  | 'welcome'
  | 'brand_new'
  | 'cinematic'
  | 'adventure'
  | 'exclusive'
  | 'warp'
  | 'showcase'
  | 'finale';

const SCENE_SCHEDULE: Array<{ id: IntroSceneId; atMs: number }> = [
  { id: 'welcome', atMs: 0 },
  { id: 'brand_new', atMs: 1100 },
  { id: 'cinematic', atMs: 1950 },
  { id: 'adventure', atMs: 2800 },
  { id: 'exclusive', atMs: 3650 },
  { id: 'warp', atMs: 4750 },
  { id: 'showcase', atMs: 5350 },
  { id: 'finale', atMs: 7300 },
];

const TOTAL_EXIT_MS = 8600;
const TOTAL_DONE_MS = 9000;

const CINEMA_FONT_STYLE: React.CSSProperties = {
  fontFamily: "'Cinzel', Georgia, serif",
};

const CHROME_SILVER_TEXT_STYLE: React.CSSProperties = {
  ...CINEMA_FONT_STYLE,
  backgroundImage:
    'linear-gradient(180deg, #ffffff 0%, #e0f2fe 36%, #bae6fd 58%, #94a3b8 84%, #e2e8f0 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 6px 22px rgba(0, 168, 255, 0.35)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.9))',
};

const GOLD_METALLIC_TEXT_STYLE: React.CSSProperties = {
  ...CINEMA_FONT_STYLE,
  backgroundImage:
    'linear-gradient(180deg, #fffbeb 0%, #fde047 38%, #f7c600 68%, #b45309 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 6px 22px rgba(247, 198, 0, 0.45)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.9))',
};

const AnamorphicFlareBar: React.FC<{
  sweepFrom?: string;
  sweepTo?: string;
  widthClass?: string;
  goldHint?: boolean;
}> = ({
  sweepFrom = '-32%',
  sweepTo = '32%',
  widthClass = 'w-[78vw] max-w-[540px]',
  goldHint = false,
}) => (
  <div className={`relative mt-2.5 sm:mt-3.5 h-[2px] ${widthClass} flex items-center justify-center`}>
    {/* Razor thin horizontal flare beam */}
    <div
      className="w-full h-[1.5px] rounded-full opacity-90"
      style={{
        background: goldHint
          ? 'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.4) 18%, rgba(247,198,0,0.85) 50%, rgba(56,189,248,0.4) 82%, transparent 100%)'
          : 'linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.45) 18%, rgba(125,211,252,0.95) 50%, rgba(14,165,233,0.45) 82%, transparent 100%)',
      }}
    />
    {/* Traveling intense hotspot flare */}
    <motion.div
      initial={{ x: sweepFrom, opacity: 0.4 }}
      animate={{ x: sweepTo, opacity: [0.5, 1, 0.7] }}
      transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none absolute flex items-center justify-center"
    >
      <div
        className="w-28 sm:w-44 h-6 rounded-full blur-md"
        style={{
          background: goldHint
            ? 'radial-gradient(ellipse at center, rgba(247,198,0,0.55) 0%, rgba(56,189,248,0.4) 45%, transparent 75%)'
            : 'radial-gradient(ellipse at center, rgba(56,189,248,0.75) 0%, rgba(2,132,199,0.35) 50%, transparent 78%)',
        }}
      />
      <div className="absolute w-10 sm:w-16 h-[3px] rounded-full bg-white blur-[1.5px] shadow-[0_0_16px_4px_rgba(125,211,252,0.95)]" />
    </motion.div>
  </div>
);

export const PlayerCinemaIntro: React.FC<PlayerCinemaIntroProps> = ({
  onComplete,
  isLandscape = false,
}) => {
  const [scene, setScene] = useState<IntroSceneId>('welcome');
  const [isBlackCut, setIsBlackCut] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setScene('finale');
      const exitTimer = window.setTimeout(() => setIsExiting(true), 950);
      const doneTimer = window.setTimeout(() => onCompleteRef.current(), 1300);
      return () => {
        window.clearTimeout(exitTimer);
        window.clearTimeout(doneTimer);
      };
    }

    const timers: number[] = [];

    for (const item of SCENE_SCHEDULE) {
      if (item.atMs === 0) continue;
      timers.push(window.setTimeout(() => setScene(item.id), item.atMs));
    }

    // Brief sharp impact blackout cuts mirroring the reference video rhythm
    const blackoutBeats = [1020, 2710, 3570];
    for (const cutAt of blackoutBeats) {
      timers.push(window.setTimeout(() => setIsBlackCut(true), cutAt));
      timers.push(window.setTimeout(() => setIsBlackCut(false), cutAt + 95));
    }

    timers.push(window.setTimeout(() => setIsExiting(true), TOTAL_EXIT_MS));
    timers.push(window.setTimeout(() => onCompleteRef.current(), TOTAL_DONE_MS));

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const topRightBloomActive =
    scene === 'brand_new' ||
    scene === 'cinematic' ||
    scene === 'adventure' ||
    scene === 'showcase' ||
    scene === 'finale';
  const bottomLeftBloomActive =
    scene === 'welcome' || scene === 'exclusive' || scene === 'warp';

  return (
    <motion.div
      dir="ltr"
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="absolute inset-0 z-50 w-full h-full overflow-hidden bg-[#01050d] flex items-center justify-center select-none"
      aria-label="GoldenFlix Cinema Intro"
    >
      {/* 1. Deep Midnight Cinematic Blue Atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 50% 50%, rgba(8, 52, 110, 0.58) 0%, rgba(3, 21, 52, 0.85) 48%, #01050c 100%)',
        }}
      />

      {/* 2. Rotating Volumetric Blue Smoke / Nebula Swirls */}
      <motion.div
        aria-hidden="true"
        initial={{ rotate: 0, scale: 1.05 }}
        animate={{ rotate: 42, scale: 1.18 }}
        transition={{ duration: 9, ease: 'linear' }}
        className="pointer-events-none absolute -inset-[25%] opacity-75"
      >
        <svg viewBox="0 0 800 800" className="w-full h-full">
          <defs>
            <radialGradient id="gfBlueSmokeA" cx="50%" cy="50%" r="50%">
              <stop offset="45%" stopColor="rgba(14, 165, 233, 0)" />
              <stop offset="76%" stopColor="rgba(56, 189, 248, 0.16)" />
              <stop offset="92%" stopColor="rgba(2, 132, 199, 0.08)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>
            <linearGradient id="gfBlueSwirlRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(125, 211, 252, 0)" />
              <stop offset="50%" stopColor="rgba(56, 189, 248, 0.24)" />
              <stop offset="100%" stopColor="rgba(2, 132, 199, 0)" />
            </linearGradient>
          </defs>
          <circle cx="400" cy="400" r="320" fill="url(#gfBlueSmokeA)" />
          <ellipse
            cx="400"
            cy="400"
            rx="340"
            ry="245"
            fill="none"
            stroke="url(#gfBlueSwirlRibbon)"
            strokeWidth="22"
            transform="rotate(-24 400 400)"
          />
          <ellipse
            cx="400"
            cy="400"
            rx="290"
            ry="335"
            fill="none"
            stroke="url(#gfBlueSwirlRibbon)"
            strokeWidth="16"
            transform="rotate(34 400 400)"
          />
        </svg>
      </motion.div>

      <motion.div
        aria-hidden="true"
        initial={{ rotate: 15, scale: 1.12 }}
        animate={{ rotate: -34, scale: 1.02 }}
        transition={{ duration: 9, ease: 'linear' }}
        className="pointer-events-none absolute -inset-[20%] opacity-55 blur-xl"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              'conic-gradient(from 40deg at 50% 50%, transparent 0deg, rgba(14,165,233,0.22) 65deg, transparent 140deg, rgba(56,189,248,0.18) 220deg, transparent 310deg, rgba(247,198,0,0.06) 340deg, transparent 360deg)',
          }}
        />
      </motion.div>

      {/* 3. Dynamic Electric Sapphire & Cyan Corner Lens Flares */}
      <motion.div
        aria-hidden="true"
        animate={{
          opacity: topRightBloomActive ? 0.92 : 0.16,
          scale: topRightBloomActive ? 1.1 : 0.72,
        }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 sm:w-[440px] sm:h-[440px] rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle at 65% 35%, rgba(224,242,254,0.85) 0%, rgba(0,180,255,0.68) 22%, rgba(2,132,199,0.28) 52%, transparent 76%)',
        }}
      />

      <motion.div
        aria-hidden="true"
        animate={{
          opacity: bottomLeftBloomActive ? 0.9 : 0.14,
          scale: bottomLeftBloomActive ? 1.08 : 0.75,
        }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 sm:w-[440px] sm:h-[440px] rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle at 35% 65%, rgba(224,242,254,0.85) 0%, rgba(0,174,255,0.65) 24%, rgba(3,105,161,0.26) 54%, transparent 78%)',
        }}
      />

      {/* Subtle GoldenFlix Warm Gold Center Accent Wash */}
      <motion.div
        aria-hidden="true"
        animate={{
          opacity: scene === 'showcase' || scene === 'finale' ? 0.45 : 0.12,
        }}
        transition={{ duration: 0.6 }}
        className="pointer-events-none absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(247,198,0,0.24) 0%, rgba(14,165,233,0.12) 48%, transparent 75%)',
        }}
      />

      {/* 4. Choreography Stage */}
      <div className="relative z-10 w-full h-full flex items-center justify-center px-4 sm:px-8">
        <AnimatePresence mode="wait">
          {scene === 'welcome' && (
            <motion.div
              key="scene-welcome"
              initial={{ opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1.06, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.14, filter: 'blur(4px)' }}
              transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center max-w-full"
            >
              <motion.h2
                initial={{ letterSpacing: '0.24em' }}
                animate={{ letterSpacing: '0.4em' }}
                transition={{ duration: 1.05, ease: 'easeOut' }}
                className="text-[28px] sm:text-5xl md:text-6xl font-bold uppercase whitespace-nowrap pl-[0.4em]"
                style={CHROME_SILVER_TEXT_STYLE}
              >
                WELCOME
              </motion.h2>
              <AnamorphicFlareBar sweepFrom="-35%" sweepTo="28%" />
            </motion.div>
          )}

          {scene === 'brand_new' && (
            <motion.div
              key="scene-brand-new"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
              animate={{ opacity: 1, scale: 1.06, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.16 }}
              transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center max-w-full"
            >
              <motion.h2
                initial={{ letterSpacing: '0.22em' }}
                animate={{ letterSpacing: '0.36em' }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                className="text-[26px] sm:text-5xl md:text-6xl font-bold uppercase whitespace-nowrap pl-[0.36em]"
                style={CHROME_SILVER_TEXT_STYLE}
              >
                GOLDENFLIX
              </motion.h2>
              <AnamorphicFlareBar sweepFrom="-20%" sweepTo="38%" goldHint />
            </motion.div>
          )}

          {scene === 'cinematic' && (
            <motion.div
              key="scene-cinematic"
              initial={{ opacity: 0, scale: 0.86, filter: 'blur(7px)' }}
              animate={{ opacity: 1, scale: 1.08, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.2, filter: 'blur(5px)' }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center max-w-full"
            >
              <motion.h2
                initial={{ letterSpacing: '0.2em' }}
                animate={{ letterSpacing: '0.36em' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="text-[27px] sm:text-5xl md:text-6xl font-bold uppercase whitespace-nowrap pl-[0.36em]"
                style={CHROME_SILVER_TEXT_STYLE}
              >
                CINEMATIC
              </motion.h2>
              <AnamorphicFlareBar sweepFrom="30%" sweepTo="-30%" />
            </motion.div>
          )}

          {scene === 'adventure' && (
            <motion.div
              key="scene-adventure"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
              animate={{ opacity: 1, scale: 1.07, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center max-w-full"
            >
              <motion.h2
                initial={{ letterSpacing: '0.2em' }}
                animate={{ letterSpacing: '0.36em' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="text-[26px] sm:text-5xl md:text-6xl font-bold uppercase whitespace-nowrap pl-[0.36em]"
                style={CHROME_SILVER_TEXT_STYLE}
              >
                EXPERIENCE
              </motion.h2>
              <AnamorphicFlareBar sweepFrom="-35%" sweepTo="25%" />
            </motion.div>
          )}

          {scene === 'exclusive' && (
            <motion.div
              key="scene-exclusive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.25, filter: 'blur(6px)' }}
              transition={{ duration: 0.35 }}
              className="relative w-full h-full flex flex-col items-center justify-center text-center"
            >
              {/* Luminous Curved Planetary Horizon Line */}
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0, y: 36, scale: 0.9 }}
                animate={{ opacity: 0.95, y: 0, scale: 1 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-none absolute top-[54%] w-[140vw] h-[55vw] max-h-[380px] rounded-[100%] border-t-2 border-cyan-300/80"
                style={{
                  boxShadow:
                    '0 -10px 42px rgba(0, 186, 255, 0.55), inset 0 12px 38px rgba(14, 165, 233, 0.25)',
                }}
              />

              {/* Optical Stretched Letters Converging Into Razor Focus */}
              <motion.h2
                initial={{
                  opacity: 0.2,
                  scaleX: 1.55,
                  letterSpacing: '0.82em',
                  filter: 'blur(7px)',
                }}
                animate={{
                  opacity: 1,
                  scaleX: 1,
                  letterSpacing: '0.36em',
                  filter: 'blur(0px)',
                }}
                transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 text-[26px] sm:text-5xl md:text-6xl font-bold uppercase whitespace-nowrap pl-[0.36em]"
                style={CHROME_SILVER_TEXT_STYLE}
              >
                EXCLUSIVE
              </motion.h2>

              <AnamorphicFlareBar sweepFrom="-25%" sweepTo="25%" widthClass="w-[65vw] max-w-[440px]" />
            </motion.div>
          )}

          {scene === 'warp' && (
            <motion.div
              key="scene-warp"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative w-full h-full flex items-center justify-center"
            >
              {/* High-Speed Blue Radial Optical Stretch */}
              <motion.div
                initial={{ scale: 0.35, opacity: 0.4, filter: 'blur(2px)' }}
                animate={{ scale: 2.35, opacity: [0.65, 1, 0], filter: 'blur(10px)' }}
                transition={{ duration: 0.58, ease: [0.4, 0, 1, 1] }}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="text-4xl sm:text-7xl font-black uppercase tracking-[0.55em] pl-[0.55em]"
                  style={CHROME_SILVER_TEXT_STYLE}
                >
                  GOLDEN
                </div>
                <div className="mt-2 w-56 sm:w-96 h-1 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_28px_rgba(56,189,248,0.95)]" />
              </motion.div>

              {/* Radial Sapphire Flash Burst */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 0.9, 0.4], scale: [0.5, 1.35, 1.8] }}
                transition={{ duration: 0.58, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 50%, rgba(186,230,253,0.45) 0%, rgba(2,132,199,0.52) 45%, rgba(1,15,40,0.9) 100%)',
                }}
              />
            </motion.div>
          )}

          {scene === 'showcase' && (
            <motion.div
              key="scene-showcase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.06, filter: 'blur(4px)' }}
              transition={{ duration: 0.45 }}
              className={`w-full max-w-4xl flex ${
                isLandscape ? 'flex-row' : 'flex-col sm:flex-row'
              } items-center justify-center gap-5 sm:gap-10 px-2`}
              style={{ perspective: '1200px' }}
            >
              {/* Left 3D Perspective Studio Presentation Slate (GoldenFlix Emblem) */}
              <motion.div
                initial={{
                  opacity: 0,
                  x: -48,
                  rotateY: 48,
                  rotateX: 12,
                  scale: 0.82,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  rotateY: 22,
                  rotateX: 4,
                  scale: 1,
                }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                className="relative shrink-0"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* 3D Extruded Spine Edge */}
                <div
                  aria-hidden="true"
                  className="absolute top-1 bottom-1 -left-3.5 w-4 rounded-l-md bg-gradient-to-b from-slate-200 via-sky-300/70 to-slate-500 border-l border-white/50 shadow-xl"
                  style={{
                    transform: 'rotateY(-72deg) translateZ(6px)',
                  }}
                />

                {/* Main 3D Studio Case Face */}
                <div
                  className="relative w-32 h-44 sm:w-48 sm:h-64 rounded-r-xl rounded-l-sm overflow-hidden border border-sky-300/45 shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_38px_rgba(0,170,255,0.28)] flex flex-col items-center justify-between p-4 sm:p-6"
                  style={{
                    background:
                      'linear-gradient(145deg, #061b3d 0%, #030d21 48%, #091d3a 100%)',
                  }}
                >
                  {/* Decorative Cinema Filigree Circle */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-35"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 50% 46%, transparent 32%, rgba(56,189,248,0.22) 33%, transparent 34%), radial-gradient(circle at 50% 46%, transparent 48%, rgba(247,198,0,0.22) 49%, transparent 50%)',
                    }}
                  />

                  {/* Top Studio Mark */}
                  <span
                    className="relative z-10 text-[7px] sm:text-[9px] tracking-[0.28em] text-sky-200/85 uppercase"
                    style={CINEMA_FONT_STYLE}
                  >
                    OFFICIAL STREAM
                  </span>

                  {/* Center 3D Golden Play Emblem */}
                  <div className="relative z-10 flex items-center justify-center">
                    <div
                      aria-hidden="true"
                      className="absolute w-16 h-16 sm:w-24 sm:h-24 rounded-full blur-xl opacity-65"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(247,198,0,0.55) 0%, rgba(56,189,248,0.25) 60%, transparent 80%)',
                      }}
                    />
                    <svg
                      viewBox="0 0 100 100"
                      className="w-12 h-12 sm:w-18 sm:h-18 drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)]"
                    >
                      <defs>
                        <linearGradient id="gfSlateGold" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FFF7B2" />
                          <stop offset="45%" stopColor="#F7C600" />
                          <stop offset="100%" stopColor="#B45309" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 24 22 Q 24 12 34 17 L 82 43 Q 92 50 82 57 L 34 83 Q 24 88 24 78 Z"
                        fill="url(#gfSlateGold)"
                        stroke="rgba(255,255,255,0.65)"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </div>

                  {/* Bottom Title Engraved On Slate */}
                  <div className="relative z-10 text-center space-y-0.5">
                    <p
                      className="text-[11px] sm:text-sm font-bold tracking-[0.2em]"
                      style={GOLD_METALLIC_TEXT_STYLE}
                    >
                      GOLDENFLIX
                    </p>
                    <p
                      className="text-[6px] sm:text-[8px] tracking-[0.26em] text-sky-200/70 uppercase"
                      style={CINEMA_FONT_STYLE}
                    >
                      ORIGINAL EDITION
                    </p>
                  </div>

                  {/* Specular Glass Sweep */}
                  <motion.div
                    initial={{ x: '-140%' }}
                    animate={{ x: '220%' }}
                    transition={{ delay: 0.35, duration: 1.0, ease: 'easeInOut' }}
                    className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  />
                </div>
              </motion.div>

              {/* Right Stacked Chrome Typography Matching Reference */}
              <motion.div
                initial={{ opacity: 0, x: 28, filter: 'blur(6px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.16, duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col ${
                  isLandscape ? 'items-start text-left' : 'items-center sm:items-start text-center sm:text-left'
                }`}
              >
                <div className="text-[22px] sm:text-4xl md:text-5xl font-bold uppercase tracking-[0.22em] leading-tight">
                  <span style={GOLD_METALLIC_TEXT_STYLE}>GOLDEN</span>
                  <span style={CHROME_SILVER_TEXT_STYLE}>FLIX</span>
                </div>
                <div
                  className="mt-1 text-sm sm:text-2xl md:text-3xl font-semibold uppercase tracking-[0.26em] leading-tight"
                  style={CHROME_SILVER_TEXT_STYLE}
                >
                  NEW CINEMA
                </div>
                <AnamorphicFlareBar
                  sweepFrom="-20%"
                  sweepTo="35%"
                  widthClass="w-56 sm:w-80"
                  goldHint
                />
              </motion.div>
            </motion.div>
          )}

          {scene === 'finale' && (
            <motion.div
              key="scene-finale"
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(5px)' }}
              animate={{ opacity: 1, scale: 1.04, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center max-w-full"
            >
              <motion.h2
                initial={{ letterSpacing: '0.18em' }}
                animate={{ letterSpacing: '0.28em' }}
                transition={{ duration: 1.0, ease: 'easeOut' }}
                className="text-[22px] sm:text-4xl md:text-5xl font-bold uppercase whitespace-nowrap pl-[0.28em]"
                style={CHROME_SILVER_TEXT_STYLE}
              >
                NOW STREAMING
              </motion.h2>

              <AnamorphicFlareBar
                sweepFrom="-30%"
                sweepTo="30%"
                widthClass="w-[74vw] max-w-[480px]"
                goldHint
              />

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.55 }}
                className="mt-2.5 sm:mt-3.5 text-sm sm:text-xl md:text-2xl font-bold uppercase tracking-[0.34em] pl-[0.34em]"
              >
                <span style={GOLD_METALLIC_TEXT_STYLE}>GOLDENFLIX</span>
                <span className="mx-2 text-sky-300/70">·</span>
                <span style={CHROME_SILVER_TEXT_STYLE}>ULTRA HD</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Crisp Impact Blackout Cut Layer */}
      {isBlackCut && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 bg-black"
        />
      )}
    </motion.div>
  );
};
