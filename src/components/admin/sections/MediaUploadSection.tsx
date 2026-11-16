import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Film,
  Image as ImageIcon,
  Layers,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  Youtube,
} from 'lucide-react';
import { CategoryItem, MediaItem, PersonItem, VideoSourceOption } from '../../../types';
import {
  extractVideoDurationFromFile,
  formatAdminErrorMessage,
  formatFileSize,
  saveMovieToDatabases,
  UploadController,
  uploadMoviePoster,
  uploadMovieVideo,
  UploadProgressInfo,
} from '../../../services/movieService';
import { generateRandomRating } from '../../../utils/rating';
import {
  extractYouTubeVideoId,
  fetchYouTubeOEmbedMetadata,
  getYouTubeCanonicalUrl,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  isYouTubeUrl,
} from '../../../utils/youtube';

interface QueueVideoTask {
  id: string;
  file: File;
  titleAr: string;
  duration: string;
  previewObjectUrl: string;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: UploadProgressInfo;
  controller: UploadController;
  uploadedUrl?: string;
  storagePath?: string;
  storageType?: 'firebase' | 'server';
  error?: string;
}

interface MediaUploadSectionProps {
  token: string;
  categories: CategoryItem[];
  people: PersonItem[];
  onSaved: () => void;
  onPlayMedia?: (media: MediaItem) => void;
  onNavigateManage: () => void;
}

const QUALITY_OPTIONS = ['4K Ultra HD', '1080p', '720p HD', '480p SD'];
const AGE_RATING_OPTIONS = ['عام', '+13', '+16', '+18'];

