import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const AnimatedBrandSearchBar: React.FC = () => {
  const { lang } = useLanguage();

  const phrases = useMemo(
    () =>
      lang === 'en'
        ? ['MASHHAD', 'MASHHAD Cinema', 'MASHHAD · 4K']
        : ['MASHHAD', 'منصة MASHHAD', 'أفلام MASHHAD'],
    [lang]
  );

  const [isWhiteStage, setIsWhiteStage] = useState(true);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedCount, setTypedCount] = useState(0);
  const [searchPulse, setSearchPulse] = useState(false);

  const currentPhrase = phrases[phraseIndex] || 'MASHHAD';

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setIsWhiteStage(false);
      setPhraseIndex(0);
      setTypedCount('MASHHAD'.length);
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timers.push(id);
      });

    const runLoop = async () => {
      while (!cancelled) {
        // Phase 1: Glowing bright white capsule typing "MASHHAD"
        setIsWhiteStage(true);
        setPhraseIndex(0);
        setTypedCount(0);

        const firstWord = phrases[0];
        for (let i = 1; i <= firstWord.length; i++) {
          if (cancelled) return;
          setTypedCount(i);
          await wait(75);
        }
        await wait(520);

        // Snap click pulse into Phase 2 dark iridescent rim
        if (cancelled) return;
        setSearchPulse(true);
        await wait(140);
        if (cancelled) return;
        setSearchPulse(false);
        setIsWhiteStage(false);
        await wait(950);

        // Phase 2: Cycle site-branded phrases inside dark multi-color glowing border
        for (let idx = 1; idx < phrases.length; idx++) {
          if (cancelled) return;
          const nextText = phrases[idx];
          setPhraseIndex(idx);
          setTypedCount(0);
          for (let c = 1; c <= nextText.length; c++) {
            if (cancelled) return;
            setTypedCount(c);
            await wait(55);
          }
          setSearchPulse(true);
          await wait(150);
          if (cancelled) return;
          setSearchPulse(false);
          await wait(1350);
        }
      }
    };

    runLoop();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [phrases]);

  const visibleText = currentPhrase.slice(0, typedCount);

  return (
    <div
      dir="ltr"
      aria-hidden="true"
      className="relative inline-flex items-center justify-center w-[212px] h-[34px] select-none pointer-events-none"
    >
      {/* Ambient Outer Glow (Intense Violet on White Beat -> Multi-Tone Aura on Dark Beat) */}
      <motion.div
        animate={{
          opacity: isWhiteStage ? 0.88 : 0.48,
          scale: isWhiteStage ? 1.06 : 1,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -inset-1.5 rounded-full blur-lg"
        style={{
          background: isWhiteStage
            ? 'radial-gradient(ellipse at center, rgba(109,40,217,0.92) 0%, rgba(139,92,246,0.55) 55%, transparent 80%)'
            : 'linear-gradient(90deg, rgba(34,211,238,0.42), rgba(168,85,247,0.45), rgba(234,29,36,0.42), rgba(52,211,153,0.42))',
        }}
      />

      {/* Capsule Wrapper With Sweeping Iridescent Rim Border */}
      <motion.div
        animate={{
          scale: searchPulse ? 0.96 : 1,
        }}
        transition={{ duration: 0.14 }}
        className="relative w-full h-full rounded-full p-[1.5px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.65)]"
      >
        {/* Rotating Multi-Color Neon Conic Border */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
          className="absolute -inset-[140%] opacity-95"
          style={{
            background: isWhiteStage
              ? 'conic-gradient(from 0deg, #ffffff, #a78bfa, #7c3aed, #ffffff)'
              : 'conic-gradient(from 0deg, #22d3ee 0deg, #34d399 75deg, #07070c 135deg, #a855f7 205deg, #ea1d24 275deg, #38bdf8 330deg, #22d3ee 360deg)',
          }}
        />

        {/* Inner Search Capsule Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-full px-3.5 flex items-center justify-between gap-2 transition-colors duration-300 ${
            isWhiteStage ? 'bg-white text-[#0b0a10]' : 'bg-[#07060c] text-white'
          }`}
        >
          <div className="min-w-0 flex items-center gap-0.5 overflow-hidden">
            <span
              className={`text-[11.5px] font-black tracking-wide truncate ${
                isWhiteStage
                  ? 'bg-gradient-to-r from-[#0b0a10] via-[#4c1d95] to-[#7c3aed] bg-clip-text text-transparent'
                  : 'text-white'
              }`}
            >
              {visibleText}
            </span>
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.75, repeat: Infinity }}
              className={`inline-block w-[1.5px] h-3.5 rounded-full shrink-0 ${
                isWhiteStage ? 'bg-[#7c3aed]' : 'bg-[#22d3ee]'
              }`}
            />
          </div>

          <motion.span
            animate={{ scale: searchPulse ? 0.82 : 1 }}
            transition={{ duration: 0.14 }}
            className="shrink-0 flex items-center justify-center"
          >
            <Search
              className={`w-3.5 h-3.5 stroke-[2.4] transition-colors duration-300 ${
                isWhiteStage ? 'text-[#6d28d9]' : 'text-zinc-200'
              }`}
            />
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
};
