import React from 'react';
import { Download, Film, HardDrive, ArrowLeft } from 'lucide-react';
import { MediaItem } from '../../types';

interface DownloadsViewProps {
  onBackToHome: () => void;
  onExploreMovies: () => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  onBackToHome,
  onExploreMovies,
}) => {
  return (
    <div className="w-full px-4 py-4 select-none animate-fade-in space-y-5 text-right font-sans">
      {/* View Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <button
          onClick={onBackToHome}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-black text-white">تحميلاتي (Downloads)</h2>
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Download className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Storage Status Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900/90 to-black border border-amber-400/30 shadow-[0_0_15px_rgba(250,204,21,0.15)] space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-zinc-400">سعة التخزين المحلية المتاحة</span>
          <span className="text-amber-400 font-mono">100% فارغة</span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full w-0 bg-amber-400 rounded-full" />
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          يمكنك تنزيل أفلامك المفضلة ومشاهدتها في أي وقت بدون استهلاك بيانات الإنترنت.
        </p>
      </div>

      {/* Empty State */}
      <div className="py-16 text-center space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-500/10">
          <HardDrive className="w-8 h-8 stroke-[1.7]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-black text-white">
            لا توجد أفلام محملة حالياً
          </h3>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            تصفح مكتبة الأفلام السينمائية واختر فيلمك المفضل لبدء المشاهدة أو التنزيل.
          </p>
        </div>

        <button
          onClick={onExploreMovies}
          className="mt-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
        >
          <Film className="w-3.5 h-3.5" />
          <span>تصفح الأفلام المتاحة</span>
        </button>
      </div>
    </div>
  );
};
