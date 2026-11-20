import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Info, Play } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface ContinueWatchingSectionProps {
  history: WatchProgress[];
  mediaItems: MediaItem[];
  onPlayMedia: (item: MediaItem) => void;
  onSelectMedia: (item: MediaItem) => void;
  onViewHistory: () => void;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const ContinueWatchingCard: React.FC<{
  media: MediaItem;
  progress: WatchProgress;
  index: number;
  onPlayMedia: (item: MediaItem) => void;
  onSelectMedia: (item: MediaItem) => void;
}> = ({ media, progress, onPlayMedia, onSelectMedia }) => {
  const { lang, dir, t, getMediaTitle } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const thumbUrl = media.bannerUrl || media.posterUrl;
  const displayTitle = getMediaTitle(media);

  const matchedEpisode =
    progress.episodeId && media.seasons
      ? media.seasons
          .flatMap((sn) =>
            (sn.episodes || []).map((ep) => ({
              ...ep,
              seasonNumber: sn.seasonNumber,
            }))
          )
          .find((ep) => ep.id === progress.episodeId)
      : null;

  const remainingSec = Math.max(0, (progress.duration || 0) - (progress.currentTime || 0));
  const pct = Math.max(2, Math.min(100, Math.round(progress.percentage || 0)));

  return (
    <div
      className="group relative flex-shrink-0 w-[250px] sm:w-[290px] md:w-[310px] rounded-2xl overflow-hidden bg-[#121216] border border-white/[0.08] hover:border-amber-400/55 transition-colors duration-200 shadow-lg"
    >
      {/* Thumbnail Preview (16:9) */}
      <button
        type="button"
        onClick={() => onPlayMedia(media)}
        className={`relative w-full aspect-video block overflow-hidden bg-zinc-950 cursor-pointer ${
          dir === 'ltr' ? 'text-left' : 'text-right'
        }`}
        aria-label={t(`متابعة مشاهدة ${displayTitle}`, `Resume watching ${displayTitle}`)}
      >
        {thumbUrl && !imgError ? (
          <img
            src={thumbUrl}
            alt={displayTitle}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/30 flex flex-col items-center justify-center p-4 text-center">
            <Play className="w-8 h-8 text-amber-400/60 mb-1" />
            <span className="text-xs font-bold text-zinc-300 truncate max-w-full">
              {displayTitle}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-amber-400/95 group-hover:bg-amber-300 text-black flex items-center justify-center shadow-[0_0_24px_rgba(250,204,21,0.45)] transition-transform duration-200 group-hover:scale-110">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-1.5 bg-white/15">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>

      {/* Metadata Row Below */}
      <div className="p-3 flex items-center justify-between gap-2">
        <div
          onClick={() => onSelectMedia(media)}
          className={`min-w-0 flex-1 cursor-pointer ${dir === 'ltr' ? 'text-left' : 'text-right'}`}
        >
          <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-400 transition-colors truncate">
            {displayTitle}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1 tabular-nums truncate">
            {matchedEpisode ? (
              <>
                <span className="text-amber-400 font-bold">
                  {lang === 'en'
                    ? `S${matchedEpisode.seasonNumber} · E${matchedEpisode.episodeNumber}`
                    : `م${matchedEpisode.seasonNumber} · ح${matchedEpisode.episodeNumber}`}
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span>
              {t(`توقفت عند ${formatClock(progress.currentTime)}`, `Paused at ${formatClock(progress.currentTime)}`)}
            </span>
            {remainingSec > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-300">
                  {lang === 'en'
                    ? `${Math.ceil(remainingSec / 60)}m left`
                    : `متبقي ${Math.ceil(remainingSec / 60)} د`}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectMedia(media)}
          aria-label={t(`تفاصيل ${displayTitle}`, `Details for ${displayTitle}`)}
          className="min-w-[40px] min-h-[40px] rounded-xl bg-white/[0.04] hover:bg-amber-400 hover:text-black text-zinc-300 border border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const ContinueWatchingSection: React.FC<ContinueWatchingSectionProps> = ({
  history,
  mediaItems,
  onPlayMedia,
  onSelectMedia,
  onViewHistory,
}) => {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = React.useMemo(() => {
    const byMedia = new Map<string, { progress: WatchProgress; media: MediaItem }>();
    const sorted = [...history].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    for (const prog of sorted) {
      if (byMedia.has(prog.mediaId)) continue;
      const media = mediaItems.find((m) => m.id === prog.mediaId);
      if (media) {
        byMedia.set(prog.mediaId, { progress: prog, media });
      }
    }
    return Array.from(byMedia.values()).slice(0, 12);
  }, [history, mediaItems]);

  if (entries.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    });
  };

  return (
    <section className="mb-8 relative">
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-black text-white flex items-center gap-2">
              <span>{t('تابع المشاهدة', 'Continue Watching')}</span>
              <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                ({entries.length})
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewHistory}
            className="min-h-[38px] px-2 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t('السجل الكامل', 'Full History')}
          </button>

          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label={t('تمرير لليمين', 'Scroll right')}
              className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label={t('تمرير لليسار', 'Scroll left')}
              className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 hover:border-amber-400/50 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 md:gap-4 overflow-x-auto no-scrollbar py-1"
      >
        {entries.map(({ media, progress }, idx) => (
          <ContinueWatchingCard
            key={`${progress.mediaId}_${progress.episodeId || 'movie'}`}
            media={media}
            progress={progress}
            index={idx}
            onPlayMedia={onPlayMedia}
            onSelectMedia={onSelectMedia}
          />
        ))}
      </div>
    </section>
  );
};
