import React from 'react';
import { Play } from 'lucide-react';

interface PromoBannerProps {
  onStartNow: () => void;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({ onStartNow }) => {
  return (
    <div className="w-full px-3 sm:px-4 py-2.5 select-none">
      <div className="relative w-full h-[125px] xs:h-[135px] sm:h-[155px] rounded-3xl overflow-hidden border border-amber-400/60 shadow-[0_0_25px_rgba(250,204,21,0.25)] bg-[#0d0d12] group">
        {/* Background Image: 3D Cinema Film Reel & Clapperboard */}
        <div className="absolute inset-0">
          <img
            src="/banners/goldenflix_promo_strip.jpg"
            alt="Golden Flix Cinema Promo"
            className="w-full h-full object-cover object-left-center sm:object-center transition-transform duration-700 ease-out group-hover:scale-102"
          />
          {/* Subtle Right-to-Left Black Gradient to make typography pop */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/40 to-black/90 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Content on the Right matching Reference Screenshot */}
        <div className="absolute inset-0 flex flex-col justify-center items-end p-4 sm:p-6 z-10 text-right">
          <div className="max-w-[62%] sm:max-w-[55%] flex flex-col items-end">
            <h3 className="text-white text-xs xs:text-sm sm:text-base md:text-lg font-black leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              استمتع بمشاهدة
            </h3>
            <h4 className="text-white text-xs xs:text-sm sm:text-base md:text-lg font-black leading-tight mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              أفلامك المفضلة بجودة عالية
            </h4>

            {/* Solid Golden Button: ابدأ الآن ▶ */}
            <button
              onClick={onStartNow}
              className="mt-2 sm:mt-3 px-4 sm:px-5 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-[11px] sm:text-xs font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.5)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>ابدأ الآن</span>
              <Play className="w-3 h-3 fill-black text-black ml-0.5" />
            </button>
          </div>
        </div>

        {/* Glowing Golden Ring Accent */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none ring-1 ring-inset ring-amber-400/40" />
      </div>
    </div>
  );
};
