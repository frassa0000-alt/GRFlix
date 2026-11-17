import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';

interface CinemaIntroProps {
  onComplete: () => void;
}

const PLAY_TRIANGLE_PATH =
  'M 20 30 Q 20 14 34 21 L 92 52 Q 106 60 92 68 L 34 99 Q 20 106 20 90 Z';

const PULSE_TOP_HALF_PATH =
  'M 0 0 L 120 0 L 120 60 L 84 60 L 78 52 L 69 68 L 58 40 L 49 76 L 41 48 L 35 60 L 0 60 Z';

const PULSE_BOTTOM_HALF_PATH =
  'M 0 60 L 35 60 L 41 48 L 49 76 L 58 40 L 69 68 L 78 52 L 84 60 L 120 60 L 120 120 L 0 120 Z';

const PULSE_RIDGE_PATH =
  'M 0 60 L 35 60 L 41 48 L 49 76 L 58 40 L 69 68 L 78 52 L 84 60 L 120 60';

const MICRO_PARTICLES: {
  id: string;
  kind: 'ring' | 'square' | 'triangle' | 'cross';
  x: number;
  y: number;
  rotate: number;
  size: number;
  color: string;
  delay: number;
}[] = [
  { id: 'p1', kind: 'ring', x: -74, y: -56, rotate: 0, size: 11, color: '#F7C600', delay: 1.55 },
  { id: 'p2', kind: 'square', x: 76, y: -48, rotate: 38, size: 10, color: '#FDE047', delay: 1.62 },
  { id: 'p3', kind: 'cross', x: -86, y: 12, rotate: 45, size: 9, color: '#F59E0B', delay: 1.68 },
  { id: 'p4', kind: 'triangle', x: 64, y: 54, rotate: 22, size: 11, color: '#F7C600', delay: 1.72 },
  { id: 'p5', kind: 'ring', x: 84, y: 6, rotate: 0, size: 8, color: '#FBBF24', delay: 1.76 },
  { id: 'p6', kind: 'cross', x: -56, y: 64, rotate: 20, size: 8, color: '#FDE68A', delay: 1.8 },
];

