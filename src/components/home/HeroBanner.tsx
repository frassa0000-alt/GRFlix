import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Info, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { MediaItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

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
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

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

  if (!slides || slides.length === 0) {
    return null;
  }

  const currentSlide = slides[currentIndex] || slides[0];
  const linkedMedia = currentSlide.media;
  const imageSrc =
    currentSlide.imageUrl || linkedMedia?.bannerUrl || linkedMedia?.posterUrl || '';
  const hasImageError = !imageSrc || Boolean(failedImages[currentSlide.id]);

  const typeLabel = linkedMedia
    ? linkedMedia.type === 'series'
      ? t('مسلسل', 'Series')
      : linkedMedia.type === 'anime'
      ? t('أنمي', 'Anime')
      : t('فيلم', 'Movie')
    : t('عرض مميز', 'Featured');

  const firstGenre =
    linkedMedia?.genres && linkedMedia.genres.length > 0 && typeof linkedMedia.genres[0] === 'string'
      ? translateGenre(linkedMedia.genres[0])
      : '';

  const headlineTitle = linkedMedia
    ? getMediaTitle(linkedMedia) || currentSlide.title
    : currentSlide.title;

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <section
      aria-label={t('العروض السينمائية المميزة', 'Featured Cinema Releases')}
      className="relative w-full h-[330px] sm:h-[410px] md:h-[470px] overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-500/25 shadow-[0_28px_70px_rgba(0,0,0,0.85)] bg-[#09090d] group"
    >
      {/* Background Backdrop Transition with Smooth Ken Burns Drift */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id}
          initial={{ opacity: 0.25 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.15 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
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

          {/* Multi-layer obsidian cinematic scrims */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070709] via-[#070709]/45 to-black/25" />
          <div
            className={`absolute inset-0 ${
              dir === 'ltr'
                ? 'bg-gradient-to-r from-[#070709]/92 via-[#070709]/45 to-transparent'
                : 'bg-gradient-to-l from-[#070709]/92 via-[#070709]/45 to-transparent'
            }`}
          />
        </motion.div>
      </AnimatePresence>

      {/* Subtle Desktop Arrow Controls */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label={t('العرض السابق', 'Previous slide')}
            className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${
              dir === 'ltr' ? 'left-4' : 'right-4'
            } z-20 w-10 h-10 rounded-full bg-black/55 hover:bg-amber-400 text-white hover:text-black border border-white/15 items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-md active:scale-90`}
          >
            {dir === 'ltr' ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label={t('العرض التالي', 'Next slide')}
            className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${
              dir === 'ltr' ? 'right-4' : 'left-4'
            } z-20 w-10 h-10 rounded-full bg-black/55 hover:bg-amber-400 text-white hover:text-black border border-white/15 items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-md active:scale-90`}
          >
            {dir === 'ltr' ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </>
      )}

      {/* Text Content Overlay */}
      <div
        className={`relative z-10 h-full flex flex-col justify-end p-5 sm:p-8 md:p-10 max-w-2xl ${
          dir === 'ltr' ? 'text-left' : 'text-right'
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${currentSlide.id}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-2.5 sm:space-y-3"
          >
            {/* Clean Metadata Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] font-bold text-amber-300/95">
              {linkedMedia?.videoQuality && (
                <>
                  <span className="text-amber-400 font-black tracking-wide uppercase">
                    {linkedMedia.videoQuality}
                  </span>
                  <span className="text-white/30" aria-hidden="true">·</span>
                </>
              )}
              <span className="text-zinc-200">{typeLabel}</span>
              {firstGenre && (
                <>
                  <span className="text-white/30" aria-hidden="true">·</span>
                  <span className="text-zinc-300">{firstGenre}</span>
                </>
              )}
              {linkedMedia?.year && (
                <>
                  <span className="text-white/30" aria-hidden="true">·</span>
                  <span className="text-zinc-300 tabular-nums">{linkedMedia.year}</span>
                </>
              )}
              {typeof linkedMedia?.rating === 'number' && linkedMedia.rating > 0 && (
                <>
                  <span className="text-white/30" aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-400 tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{linkedMedia.rating.toFixed(1)}</span>
                  </span>
                </>
              )}
            </div>

            {/* Primary Headline */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-lg line-clamp-2">
              {headlineTitle}
            </h1>

            {/* Subtitle / Description */}
            {currentSlide.subtitle && (
              <p className="text-xs sm:text-sm md:text-base text-zinc-300/95 line-clamp-2 max-w-xl leading-relaxed">
                {currentSlide.subtitle}
              </p>
            )}

            {/* Action Buttons */}
            {linkedMedia && (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => onPlayMedia(linkedMedia)}
                  className="min-h-[44px] inline-flex items-center gap-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-black font-black text-xs sm:text-sm px-5 sm:px-6 rounded-xl transition-shadow shadow-[0_10px_28px_rgba(245,158,11,0.35)] cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {dir === 'ltr'
                      ? linkedMedia.type === 'series'
                        ? 'Watch Series'
                        : 'Watch Now'
                      : currentSlide.ctaLabel || 'مشاهدة الآن'}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => onSelectMedia(linkedMedia)}
                  className="min-h-[44px] inline-flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/15 font-bold text-xs sm:text-sm px-4 sm:px-5 rounded-xl backdrop-blur-md transition-colors cursor-pointer"
                >
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>{t('التفاصيل', 'Details')}</span>
                </motion.button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide Dot Indicators */}
      {slides.length > 1 && (
        <div
          className={`absolute bottom-4 sm:bottom-6 ${
            dir === 'ltr' ? 'right-5 sm:right-8' : 'left-5 sm:left-8'
          } flex items-center gap-1.5 z-20`}
        >
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={t(`عرض الشريحة ${idx + 1}`, `View slide ${idx + 1}`)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex
                  ? 'w-8 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]'
                  : 'w-2 bg-white/35 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
