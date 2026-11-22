import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { MediaItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getEffectiveMediaRating } from '../../utils/rating';
import { GoldenOrbitalG } from '../layout/TopHeader';
import { isPlainExternalWebUrl, normalizeExternalHttpUrl } from '../../utils/videoEngines';

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

const positiveMod = (n: number, m: number) => ((n % m) + m) % m;

export const HeroBanner: React.FC<HeroBannerProps> = ({
  slides,
  onPlayMedia,
  onSelectMedia,
  siteName = 'MASHHAD',
}) => {
  const { dir, t, getMediaTitle } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [virtualStep, setVirtualStep] = useState(0);
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [stageWidth, setStageWidth] = useState<number>(1024);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const rawBrand = (siteName || '').trim();
  const brandLabel =
    !rawBrand || /^(goldenflix|goldenfelix|جولدن(\s+فليكس)?)$/i.test(rawBrand)
      ? 'MASHHAD'
      : rawBrand;

  const totalSlides = slides?.length || 0;
  const currentIndex = totalSlides > 0 ? positiveMod(virtualStep, totalSlides) : 0;

  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      if (typeof window !== 'undefined') setStageWidth(window.innerWidth);
      return;
    }
    setStageWidth(el.clientWidth || window.innerWidth);
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && w > 0) setStageWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [totalSlides]);

  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return;
    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setVirtualStep((prev) => prev + 1);
    }, 2800);
    return () => window.clearInterval(interval);
  }, [totalSlides, isPaused]);

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
    const timer = window.setInterval(() => {
      setWelcomeIndex((prev) => (prev + 1) % welcomeSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
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

  const goPrev = () => setVirtualStep((prev) => prev - 1);
  const goNext = () => setVirtualStep((prev) => prev + 1);

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
    if (Math.abs(diff) < 30) return;
    if (diff < 0) goNext();
    else goPrev();
  };

  const isMobile = stageWidth < 540;
  const isTablet = stageWidth >= 540 && stageWidth < 920;

  const cardWidth = isMobile ? 176 : isTablet ? 214 : 244;
  const cardHeight = isMobile ? 258 : isTablet ? 314 : 358;
  const stageHeight = isMobile ? 286 : isTablet ? 344 : 392;

  const step1X = isMobile ? 128 : isTablet ? 172 : 204;
  const step2X = isMobile ? 228 : isTablet ? 312 : 374;
  const step3X = isMobile ? 320 : isTablet ? 430 : 520;

  const slotRange =
    totalSlides === 1 ? [0] : totalSlides === 2 ? [-1, 0, 1] : [-3, -2, -1, 0, 1, 2, 3];

  const getSlotGeometry = (offset: number) => {
    const abs = Math.abs(offset);
    if (abs === 0) {
      return { x: 0, scale: 1, opacity: 1, zIndex: 40, brightness: 1 };
    }
    if (abs === 1) {
      return {
        x: Math.sign(offset) * step1X,
        scale: 0.81,
        opacity: 0.84,
        zIndex: 30,
        brightness: 0.78,
      };
    }
    if (abs === 2) {
      return {
        x: Math.sign(offset) * step2X,
        scale: 0.65,
        opacity: 0.48,
        zIndex: 20,
        brightness: 0.58,
      };
    }
    return {
      x: Math.sign(offset) * step3X,
      scale: 0.5,
      opacity: 0,
      zIndex: 10,
      brightness: 0.4,
    };
  };

  return (
    <section
      aria-label={t('العروض الرئيسية', 'Featured Banners')}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full select-none py-1 group/deck"
    >
      <div
        ref={stageContainerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ height: `${stageHeight}px` }}
        className="relative w-full flex items-center justify-center overflow-hidden"
      >
        {/* Ambient Crimson Spotlight Behind Center Card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[540px] md:w-[680px] h-[250px] sm:h-[340px] rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(234,29,36,0.34) 0%, rgba(160,14,24,0.16) 46%, transparent 74%)',
          }}
        />

        {/* Soft Side Edge Vignettes Merging Outer Cards Into Dark Canvas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-20 md:w-28 bg-gradient-to-r from-[#0f0c14] via-[#0f0c14]/65 to-transparent z-[45]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-20 md:w-28 bg-gradient-to-l from-[#0f0c14] via-[#0f0c14]/65 to-transparent z-[45]"
        />

        {/* Quiet Hover Navigation Controls */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('العرض السابق', 'Previous slide')}
              className="hidden sm:flex opacity-0 group-hover/deck:opacity-100 absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-black/70 hover:bg-[#ea1d24] text-white border border-white/15 items-center justify-center transition-all duration-200 cursor-pointer active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t('العرض التالي', 'Next slide')}
              className="hidden sm:flex opacity-0 group-hover/deck:opacity-100 absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-black/70 hover:bg-[#ea1d24] text-white border border-white/15 items-center justify-center transition-all duration-200 cursor-pointer active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Stepped 5-Card Vertical Coverflow Track */}
        <div className="relative w-full h-full">
          {slotRange.map((offset) => {
            const vIndex = virtualStep + offset;
            const slideIdx = positiveMod(vIndex, totalSlides);
            const slide = slides[slideIdx];
            if (!slide) return null;

            const isCenter = offset === 0;
            const isBuffer = Math.abs(offset) >= 3;
            const geom = getSlotGeometry(offset);
            const slideMedia = slide.media;
            const posterSrc =
              slideMedia?.posterUrl || slide.imageUrl || slideMedia?.bannerUrl || '';
            const slideTitle = slideMedia
              ? getMediaTitle(slideMedia) || slide.title
              : slide.title;
            const hasImageError = !posterSrc || Boolean(failedImages[slide.id]);

            const numericRating = slideMedia ? getEffectiveMediaRating(slideMedia) : 8.6;
            const seasonsCount = slideMedia?.seasons?.length || 0;
            const metaLineParts: string[] = [];
            if (slideMedia?.year) metaLineParts.push(String(slideMedia.year));
            if (slideMedia?.type === 'series' && seasonsCount > 0) {
              metaLineParts.push(
                `${seasonsCount} ${t(
                  seasonsCount === 1 ? 'موسم' : 'مواسم',
                  seasonsCount === 1 ? 'Season' : 'Seasons'
                )}`
              );
            } else if (slideMedia?.duration) {
              metaLineParts.push(slideMedia.duration);
            }

            return (
              <motion.div
                key={`deck-${vIndex}-${slide.id}`}
                initial={
                  hasMountedRef.current
                    ? {
                        x: offset >= 0 ? step3X : -step3X,
                        scale: 0.5,
                        opacity: 0,
                      }
                    : false
                }
                animate={{
                  x: geom.x,
                  scale: geom.scale,
                  opacity: geom.opacity,
                }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.01 }
                    : {
                        duration: 0.85,
                        ease: [0.22, 1, 0.36, 1],
                      }
                }
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  left: '50%',
                  top: '50%',
                  marginLeft: `${-cardWidth / 2}px`,
                  marginTop: `${-cardHeight / 2}px`,
                  zIndex: geom.zIndex,
                  filter: `brightness(${geom.brightness})`,
                  pointerEvents: isBuffer ? 'none' : 'auto',
                }}
                onClick={() => {
                  if (isCenter) {
                    if (slideMedia) onSelectMedia(slideMedia);
                  } else if (!isBuffer) {
                    setVirtualStep((prev) => prev + offset);
                  }
                }}
                className={`absolute will-change-transform rounded-2xl sm:rounded-[22px] overflow-hidden bg-[#16121e] cursor-pointer group ${
                  isCenter
                    ? 'shadow-[0_24px_56px_rgba(0,0,0,0.92),0_0_38px_rgba(234,29,36,0.22)] ring-1 ring-white/20'
                    : 'shadow-[0_14px_32px_rgba(0,0,0,0.75)] ring-1 ring-white/10'
                }`}
              >
                {!hasImageError ? (
                  <img
                    src={posterSrc}
                    alt={slideTitle}
                    loading={Math.abs(offset) <= 1 ? 'eager' : 'lazy'}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [slide.id]: true }))
                    }
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-[#191422] to-black flex flex-col items-center justify-center p-4 text-center">
                    <Play className="w-10 h-10 text-[#ea1d24]/75 mb-2" />
                    <span className="text-xs font-bold text-zinc-200 line-clamp-2">
                      {slideTitle}
                    </span>
                  </div>
                )}

                {/* Top & Bottom Contrast Scrims */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/35" />

                {/* Top Overlay Row: Crimson Play Icon Left + Bold Rating Right */}
                <div
                  dir="ltr"
                  className="absolute top-3 inset-x-3 flex items-start justify-between gap-2 z-10"
                >
                  {isCenter && slideMedia ? (
                    (() => {
                      const directHeroUrl = normalizeExternalHttpUrl(
                        slideMedia.videoUrl ||
                          slideMedia.sources?.[0]?.url ||
                          slideMedia.seasons?.[0]?.episodes?.[0]?.videoUrl ||
                          ''
                      );
                      if (isPlainExternalWebUrl(directHeroUrl, slideMedia.storageType)) {
                        return (
                          <a
                            href={directHeroUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t(`فتح ${slideTitle}`, `Open ${slideTitle}`)}
                            className="-m-1.5 p-1.5 flex items-center justify-center cursor-pointer shrink-0 group/play"
                          >
                            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#ea1d24] group-hover/play:bg-[#ff2c34] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(234,29,36,0.55)] transition-transform group-hover/play:scale-110 group-active/play:scale-95">
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </span>
                          </a>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayMedia(slideMedia);
                          }}
                          aria-label={t(`تشغيل ${slideTitle}`, `Play ${slideTitle}`)}
                          className="-m-1.5 p-1.5 flex items-center justify-center cursor-pointer shrink-0 group/play"
                        >
                          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#ea1d24] group-hover/play:bg-[#ff2c34] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(234,29,36,0.55)] transition-transform group-hover/play:scale-110 group-active/play:scale-95">
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </span>
                        </button>
                      );
                    })()
                  ) : (
                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/55 backdrop-blur-sm border border-white/15 text-white flex items-center justify-center shrink-0">
                      <Play className="w-3 h-3 fill-current ml-0.5 text-[#ea1d24]" />
                    </span>
                  )}

                  <div className="flex items-start gap-0.5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] select-none">
                    <span className="text-base sm:text-xl font-black tracking-tight leading-none tabular-nums">
                      {numericRating.toFixed(1)}
                    </span>
                    <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-white text-white mt-0.5 shrink-0" />
                  </div>
                </div>

                {/* Bottom Centered Title + Quiet Unboxed Metadata */}
                <div className="absolute bottom-3.5 sm:bottom-4 inset-x-3.5 z-10 text-center space-y-1 pointer-events-none">
                  <h2
                    className={`font-black text-white tracking-tight leading-tight line-clamp-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] ${
                      isCenter ? 'text-sm sm:text-lg md:text-xl' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {slideTitle}
                  </h2>

                  {metaLineParts.length > 0 && (
                    <p className="text-[10.5px] sm:text-xs font-semibold text-zinc-300/90 tabular-nums truncate">
                      {metaLineParts.join(' · ')}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Centered Pagination Dots */}
      {totalSlides > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((slide, idx) => {
            const active = idx === currentIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => {
                  let diff = idx - currentIndex;
                  if (totalSlides > 2) {
                    const half = totalSlides / 2;
                    if (diff > half) diff -= totalSlides;
                    if (diff < -half) diff += totalSlides;
                  }
                  setVirtualStep((prev) => prev + diff);
                }}
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

