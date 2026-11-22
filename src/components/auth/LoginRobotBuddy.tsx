import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  playMishmishVoice,
  unlockMishmishAudio,
} from '../../utils/mishmishVoice';

export type RandomTapMood =
  | 'smile'
  | 'laugh'
  | 'wink'
  | 'surprised'
  | 'starry'
  | 'shy'
  | 'cool';

export type RobotMood =
  | 'normal'
  | 'tickle'
  | 'loading'
  | 'cry'
  | 'celebrate'
  | 'angry'
  | RandomTapMood;

const ANGRY_REPLIES_AR = [
  'توقّف! دعني أنام!',
  'كفى، لقد غضبت حقّاً!',
  'لا تزعجني كثيراً!',
  'أرجوك، اتركني أستريح!',
];

const ANGRY_REPLIES_EN = [
  'Hey! Stop poking me!',
  'Let me sleep already!',
  'Too many taps! I am grumpy!',
  'Seriously? Stop tapping me!',
];

const RANDOM_TAP_MOODS: RandomTapMood[] = [
  'smile',
  'laugh',
  'wink',
  'surprised',
  'starry',
  'shy',
  'cool',
];

interface LoginRobotBuddyProps {
  isLoading?: boolean;
  /** True if user has not logged in for >= 1 day so Mishmish starts crying */
  initialAbsentCry?: boolean;
  /** Optional externally forced mood (e.g. 'celebrate' on post-login welcome) */
  forcedMood?: RobotMood;
  /** Component scale preset */
  size?: 'sm' | 'md' | 'lg';
}

const LOADING_DOTS = [
  { cx: 38, cy: 34, delay: 0.0 },
  { cx: 50, cy: 34, delay: 0.12 },
  { cx: 62, cy: 34, delay: 0.24 },
  { cx: 38, cy: 46, delay: 0.36 },
  { cx: 50, cy: 46, delay: 0.18 },
  { cx: 62, cy: 46, delay: 0.48 },
  { cx: 38, cy: 58, delay: 0.6 },
  { cx: 50, cy: 58, delay: 0.42 },
  { cx: 62, cy: 58, delay: 0.72 },
];

// Organic morphing liquid-water orb contour paths (centered around 50,46 in 100x92 viewBox)
const LIQUID_BLOB_FRAMES = [
  'M 50,12 C 67,11 81,20 84,37 C 87,55 77,73 59,78 C 43,82 23,77 17,60 C 11,42 19,21 35,14 C 41,12 45,12 50,12 Z',
  'M 51,13 C 69,14 83,24 83,42 C 83,60 72,76 54,79 C 36,81 19,72 16,54 C 13,36 22,19 38,14 C 43,12 47,12 51,13 Z',
  'M 49,11 C 65,12 80,21 85,39 C 88,57 74,75 56,78 C 38,80 21,74 16,56 C 12,39 20,20 36,13 C 41,11 45,11 49,11 Z',
  'M 50,12 C 67,11 81,20 84,37 C 87,55 77,73 59,78 C 43,82 23,77 17,60 C 11,42 19,21 35,14 C 41,12 45,12 50,12 Z',
];

