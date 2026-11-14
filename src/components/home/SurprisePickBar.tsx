import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shuffle, Play, Film, Star, X } from 'lucide-react';
import { MediaItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface SurprisePickBarProps {
  mediaItems: MediaItem[];
  onPlayMedia: (item: MediaItem) => void;
  onSelectMedia: (item: MediaItem) => void;
}

export const SurprisePickBar: React.FC<SurprisePickBarProps> = ({
  mediaItems,
  onPlayMedia,
  onSelectMedia,
}) => {
  const { dir, t, getMediaTitle, translateGenre } = useLanguage();
  const [pickedItem, setPickedItem] = useState<MediaItem | null>(null);
  const [spinCount, setSpinCount] = useState<number>(0);
  const [imgError, setImgError] = useState<boolean>(false);

  if (!mediaItems || mediaItems.length === 0) {
    return null;
  }

  const handlePickRandom = () => {
    const pool =
      mediaItems.length > 1 && pickedItem
        ? mediaItems.filter((m) => m.id !== pickedItem.id)
        : mediaItems;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (chosen) {
      setImgError(false);
      setPickedItem(chosen);
      setSpinCount((c) => c + 1);
    }
  };

  const title = pickedItem ? getMediaTitle(pickedItem) : '';
  const thumbUrl = pickedItem ? pickedItem.posterUrl || pickedItem.bannerUrl : '';
  const typeLabel = pickedItem
    ? pickedItem.type === 'series'
      ? t('مسلسل', 'Series')
      : pickedItem.type === 'anime'
      ? t('أنمي', 'Anime')
      : t('فيلم', 'Movie')
    : '';
  const primaryGenre =
    pickedItem?.genres && pickedItem.genres.length > 0 && typeof pickedItem.genres[0] === 'string'
      ? translateGenre(pickedItem.genres[0])
      : '';

  return (
    <div className="max-w-lg mx-auto px-1">
      <div className="rounded-2xl bg-[#101016]/90 border border-white/[0.08] backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Compact Action Row */}
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
              <motion.div
                animate={{ rotate: spinCount * 180 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              >
                <Shuffle className="w-4 h-4" />
              </motion.div>
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-zinc-200 truncate">
              {t('محتار تشوف إيه؟', 'Not sure what to watch?')}
            </span>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePickRandom}
            className="min-h-[40px] px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-black text-xs font-black whitespace-nowrap shrink-0 shadow-[0_6px_18px_rgba(251,191,36,0.25)] transition-all cursor-pointer"
          >
            {pickedItem ? t('اختيار آخر', 'Pick Another') : t('اقترح لي', 'Surprise Me')}
          </motion.button>
        </div>

        {/* Mini Selected Result Strip */}
        <AnimatePresence mode="wait">
          {pickedItem && (
            <motion.div
              key={pickedItem.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-white/[0.06] bg-white/[0.02]"
            >
              <div className="flex items-center justify-between gap-2.5 p-2.5 sm:px-3.5">
                <button
                  type="button"
                  onClick={() => onSelectMedia(pickedItem)}
                  className={`flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group ${
                    dir === 'ltr' ? 'text-left' : 'text-right'
                  }`}
                >
                  <div className="w-10 h-13 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center">
                    {thumbUrl && !imgError ? (
                      <img
                        src={thumbUrl}
                        alt={title}
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-4 h-4 text-amber-400/50" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-white group-hover:text-amber-400 transition-colors truncate">
                      {title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 truncate tabular-nums">
                      <span>{typeLabel}</span>
                      {primaryGenre && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{primaryGenre}</span>
                        </>
                      )}
                      {pickedItem.year ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{pickedItem.year}</span>
                        </>
                      ) : null}
                      {typeof pickedItem.rating === 'number' && pickedItem.rating > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{pickedItem.rating.toFixed(1)}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlayMedia(pickedItem)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400 text-amber-300 hover:text-black border border-amber-400/35 text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('تشغيل', 'Watch')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPickedItem(null)}
                    aria-label={t('إغلاق الاقتراح', 'Dismiss pick')}
                    className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
