import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Edit3,
  Film,
  Layers,
  ListPlus,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Tv,
  UploadCloud,
  X,
} from 'lucide-react';
import { CategoryItem, Episode, MediaItem, Season } from '../../../types';
import {
  extractVideoDurationFromFile,
  formatFileSize,
  saveMovieToDatabases,
  updateMovieInDatabases,
  uploadMoviePoster,
  uploadMovieVideo,
  UploadProgressInfo,
} from '../../../services/movieService';

interface SeriesManagerSectionProps {
  activeSubMode: 'add_series' | 'seasons_episodes';
  token: string;
  mediaItems: MediaItem[];
  categories: CategoryItem[];
  selectedSeriesId?: string | null;
  onSelectSeriesId: (id: string) => void;
  onRefresh: () => void;
  onSwitchToSeasons: () => void;
  onPlayMedia?: (media: MediaItem) => void;
}

export const SeriesManagerSection: React.FC<SeriesManagerSectionProps> = ({
  activeSubMode,
  token,
  mediaItems,
  categories,
  selectedSeriesId,
  onSelectSeriesId,
  onRefresh,
  onSwitchToSeasons,
  onPlayMedia,
}) => {
  const seriesList = mediaItems.filter((m) => m.type === 'series');

  // --- CREATE NEW SERIES FORM STATE ---
  const [titleAr, setTitleAr] = useState<string>('');
  const [titleEn, setTitleEn] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [videoQuality, setVideoQuality] = useState<string>('1080p');
  const [ageRating, setAgeRating] = useState<string>('+16');
  const [rating, setRating] = useState<number>(8.8);
  const [director, setDirector] = useState<string>('');
  const [castInput, setCastInput] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['drama']);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // --- SEASONS & EPISODES MANAGEMENT STATE ---
  const activeSeries =
    seriesList.find((s) => s.id === selectedSeriesId) || seriesList[0] || null;
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [newSeasonTitle, setNewSeasonTitle] = useState<string>('');
  const [isSavingSeasons, setIsSavingSeasons] = useState<boolean>(false);
  const [seasonFeedback, setSeasonFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  // New / Edit Episode Form
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [epNumber, setEpNumber] = useState<number>(1);
  const [epTitle, setEpTitle] = useState<string>('');
  const [epDesc, setEpDesc] = useState<string>('');
  const [epDuration, setEpDuration] = useState<string>('45 دقيقة');
  const [epVideoUrl, setEpVideoUrl] = useState<string>('');
  const [epVideoFile, setEpVideoFile] = useState<File | null>(null);
  const [epFileSize, setEpFileSize] = useState<number>(0);
  const [epIntroStart, setEpIntroStart] = useState<string>('');
  const [epIntroEnd, setEpIntroEnd] = useState<string>('');
  const [epUploadProgress, setEpUploadProgress] = useState<UploadProgressInfo | null>(null);
  const [isUploadingEp, setIsUploadingEp] = useState<boolean>(false);

  const epVideoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeSeries) {
      const s = Array.isArray(activeSeries.seasons) && activeSeries.seasons.length > 0
        ? activeSeries.seasons
        : [{ seasonNumber: 1, title: 'الموسم 1', episodes: [] }];
      setSeasons(s);
      if (!s.some((sn) => sn.seasonNumber === selectedSeasonNum)) {
        setSelectedSeasonNum(s[0].seasonNumber);
      }
      if (!selectedSeriesId) {
        onSelectSeriesId(activeSeries.id);
      }
    } else {
      setSeasons([]);
    }
  }, [activeSeries?.id, activeSeries?.updatedAt]);

  const currentSeason = seasons.find((s) => s.seasonNumber === selectedSeasonNum) || seasons[0] || null;

  useEffect(() => {
    if (currentSeason && !editingEpId) {
      setEpNumber((currentSeason.episodes?.length || 0) + 1);
    }
  }, [currentSeason?.seasonNumber, currentSeason?.episodes?.length, editingEpId]);

  const genreChoices =
    categories.length > 0
      ? categories.map((c) => ({ slug: c.slug, nameAr: c.nameAr }))
      : [
          { slug: 'drama', nameAr: 'دراما' },
          { slug: 'action', nameAr: 'أكشن' },
          { slug: 'crime', nameAr: 'جريمة' },
          { slug: 'sci-fi', nameAr: 'خيال علمي' },
          { slug: 'comedy', nameAr: 'كوميديا' },
          { slug: 'anime', nameAr: 'أنمي' },
        ];

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!titleAr.trim()) {
      setCreateError('يرجى إدخال اسم المسلسل بالعربية');
      return;
    }

    setIsCreating(true);
    try {
      let finalPoster =
        posterUrl.trim() ||
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80';
      if (posterFile) {
        const up = await uploadMoviePoster(posterFile, token);
        finalPoster = up.posterUrl;
      }

      const created = await saveMovieToDatabases(
        {
          type: 'series',
          title: titleEn.trim() || titleAr.trim(),
          titleAr: titleAr.trim(),
          description: description.trim(),
          year: Number(year) || new Date().getFullYear(),
          videoQuality,
          ageRating,
          rating: Number(rating) || 8.5,
          director: director.trim(),
          cast: castInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          genres: selectedGenres,
          posterUrl: finalPoster,
          bannerUrl: bannerUrl.trim() || finalPoster,
          videoUrl: '',
          isPublished: true,
          isFeatured,
          isLatest: true,
          seasons: [{ seasonNumber: 1, title: 'الموسم 1', episodes: [] }],
        },
        token
      );

      setTitleAr('');
      setTitleEn('');
      setDescription('');
      setPosterFile(null);
      setPosterUrl('');
      onRefresh();
      onSelectSeriesId(created.id);
      onSwitchToSeasons();
    } catch (err: any) {
      setCreateError(err?.message || 'تعذر إنشاء المسلسل');
    } finally {
      setIsCreating(false);
    }
  };

  // Relink nextEpisodeId in sequence and persist seasons to DB + Firestore
  const persistSeasons = async (nextSeasons: Season[], successMessage: string) => {
    if (!activeSeries) return;
    setIsSavingSeasons(true);
    setSeasonFeedback(null);

    const linkedSeasons = nextSeasons.map((sn) => {
      const sortedEps = [...(sn.episodes || [])].map((ep, idx, arr) => ({
        ...ep,
        episodeNumber: idx + 1,
        nextEpisodeId: arr[idx + 1]?.id || undefined,
      }));
      return { ...sn, episodes: sortedEps };
    });

    const firstVideoUrl = linkedSeasons[0]?.episodes?.[0]?.videoUrl || activeSeries.videoUrl || '';

    try {
      await updateMovieInDatabases(
        activeSeries.id,
        {
          seasons: linkedSeasons,
          videoUrl: firstVideoUrl,
        },
        token
      );
      setSeasons(linkedSeasons);
      setSeasonFeedback({ type: 'success', msg: successMessage });
      onRefresh();
    } catch (err: any) {
      setSeasonFeedback({ type: 'error', msg: err?.message || 'فشل حفظ المواسم والحلقات' });
    } finally {
      setIsSavingSeasons(false);
    }
  };

  const handleAddSeason = async () => {
    const nextNum =
      seasons.length > 0 ? Math.max(...seasons.map((s) => s.seasonNumber)) + 1 : 1;
    const newSeason: Season = {
      seasonNumber: nextNum,
      title: newSeasonTitle.trim() || `الموسم ${nextNum}`,
      episodes: [],
    };
    const updated = [...seasons, newSeason];
    setNewSeasonTitle('');
    setSelectedSeasonNum(nextNum);
    await persistSeasons(updated, `تمت إضافة ${newSeason.title} بنجاح`);
  };

  const handleEpisodeFilePicked = async (file: File) => {
    setEpVideoFile(file);
    setEpFileSize(file.size);
    if (!epTitle.trim()) {
      setEpTitle(`الحلقة ${epNumber}`);
    }
    const dur = await extractVideoDurationFromFile(file);
    if (dur) setEpDuration(dur);
  };

  const resetEpisodeForm = () => {
    setEditingEpId(null);
    setEpTitle('');
    setEpDesc('');
    setEpDuration('45 دقيقة');
    setEpVideoUrl('');
    setEpVideoFile(null);
    setEpFileSize(0);
    setEpIntroStart('');
    setEpIntroEnd('');
    setEpUploadProgress(null);
  };

  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSeason || !activeSeries) return;
    setSeasonFeedback(null);

    if (!epTitle.trim()) {
      setSeasonFeedback({ type: 'error', msg: 'يرجى إدخال عنوان الحلقة' });
      return;
    }

    if (!epVideoFile && !epVideoUrl.trim()) {
      setSeasonFeedback({ type: 'error', msg: 'يرجى اختيار ملف فيديو للحلقة أو إدخال رابط تشغيل' });
      return;
    }

    let finalVideoUrl = epVideoUrl.trim();
    let finalFileSize = epFileSize;

    if (epVideoFile) {
      setIsUploadingEp(true);
      try {
        const res = await uploadMovieVideo(epVideoFile, token, (p) => setEpUploadProgress(p));
        finalVideoUrl = res.videoUrl;
        finalFileSize = res.fileSizeBytes;
      } catch (err: any) {
        setIsUploadingEp(false);
        setSeasonFeedback({ type: 'error', msg: err?.message || 'فشل رفع فيديو الحلقة' });
        return;
      }
      setIsUploadingEp(false);
    }

    const epPayload: Episode = {
      id: editingEpId || `ep-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      episodeNumber: Number(epNumber) || (currentSeason.episodes.length + 1),
      title: epTitle.trim(),
      description: epDesc.trim(),
      duration: epDuration.trim() || '45 دقيقة',
      videoUrl: finalVideoUrl,
      fileSizeBytes: finalFileSize || undefined,
      introStart: epIntroStart ? Number(epIntroStart) : undefined,
      introEnd: epIntroEnd ? Number(epIntroEnd) : undefined,
    };

    const nextSeasons = seasons.map((sn) => {
      if (sn.seasonNumber !== currentSeason.seasonNumber) return sn;
      const eps = [...(sn.episodes || [])];
      if (editingEpId) {
        const idx = eps.findIndex((item) => item.id === editingEpId);
        if (idx !== -1) eps[idx] = epPayload;
      } else {
        eps.push(epPayload);
      }
      return { ...sn, episodes: eps };
    });

    await persistSeasons(
      nextSeasons,
      editingEpId ? 'تم تحديث بيانات الحلقة وربطها' : 'تم رفع وإضافة الحلقة وربطها بالسلسلة'
    );
    resetEpisodeForm();
  };

  const handleMoveEpisode = async (index: number, direction: -1 | 1) => {
    if (!currentSeason) return;
    const eps = [...currentSeason.episodes];
    const target = index + direction;
    if (target < 0 || target >= eps.length) return;
    [eps[index], eps[target]] = [eps[target], eps[index]];
    const nextSeasons = seasons.map((sn) =>
      sn.seasonNumber === currentSeason.seasonNumber ? { ...sn, episodes: eps } : sn
    );
    await persistSeasons(nextSeasons, 'تم إعادة ترتيب الحلقات وربط الحلقة التالية تلقائياً');
  };

  const handleDeleteSeasonImmediate = async (seasonNum: number, label: string) => {
    const nextSeasons = seasons.filter((s) => s.seasonNumber !== seasonNum);
    await persistSeasons(nextSeasons, `تم حذف ${label}`);
  };

  const handleDeleteEpisodeImmediate = async (
    seasonNum: number,
    episodeId: string,
    label: string
  ) => {
    const nextSeasons = seasons.map((s) =>
      s.seasonNumber === seasonNum
        ? { ...s, episodes: s.episodes.filter((e) => e.id !== episodeId) }
        : s
    );
    await persistSeasons(nextSeasons, `تم حذف ${label}`);
  };

  if (activeSubMode === 'add_series') {
    return (
      <form onSubmit={handleCreateSeries} className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-sky-400" />
            <span>إضافة مسلسل جديد</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            أنشئ المسلسل أولاً ثم أضف المواسم والحلقات وملفات الفيديو الخاصة بكل حلقة
          </p>
        </div>

        {createError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{createError}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-bold mb-1">اسم المسلسل بالعربية *</label>
              <input
                type="text"
                required
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مثال: صراع العروش"
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-bold mb-1">الاسم بالإنجليزية</label>
              <input
                type="text"
                dir="ltr"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Game of Thrones"
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1">الوصف والقصة</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-bold mb-1">صورة البوستر (ملف أو رابط)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  dir="ltr"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <label className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-amber-400 font-bold cursor-pointer shrink-0">
                  ملف
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              {posterFile && <p className="text-[11px] text-emerald-400 mt-1">{posterFile.name}</p>}
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1">صورة الخلفية (Banner URL)</label>
              <input
                type="url"
                dir="ltr"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-zinc-400 font-bold mb-1">السنة</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-bold mb-1">الجودة</label>
              <select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-white"
              >
                <option value="4K Ultra HD">4K Ultra HD</option>
                <option value="1080p">1080p</option>
                <option value="720p HD">720p HD</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-bold mb-1">الفئة العمرية</label>
              <select
                value={ageRating}
                onChange={(e) => setAgeRating(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-white"
              >
                <option value="عام">عام</option>
                <option value="+13">+13</option>
                <option value="+16">+16</option>
                <option value="+18">+18</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-bold mb-1">التقييم</label>
              <input
                type="number"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-bold mb-1">المخرج</label>
              <input
                type="text"
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-bold mb-1">الممثلون (بفاصلة)</label>
              <input
                type="text"
                value={castInput}
                onChange={(e) => setCastInput(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-2">التصنيفات:</label>
            <div className="flex flex-wrap gap-1.5">
              {genreChoices.map((g) => {
                const active = selectedGenres.includes(g.slug);
                return (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() =>
                      setSelectedGenres((prev) =>
                        prev.includes(g.slug)
                          ? prev.length > 1
                            ? prev.filter((x) => x !== g.slug)
                            : prev
                          : [...prev, g.slug]
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-zinc-950 text-zinc-400 border-white/10'
                    }`}
                  >
                    {g.nameAr}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-semibold">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="accent-amber-400"
            />
            <span>إظهار في البنرات المميزة</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isCreating}
          className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {isCreating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جارٍ إنشاء المسلسل...</span>
            </>
          ) : (
            <>
              <Tv className="w-4 h-4" />
              <span>إنشاء المسلسل والانتقال لإضافة الحلقات</span>
            </>
          )}
        </button>
      </form>
    );
  }

  // --- SEASONS & EPISODES VIEW ---
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <span>إدارة المواسم والحلقات</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            أضف مواسم متعددة وارفع فيديو مستقل لكل حلقة مع ترتيب الحلقات وتوقيت تخطي المقدمة
          </p>
        </div>
      </div>

      {seasonFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            seasonFeedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {seasonFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{seasonFeedback.msg}</span>
          </div>
          <button type="button" onClick={() => setSeasonFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {seriesList.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-[#111116] border border-white/[0.08] space-y-2">
          <Tv className="w-9 h-9 text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-zinc-300">لا توجد مسلسلات مضافة بعد</p>
          <p className="text-xs text-zinc-500">قم بإنشاء مسلسل أولاً من قسم "إضافة مسلسل جديد".</p>
        </div>
      ) : (
        <>
          {/* Series Picker + Add Season */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-2xl bg-[#111116] border border-white/[0.08]">
            <div className="lg:col-span-5">
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                اختر المسلسل:
              </label>
              <select
                value={activeSeries?.id || ''}
                onChange={(e) => {
                  onSelectSeriesId(e.target.value);
                  resetEpisodeForm();
                }}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold"
              >
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titleAr} ({s.year})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-5">
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                إضافة موسم جديد:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSeasonTitle}
                  onChange={(e) => setNewSeasonTitle(e.target.value)}
                  placeholder={`الموسم ${seasons.length + 1}`}
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
                <button
                  type="button"
                  disabled={isSavingSeasons}
                  onClick={handleAddSeason}
                  className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>موسم</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 flex items-end">
              {activeSeries && onPlayMedia && (
                <button
                  type="button"
                  onClick={() => onPlayMedia(activeSeries)}
                  className="w-full py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400 text-amber-300 hover:text-black font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-400/30 cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تشغيل</span>
                </button>
              )}
            </div>
          </div>

          {/* Season Tabs */}
          {seasons.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {seasons.map((sn) => {
                const isSel = sn.seasonNumber === currentSeason?.seasonNumber;
                return (
                  <div
                    key={sn.seasonNumber}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                      isSel
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-[#111116] text-zinc-300 border-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSeasonNum(sn.seasonNumber);
                        resetEpisodeForm();
                      }}
                      className="cursor-pointer"
                    >
                      {sn.title} ({sn.episodes?.length || 0})
                    </button>
                    {seasons.length > 1 && (
                      <button
                        type="button"
                        disabled={isSavingSeasons}
                        onClick={() => handleDeleteSeasonImmediate(sn.seasonNumber, sn.title)}
                        className={`p-0.5 rounded hover:bg-black/20 cursor-pointer ${
                          isSel ? 'text-black' : 'text-zinc-500 hover:text-rose-400'
                        }`}
                        title="حذف الموسم فوراً"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Two Column: Episode Upload/Edit Form + Episode List */}
          {currentSeason && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Episode Form */}
              <form
                onSubmit={handleSaveEpisode}
                className="lg:col-span-5 p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3 text-xs h-fit"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h3 className="font-black text-amber-400">
                    {editingEpId
                      ? `تعديل الحلقة (${currentSeason.title})`
                      : `إضافة حلقة إلى ${currentSeason.title}`}
                  </h3>
                  {editingEpId && (
                    <button
                      type="button"
                      onClick={resetEpisodeForm}
                      className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">رقم الحلقة</label>
                    <input
                      type="number"
                      min="1"
                      value={epNumber}
                      onChange={(e) => setEpNumber(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-zinc-400 font-bold mb-1">عنوان الحلقة *</label>
                    <input
                      type="text"
                      required
                      value={epTitle}
                      onChange={(e) => setEpTitle(e.target.value)}
                      placeholder={`الحلقة ${epNumber}`}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 font-bold mb-1">وصف الحلقة</label>
                  <textarea
                    rows={2}
                    value={epDesc}
                    onChange={(e) => setEpDesc(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">المدة</label>
                    <input
                      type="text"
                      value={epDuration}
                      onChange={(e) => setEpDuration(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">بداية المقدمة (ث)</label>
                    <input
                      type="number"
                      value={epIntroStart}
                      onChange={(e) => setEpIntroStart(e.target.value)}
                      placeholder="0"
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">نهاية المقدمة (ث)</label>
                    <input
                      type="number"
                      value={epIntroEnd}
                      onChange={(e) => setEpIntroEnd(e.target.value)}
                      placeholder="60"
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                {/* Episode Video File Upload */}
                <div className="space-y-2 pt-1">
                  <input
                    ref={epVideoInputRef}
                    type="file"
                    accept="video/*,.mp4,.mkv,.webm,.mov"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleEpisodeFilePicked(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => epVideoInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400 bg-zinc-950 text-zinc-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-amber-400" />
                    <span className="truncate">
                      {epVideoFile
                        ? `${epVideoFile.name} (${formatFileSize(epVideoFile.size)})`
                        : 'اختيار ملف فيديو مستقل للحلقة من الجهاز'}
                    </span>
                  </button>

                  <input
                    type="url"
                    dir="ltr"
                    value={epVideoUrl}
                    onChange={(e) => setEpVideoUrl(e.target.value)}
                    placeholder="أو رابط يوتيوب / فيديو مباشر (YouTube أو /uploads/...)"
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />

                  {isUploadingEp && epUploadProgress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-amber-400">
                        <span>{epUploadProgress.speedFormatted}</span>
                        <span>{epUploadProgress.percent}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{ width: `${epUploadProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUploadingEp || isSavingSeasons}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isUploadingEp || isSavingSeasons ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{editingEpId ? 'حفظ تعديل الحلقة' : 'رفع وإضافة الحلقة'}</span>
                </button>
              </form>

              {/* Episodes List */}
              <div className="lg:col-span-7 p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h3 className="text-xs font-black text-white">
                    حلقات {currentSeason.title} ({currentSeason.episodes?.length || 0})
                  </h3>
                  <span className="text-[11px] text-zinc-500">
                    الحلقات مرتبطة تلقائياً للتشغيل المتتابع
                  </span>
                </div>

                {!currentSeason.episodes?.length ? (
                  <div className="py-12 text-center text-zinc-500 text-xs">
                    <Film className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p>لا توجد حلقات في هذا الموسم بعد.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentSeason.episodes.map((ep, idx) => (
                      <div
                        key={ep.id}
                        className="p-3 rounded-xl bg-zinc-950/90 border border-white/[0.06] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 font-mono font-black text-xs flex items-center justify-center shrink-0">
                            {ep.episodeNumber || idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate max-w-[220px]">
                              {ep.title}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {ep.duration}
                              </span>
                              {ep.introEnd ? (
                                <span className="text-amber-400">
                                  مقدمة: {ep.introStart || 0}ث - {ep.introEnd}ث
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0 || isSavingSeasons}
                            onClick={() => handleMoveEpisode(idx, -1)}
                            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 flex items-center justify-center cursor-pointer"
                            title="تقديم للأعلى"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentSeason.episodes.length - 1 || isSavingSeasons}
                            onClick={() => handleMoveEpisode(idx, 1)}
                            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 flex items-center justify-center cursor-pointer"
                            title="تأخير للأسفل"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEpId(ep.id);
                              setEpNumber(ep.episodeNumber);
                              setEpTitle(ep.title);
                              setEpDesc(ep.description || '');
                              setEpDuration(ep.duration || '45 دقيقة');
                              setEpVideoUrl(ep.videoUrl);
                              setEpIntroStart(ep.introStart !== undefined ? String(ep.introStart) : '');
                              setEpIntroEnd(ep.introEnd !== undefined ? String(ep.introEnd) : '');
                            }}
                            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isSavingSeasons}
                            onClick={() =>
                              handleDeleteEpisodeImmediate(
                                currentSeason.seasonNumber,
                                ep.id,
                                ep.title
                              )
                            }
                            className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer disabled:opacity-50"
                            title="حذف الحلقة فوراً"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
