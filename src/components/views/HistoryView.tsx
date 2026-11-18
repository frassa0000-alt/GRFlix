import React, { useState } from 'react';
import { WatchProgress, MediaItem } from '../../types';
import { clearWatchHistory } from '../../services/storage';
import { EmptyCinemaState } from '../common/EmptyCinemaState';
import { History, Play, Trash2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface HistoryViewProps {
  history: WatchProgress[];
  mediaItems: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onRefreshHistory: () => void;
  onBrowseContent?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  mediaItems,
  onPlay,
  onRefreshHistory,
  onBrowseContent,
}) => {
  const { lang, t, getMediaTitle } = useLanguage();
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  const historyWithMedia = [...history]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
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
    if (hrs > 0) return lang === 'en' ? `${hrs}h ${mins}m` : `${hrs} س ${mins} د`;
    return lang === 'en' ? `${mins} min` : `${mins} دقيقة`;
  };

  return (
    <div className="px-1 sm:px-2 py-2 space-y-4 animate-fade-in">
      {/* Header when history items exist */}
      {historyWithMedia.length > 0 && (
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#F7C600]/12 border border-[#F7C600]/30 flex items-center justify-center text-[#F7C600]">
              <History className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {t('تابع المشاهدة', 'Continue Watching')}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {t(
                  'الأفلام والمسلسلات التي كنت تشاهدها مؤخراً',
                  'Movies and series you were recently watching'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmClear(true)}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-full border border-rose-500/20 transition-all font-semibold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('مسح السجل', 'Clear History')}</span>
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmClear && (
        <div className="p-4 bg-zinc-900 border border-rose-500/30 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-start gap-2.5 text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-white">
                {t(
                  'هل أنت متأكد من مسح كامل سجل المشاهدة؟',
                  'Are you sure you want to clear your watch history?'
                )}
              </p>
              <p className="text-zinc-400 mt-0.5">
                {t('لن يمكنك استعادة نقاط التوقف الحالية', 'Saved resume timestamps will be reset')}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowConfirmClear(false)}
              className="px-3 py-1.5 rounded-full text-xs bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              className="px-3 py-1.5 rounded-full text-xs bg-rose-500 hover:bg-rose-600 text-white font-bold cursor-pointer"
            >
              {t('تأكيد المسح', 'Confirm Clear')}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {historyWithMedia.length === 0 ? (
        <EmptyCinemaState
          titleStart={t('سجل المشاهدة', 'Watch History')}
          titleHighlight={t('فارغ', 'is Empty')}
          titleEnd={t('حالياً', '')}
          subtitle={t(
            'عندما تشاهد أي فيلم أو مسلسل على GoldenFlix، سيتم حفظ نقطة التوقف هنا تلقائياً',
            'Any movie or series you watch on GoldenFlix will automatically save here'
          )}
          ctaLabel={t('تصفح المحتوى', 'Browse Content')}
          onCtaClick={onBrowseContent}
        />
      ) : (
        <div className="space-y-3">
          {historyWithMedia.map(({ progress, media }) => {
            const title = getMediaTitle(media);
            return (
              <div
                key={`${progress.mediaId}_${progress.episodeId || 'movie'}`}
                className="group relative flex items-center gap-3.5 p-2.5 bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/40 rounded-2xl transition-all shadow-md"
              >
                <div className="relative w-24 h-32 rounded-xl overflow-hidden shrink-0 bg-black">
                  <img
                    src={media.posterUrl}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/70">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {media.type === 'anime'
                        ? t('أنمي', 'Anime')
                        : media.type === 'series'
                        ? t('مسلسل', 'Series')
                        : t('فيلم', 'Movie')}
                    </span>
                    <span className="text-[11px] text-zinc-500">{media.year}</span>
                  </div>

                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                    {title}
                  </h3>

                  <p className="text-[11px] text-zinc-400 line-clamp-1">{media.description}</p>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>
                        {t(
                          `تمت مشاهدة ${progress.percentage}% (${formatSeconds(progress.currentTime)})`,
                          `Watched ${progress.percentage}% (${formatSeconds(progress.currentTime)})`
                        )}
                      </span>
                      <span className="text-amber-400 font-semibold">
                        {t(
                          `متبقي ${formatSeconds(Math.max(0, progress.duration - progress.currentTime))}`,
                          `${formatSeconds(Math.max(0, progress.duration - progress.currentTime))} left`
                        )}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1.5">
                    <button
                      onClick={() => onPlay(media)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-sm transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      <span>{t('متابعة المشاهدة', 'Resume Watching')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
