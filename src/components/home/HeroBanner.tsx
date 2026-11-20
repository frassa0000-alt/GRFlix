import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { GoldenOrbitalG } from '../layout/TopHeader';

export interface HeroSlideItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  ctaLabel?: string;
  media?: MediaItem;
}

interface HeroBannerProps {
  slides: HeroSlideItem[];
  onPlayMedia: (item: MediaItem) => void;
  onSelectMedia: (item: MediaItem) => void;
  siteName?: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  slides,
  onPlayMedia,
  onSelectMedia,
  siteName = 'MASHHAD',
}) => {
  const { dir, t, getMediaTitle } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const rawBrand = (siteName || '').trim();
  const brandLabel =
    !rawBrand || /^(goldenflix|goldenfelix|جولدن(\s+فليكس)?)$/i.test(rawBrand)
      ? 'MASHHAD'
      : rawBrand;

  useEffect(() => {
    if (currentIndex >= slides.length && slides.length > 0) {
      setCurrentIndex(0);
    }
  }, [slides.length, currentIndex]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides.length, isPaused]);

  const welcomeSlides = [
    {
      prefixAr: 'مرحباً بك في',
      prefixEn: 'Welcome to',
      brand: brandLabel,
      subtitleAr: 'أفلامك ومسلسلاتك المفضلة بجودة عالية وتشغيل فوري',
      subtitleEn: 'Stream curated cinema & series anytime',
    },
    {
      prefixAr: 'مكتبة سينمائية في',
      prefixEn: 'Cinema Library on',
      brand: brandLabel,
      subtitleAr: 'تصفح أحدث الإصدارات والعروض الحصرية',
      subtitleEn: 'Browse latest releases and featured titles',
    },
  ];

  useEffect(() => {
    if (slides && slides.length > 0) return;
    const timer = setInterval(() => {
      setWelcomeIndex((prev) => (prev + 1) % welcomeSlides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [slides?.length, welcomeSlides.length]);

  if (!slides || slides.length === 0) {
    const activeWelcome = welcomeSlides[welcomeIndex] || welcomeSlides[0];
    return (
      <section
        aria-label={t(`مرحباً بك في ${brandLabel}`, `Welcome to ${brandLabel}`)}
        className="relative w-full h-[185px] sm:h-[225px] md:h-[250px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#16121d] shadow-[0_20px_50px_rgba(0,0,0,0.8)] select-none"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[360px] h-[220px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(234,29,36,0.16) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 h-full px-5 sm:px-10 md:px-12 flex items-center justify-between gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`welcome-${welcomeIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`min-w-0 flex-1 space-y-1.5 ${
                dir === 'ltr' ? 'text-left' : 'text-right'
              }`}
            >
              <p className="text-sm sm:text-lg font-black text-zinc-300">
                {dir === 'ltr' ? activeWelcome.prefixEn : activeWelcome.prefixAr}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none text-white">
                {activeWelcome.brand}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-bold pt-0.5 line-clamp-2 max-w-lg">
                {dir === 'ltr' ? activeWelcome.subtitleEn : activeWelcome.subtitleAr}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="shrink-0 flex items-center justify-center">
            <div className="w-18 h-18 sm:w-24 sm:h-24 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center shadow-xl">
              <GoldenOrbitalG className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const totalSlides = slides.length;

  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % totalSlides);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartXRef.current === null || totalSlides <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(diff) < 35) return;
    if (diff < 0) goNext();
    else goPrev();
  };

  const getCircularOffset = (index: number) => {
    let offset = index - currentIndex;
    if (totalSlides > 2) {
      const half = totalSlides / 2;
      if (offset > half) offset -= totalSlides;
      if (offset < -half) offset += totalSlides;
    } else if (totalSlides === 2) {
      if (offset < 0) offset = 1;
    }
    return offset;
  };

  return (
    <section
      aria-label={t('العروض الرئيسية', 'Featured Banners')}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full select-none pt-1 pb-1"
    >
      {/* Side-Peeking Wide Landscape Banner Carousel Matching Screen 1 */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-[185px] sm:h-[235px] md:h-[275px] flex items-center justify-center overflow-hidden"
      >
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('العرض السابق', 'Previous slide')}
              className="hidden sm:flex absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-40 w-9 h-9 rounded-full bg-black/75 hover:bg-[#ea1d24] text-white border border-white/15 items-center justify-center transition-colors cursor-pointer active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t('العرض التالي', 'Next slide')}
              className="hidden sm:flex absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-40 w-9 h-9 rounded-full bg-black/75 hover:bg-[#ea1d24] text-white border border-white/15 items-center justify-center transition-colors cursor-pointer active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <div className="relative w-full h-full flex items-center justify-center">
          {slides.map((slide, idx) => {
            const offset = getCircularOffset(idx);
            const absOffset = Math.abs(offset);
            if (absOffset > 1) return null;

            const isCenter = offset === 0;
            const slideMedia = slide.media;
            const bannerSrc =
              slideMedia?.bannerUrl || slide.imageUrl || slideMedia?.posterUrl || '';
            const slideTitle = slideMedia
              ? getMediaTitle(slideMedia) || slide.title
              : slide.title;
            const hasImageError = !bannerSrc || Boolean(failedImages[slide.id]);

            const translatePct =
              offset === 0 ? '0%' : offset === 1 ? '88%' : '-88%';
            const scaleVal = isCenter ? 1 : 0.9;
            const opacityVal = isCenter ? 1 : 0.45;
            const zIndexVal = isCenter ? 30 : 15;

            return (
              <motion.div
                key={slide.id}
                initial={false}
                animate={{
                  x: translatePct,
                  scale: scaleVal,
                  opacity: opacityVal,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
                style={{ zIndex: zIndexVal }}
                onClick={() => {
                  if (isCenter) {
                    if (slideMedia) onSelectMedia(slideMedia);
                  } else {
                    setCurrentIndex(idx);
                  }
                }}
                className={`absolute will-change-transform w-[78%] sm:w-[68%] md:w-[58%] h-full rounded-2xl overflow-hidden bg-[#16121e] cursor-pointer group ${
                  isCenter
                    ? 'shadow-[0_14px_34px_rgba(0,0,0,0.8)] ring-1 ring-white/15'
                    : 'shadow-[0_8px_22px_rgba(0,0,0,0.65)] ring-1 ring-white/10'
                }`}
              >
                {!hasImageError ? (
                  <img
                    src={bannerSrc}
                    alt={slideTitle}
                    loading={isCenter ? 'eager' : 'lazy'}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [slide.id]: true }))
                    }
                    className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-[#191422] to-black flex flex-col items-center justify-center p-4 text-center">
                    <Play className="w-10 h-10 text-[#ea1d24]/70 mb-2" />
                    <span className="text-xs font-bold text-zinc-200 line-clamp-2">
                      {slideTitle}
                    </span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                {isCenter && (
                  <div className="absolute bottom-3 inset-x-4 flex items-end justify-between gap-2 z-10">
                    <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight truncate drop-shadow">
                      {slideTitle}
                    </h2>

                    {slideMedia && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayMedia(slideMedia);
                        }}
                        aria-label={t(`تشغيل ${slideTitle}`, `Play ${slideTitle}`)}
                        className="w-9 h-9 rounded-full bg-[#ea1d24] hover:bg-[#ff2c34] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Centered Pagination Dots with Wide White Pill Active Indicator Matching Screen 1 */}
      {totalSlides > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {slides.map((slide, idx) => {
            const active = idx === currentIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={t(`عرض الشريحة ${idx + 1}`, `View slide ${idx + 1}`)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  active
                    ? 'w-5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]'
                    : 'w-1.5 bg-zinc-600/80 hover:bg-zinc-400'
                }`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
