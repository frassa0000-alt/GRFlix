import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppLanguage = 'ar' | 'en';

interface LanguageContextValue {
  lang: AppLanguage;
  dir: 'rtl' | 'ltr';
  isEnglish: boolean;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
  t: (ar: string, en: string) => string;
  getMediaTitle: (item?: { title?: string; titleAr?: string } | null) => string;
  translateGenre: (genre: string) => string;
}

const LANGUAGE_STORAGE_KEY = 'goldenflix_ui_language';

const GENRE_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  action: { ar: 'أكشن', en: 'Action' },
  'أكشن': { ar: 'أكشن', en: 'Action' },
  'اكشن': { ar: 'أكشن', en: 'Action' },
  drama: { ar: 'دراما', en: 'Drama' },
  'دراما': { ar: 'دراما', en: 'Drama' },
  horror: { ar: 'رعب', en: 'Horror' },
  'رعب': { ar: 'رعب', en: 'Horror' },
  comedy: { ar: 'كوميديا', en: 'Comedy' },
  'كوميديا': { ar: 'كوميديا', en: 'Comedy' },
  'sci-fi': { ar: 'خيال علمي', en: 'Sci-Fi' },
  scifi: { ar: 'خيال علمي', en: 'Sci-Fi' },
  'خيال علمي': { ar: 'خيال علمي', en: 'Sci-Fi' },
  adventure: { ar: 'مغامرات', en: 'Adventure' },
  'مغامرات': { ar: 'مغامرات', en: 'Adventure' },
  'مغامرة': { ar: 'مغامرة', en: 'Adventure' },
  crime: { ar: 'جريمة', en: 'Crime' },
  'جريمة': { ar: 'جريمة', en: 'Crime' },
  romance: { ar: 'رومانسي', en: 'Romance' },
  'رومانسي': { ar: 'رومانسي', en: 'Romance' },
  history: { ar: 'تاريخي', en: 'History' },
  'تاريخي': { ar: 'تاريخي', en: 'History' },
  biography: { ar: 'سيرة ذاتية', en: 'Biography' },
  fantasy: { ar: 'فانتازيا', en: 'Fantasy' },
  documentary: { ar: 'وثائقي', en: 'Documentary' },
  anime: { ar: 'أنمي', en: 'Anime' },
  'أنمي': { ar: 'أنمي', en: 'Anime' },
  series: { ar: 'مسلسل', en: 'Series' },
  movie: { ar: 'فيلم', en: 'Movie' },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'ar';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(getInitialLanguage);

  const dir: 'rtl' | 'ltr' = lang === 'en' ? 'ltr' : 'rtl';
  const isEnglish = lang === 'en';

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }, [lang, dir]);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const t = useCallback(
    (ar: string, en: string) => (lang === 'en' ? en : ar),
    [lang]
  );

  const getMediaTitle = useCallback(
    (item?: { title?: string; titleAr?: string } | null) => {
      if (!item) return '';
      if (lang === 'en') {
        return item.title?.trim() || item.titleAr?.trim() || '';
      }
      return item.titleAr?.trim() || item.title?.trim() || '';
    },
    [lang]
  );

  const translateGenre = useCallback(
    (genre: string) => {
      const key = String(genre || '').toLowerCase().trim();
      const match = GENRE_TRANSLATIONS[key];
      if (match) return lang === 'en' ? match.en : match.ar;
      return genre;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider
      value={{
        lang,
        dir,
        isEnglish,
        setLang,
        toggleLang,
        t,
        getMediaTitle,
        translateGenre,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'ar',
      dir: 'rtl',
      isEnglish: false,
      setLang: () => {},
      toggleLang: () => {},
      t: (ar) => ar,
      getMediaTitle: (item) => item?.titleAr || item?.title || '',
      translateGenre: (g) => g,
    };
  }
  return ctx;
}