export const LoginRobotBuddy: React.FC<LoginRobotBuddyProps> = ({
  isLoading = false,
  initialAbsentCry = false,
  forcedMood,
  size = 'md',
}) => {
  const { lang, dir, t } = useLanguage();
  const uid = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLButtonElement>(null);

  const [mood, setMood] = useState<
    'normal' | 'tickle' | 'cry' | 'celebrate' | 'angry' | RandomTapMood
  >(() => (initialAbsentCry ? 'cry' : 'normal'));
  const [tickleIntensity, setTickleIntensity] = useState(0);
  const [angrySpeech, setAngrySpeech] = useState<string | null>(null);

  const lastRandomMoodRef = useRef<RandomTapMood | null>(null);
  const lastAngryReplyRef = useRef<string | null>(null);
  const recentTapTimesRef = useRef<number[]>([]);
  const comfortedFromCryRef = useRef<boolean>(false);

  // Sync cry state when AuthModal re-opens with >= 1 day absence
  useEffect(() => {
    if (forcedMood) return;
    if (initialAbsentCry) {
      comfortedFromCryRef.current = false;
      setMood('cry');
    } else if (mood === 'cry') {
      setMood('normal');
    }
  }, [initialAbsentCry, forcedMood]);

  // Track vertical oscillation for tickling (touch or pressed drag up & down)
  const lastYRef = useRef<number | null>(null);
  const lastDirRef = useRef<-1 | 0 | 1>(0);
  const lastFlipTimeRef = useRef<number>(0);
  const tickleScoreRef = useRef<number>(0);
  const calmTimerRef = useRef<number | null>(null);
  const lastTapWasDragRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const scheduleReturnToNormal = useCallback(
    (delayMs: number) => {
      if (forcedMood) return;
      if (calmTimerRef.current) {
        window.clearTimeout(calmTimerRef.current);
      }
      calmTimerRef.current = window.setTimeout(() => {
        tickleScoreRef.current = 0;
        setTickleIntensity(0);
        setAngrySpeech(null);
        recentTapTimesRef.current = [];
        setMood(initialAbsentCry && !comfortedFromCryRef.current ? 'cry' : 'normal');
      }, delayMs);
    },
    [forcedMood, initialAbsentCry]
  );

  useEffect(() => {
    return () => {
      if (calmTimerRef.current) window.clearTimeout(calmTimerRef.current);
    };
  }, []);

  // Process vertical Y movement to detect pressed/touch up-and-down tickle rubbing
  const processVerticalMotion = useCallback(
    (clientY: number, sensitivityBoost = 1) => {
      if (isLoading || forcedMood) return;
      const now = performance.now();

      if (lastYRef.current === null) {
        lastYRef.current = clientY;
        return;
      }

      const dy = clientY - lastYRef.current;
      if (Math.abs(dy) < 3.5) return;

      const dirY: -1 | 1 = dy > 0 ? 1 : -1;
      lastYRef.current = clientY;

      if (now - lastFlipTimeRef.current > 650) {
        tickleScoreRef.current = Math.max(0, tickleScoreRef.current - 1.5);
      }

      if (lastDirRef.current !== 0 && dirY !== lastDirRef.current) {
        tickleScoreRef.current = Math.min(6, tickleScoreRef.current + 1.15 * sensitivityBoost);
        lastFlipTimeRef.current = now;
      } else if (Math.abs(dy) > 10 * (1 / sensitivityBoost)) {
        tickleScoreRef.current = Math.min(6, tickleScoreRef.current + 0.35 * sensitivityBoost);
        lastFlipTimeRef.current = now;
      }

      lastDirRef.current = dirY;

      if (tickleScoreRef.current >= 1.8) {
        comfortedFromCryRef.current = true;
        setMood('tickle');
        setTickleIntensity((prev) => (prev + 1) % 100);
        playMishmishVoice('tickle');
        try {
          if ('vibrate' in navigator && tickleScoreRef.current > 3) {
            navigator.vibrate(6);
          }
        } catch {
          // ignore
        }
        scheduleReturnToNormal(1750);
      }
    },
    [isLoading, forcedMood, scheduleReturnToNormal]
  );

  // Pick a random expression on tap, or get grumpy & talk back when tapped many times rapidly
  const triggerRandomExpression = useCallback(() => {
    if (isLoading) return;
    unlockMishmishAudio();

    if (forcedMood === 'celebrate') {
      playMishmishVoice('celebrate');
      return;
    }

    comfortedFromCryRef.current = true;

    const now = performance.now();
    const recent = recentTapTimesRef.current.filter((ts) => now - ts < 2400);
    recent.push(now);
    recentTapTimesRef.current = recent;

    if (recent.length >= 5 || mood === 'angry') {
      const replies = lang === 'en' ? ANGRY_REPLIES_EN : ANGRY_REPLIES_AR;
      const filtered = replies.filter((r) => r !== lastAngryReplyRef.current);
      const reply = filtered[Math.floor(Math.random() * filtered.length)] || replies[0];
      lastAngryReplyRef.current = reply;

      setMood('angry');
      setAngrySpeech(reply);
      playMishmishVoice('angry');
      scheduleReturnToNormal(2800);
      return;
    }

    setAngrySpeech(null);
    const pool = RANDOM_TAP_MOODS.filter((m) => m !== lastRandomMoodRef.current);
    const chosen = pool[Math.floor(Math.random() * pool.length)] || 'smile';
    lastRandomMoodRef.current = chosen;

    setMood(chosen);
    playMishmishVoice(chosen);
    scheduleReturnToNormal(2300);
  }, [isLoading, forcedMood, mood, lang, scheduleReturnToNormal]);

  const handleTap = () => {
    if (isLoading || lastTapWasDragRef.current) {
      lastTapWasDragRef.current = false;
      return;
    }
    triggerRandomExpression();
  };

  const handleDirectPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    unlockMishmishAudio();
    lastTapWasDragRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastYRef.current = e.clientY;
    lastDirRef.current = 0;
  };

  const handleDirectPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;

    if (dragStartRef.current) {
      const dist = Math.hypot(
        e.clientX - dragStartRef.current.x,
        e.clientY - dragStartRef.current.y
      );
      if (dist > 10) {
        lastTapWasDragRef.current = true;
      }
    }
    processVerticalMotion(e.clientY, 1.4);
  };

  const handleDirectPointerUp = () => {
    dragStartRef.current = null;
  };

  const activeMood: RobotMood = isLoading ? 'loading' : forcedMood || mood;
  const isCrying = activeMood === 'cry';
  const isAngry = activeMood === 'angry';
  const isExpressive =
    activeMood !== 'normal' &&
    activeMood !== 'loading' &&
    activeMood !== 'cry' &&
    activeMood !== 'angry';

  const sizeClasses =
    size === 'lg'
      ? { button: 'w-[112px] h-[102px]', svg: 'w-[104px] h-[94px]' }
      : size === 'sm'
      ? { button: 'w-[60px] h-[54px]', svg: 'w-[56px] h-[50px]' }
      : { button: 'w-[80px] h-[72px]', svg: 'w-[74px] h-[68px]' };

  const getBodyAnimation = () => {
    switch (activeMood) {
      case 'angry':
        return {
          x: [-2.8, 2.8, -2.2, 2.2, 0],
          y: [0, -2.2, 0.8, -1.8, 0],
          rotate: [-4.5, 4.5, -3.5, 3.5, 0],
          scaleX: [1.06, 0.96, 1.05, 0.97, 1],
          scaleY: [0.95, 1.06, 0.96, 1.04, 1],
        };
      case 'cry':
        return {
          y: [0, 1.8, 0.5, 1.6, 0],
          rotate: [-1.5, 1.2, -1.2, 0.8, -1.5],
          scaleX: [1, 1.02, 0.99, 1],
          scaleY: [1, 0.97, 1.01, 1],
        };
      case 'celebrate':
        return {
          y: [0, -9, 1, -6, 0],
          rotate: [0, -5, 5, -3, 0],
          scaleX: [1, 1.08, 0.95, 1.04, 1],
          scaleY: [1, 0.94, 1.08, 0.98, 1],
        };
      case 'tickle':
        return {
          y: [-2.5, 2.5, -2.5, 1.5, 0],
          rotate: tickleIntensity % 2 === 0 ? [-6, 6, -4, 3] : [6, -6, 4, -3],
          scaleX: [1.08, 0.92, 1.07, 0.96],
          scaleY: [0.9, 1.1, 0.93, 1.04],
        };
      case 'laugh':
        return {
          y: [0, -5, 1, -3, 0],
          rotate: [0, -4, 4, -2, 0],
          scaleX: [1, 1.07, 0.96, 1.03, 1],
          scaleY: [1, 0.95, 1.06, 0.98, 1],
        };
      case 'surprised':
        return {
          y: [0, -6, 0],
          scale: [0.92, 1.1, 1],
          rotate: 0,
        };
      case 'wink':
        return {
          y: [0, -2.5, 0],
          rotate: [0, -6, 0],
          scale: [0.96, 1.05, 1],
        };
      case 'starry':
        return {
          y: [0, -4, 0, -2, 0],
          scale: [0.95, 1.08, 1],
          rotate: [0, 3, -3, 0],
        };
      case 'shy':
        return {
          y: [0, 1.5, 0],
          rotate: [0, -5, -3],
          scale: [0.96, 1.02, 0.99],
        };
      case 'cool':
        return {
          y: [0, -2, 0],
          rotate: [0, 4, 2],
          scale: [0.96, 1.04, 1],
        };
      case 'smile':
        return {
          y: [0, -3, 0],
          scale: [0.95, 1.06, 1],
          rotate: 0,
        };
      default:
        // Peaceful sleeping breathing motion when nobody touches/taps Mishmish
        return {
          y: [0, 1.8, 0],
          rotate: [-0.8, 0.8, -0.8],
          scaleX: [1, 1.036, 1],
          scaleY: [1, 0.962, 1],
        };
    }
  };

  // Water wave motion slows calmly during sleep and speeds up when laughing/tickled/angry
  const liquidCycleDuration =
    activeMood === 'angry'
      ? 1.05
      : activeMood === 'tickle' || activeMood === 'celebrate' || activeMood === 'laugh'
      ? 1.55
      : isCrying
      ? 4.6
      : activeMood === 'normal'
      ? 5.0
      : 3.4;

  const clipId = `mishmish-liquid-clip-${uid}`;
  const bodyGradId = `mishmish-jelly-grad-${uid}`;
  const cryGradId = `mishmish-cry-grad-${uid}`;
  const angryGradId = `mishmish-angry-grad-${uid}`;
  const rimGradId = `mishmish-rim-grad-${uid}`;
  const eyeGlowId = `mishmish-eye-glow-${uid}`;

  return (
    <div className="relative inline-flex flex-col items-center justify-center select-none">
      <motion.button
        ref={containerRef}
        type="button"
        onClick={handleTap}
        onPointerDown={handleDirectPointerDown}
        onPointerMove={handleDirectPointerMove}
        onPointerUp={handleDirectPointerUp}
        onPointerCancel={handleDirectPointerUp}
        aria-label={t('مشمش', 'Mishmish')}
        style={{ touchAction: 'none' }}
        animate={getBodyAnimation()}
        transition={
          activeMood === 'angry'
            ? { duration: 0.26, repeat: Infinity, ease: 'easeInOut' }
            : activeMood === 'tickle'
            ? { duration: 0.28, repeat: Infinity, ease: 'easeInOut' }
            : activeMood === 'cry'
            ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            : activeMood === 'celebrate'
            ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
            : activeMood === 'laugh'
            ? { duration: 0.48, repeat: 2, ease: 'easeInOut' }
            : activeMood === 'normal'
            ? { duration: 4.4, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.36, ease: [0.16, 1, 0.3, 1] }
        }
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.91 }}
        className={`relative ${sizeClasses.button} rounded-full flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 group`}
      >
        {/* Living Translucent Violet-Cyan Water Orb (Mishmish) */}
        <svg
          viewBox="0 0 100 92"
          className={`relative z-10 ${sizeClasses.svg} overflow-visible ${
            isAngry
              ? 'drop-shadow-[0_0_14px_rgba(251,113,133,0.55)]'
              : 'drop-shadow-[0_0_12px_rgba(103,232,249,0.38)]'
          }`}
          aria-hidden="true"
        >
          <defs>
            {/* Violet-Purple Translucent Core fading into Luminous Cyan Rim (matches uploaded reference) */}
            <radialGradient id={bodyGradId} cx="46%" cy="42%" r="58%">
              <stop offset="0%" stopColor={isExpressive ? '#9333ea' : '#7c3aed'} stopOpacity="0.92" />
              <stop offset="52%" stopColor={isExpressive ? '#7e22ce' : '#6d28d9'} stopOpacity="0.88" />
              <stop offset="78%" stopColor="#4f46e5" stopOpacity="0.85" />
              <stop offset="92%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.96" />
            </radialGradient>

            {/* Cooler sad deep-blue water tint when absent/crying */}
            <radialGradient id={cryGradId} cx="46%" cy="42%" r="58%">
              <stop offset="0%" stopColor="#4338ca" stopOpacity="0.9" />
              <stop offset="58%" stopColor="#3b82f6" stopOpacity="0.84" />
              <stop offset="86%" stopColor="#60a5fa" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.95" />
            </radialGradient>

            {/* Fiery crimson-coral water tint when grumpy/annoyed */}
            <radialGradient id={angryGradId} cx="46%" cy="42%" r="58%">
              <stop offset="0%" stopColor="#dc2626" stopOpacity="0.94" />
              <stop offset="56%" stopColor="#e11d48" stopOpacity="0.9" />
              <stop offset="84%" stopColor="#fb7185" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#fda4af" stopOpacity="0.97" />
            </radialGradient>

            {/* Crisp Luminous Cyan-Aqua Water Rim Stroke */}
            <linearGradient id={rimGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="48%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            {/* Soft Eye Glow Filter matching the luminous white eyes in the image */}
            <filter id={eyeGlowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Animated Organic Liquid Clip Mask */}
            <clipPath id={clipId}>
              <motion.path
                d={LIQUID_BLOB_FRAMES[0]}
                animate={{ d: LIQUID_BLOB_FRAMES }}
                transition={{
                  duration: liquidCycleDuration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </clipPath>
          </defs>

          {activeMood === 'loading' ? (
            <g>
              {/* Softly breathing water shell behind loading dots */}
              <motion.path
                d={LIQUID_BLOB_FRAMES[0]}
                animate={{ d: LIQUID_BLOB_FRAMES }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                fill={`url(#${bodyGradId})`}
                fillOpacity={0.38}
                stroke={`url(#${rimGradId})`}
                strokeWidth="1.6"
              />
              {LOADING_DOTS.map((dot, idx) => (
                <motion.circle
                  key={idx}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={2.8}
                  fill="#ffffff"
                  animate={{
                    opacity: [0.22, 1, 0.22],
                    scale: [0.82, 1.15, 0.82],
                  }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: dot.delay,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </g>
          ) : (
            <g>
              {/* 1. Organic Living Water/Jelly Orb Shell */}
              <motion.path
                d={LIQUID_BLOB_FRAMES[0]}
                animate={{ d: LIQUID_BLOB_FRAMES }}
                transition={{
                  duration: liquidCycleDuration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                fill={
                  isAngry
                    ? `url(#${angryGradId})`
                    : isCrying
                    ? `url(#${cryGradId})`
                    : `url(#${bodyGradId})`
                }
                stroke={isAngry ? '#fda4af' : isCrying ? '#93c5fd' : `url(#${rimGradId})`}
                strokeWidth="1.9"
              />

              {/* 2. Animated Internal Moving Water Waves & Glossy Caustic Reflections */}
              <g clipPath={`url(#${clipId})`}>
                {/* Sloshing translucent water wave band inside the orb */}
                <motion.path
                  d="M -20,48 Q 10,36 40,48 T 100,48 T 160,48 L 160,96 L -20,96 Z"
                  fill={
                    isAngry
                      ? 'rgba(251,113,133,0.3)'
                      : isCrying
                      ? 'rgba(96,165,250,0.28)'
                      : 'rgba(167,139,250,0.26)'
                  }
                  animate={{
                    x: [-28, 0, -28],
                    y: isCrying ? [4, 7, 4] : [-2, 3, -2],
                  }}
                  transition={{
                    duration: liquidCycleDuration * 0.9,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <motion.path
                  d="M -20,56 Q 15,66 48,54 T 112,56 T 168,54 L 168,96 L -20,96 Z"
                  fill={isCrying ? 'rgba(147,197,253,0.2)' : 'rgba(56,189,248,0.22)'}
                  animate={{
                    x: [0, -32, 0],
                    y: [2, -2, 2],
                  }}
                  transition={{
                    duration: liquidCycleDuration * 1.15,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                {/* Glossy water-surface caustic sheen arcs matching reference highlights */}
                <motion.path
                  d="M 23,31 C 28,20 42,15 56,17"
                  fill="none"
                  stroke="rgba(224,242,254,0.68)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  animate={{ opacity: [0.55, 0.9, 0.55], x: [-1, 1.5, -1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.path
                  d="M 67,25 C 74,31 77,41 75,51"
                  fill="none"
                  stroke="rgba(165,243,252,0.45)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  animate={{ opacity: [0.35, 0.7, 0.35], y: [-1, 1.5, -1] }}
                  transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.ellipse
                  cx="31"
                  cy="27"
                  rx="3.4"
                  ry="1.8"
                  transform="rotate(-28 31 27)"
                  fill="rgba(255,255,255,0.78)"
                  animate={{ opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.path
                  d="M 33,70 C 44,75 58,74 68,66"
                  fill="none"
                  stroke="rgba(103,232,249,0.48)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  animate={{ opacity: [0.38, 0.72, 0.38] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </g>

              {/* Subtle Translucent Rose Cheeks when Laughing / Tickled / Shy / Celebrate */}
              {(activeMood === 'laugh' ||
                activeMood === 'tickle' ||
                activeMood === 'shy' ||
                activeMood === 'starry' ||
                activeMood === 'celebrate') && (
                <g opacity={0.42}>
                  <ellipse cx="30" cy="54" rx="4.8" ry="2.4" fill="#f472b6" />
                  <ellipse cx="70" cy="54" rx="4.8" ry="2.4" fill="#f472b6" />
                </g>
              )}

              {/* 1. SLEEPING / IDLE — Peaceful Closed Eyes, Breathing Bubble Mouth & Floating Zzz */}
              {activeMood === 'normal' && (
                <g>
                  <g filter={`url(#${eyeGlowId})`}>
                    <path
                      d="M 35.5,43 Q 40.5,48.5 45.5,43"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.9"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 54.5,43 Q 59.5,48.5 64.5,43"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.9"
                      strokeLinecap="round"
                    />
                    {/* Gentle breathing sleeping mouth */}
                    <motion.ellipse
                      cx="50"
                      cy="54.5"
                      rx="2.6"
                      ry="2.2"
                      fill="#ffffff"
                      animate={{
                        scale: [0.8, 1.22, 0.8],
                        opacity: [0.7, 0.98, 0.7],
                      }}
                      transition={{
                        duration: 4.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      style={{ transformOrigin: '50px 54.5px' }}
                    />
                  </g>

                  {/* Soft rising Zzz sleep letters */}
                  <motion.text
                    x="74"
                    y="22"
                    fill="#bae6fd"
                    fontSize="9"
                    fontWeight="800"
                    fontFamily="sans-serif"
                    animate={{
                      y: [22, 12, 5],
                      x: [74, 77, 80],
                      opacity: [0, 0.9, 0],
                      scale: [0.75, 1, 0.9],
                    }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  >
                    z
                  </motion.text>
                  <motion.text
                    x="81"
                    y="15"
                    fill="#a5f3fc"
                    fontSize="11"
                    fontWeight="900"
                    fontFamily="sans-serif"
                    animate={{
                      y: [15, 5, -3],
                      x: [81, 85, 88],
                      opacity: [0, 0.85, 0],
                      scale: [0.75, 1.05, 0.9],
                    }}
                    transition={{
                      duration: 2.8,
                      delay: 1.3,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  >
                    Z
                  </motion.text>
                </g>
              )}

              {/* 2. SMILE */}
              {activeMood === 'smile' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <path
                    d="M 35.5,43.5 Q 40.5,36.5 45.5,43.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 54.5,43.5 Q 59.5,36.5 64.5,43.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 44,54 Q 50,59.5 56,54"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* 3. LAUGH */}
              {activeMood === 'laugh' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <path
                    d="M 35,43 Q 40.5,35.5 46,43"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 54,43 Q 59.5,35.5 65,43"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 42,51.5 Q 50,53.5 58,51.5 C 57.5,59.5 53.8,62 50,62 C 46.2,62 42.5,59.5 42,51.5 Z"
                    fill="#ffffff"
                  />
                  <path
                    d="M 46.2,58 Q 50,55.8 53.8,58 Q 50,60.8 46.2,58 Z"
                    fill="#a855f7"
                  />
                </g>
              )}

              {/* 4. WINK */}
              {activeMood === 'wink' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <path
                    d="M 40.5,37 C 43.5,37 45.5,44 44.7,47.7 C 44.1,49.3 42.7,48 40.5,47.9 C 38.3,48 36.9,49.3 36.3,47.7 C 35.5,44 37.5,37 40.5,37 Z"
                    fill="#ffffff"
                  />
                  <path
                    d="M 55,43 Q 59.8,38 64.5,43"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 44.5,53.5 Q 51.5,58.5 57.5,52"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* 5. SURPRISED */}
              {activeMood === 'surprised' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <circle cx="40" cy="42" r="4.6" fill="#ffffff" />
                  <circle cx="60" cy="42" r="4.6" fill="#ffffff" />
                  <ellipse cx="50" cy="56" rx="4" ry="4.8" fill="#ffffff" />
                </g>
              )}

              {/* 6. STARRY */}
              {activeMood === 'starry' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <path
                    d="M40 35.5 L41.8 40.6 L47 42.3 L41.8 44 L40 49.2 L38.2 44 L33 42.3 L38.2 40.6 Z"
                    fill="#ffffff"
                  />
                  <path
                    d="M60 35.5 L61.8 40.6 L67 42.3 L61.8 44 L60 49.2 L58.2 44 L53 42.3 L58.2 40.6 Z"
                    fill="#ffffff"
                  />
                  <path
                    d="M 44,54.5 Q 50,59.5 56,54.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.7"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* 7. SHY / CAT SMILE */}
              {activeMood === 'shy' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <path
                    d="M 40,38 C 42.7,38 44.5,44 43.8,47 C 43.2,48.4 42,47.3 40,47.2 C 38,47.3 36.8,48.4 36.2,47 C 35.5,44 37.3,38 40,38 Z"
                    fill="#ffffff"
                  />
                  <path
                    d="M 60,38 C 62.7,38 64.5,44 63.8,47 C 63.2,48.4 62,47.3 60,47.2 C 58,47.3 56.8,48.4 56.2,47 C 55.5,44 57.3,38 60,38 Z"
                    fill="#ffffff"
                  />
                  <path
                    d="M 43.5,53.5 Q 46.8,57.5 50,53.5 Q 53.2,57.5 56.5,53.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* 8. COOL */}
              {activeMood === 'cool' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <rect x="34" y="40.5" width="12" height="4.4" rx="2.2" fill="#ffffff" />
                  <rect x="54" y="40.5" width="12" height="4.4" rx="2.2" fill="#ffffff" />
                  <path
                    d="M 44,54 Q 50.5,58 57.5,52.8"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* 9. TICKLE (مدغدغ بيضحك) */}
              {activeMood === 'tickle' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <path
                    d="M 35.5,38.5 L 43,42.5 L 35.5,46.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 64.5,38.5 L 57,42.5 L 64.5,46.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <motion.path
                    animate={{ scaleY: [0.92, 1.1, 0.92] }}
                    transition={{ duration: 0.22, repeat: Infinity }}
                    style={{ transformOrigin: '50px 55px' }}
                    d="M 41,51.5 Q 50,53 59,51.5 C 58.5,60 54.5,63 50,63 C 45.5,63 41.5,60 41,51.5 Z"
                    fill="#ffffff"
                  />
                </g>
              )}

              {/* 10. CRY (بيعيط لما يغيب يوم عن تسجيل الدخول) */}
              {activeMood === 'cry' && (
                <g>
                  <path
                    d="M 34,36 Q 38.5,34.5 42.5,33"
                    fill="none"
                    stroke="#bae6fd"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 66,36 Q 61.5,34.5 57.5,33"
                    fill="none"
                    stroke="#bae6fd"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 35,42.5 Q 39.5,46.5 44,42.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 56,42.5 Q 60.5,46.5 65,42.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <motion.path
                    d="M 44.5,57.5 Q 50,52.5 55.5,57.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    animate={{ y: [0, 0.8, -0.3, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                  />
                  {/* Animated rolling teardrops (Left & Right) */}
                  <motion.path
                    d="M 37.5,47.5 C 37.5,47.5 34.8,52 34.8,53.8 A 2.7,2.7 0 0,0 40.2,53.8 C 40.2,52 37.5,47.5 37.5,47.5 Z"
                    fill="#bae6fd"
                    animate={{
                      y: [0, 9, 14],
                      opacity: [0, 0.95, 0],
                      scale: [0.7, 1, 0.75],
                    }}
                    transition={{ duration: 1.35, repeat: Infinity, ease: 'easeIn' }}
                  />
                  <motion.path
                    d="M 62.5,47.5 C 62.5,47.5 59.8,52 59.8,53.8 A 2.7,2.7 0 0,0 65.2,53.8 C 65.2,52 62.5,47.5 62.5,47.5 Z"
                    fill="#bae6fd"
                    animate={{
                      y: [0, 9, 14],
                      opacity: [0, 0.95, 0],
                      scale: [0.7, 1, 0.75],
                    }}
                    transition={{
                      duration: 1.35,
                      delay: 0.65,
                      repeat: Infinity,
                      ease: 'easeIn',
                    }}
                  />
                </g>
              )}

              {/* 11. CELEBRATE (فرحان أوي بعد تسجيل الدخول) */}
              {activeMood === 'celebrate' && (
                <g filter={`url(#${eyeGlowId})`}>
                  <path
                    d="M 34.5,43 Q 40,35 45.5,43"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 54.5,43 Q 60,35 65.5,43"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 41,51 Q 50,53 59,51 C 58.5,60 54.5,63 50,63 C 45.5,63 41.5,60 41,51 Z"
                    fill="#ffffff"
                  />
                  <path
                    d="M 46,58.5 Q 50,56.2 54,58.5 Q 50,61.6 46,58.5 Z"
                    fill="#a855f7"
                  />
                </g>
              )}

              {/* 12. ANGRY (بيتعصب لما تضغط عليه كتير) */}
              {activeMood === 'angry' && (
                <g filter={`url(#${eyeGlowId})`}>
                  {/* Sharp furrowed eyebrows */}
                  <path
                    d="M 33,36 L 44.5,40.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 67,36 L 55.5,40.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  {/* Fierce narrowed glowing eyes */}
                  <ellipse cx="40" cy="44" rx="4.2" ry="3.2" fill="#ffffff" />
                  <ellipse cx="60" cy="44" rx="4.2" ry="3.2" fill="#ffffff" />
                  {/* Grumpy zigzag scolding mouth */}
                  <motion.path
                    d="M 41.5,56.5 L 45.5,53.5 L 50,56.5 L 54.5,53.5 L 58.5,56.5"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    animate={{ scaleY: [0.85, 1.25, 0.85] }}
                    transition={{ duration: 0.25, repeat: Infinity }}
                    style={{ transformOrigin: '50px 55px' }}
                  />
                  {/* Cartoon annoyance cross-mark on upper brow */}
                  <motion.path
                    d="M 69,24 Q 72,27 69,30 M 75,24 Q 72,27 75,30 M 67,27 Q 72,27 77,27"
                    fill="none"
                    stroke="#fecdd3"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    animate={{ scale: [0.9, 1.2, 0.9] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                    style={{ transformOrigin: '72px 27px' }}
                  />
                </g>
              )}
            </g>
          )}
        </svg>
      </motion.button>

      {/* Compact Bold Spoken Reply Directly Underneath Mishmish */}
      <AnimatePresence>
        {activeMood === 'angry' && angrySpeech && (
          <motion.div
            key={angrySpeech}
            dir={dir}
            initial={{ opacity: 0, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none relative mt-1 flex flex-col items-center z-20"
          >
            <span
              aria-hidden="true"
              className="w-2 h-2 rotate-45 -mb-1 bg-rose-950 border-s border-t border-rose-400/55"
            />
            <div className="px-2.5 py-1 rounded-full bg-rose-950/95 border border-rose-400/55 text-[10px] font-black leading-tight tracking-tight text-rose-50 text-center whitespace-nowrap shadow-[0_6px_18px_rgba(225,29,72,0.35)]">
              {angrySpeech}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
