import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, Star, Calendar, Drama } from 'lucide-react';
import { MediaItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatQualityLabel } from '../../utils/quality';

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
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentIndex >= slides.length && slides.length > 0) {
      setCurrentIndex(0);
    }
  }, [slides.length, currentIndex]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [slides.length]);

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
        {/* Curved Metallic Golden Ribbons Backdrop Matching Reference Visual */}
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
          <path
            d="M0,0 L280,0 C175,90 95,155 0,210 Z"
            fill="url(#gfGoldSweepA)"
          />
          <path
            d="M800,320 L480,320 C610,230 710,155 800,80 Z"
            fill="url(#gfGoldSweepB)"
          />
          <path
            d="M120,0 C240,120 510,210 800,190 L800,260 C490,265 230,170 40,0 Z"
            fill="#F7C600"
            fillOpacity="0.06"
          />
        </svg>

        <div className="relative z-10 h-full px-5 sm:px-9 md:px-12 flex items-center justify-between gap-4">
          {/* Welcome Text Block */}
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

          {/* Glowing Large Golden Play Triangle Visual */}
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

        {/* 4 Centered Pagination Dots */}
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

  const currentSlide = slides[currentIndex] || slides[0];
  const linkedMedia = currentSlide.media;
  const imageSrc =
    currentSlide.imageUrl || linkedMedia?.bannerUrl || linkedMedia?.posterUrl || '';
  const hasImageError = !imageSrc || Boolean(failedImages[currentSlide.id]);

  const firstGenre =
    linkedMedia?.genres && linkedMedia.genres.length > 0 && typeof linkedMedia.genres[0] === 'string'
      ? translateGenre(linkedMedia.genres[0])
      : linkedMedia?.type === 'series'
      ? t('مسلسل', 'Series')
      : linkedMedia?.type === 'anime'
      ? t('أنمي', 'Anime')
      : t('فيلم', 'Movie');

  const qualityText = linkedMedia?.videoQuality
    ? formatQualityLabel(linkedMedia.videoQuality).toUpperCase()
    : '1080P';

  const headlineTitle = linkedMedia
    ? getMediaTitle(linkedMedia) || currentSlide.title
    : currentSlide.title;

  const watchLabel =
    dir === 'ltr'
      ? linkedMedia?.type === 'series'
        ? 'Watch Series'
        : 'Watch Movie'
      : currentSlide.ctaLabel ||
        (linkedMedia?.type === 'series' ? 'مشاهدة المسلسل' : 'مشاهدة الفيلم');

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || slides.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(diff) < 40) return;
    if (dir === 'ltr') {
      if (diff < 0) goNext();
      else goPrev();
    } else {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  return (
    <section
      aria-label={t('العروض السينمائية المميزة', 'Featured Cinema Releases')}
      className="w-full select-none"
    >
      {/* Golden-Bordered Featured Banner Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (linkedMedia) onSelectMedia(linkedMedia);
        }}
        className={`relative w-full h-[215px] sm:h-[310px] md:h-[380px] lg:h-[420px] overflow-hidden rounded-[22px] sm:rounded-[26px] border-[1.5px] border-[#F7C600]/75 shadow-[0_0_22px_rgba(247,198,0,0.28),0_22px_55px_rgba(0,0,0,0.88)] bg-[#09090d] group ${
          linkedMedia ? 'cursor-pointer' : ''
        }`}
      >
        {/* Background Artwork Transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.15 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 overflow-hidden"
          >
            {!hasImageError ? (
              <img
                src={imageSrc}
                alt={headlineTitle}
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedImages((prev) => ({ ...prev, [currentSlide.id]: true }))
                }
                className="w-full h-full object-cover object-center animate-ken-burns"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1b150b] via-[#0b0b0f] to-[#060608]" />
            )}

            {/* Subtle Edge Contrast Scrims */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/22 to-black/35" />
            <div
              className={`absolute inset-0 ${
                dir === 'ltr'
                  ? 'bg-gradient-to-r from-black/75 via-black/25 to-transparent'
                  : 'bg-gradient-to-l from-black/75 via-black/25 to-transparent'
              }`}
            />
          </motion.div>
        </AnimatePresence>

        {/* Subtle Desktop Prev/Next Arrows */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label={t('العرض السابق', 'Previous slide')}
              className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${
                dir === 'ltr' ? 'left-3.5' : 'right-3.5'
              } z-20 w-9 h-9 rounded-full bg-black/55 hover:bg-[#F7C600] text-white hover:text-black border border-white/15 items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-md active:scale-90`}
            >
              {dir === 'ltr' ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label={t('العرض التالي', 'Next slide')}
              className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${
                dir === 'ltr' ? 'right-3.5' : 'left-3.5'
              } z-20 w-9 h-9 rounded-full bg-black/55 hover:bg-[#F7C600] text-white hover:text-black border border-white/15 items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-md active:scale-90`}
            >
              {dir === 'ltr' ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </>
        )}

        {/* Top Floating Corner Metadata Capsules */}
        <div
          dir="rtl"
          className="relative z-10 flex items-center justify-between gap-2 px-3 pt-3 sm:px-5 sm:pt-4"
        >
          {/* Top-Right Capsule: Genre + Quality (e.g. كوميديا | 1080P) */}
          <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-[10px] sm:text-xs font-bold shadow-md">
            <span className="inline-flex items-center gap-1 text-zinc-100 whitespace-nowrap">
              <Drama className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F7C600] shrink-0" />
              <span>{firstGenre}</span>
            </span>
            <span className="h-3 w-px bg-white/25" aria-hidden="true" />
            <span dir="ltr" className="text-[#F7C600] font-black tracking-wide whitespace-nowrap">
              {qualityText}
            </span>
          </div>

          {/* Top-Left Capsule: Year + Rating (e.g. 2000 | ★ 6.7) */}
          {(linkedMedia?.year || (typeof linkedMedia?.rating === 'number' && linkedMedia.rating > 0)) && (
            <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-[10px] sm:text-xs font-bold shadow-md tabular-nums">
              {linkedMedia?.year && (
                <span className="inline-flex items-center gap-1 text-zinc-100 whitespace-nowrap">
                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 shrink-0" />
                  <span>{linkedMedia.year}</span>
                </span>
              )}
              {linkedMedia?.year &&
                typeof linkedMedia?.rating === 'number' &&
                linkedMedia.rating > 0 && (
                  <span className="h-3 w-px bg-white/25" aria-hidden="true" />
                )}
              {typeof linkedMedia?.rating === 'number' && linkedMedia.rating > 0 && (
                <span className="inline-flex items-center gap-1 text-white whitespace-nowrap">
                  <span>{linkedMedia.rating.toFixed(1)}</span>
                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#F7C600] text-[#F7C600] shrink-0" />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom Title & Action Row */}
        <div
          className={`absolute inset-x-0 bottom-0 z-10 px-3.5 pb-3.5 sm:px-6 sm:pb-6 flex flex-col justify-end ${
            dir === 'ltr' ? 'items-start text-left' : 'items-start text-right'
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${currentSlide.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2.5 sm:space-y-3.5 max-w-[85%] sm:max-w-xl"
            >
              <h1 className="text-base sm:text-2xl md:text-3xl font-black text-white leading-snug tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.92)] line-clamp-2">
                {headlineTitle}
              </h1>

              {linkedMedia && (
                <div className="flex items-center gap-2.5">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayMedia(linkedMedia);
                    }}
                    className="h-9 sm:h-11 inline-flex items-center gap-1.5 px-4 sm:px-6 rounded-full bg-gradient-to-b from-[#FFE23A] via-[#F7C600] to-[#E6AD00] hover:from-[#ffe85c] hover:to-[#f0b900] text-black font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(247,198,0,0.48),inset_0_1px_1px_rgba(255,255,255,0.65)] transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>{watchLabel}</span>
                    {dir === 'ltr' ? (
                      <ChevronRight className="w-4 h-4 stroke-[2.6]" />
                    ) : (
                      <ChevronLeft className="w-4 h-4 stroke-[2.6]" />
                    )}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayMedia(linkedMedia);
                    }}
                    aria-label={t('تشغيل الآن', 'Play now')}
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/55 hover:bg-black/75 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.65)] transition-all cursor-pointer shrink-0"
                  >
                    <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-[#F7C600] text-[#F7C600]" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Centered Pagination Indicators Directly Below the Card */}
      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {slides.map((slide, idx) => {
            const active = idx === currentIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={t(`عرض الشريحة ${idx + 1}`, `View slide ${idx + 1}`)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  active
                    ? 'w-6 sm:w-7 bg-[#F7C600] shadow-[0_0_10px_rgba(247,198,0,0.7)]'
                    : 'w-2 bg-zinc-600/80 hover:bg-zinc-400'
                }`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
