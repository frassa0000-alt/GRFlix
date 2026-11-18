import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { MediaItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatQualityLabel } from '../../utils/quality';
import { getEffectiveMediaRating } from '../../utils/rating';

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
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  slides,
  onPlayMedia,
  onSelectMedia,
}) => {
  const { dir, t, getMediaTitle, translateGenre } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentIndex >= slides.length && slides.length > 0) {
      setCurrentIndex(0);
    }
  }, [slides.length, currentIndex]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides.length, isPaused]);

  const welcomeSlides = [
    {
      prefixAr: 'مرحباً بك في',
      prefixEn: 'Welcome to',
      brand: 'GoldenFlix',
      subtitleAr: 'استمتع بمشاهدة أفضل الأفلام والمسلسلات',
      subtitleEn: 'Enjoy watching the finest movies and series',
    },
    {
      prefixAr: 'مكتبة سينمائية في',
      prefixEn: 'Cinema Library on',
      brand: 'GoldenFlix',
      subtitleAr: 'جودة عالية وتشغيل فوري من أي جهاز',
      subtitleEn: 'High quality instant streaming across every screen',
    },
    {
      prefixAr: 'تجربة مشاهدة فاخرة مع',
      prefixEn: 'Luxury Streaming with',
      brand: 'GoldenFlix',
      subtitleAr: 'تصفح أحدث الإصدارات والعروض الحصرية',
      subtitleEn: 'Browse latest releases and exclusive premieres',
    },
    {
      prefixAr: 'كل ما تحبه على',
      prefixEn: 'Everything You Love on',
      brand: 'GoldenFlix',
      subtitleAr: 'أفلام، مسلسلات، ومفضلاتك في مكان واحد',
      subtitleEn: 'Movies, series, and favorites all in one place',
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
        aria-label={t('مرحباً بك في GoldenFlix', 'Welcome to GoldenFlix')}
        className="relative w-full h-[185px] sm:h-[220px] md:h-[245px] overflow-hidden rounded-[22px] border border-[#F7C600]/20 bg-[#0d0d11] shadow-[0_22px_55px_rgba(0,0,0,0.8)] select-none"
      >
        <svg
          viewBox="0 0 800 320"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full"
        >
          <defs>
            <linearGradient id="gfGoldSweepA" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F7C600" stopOpacity="0.88" />
              <stop offset="55%" stopColor="#8c6800" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0d0d11" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gfGoldSweepB" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#F7C600" stopOpacity="0.92" />
              <stop offset="48%" stopColor="#a37a00" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#0d0d11" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,0 L280,0 C175,90 95,155 0,210 Z" fill="url(#gfGoldSweepA)" />
          <path d="M800,320 L480,320 C610,230 710,155 800,80 Z" fill="url(#gfGoldSweepB)" />
          <path
            d="M120,0 C240,120 510,210 800,190 L800,260 C490,265 230,170 40,0 Z"
            fill="#F7C600"
            fillOpacity="0.06"
          />
        </svg>

        <div className="relative z-10 h-full px-5 sm:px-9 md:px-12 flex items-center justify-between gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`welcome-${welcomeIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`min-w-0 flex-1 space-y-1 sm:space-y-1.5 ${
                dir === 'ltr' ? 'text-left' : 'text-right'
              }`}
            >
              <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white/95 leading-snug">
                {dir === 'ltr' ? activeWelcome.prefixEn : activeWelcome.prefixAr}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none">
                <span className="text-white">Golden</span>
                <span className="text-[#F7C600]">Flix</span>
              </h1>
              <p className="text-[11px] sm:text-sm text-zinc-300 font-medium pt-0.5 line-clamp-1">
                {dir === 'ltr' ? activeWelcome.subtitleEn : activeWelcome.subtitleAr}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="shrink-0 flex items-center justify-center pl-1 sm:pl-4">
            <div className="relative w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#F7C600]/20 blur-xl" />
              <svg
                viewBox="0 0 64 64"
                className="relative w-14 h-14 sm:w-20 sm:h-20 drop-shadow-[0_10px_24px_rgba(247,198,0,0.45)]"
              >
                <defs>
                  <linearGradient id="gfPlayTriangle" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffe55c" />
                    <stop offset="100%" stopColor="#f5b800" />
                  </linearGradient>
                </defs>
                <path
                  d="M16 11.5C16 8.8 18.9 7.1 21.3 8.5L51.5 26.2C53.8 27.6 53.8 30.9 51.5 32.3L21.3 50C18.9 51.4 16 49.7 16 47V11.5Z"
                  fill="url(#gfPlayTriangle)"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2 z-20">
          {welcomeSlides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setWelcomeIndex(idx)}
              aria-label={t(`الشريحة ${idx + 1}`, `Slide ${idx + 1}`)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                idx === welcomeIndex
                  ? 'w-2 bg-[#F7C600] shadow-[0_0_10px_rgba(247,198,0,0.85)]'
                  : 'w-2 bg-white/25 hover:bg-white/55'
              }`}
            />
          ))}
        </div>
      </section>
    );
  }

  const totalSlides = slides.length;
  const currentSlide = slides[currentIndex] || slides[0];
  const linkedMedia = currentSlide.media;

  const firstGenre =
    linkedMedia?.genres && linkedMedia.genres.length > 0 && typeof linkedMedia.genres[0] === 'string'
      ? translateGenre(linkedMedia.genres[0])
      : linkedMedia?.type === 'series'
      ? t('مسلسل', 'Series')
      : linkedMedia?.type === 'anime'
      ? t('أنمي', 'Anime')
      : t('فيلم', 'Movie');

  const durationOrQuality =
    linkedMedia?.duration?.trim() ||
    (linkedMedia?.videoQuality ? formatQualityLabel(linkedMedia.videoQuality).toUpperCase() : 'HD');

  const ratingValue = linkedMedia ? getEffectiveMediaRating(linkedMedia) : 8.0;

  const headlineTitle = linkedMedia
    ? getMediaTitle(linkedMedia) || currentSlide.title
    : currentSlide.title;

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

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
      aria-label={t('العروض السينمائية المميزة', 'Featured Cinema Releases')}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="w-full select-none pt-1 pb-2"
    >
      {/* 3D Perspective Coverflow Poster Carousel Matching Video Reference */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-[290px] sm:h-[345px] md:h-[385px] flex items-center justify-center overflow-hidden"
        style={{ perspective: '1200px' }}
      >
        {/* Subtle atmospheric glow behind active poster */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-72 sm:w-72 sm:h-80 rounded-full bg-white/[0.04] blur-3xl"
        />

        {/* Desktop Previous / Next Navigation Arrows */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('العرض السابق', 'Previous slide')}
              className="hidden sm:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/55 hover:bg-[#F7C600] text-white hover:text-black border border-white/15 items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t('العرض التالي', 'Next slide')}
              className="hidden sm:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-black/55 hover:bg-[#F7C600] text-white hover:text-black border border-white/15 items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Stacked Coverflow Poster Cards */}
        <div className="relative w-full h-full flex items-center justify-center">
          {slides.map((slide, idx) => {
            const offset = getCircularOffset(idx);
            const absOffset = Math.abs(offset);
            if (absOffset > 2) return null;

            const isCenter = offset === 0;
            const slideMedia = slide.media;
            const posterSrc =
              slideMedia?.posterUrl || slide.imageUrl || slideMedia?.bannerUrl || '';
            const slideTitle = slideMedia
              ? getMediaTitle(slideMedia) || slide.title
              : slide.title;
            const hasImageError = !posterSrc || Boolean(failedImages[slide.id]);

            const translatePct =
              offset === 0
                ? '0%'
                : offset === 1
                ? '56%'
                : offset === -1
                ? '-56%'
                : offset > 1
                ? '98%'
                : '-98%';

            const scaleVal = isCenter ? 1 : absOffset === 1 ? 0.83 : 0.68;
            const opacityVal = isCenter ? 1 : absOffset === 1 ? 0.68 : 0.28;
            const rotateYVal = offset === 0 ? 0 : offset > 0 ? -12 : 12;
            const zIndexVal = isCenter ? 30 : absOffset === 1 ? 20 : 10;

            return (
              <motion.div
                key={slide.id}
                initial={false}
                animate={{
                  x: translatePct,
                  scale: scaleVal,
                  opacity: opacityVal,
                  rotateY: rotateYVal,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 290,
                  damping: 28,
                }}
                style={{ zIndex: zIndexVal }}
                onClick={() => {
                  if (isCenter) {
                    if (slideMedia) onSelectMedia(slideMedia);
                  } else {
                    setCurrentIndex(idx);
                  }
                }}
                className={`absolute w-[186px] sm:w-[222px] md:w-[248px] aspect-[2/3] rounded-[24px] sm:rounded-[28px] overflow-hidden bg-[#13141a] cursor-pointer group ${
                  isCenter
                    ? 'shadow-[0_24px_60px_rgba(0,0,0,0.9)] ring-1 ring-white/20'
                    : 'shadow-[0_14px_35px_rgba(0,0,0,0.75)] ring-1 ring-white/10'
                }`}
              >
                {!hasImageError ? (
                  <img
                    src={posterSrc}
                    alt={slideTitle}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [slide.id]: true }))
                    }
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-[#15161e] to-amber-950/30 flex flex-col items-center justify-center p-4 text-center">
                    <Play className="w-10 h-10 text-[#F7C600]/60 mb-2" />
                    <span className="text-xs font-bold text-zinc-200 line-clamp-2">
                      {slideTitle}
                    </span>
                  </div>
                )}

                {/* Subtle darkening veil on non-center peeking cards */}
                {!isCenter && (
                  <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                )}

                {/* Center card quick Play hover trigger */}
                {isCenter && slideMedia && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayMedia(slideMedia);
                    }}
                    aria-label={t(`تشغيل ${slideTitle}`, `Play ${slideTitle}`)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20 cursor-pointer"
                  >
                    <span className="w-13 h-13 rounded-full bg-white/25 backdrop-blur-md border border-white/35 text-white flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </span>
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Centered Active Slide Details Below Poster (Exact Video Hierarchy) */}
      <div className="mt-2.5 flex flex-col items-center text-center px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={`hero-meta-${currentSlide.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            onClick={() => {
              if (linkedMedia) onSelectMedia(linkedMedia);
            }}
            className={`flex flex-col items-center max-w-md ${
              linkedMedia ? 'cursor-pointer' : ''
            }`}
          >
            {linkedMedia?.year && (
              <span className="text-[11px] sm:text-xs font-medium text-zinc-400 tabular-nums mb-0.5">
                {linkedMedia.year}
              </span>
            )}

            <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-snug line-clamp-1">
              {headlineTitle}
            </h1>

            {/* Compact 3-chip metadata strip matching the video */}
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-[#17181f] border border-white/[0.06] text-[11px] font-semibold text-zinc-300">
                {firstGenre}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#17181f] border border-white/[0.06] text-[11px] font-semibold text-zinc-300 tabular-nums">
                {durationOrQuality}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#17181f] border border-white/[0.06] text-[11px] font-bold text-white tabular-nums">
                <Star className="w-3 h-3 fill-[#F7C600] text-[#F7C600]" />
                <span>{ratingValue.toFixed(1)}</span>
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Centered Pagination Dots */}
        {totalSlides > 1 && (
          <div className="mt-3.5 flex items-center justify-center gap-1.5">
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
                      ? 'w-4 bg-white shadow-[0_0_8px_rgba(255,255,255,0.55)]'
                      : 'w-1.5 bg-zinc-600/80 hover:bg-zinc-400'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
