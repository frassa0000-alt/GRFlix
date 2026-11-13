import React, { useState } from 'react';
import { WatchProgress, MediaItem } from '../../types';
import { clearWatchHistory } from '../../services/storage';
import { History, Play, Trash2, Clock, AlertCircle } from 'lucide-react';

interface HistoryViewProps {
  history: WatchProgress[];
  mediaItems: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onRefreshHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  mediaItems,
  onPlay,
  onRefreshHistory,
}) => {
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  // Match each history item to its MediaItem
  const historyWithMedia = history
    .map((prog) => {
      const media = mediaItems.find((m) => m.id === prog.mediaId);
      return { progress: prog, media };
    })
    .filter((entry): entry is { progress: WatchProgress; media: MediaItem } => Boolean(entry.media));

  const handleClearHistory = () => {
    clearWatchHistory();
    setShowConfirmClear(false);
    onRefreshHistory();
  };

  const formatSeconds = (sec: number): string => {
    const totalMin = Math.floor(sec / 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs > 0) return `${hrs} س ${mins} د`;
    return `${mins} دقيقة`;
  };

  return (
    <div className="px-3.5 sm:px-6 py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">سجل المشاهدة</h2>
            <p className="text-[11px] text-zinc-400">
              استكمل مشاهدة أفلامك المفضلة من حيث توقفت
            </p>
          </div>
        </div>

        {historyWithMedia.length > 0 && (
          <button
            onClick={() => setShowConfirmClear(true)}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-xl border border-rose-500/20 transition-all font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح السجل</span>
          </button>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmClear && (
        <div className="p-4 bg-zinc-900 border border-rose-500/30 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-start gap-2.5 text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-white">هل أنت متأكد من مسح كامل سجل المشاهدة؟</p>
              <p className="text-zinc-400 mt-0.5">لن يمكنك استعادة نقاط التوقف الحالية</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowConfirmClear(false)}
              className="px-3 py-1.5 rounded-xl text-xs bg-zinc-800 text-zinc-300 hover:text-white"
            >
              إلغاء
            </button>
            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 rounded-xl text-xs bg-rose-500 hover:bg-rose-600 text-white font-bold"
            >
              تأكيد المسح
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {historyWithMedia.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800/60 p-6 space-y-3">
          <Clock className="w-12 h-12 mx-auto text-zinc-600 mb-2" />
          <p className="text-sm font-bold text-white">سجل المشاهدة فارغ</p>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            عندما تشاهد أي فيلم أو مسلسل على GoldenFlix، سيتم حفظ نقطة التوقف هنا تلقائياً
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {historyWithMedia.map(({ progress, media }) => (
            <div
              key={`${progress.mediaId}_${progress.episodeId || 'movie'}`}
              className="group relative flex items-center gap-3.5 p-2.5 bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/40 rounded-2xl transition-all shadow-md"
            >
              {/* Thumbnail with Progress Overlay */}
              <div className="relative w-24 h-32 rounded-xl overflow-hidden shrink-0 bg-black">
                <img
                  src={media.posterUrl}
                  alt={media.titleAr || media.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Bottom Progress Bar on Thumbnail */}
                <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/70">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>

              {/* Info Details */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {media.type === 'anime'
                      ? 'أنمي'
                      : media.type === 'series'
                      ? 'مسلسل'
                      : 'فيلم'}
                  </span>
                  <span className="text-[11px] text-zinc-500">{media.year}</span>
                </div>

                <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                  {media.titleAr || media.title}
                </h3>

                <p className="text-[11px] text-zinc-400 line-clamp-1">
                  {media.description}
                </p>

                {/* Progress Stats */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>
                      تمت مشاهدة {progress.percentage}% ({formatSeconds(progress.currentTime)})
                    </span>
                    <span className="text-amber-400 font-semibold">
                      متبقي {formatSeconds(Math.max(0, progress.duration - progress.currentTime))}
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Resume Play Button */}
                <div className="pt-1.5">
                  <button
                    onClick={() => onPlay(media)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-sm transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    <span>متابعة المشاهدة</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