export const MediaUploadSection: React.FC<MediaUploadSectionProps> = ({
  token,
  categories,
  people,
  onSaved,
  onPlayMedia,
  onNavigateManage,
}) => {
  const [queue, setQueue] = useState<QueueVideoTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Poster & Banner
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [posterPreview, setPosterPreview] = useState<string>('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');

  // Metadata fields
  const [titleAr, setTitleAr] = useState<string>('');
  const [titleEn, setTitleEn] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [duration, setDuration] = useState<string>('120 دقيقة');
  const [videoQuality, setVideoQuality] = useState<string>('1080p');
  const [ageRating, setAgeRating] = useState<string>('+16');
  const [rating, setRating] = useState<number>(() => generateRandomRating());
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['action']);
  const [director, setDirector] = useState<string>('');
  const [castInput, setCastInput] = useState<string>('');
  const [introStart, setIntroStart] = useState<string>('');
  const [introEnd, setIntroEnd] = useState<string>('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);

  // Flags
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isLatest, setIsLatest] = useState<boolean>(true);
  const [isMostWatched, setIsMostWatched] = useState<boolean>(false);

  // Additional playback sources (optional)
  const [uploadSourceMode, setUploadSourceMode] = useState<
    'file' | 'youtube' | 'external' | 'coming_soon'
  >('file');
  const [youtubeUrlInput, setYoutubeUrlInput] = useState<string>('');
  const [isFetchingYoutubeMeta, setIsFetchingYoutubeMeta] = useState<boolean>(false);
  const [youtubeMetaNote, setYoutubeMetaNote] = useState<string | null>(null);
  const [extraSources, setExtraSources] = useState<VideoSourceOption[]>([]);
  const [externalVideoUrl, setExternalVideoUrl] = useState<string>('');

  // Preview Modal
  const [previewVideoSrc, setPreviewVideoSrc] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // Processing Status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<MediaItem[]>([]);

  const detectedYoutubeId = extractYouTubeVideoId(youtubeUrlInput);
  const detectedYoutubeThumb = detectedYoutubeId
    ? getYouTubeThumbnailUrl(detectedYoutubeId, 'hq')
    : null;

  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const genreChoices =
    categories.length > 0
      ? categories.map((c) => ({ slug: c.slug, nameAr: c.nameAr }))
      : [
          { slug: 'action', nameAr: 'أكشن' },
          { slug: 'drama', nameAr: 'دراما' },
          { slug: 'horror', nameAr: 'رعب' },
          { slug: 'sci-fi', nameAr: 'خيال علمي' },
          { slug: 'comedy', nameAr: 'كوميديا' },
          { slug: 'crime', nameAr: 'جريمة' },
          { slug: 'anime', nameAr: 'أنمي' },
        ];

  const handleFilesSelected = async (files: FileList | File[]) => {
    setErrorMsg(null);
    const list = Array.from(files).filter((f) => f.type.startsWith('video/') || /\.(mp4|mkv|webm|mov|m3u8)$/i.test(f.name));
    if (list.length === 0) {
      setErrorMsg('يرجى اختيار ملفات فيديو صالحة (MP4, WebM, MKV, MOV)');
      return;
    }

    const createdTasks: QueueVideoTask[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_.]+/g, ' ').trim();
      const detectedDuration = await extractVideoDurationFromFile(file);
      const previewObjectUrl = URL.createObjectURL(file);

      const task: QueueVideoTask = {
        id: `q-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        titleAr: cleanName,
        duration: detectedDuration || '120 دقيقة',
        previewObjectUrl,
        status: 'pending',
        progress: {
          percent: 0,
          loadedBytes: 0,
          totalBytes: file.size,
          speedFormatted: 'في الانتظار',
          etaFormatted: 'جاهز للرفع',
          phase: 'uploading',
        },
        controller: {
          cancel: () => {},
          isCancelled: false,
          isPaused: false,
        },
      };
      createdTasks.push(task);

      if (i === 0 && queue.length === 0) {
        if (!titleAr.trim()) setTitleAr(cleanName);
        if (!titleEn.trim()) setTitleEn(cleanName);
        if (detectedDuration) setDuration(detectedDuration);
      }
    }

    setQueue((prev) => [...prev, ...createdTasks]);
  };

  const toggleGenre = (slug: string) => {
    setSelectedGenres((prev) =>
      prev.includes(slug) ? (prev.length > 1 ? prev.filter((g) => g !== slug) : prev) : [...prev, slug]
    );
  };

  const addCastChip = (name: string) => {
    const current = castInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(name)) {
      setCastInput([...current, name].join(', '));
    }
  };

  const addExtraSource = () => {
    setExtraSources((prev) => [
      ...prev,
      {
        id: `src-${Date.now()}`,
        label: `سيرفر احتياطي ${prev.length + 1}`,
        url: '',
        format: 'mp4',
        quality: videoQuality,
        isDefault: false,
      },
    ]);
  };

  const updateTaskState = (taskId: string, updater: (t: QueueVideoTask) => QueueVideoTask) => {
    setQueue((prev) => prev.map((t) => (t.id === taskId ? updater(t) : t)));
  };

  const handlePauseResumeTask = (task: QueueVideoTask) => {
    if (task.status === 'uploading') {
      task.controller.pause?.();
      updateTaskState(task.id, (t) => ({ ...t, status: 'paused' }));
    } else if (task.status === 'paused') {
      task.controller.resume?.();
      updateTaskState(task.id, (t) => ({ ...t, status: 'uploading' }));
    }
  };

  const handleCancelTask = (task: QueueVideoTask) => {
    if (task.status === 'uploading' || task.status === 'paused') {
      task.controller.cancel();
    }
    updateTaskState(task.id, (t) => ({
      ...t,
      status: 'cancelled',
      error: 'تم إلغاء الرفع',
    }));
  };

  const removeTaskFromQueue = (task: QueueVideoTask) => {
    if (task.status === 'uploading' || task.status === 'paused') {
      task.controller.cancel();
    }
    try {
      URL.revokeObjectURL(task.previewObjectUrl);
    } catch {
      // ignore
    }
    setQueue((prev) => prev.filter((t) => t.id !== task.id));
  };

  const handleFetchYoutubeInfo = async () => {
    setErrorMsg(null);
    setYoutubeMetaNote(null);
    const id = extractYouTubeVideoId(youtubeUrlInput);
    if (!id) {
      setErrorMsg('رابط يوتيوب غير صالح. يرجى لصق رابط مثل https://www.youtube.com/watch?v=...');
      return;
    }

    setIsFetchingYoutubeMeta(true);
    try {
      const meta = await fetchYouTubeOEmbedMetadata(youtubeUrlInput);
      if (meta) {
        if (meta.title) {
          if (!titleAr.trim()) setTitleAr(meta.title);
          if (!titleEn.trim()) setTitleEn(meta.title);
        }
        if (meta.authorName && !director.trim()) {
          setDirector(meta.authorName);
        }
        if (meta.thumbnailUrl) {
          if (!posterFile && !posterUrl.trim()) setPosterUrl(meta.thumbnailUrl);
          if (!bannerFile && !bannerUrl.trim()) setBannerUrl(meta.thumbnailUrl);
        }
        setYoutubeMetaNote(
          meta.title
            ? `تم جلب عنوان الفيديو والصورة المصغرة من يوتيوب بنجاح (${meta.title})`
            : 'تم التحقق من معرف الفيديو وتجهيز الصورة المصغرة تلقائياً'
        );
      }
    } finally {
      setIsFetchingYoutubeMeta(false);
    }
  };

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const activeQueue = queue.filter((q) => q.status === 'pending' || q.status === 'error');
    const hasCompletedTask = queue.some((q) => q.status === 'completed' && q.uploadedUrl);
    const trimmedYoutubeUrl = youtubeUrlInput.trim();
    const trimmedExternalUrl = externalVideoUrl.trim();
    const hasYoutubeUrl = Boolean(trimmedYoutubeUrl);
    const hasExternalUrl = Boolean(trimmedExternalUrl);

    if (uploadSourceMode === 'youtube' && !hasYoutubeUrl) {
      setErrorMsg('يرجى إدخال رابط فيديو يوتيوب لإضافة الفيلم');
      return;
    }

    if (hasYoutubeUrl && !extractYouTubeVideoId(trimmedYoutubeUrl) && uploadSourceMode === 'youtube') {
      setErrorMsg('رابط يوتيوب المدخل غير صالح. تأكد من نسخ الرابط الصحيح من يوتيوب');
      return;
    }

    if (
      uploadSourceMode !== 'coming_soon' &&
      activeQueue.length === 0 &&
      !hasCompletedTask &&
      !hasExternalUrl &&
      !hasYoutubeUrl
    ) {
      setErrorMsg('يرجى اختيار ملف فيديو من جهازك، أو ربط فيلم عبر يوتيوب، أو إدخال رابط بث مباشر، أو اختيار وضع قريباً');
      return;
    }

    if (!titleAr.trim() && activeQueue.length <= 1) {
      setErrorMsg('يرجى كتابة اسم الفيلم بالعربية');
      return;
    }

    setIsSubmitting(true);
    const newlySaved: MediaItem[] = [];

    try {
      const candidateLinkUrl =
        uploadSourceMode === 'youtube'
          ? trimmedYoutubeUrl
          : trimmedExternalUrl || trimmedYoutubeUrl;
      const autoYoutubeThumb = candidateLinkUrl
        ? getYouTubeThumbnailUrl(candidateLinkUrl, 'hq') || ''
        : '';

      // 1. Upload poster & banner once and reuse across batch
      let finalPosterUrl = posterUrl.trim() || autoYoutubeThumb || '';
      if (posterFile) {
        const uploadedPoster = await uploadMoviePoster(posterFile, token);
        finalPosterUrl = uploadedPoster.posterUrl;
      }

      let finalBannerUrl = bannerUrl.trim() || finalPosterUrl;
      if (bannerFile) {
        const uploadedBanner = await uploadMoviePoster(bannerFile, token);
        finalBannerUrl = uploadedBanner.posterUrl;
      }

      const castArray = castInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const cleanExtraSources = extraSources
        .filter((s) => s.url.trim())
        .map((s) => ({
          ...s,
          url: s.url.trim(),
          format: isYouTubeUrl(s.url) ? 'youtube' : s.format || 'mp4',
        }));

      // 2. Coming soon teaser (no video uploaded yet — visitors can subscribe to 'تنبيهي عند الإضافة')
      if (uploadSourceMode === 'coming_soon') {
        const saved = await saveMovieToDatabases(
          {
            type: 'movie',
            title: titleEn.trim() || titleAr.trim(),
            titleAr: titleAr.trim(),
            description: description.trim(),
            posterUrl: finalPosterUrl,
            bannerUrl: finalBannerUrl,
            videoUrl: '',
            videoQuality,
            ageRating,
            duration: duration.trim() || 'قريباً',
            year: Number(year) || new Date().getFullYear(),
            rating: Number(rating) || generateRandomRating(),
            genres: selectedGenres,
            director: director.trim(),
            cast: castArray,
            displayOrder: Number(displayOrder) || 0,
            isPublished,
            isFeatured,
            isLatest,
            isMostWatched,
            isComingSoon: true,
            sources: cleanExtraSources,
            storageType: 'external',
          },
          token
        );
        newlySaved.push(saved);
      } else if (
        (queue.length === 0 || (uploadSourceMode !== 'file' && activeQueue.length === 0 && !hasCompletedTask)) &&
        (hasYoutubeUrl || hasExternalUrl)
      ) {
        // 2b. Saving via YouTube link or direct external stream URL (no device file queue)
        const rawMainUrl =
          uploadSourceMode === 'youtube'
            ? trimmedYoutubeUrl
            : trimmedExternalUrl || trimmedYoutubeUrl;
        const isYt = isYouTubeUrl(rawMainUrl);
        const mainUrl = isYt ? getYouTubeCanonicalUrl(rawMainUrl) || rawMainUrl : rawMainUrl;
        const isHls = !isYt && mainUrl.toLowerCase().includes('.m3u8');

        const allSources: VideoSourceOption[] = [
          {
            id: `src-main-${Date.now()}`,
            label: isYt ? 'مشغل يوتيوب (YouTube)' : `المصدر الرئيسي (${videoQuality})`,
            url: mainUrl,
            format: isYt ? 'youtube' : isHls ? 'hls' : 'mp4',
            quality: videoQuality,
            isDefault: true,
          },
          ...cleanExtraSources,
        ];

        const saved = await saveMovieToDatabases(
          {
            type: 'movie',
            title: titleEn.trim() || titleAr.trim(),
            titleAr: titleAr.trim(),
            description: description.trim(),
            posterUrl: finalPosterUrl,
            bannerUrl: finalBannerUrl,
            videoUrl: mainUrl,
            videoQuality,
            ageRating,
            duration: duration.trim() || '120 دقيقة',
            year: Number(year) || new Date().getFullYear(),
            rating: Number(rating) || generateRandomRating(),
            genres: selectedGenres,
            director: director.trim(),
            cast: castArray,
            displayOrder: Number(displayOrder) || 0,
            isPublished,
            isFeatured,
            isLatest,
            isMostWatched,
            isComingSoon: false,
            introStart: introStart ? Number(introStart) : undefined,
            introEnd: introEnd ? Number(introEnd) : undefined,
            sources: allSources,
            storageType: isYt ? 'youtube' : 'server',
          },
          token
        );
        newlySaved.push(saved);
      } else {
        // 3. Process queued video files sequentially with real pause/resume/cancel
        for (let i = 0; i < queue.length; i++) {
          const task = queue[i];
          if (task.status === 'cancelled') continue;

          let videoUrl = task.uploadedUrl || '';
          let storagePath = task.storagePath || '';
          let storageType: 'firebase' | 'server' = task.storageType || 'server';
          let fileSizeBytes = task.file.size;

          if (task.status !== 'completed' || !videoUrl) {
            setActiveTaskId(task.id);
            updateTaskState(task.id, (t) => ({ ...t, status: 'uploading', error: undefined }));

            try {
              const res = await uploadMovieVideo(
                task.file,
                token,
                (progress) => {
                  updateTaskState(task.id, (t) => ({
                    ...t,
                    status: progress.phase === 'paused' ? 'paused' : 'uploading',
                    progress,
                  }));
                },
                task.controller
              );
              videoUrl = res.videoUrl;
              storagePath = res.storagePath;
              storageType = res.storageType;
              fileSizeBytes = res.fileSizeBytes;
              updateTaskState(task.id, (t) => ({
                ...t,
                status: 'completed',
                uploadedUrl: videoUrl,
                storagePath,
                storageType,
                progress: { ...t.progress, percent: 100, phase: 'completed' },
              }));
            } catch (uploadErr: any) {
              updateTaskState(task.id, (t) => ({
                ...t,
                status: t.controller.isCancelled ? 'cancelled' : 'error',
                error: formatAdminErrorMessage(uploadErr, 'فشل رفع هذا الفيديو'),
              }));
              continue;
            }
          }

          const itemTitleAr =
            queue.length === 1 && titleAr.trim()
              ? titleAr.trim()
              : task.titleAr || titleAr.trim() || task.file.name;
          const itemTitleEn =
            queue.length === 1 && titleEn.trim() ? titleEn.trim() : itemTitleAr;

          const allSources: VideoSourceOption[] = [
            {
              id: `src-main-${Date.now()}-${i}`,
              label: `السيرفر الأساسي (${videoQuality})`,
              url: videoUrl,
              format: 'mp4',
              quality: videoQuality,
              isDefault: true,
            },
            ...cleanExtraSources,
          ];

          const saved = await saveMovieToDatabases(
            {
              type: 'movie',
              title: itemTitleEn,
              titleAr: itemTitleAr,
              description: description.trim(),
              posterUrl: finalPosterUrl,
              bannerUrl: finalBannerUrl,
              videoUrl,
              videoQuality,
              ageRating,
              duration: queue.length === 1 ? duration.trim() || task.duration : task.duration,
              year: Number(year) || new Date().getFullYear(),
              rating: queue.length > 1 ? generateRandomRating() : Number(rating) || generateRandomRating(),
              genres: selectedGenres,
              director: director.trim(),
              cast: castArray,
              displayOrder: Number(displayOrder) || 0,
              isPublished,
              isFeatured,
              isLatest,
              isMostWatched,
              introStart: introStart ? Number(introStart) : undefined,
              introEnd: introEnd ? Number(introEnd) : undefined,
              sources: allSources,
              fileSizeBytes,
              storagePath,
              storageType,
            },
            token
          );

          newlySaved.push(saved);
        }
      }

      if (newlySaved.length > 0) {
        setSavedItems(newlySaved);
        setRating(generateRandomRating());
        onSaved();
      }
    } catch (err: any) {
      setErrorMsg(formatAdminErrorMessage(err, 'حدث خطأ أثناء رفع وحفظ المحتوى'));
    } finally {
      setIsSubmitting(false);
      setActiveTaskId(null);
    }
  };

  return (
    <form onSubmit={handleSubmitAll} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white">إضافة فيلم جديد ورفع الفيديوهات</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            يدعم رفع فيديو واحد أو عدة فيديوهات بالتتابع مع الإيقاف المؤقت والاستكمال والمعاينة قبل النشر
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {savedItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>تم حفظ ونشر {savedItems.length} عمل بنجاح في قاعدة البيانات!</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onPlayMedia && savedItems[0] && (
              <button
                type="button"
                onClick={() => onPlayMedia(savedItems[0])}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>تشغيل ومعاينة في المشغل</span>
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateManage}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs border border-white/10 cursor-pointer"
            >
              عرض في إدارة الأفلام
            </button>
          </div>
        </div>
      )}

      {/* 1. Video Source Selector: Device Upload / YouTube Link / Direct Stream */}
      <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-950 border border-white/10 text-xs font-bold">
            <button
              type="button"
              onClick={() => setUploadSourceMode('file')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                uploadSourceMode === 'file'
                  ? 'bg-amber-400 text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>رفع من الجهاز</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadSourceMode('youtube')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                uploadSourceMode === 'youtube'
                  ? 'bg-amber-400 text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>ربط عبر يوتيوب</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadSourceMode('external')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                uploadSourceMode === 'external'
                  ? 'bg-amber-400 text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>رابط بث مباشر</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadSourceMode('coming_soon')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                uploadSourceMode === 'coming_soon'
                  ? 'bg-amber-400 text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قريباً (بدون فيديو)</span>
            </button>
          </div>

          {uploadSourceMode === 'file' && (
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة فيديو</span>
            </button>
          )}
        </div>

        <input
          ref={videoInputRef}
          type="file"
          multiple
          accept="video/mp4,video/webm,video/x-matroska,video/quicktime,.mp4,.webm,.mkv,.mov"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
        />

        {uploadSourceMode === 'youtube' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-white">
                رابط الفيلم من يوتيوب (YouTube URL)
              </label>
              <p className="text-[11px] text-zinc-400">
                يدعم روابط Watch و youtu.be و Shorts و Embed مع جلب العنوان والصورة تلقائياً
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://www.youtube.com/watch?v=... أو https://youtu.be/..."
                  value={youtubeUrlInput}
                  onChange={(e) => {
                    setYoutubeUrlInput(e.target.value);
                    setYoutubeMetaNote(null);
                  }}
                  className="flex-1 bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!detectedYoutubeId || isFetchingYoutubeMeta}
                    onClick={handleFetchYoutubeInfo}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 disabled:opacity-45 text-amber-300 text-xs font-black border border-amber-400/35 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isFetchingYoutubeMeta ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>جلب البيانات</span>
                  </button>
                  {detectedYoutubeId && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewVideoSrc(youtubeUrlInput.trim());
                        setPreviewTitle(titleAr || 'معاينة يوتيوب');
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>معاينة</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {youtubeUrlInput.trim() && !detectedYoutubeId && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>لم يتم التعرف على معرف فيديو يوتيوب صالح في هذا الرابط.</span>
              </div>
            )}

            {detectedYoutubeId && (
              <div className="p-3 rounded-xl bg-zinc-950/90 border border-amber-400/25 flex flex-wrap sm:flex-nowrap items-center gap-3">
                {detectedYoutubeThumb && (
                  <img
                    src={detectedYoutubeThumb}
                    alt="YouTube Thumbnail"
                    className="w-32 h-20 rounded-lg object-cover border border-white/10 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>جاهز للربط والتشغيل داخل مشغل الموقع</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono" dir="ltr">
                    YouTube ID: {detectedYoutubeId}
                  </p>
                  {youtubeMetaNote && (
                    <p className="text-[11px] text-amber-300 font-semibold">{youtubeMetaNote}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {uploadSourceMode === 'file' && (
          <>
            <div
              onClick={() => videoInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files?.length) handleFilesSelected(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-zinc-700 hover:border-amber-400/80 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-amber-400/[0.03]"
            >
              <div className="w-11 h-11 rounded-2xl bg-zinc-900 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-white/10">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-black text-white">
                اسحب ملف أو عدة ملفات فيديو هنا أو اضغط للاختيار من جهازك
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                يتم استخراج المدة وحجم الملف تلقائياً مع دعم الإيقاف المؤقت والاستكمال
              </p>
            </div>

            {/* Queue items */}
            {queue.length > 0 && (
              <div className="space-y-2.5">
                {queue.map((task) => {
                  const isUploadingThis = task.status === 'uploading' || task.status === 'paused';
                  return (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/[0.08] space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-400/15 text-amber-400 flex items-center justify-center shrink-0">
                            <Film className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            {queue.length > 1 ? (
                              <input
                                type="text"
                                value={task.titleAr}
                                onChange={(e) =>
                                  updateTaskState(task.id, (t) => ({ ...t, titleAr: e.target.value }))
                                }
                                disabled={isUploadingThis || task.status === 'completed'}
                                className="bg-transparent border-b border-white/15 focus:border-amber-400 text-xs font-black text-white focus:outline-none w-52 sm:w-72"
                              />
                            ) : (
                              <p className="text-xs font-black text-white truncate max-w-xs">
                                {task.file.name}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                              <span>{formatFileSize(task.file.size)}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {task.duration}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewVideoSrc(task.previewObjectUrl);
                              setPreviewTitle(task.titleAr || task.file.name);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[11px] font-bold border border-white/10 flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>معاينة</span>
                          </button>

                          {isUploadingThis && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePauseResumeTask(task)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-[11px] font-bold border border-amber-400/30 flex items-center gap-1 cursor-pointer"
                              >
                                {task.status === 'paused' ? (
                                  <>
                                    <Play className="w-3 h-3" />
                                    <span>استكمال</span>
                                  </>
                                ) : (
                                  <>
                                    <Pause className="w-3 h-3" />
                                    <span>إيقاف مؤقت</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCancelTask(task)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-bold border border-rose-500/30 cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </>
                          )}

                          {!isUploadingThis && (
                            <button
                              type="button"
                              onClick={() => removeTaskFromQueue(task)}
                              className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center cursor-pointer"
                              title="إزالة من القائمة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {(isUploadingThis || task.status === 'completed' || task.status === 'error') && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span
                              className={
                                task.status === 'completed'
                                  ? 'text-emerald-400 font-bold'
                                  : task.status === 'error'
                                  ? 'text-rose-400 font-bold'
                                  : task.status === 'paused'
                                  ? 'text-amber-400 font-bold'
                                  : 'text-zinc-300'
                              }
                            >
                              {task.error
                                ? task.error
                                : `${task.progress.speedFormatted} • ${task.progress.etaFormatted}`}
                            </span>
                            <span className="text-amber-400 font-black tabular-nums">
                              {task.progress.percent}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-200 ${
                                task.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : task.status === 'error'
                                  ? 'bg-rose-500'
                                  : task.status === 'paused'
                                  ? 'bg-amber-500/70'
                                  : 'bg-amber-400'
                              }`}
                              style={{ width: `${task.progress.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {uploadSourceMode === 'coming_soon' && (
          <div className="p-4 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-black text-amber-300">
                نشر كعمل قادم قريباً (بدون فيديو حالياً)
              </p>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                سيظهر هذا العمل بشارة (قريباً) ليتمكن المستخدمون من الضغط على زر «تنبيهي عند الإضافة»، وعند تعديله وإضافة رابط أو ملف الفيديو لاحقاً سيصلهم إشعار فوري.
              </p>
            </div>
          </div>
        )}

        {uploadSourceMode === 'external' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-white">
              رابط بث مباشر (MP4 / HLS .m3u8 أو يوتيوب):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                dir="ltr"
                placeholder="https://cdn.example.com/movie/master.m3u8"
                value={externalVideoUrl}
                onChange={(e) => setExternalVideoUrl(e.target.value)}
                className="flex-1 bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none"
              />
              {externalVideoUrl.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewVideoSrc(externalVideoUrl.trim());
                    setPreviewTitle(titleAr || 'معاينة الرابط');
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold border border-white/10 cursor-pointer shrink-0"
                >
                  معاينة
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Poster & Banner Images */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-white flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>صورة البوستر (Poster)</span>
            </label>
            <button
              type="button"
              onClick={() => posterInputRef.current?.click()}
              className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
            >
              رفع من الجهاز
            </button>
          </div>
          <input
            ref={posterInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPosterFile(f);
                setPosterPreview(URL.createObjectURL(f));
              }
            }}
          />
          <input
            type="url"
            dir="ltr"
            placeholder="أو أدخل رابط صورة البوستر..."
            value={posterUrl}
            onChange={(e) => setPosterUrl(e.target.value)}
            className="w-full bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          />
          {(posterPreview || posterUrl) && (
            <img
              src={posterPreview || posterUrl}
              alt="Poster Preview"
              className="w-24 h-36 rounded-xl object-cover border border-white/10"
            />
          )}
        </div>

        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-white flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-sky-400" />
              <span>صورة الخلفية السينمائية (Banner)</span>
            </label>
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
            >
              رفع من الجهاز
            </button>
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setBannerFile(f);
                setBannerPreview(URL.createObjectURL(f));
              }
            }}
          />
          <input
            type="url"
            dir="ltr"
            placeholder="أو أدخل رابط صورة الخلفية..."
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            className="w-full bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          />
          {(bannerPreview || bannerUrl) && (
            <img
              src={bannerPreview || bannerUrl}
              alt="Banner Preview"
              className="w-full h-28 rounded-xl object-cover border border-white/10"
            />
          )}
        </div>
      </div>

      {/* 3. Details, Genres, Cast & Director */}
      <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4">
        <h3 className="text-xs font-black text-amber-400 border-b border-white/[0.06] pb-2">
          بيانات العمل والتصنيف وطاقم التمثيل
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">اسم الفيلم بالعربية *</label>
            <input
              type="text"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder="مثال: المهمة المستحيلة"
              className="w-full bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">الاسم الأصلي / بالإنجليزية</label>
            <input
              type="text"
              dir="ltr"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Mission Impossible"
              className="w-full bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-1">القصة والوصف</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ملخص أحداث الفيلم..."
            className="w-full bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">سنة الإنتاج</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">المدة</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">الجودة</label>
            <select
              value={videoQuality}
              onChange={(e) => setVideoQuality(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white"
            >
              {QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">الفئة العمرية</label>
            <select
              value={ageRating}
              onChange={(e) => setAgeRating(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white"
            >
              {AGE_RATING_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">التقييم</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="10"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>

        {/* Genres */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-2">التصنيفات:</label>
          <div className="flex flex-wrap gap-1.5">
            {genreChoices.map((g) => {
              const active = selectedGenres.includes(g.slug);
              return (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => toggleGenre(g.slug)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-zinc-950 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  {g.nameAr}
                </button>
              );
            })}
          </div>
        </div>

        {/* Director & Cast */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">المخرج</label>
            <input
              type="text"
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              placeholder="اسم المخرج..."
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
            />
            {people.filter((p) => p.role !== 'actor').length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {people
                  .filter((p) => p.role !== 'actor')
                  .slice(0, 6)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDirector(p.name)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
                    >
                      + {p.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              أسماء الممثلين (افصل بينهم بفاصلة)
            </label>
            <input
              type="text"
              value={castInput}
              onChange={(e) => setCastInput(e.target.value)}
              placeholder="ممثل 1، ممثل 2، ..."
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
            />
            {people.filter((p) => p.role !== 'director').length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {people
                  .filter((p) => p.role !== 'director')
                  .slice(0, 8)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addCastChip(p.name)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
                    >
                      + {p.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Intro Timing & Order & Flags */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">
              بداية المقدمة (ثانية) - لتخطي المقدمة
            </label>
            <input
              type="number"
              value={introStart}
              onChange={(e) => setIntroStart(e.target.value)}
              placeholder="مثال: 5"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">
              نهاية المقدمة (ثانية)
            </label>
            <input
              type="number"
              value={introEnd}
              onChange={(e) => setIntroEnd(e.target.value)}
              placeholder="مثال: 75"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">ترتيب الظهور (0 = تلقائي)</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>

        {/* Flags */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/[0.06] text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-semibold">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="accent-amber-400 w-4 h-4"
            />
            <span>نشر الفيلم فوراً للزوار</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-semibold">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="accent-amber-400 w-4 h-4"
            />
            <span>فيلم مميز (Hero Banner)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-semibold">
            <input
              type="checkbox"
              checked={isLatest}
              onChange={(e) => setIsLatest(e.target.checked)}
              className="accent-amber-400 w-4 h-4"
            />
            <span>أحدث الإضافات</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-zinc-200 font-semibold">
            <input
              type="checkbox"
              checked={isMostWatched}
              onChange={(e) => setIsMostWatched(e.target.checked)}
              className="accent-amber-400 w-4 h-4"
            />
            <span>الأكثر مشاهدة</span>
          </label>
        </div>
      </div>

      {/* 4. Additional Playback Sources */}
      <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-white">
            <Link2 className="w-4 h-4 text-amber-400" />
            <span>روابط تشغيل متعددة (اختياري)</span>
          </div>
          <button
            type="button"
            onClick={addExtraSource}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-xs font-bold border border-white/10 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مصدر تشغيل</span>
          </button>
        </div>

        {extraSources.map((src, idx) => (
          <div key={src.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <input
              type="text"
              value={src.label}
              onChange={(e) =>
                setExtraSources((prev) =>
                  prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s))
                )
              }
              placeholder="اسم السيرفر"
              className="sm:col-span-3 bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white"
            />
            <input
              type="url"
              dir="ltr"
              value={src.url}
              onChange={(e) => {
                const nextUrl = e.target.value;
                setExtraSources((prev) =>
                  prev.map((s, i) =>
                    i === idx
                      ? {
                          ...s,
                          url: nextUrl,
                          format: isYouTubeUrl(nextUrl) ? 'youtube' : s.format,
                        }
                      : s
                  )
                );
              }}
              placeholder="https://..."
              className="sm:col-span-5 bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono"
            />
            <select
              value={src.format || 'mp4'}
              onChange={(e) =>
                setExtraSources((prev) =>
                  prev.map((s, i) => (i === idx ? { ...s, format: e.target.value } : s))
                )
              }
              className="sm:col-span-2 bg-zinc-950 border border-white/10 rounded-xl px-2 py-2 text-xs text-white"
            >
              <option value="mp4">MP4</option>
              <option value="hls">HLS (.m3u8)</option>
              <option value="webm">WebM</option>
              <option value="youtube">YouTube</option>
            </select>
            <input
              type="text"
              value={src.quality || ''}
              onChange={(e) =>
                setExtraSources((prev) =>
                  prev.map((s, i) => (i === idx ? { ...s, quality: e.target.value } : s))
                )
              }
              placeholder="720p HD"
              className="sm:col-span-1 bg-zinc-950 border border-white/10 rounded-xl px-2 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => setExtraSources((prev) => prev.filter((_, i) => i !== idx))}
              className="sm:col-span-1 h-9 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>جارٍ الحفظ في قاعدة البيانات... {activeTaskId ? '' : ''}</span>
          </>
        ) : (
          <>
            <Layers className="w-4 h-4" />
            <span>
              {uploadSourceMode === 'youtube'
                ? 'ربط الفيلم من يوتيوب ونشره في الموقع'
                : 'بدء الرفع وحفظ الفيلم في قاعدة البيانات'}
            </span>
          </>
        )}
      </button>

      {/* Local / YouTube Video Preview Modal */}
      {previewVideoSrc && (
        <div
          className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-[#111116] border border-white/15 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs sm:text-sm font-black text-white truncate">
                معاينة الفيديو: {previewTitle}
              </p>
              <button
                type="button"
                onClick={() => setPreviewVideoSrc(null)}
                className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-black aspect-video">
              {isYouTubeUrl(previewVideoSrc) ? (
                <iframe
                  src={getYouTubeEmbedUrl(previewVideoSrc, { autoplay: true }) || ''}
                  title={previewTitle || 'YouTube Preview'}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video src={previewVideoSrc} controls autoPlay className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