export const CinemaIntro: React.FC<CinemaIntroProps> = ({ onComplete }) => {
  const { lang, t } = useLanguage();
  const [isExiting, setIsExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const exitDelay = prefersReduced ? 450 : 3550;
    const doneDelay = prefersReduced ? 750 : 4050;

    const exitTimer = setTimeout(() => setIsExiting(true), exitDelay);
    const doneTimer = setTimeout(() => onCompleteRef.current(), doneDelay);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <motion.div
      dir="ltr"
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1, scale: isExiting ? 1.03 : 1 }}
      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-[#040406] flex flex-col items-center justify-center px-6 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={t('مقدمة GoldenFlix', 'GoldenFlix Intro')}
    >
      {/* Sleek Obsidian Backdrop with Subtle Soft Radial Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 48% at 50% 18%, rgba(247, 198, 0, 0.11) 0%, rgba(161, 98, 7, 0.04) 45%, rgba(4, 4, 6, 0) 78%), radial-gradient(circle at 50% 50%, rgba(24, 24, 30, 0.55) 0%, #040406 72%)',
        }}
      />

      {/* Ambient Soft Center Halo Behind 3D Emblem */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.55, 0.35], scale: [0.6, 1.08, 1] }}
        transition={{ duration: 2.2, times: [0, 0.55, 1], ease: 'easeOut' }}
        className="pointer-events-none absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(247, 198, 0, 0.24) 0%, rgba(245, 158, 11, 0.08) 52%, transparent 76%)',
        }}
      />

      {/* Center 3D Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Emblem Wrapper with Vertical Lift When Brand Reveals */}
        <motion.div
          initial={{ y: 12 }}
          animate={{ y: -8 }}
          transition={{ delay: 1.55, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center"
          style={{ perspective: '950px' }}
        >
          {/* Minimalist Radial Geometric Spark Shapes */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {MICRO_PARTICLES.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
                animate={{
                  opacity: [0, 0.95, 0.85, 0],
                  x: [0, p.x * 0.82, p.x],
                  y: [0, p.y * 0.82, p.y],
                  scale: [0.3, 1.05, 0.75],
                  rotate: [0, p.rotate, p.rotate + 25],
                }}
                transition={{
                  delay: p.delay,
                  duration: 1.05,
                  times: [0, 0.28, 0.72, 1],
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute"
              >
                {p.kind === 'ring' && (
                  <span
                    className="block rounded-full border-[1.75px]"
                    style={{ width: p.size, height: p.size, borderColor: p.color }}
                  />
                )}
                {p.kind === 'square' && (
                  <span
                    className="block rounded-[2px] border-[1.75px]"
                    style={{ width: p.size, height: p.size, borderColor: p.color }}
                  />
                )}
                {p.kind === 'triangle' && (
                  <svg width={p.size} height={p.size} viewBox="0 0 12 12" fill="none">
                    <polygon
                      points="6,1.5 10.8,10 1.2,10"
                      stroke={p.color}
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {p.kind === 'cross' && (
                  <svg width={p.size} height={p.size} viewBox="0 0 12 12" fill="none">
                    <path
                      d="M6 1.5V10.5M1.5 6H10.5"
                      stroke={p.color}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </motion.div>
            ))}
          </div>

          {/* 3D Extruded Play Triangle Assembly (Sweeps in from left -> locks center -> morphs pulse) */}
          <motion.div
            initial={{
              x: '-42vw',
              scale: 0.72,
              rotateY: -42,
              rotateX: 18,
              rotateZ: -8,
              opacity: 0,
            }}
            animate={{
              x: 0,
              scale: [0.72, 1.06, 1],
              rotateY: [-42, 12, -5, 0],
              rotateX: [18, -6, 3, 0],
              rotateZ: [-8, 2, 0],
              opacity: 1,
            }}
            transition={{
              duration: 0.92,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative w-28 h-28 sm:w-36 sm:h-36"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Subtle Continuous 3D Depth Breathing */}
            <motion.div
              animate={{
                rotateY: [0, 8, -5, 0],
                rotateX: [0, -5, 4, 0],
              }}
              transition={{
                delay: 0.95,
                duration: 2.6,
                ease: 'easeInOut',
              }}
              className="relative w-full h-full"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* 3D Back Extrusion Depth Layers */}
              {[
                { z: -9, x: -3, y: 4, fill: '#3d2a04', opacity: 0.95 },
                { z: -7, x: -2.2, y: 3, fill: '#6b4904', opacity: 0.95 },
                { z: -5, x: -1.5, y: 2, fill: '#9c6c07', opacity: 0.95 },
                { z: -3, x: -0.8, y: 1, fill: '#ca8a04', opacity: 0.95 },
              ].map((layer, i) => (
                <svg
                  key={i}
                  viewBox="0 0 120 120"
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    transform: `translate3d(${layer.x}px, ${layer.y}px, ${layer.z}px)`,
                    opacity: layer.opacity,
                  }}
                >
                  <path d={PLAY_TRIANGLE_PATH} fill={layer.fill} />
                </svg>
              ))}

              {/* Main Front 3D Metallic Face with Dual-Wave Cinema Pulse Fill */}
              <svg
                viewBox="0 0 120 120"
                className="relative w-full h-full drop-shadow-[0_18px_36px_rgba(0,0,0,0.88)]"
                style={{ transform: 'translateZ(2px)' }}
              >
                <defs>
                  <clipPath id="gfIntroTriClip">
                    <path d={PLAY_TRIANGLE_PATH} />
                  </clipPath>

                  {/* Initial Brushed Platinum-Ivory 3D Surface */}
                  <linearGradient id="gfIntroPlatinumFace" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="55%" stopColor="#E4E4E7" />
                    <stop offset="100%" stopColor="#A1A1AA" />
                  </linearGradient>

                  {/* Top Liquid Wave Metallic Gold Gradient */}
                  <linearGradient id="gfIntroGoldTop" x1="0%" y1="0%" x2="100%" y2="90%">
                    <stop offset="0%" stopColor="#FFF099" />
                    <stop offset="45%" stopColor="#F7C600" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>

                  {/* Bottom Liquid Wave Deep Amber-Gold Gradient */}
                  <linearGradient id="gfIntroGoldBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="55%" stopColor="#D97706" />
                    <stop offset="100%" stopColor="#7C2D12" />
                  </linearGradient>

                  {/* 3D Specular Edge Rim */}
                  <linearGradient id="gfIntroEdgeRim" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                    <stop offset="45%" stopColor="rgba(247,198,0,0.55)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.18)" />
                  </linearGradient>

                  {/* Diagonal Specular Light Sheen */}
                  <linearGradient id="gfIntroSheen" x1="0%" y1="0%" x2="100%" y2="30%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.45)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>
                </defs>

                {/* Base Platinum Face (visible immediately as triangle enters) */}
                <path d={PLAY_TRIANGLE_PATH} fill="url(#gfIntroPlatinumFace)" />

                {/* Clipped Interior Animated Wave Morph */}
                <g clipPath="url(#gfIntroTriClip)">
                  {/* Top Gold Wave Sweeping In */}
                  <motion.path
                    d={PULSE_TOP_HALF_PATH}
                    fill="url(#gfIntroGoldTop)"
                    initial={{ x: -120, y: -10, opacity: 0.9 }}
                    animate={{ x: 0, y: 0, opacity: 1 }}
                    transition={{
                      delay: 0.88,
                      duration: 0.72,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />

                  {/* Bottom Gold-Bronze Wave Sweeping In */}
                  <motion.path
                    d={PULSE_BOTTOM_HALF_PATH}
                    fill="url(#gfIntroGoldBottom)"
                    initial={{ x: -120, y: 10, opacity: 0.9 }}
                    animate={{ x: 0, y: 0, opacity: 1 }}
                    transition={{
                      delay: 0.98,
                      duration: 0.72,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />

                  {/* Crisp Glowing Pulse Cut Seam */}
                  <motion.path
                    d={PULSE_RIDGE_PATH}
                    fill="none"
                    stroke="#FFF4B8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: [0, 0.95, 0.7] }}
                    transition={{
                      delay: 1.05,
                      duration: 0.7,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />

                  {/* Specular Metallic Sweep Across Front Bevel */}
                  <motion.rect
                    x="-60"
                    y="-20"
                    width="55"
                    height="160"
                    fill="url(#gfIntroSheen)"
                    transform="rotate(24 60 60)"
                    initial={{ x: -110, opacity: 0 }}
                    animate={{ x: 185, opacity: [0, 0.8, 0] }}
                    transition={{
                      delay: 1.75,
                      duration: 0.9,
                      ease: 'easeInOut',
                    }}
                  />
                </g>

                {/* Crisp 3D Chamfer Rim */}
                <path
                  d={PLAY_TRIANGLE_PATH}
                  fill="none"
                  stroke="url(#gfIntroEdgeRim)"
                  strokeWidth="1.6"
                />
              </svg>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* GoldenFlix Modern Wordmark Reveal */}
        <div className="mt-2 sm:mt-3 flex flex-col items-center text-center overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 18, clipPath: 'inset(0 100% 0 0)' }}
            animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)' }}
            transition={{
              delay: 1.75,
              duration: 0.68,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative px-2"
          >
            <h1 className="text-[32px] sm:text-[44px] font-black tracking-tight leading-none font-sans">
              <span
                className="text-[#F7C600]"
                style={{
                  textShadow: '0 4px 20px rgba(247, 198, 0, 0.35)',
                }}
              >
                Golden
              </span>
              <span
                className="text-white"
                style={{
                  textShadow: '0 4px 18px rgba(0, 0, 0, 0.75)',
                }}
              >
                Flix
              </span>
            </h1>
          </motion.div>

          {/* Subtle Modern Tagline Sweep */}
          <motion.p
            initial={{ opacity: 0, y: 8, letterSpacing: '0.32em' }}
            animate={{ opacity: 0.85, y: 0, letterSpacing: '0.2em' }}
            transition={{
              delay: 2.15,
              duration: 0.65,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-2 text-[10px] sm:text-xs font-medium uppercase text-zinc-400"
          >
            {lang === 'en' ? 'CINEMA STREAMING' : 'STREAMING PLATFORM'}
          </motion.p>
        </div>
      </div>

    </motion.div>
  );
};
