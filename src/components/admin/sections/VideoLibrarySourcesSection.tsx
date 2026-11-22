import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  EyeOff,
  FolderOpen,
  HardDrive,
  Link2,
  Play,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import {
  bulkDeletePhysicalVideoFiles,
  deletePhysicalVideoFile,
  fetchAllSiteFiles,
  fetchPhysicalVideosLibrary,
  StreamTestResult,
  testStreamUrl,
} from '../../../services/adminService';
import {
  deleteMovieFromDatabases,
  formatFileSize,
  updateMovieInDatabases,
} from '../../../services/movieService';
import {
  MediaItem,
  PhysicalVideoFile,
  SiteFileEntry,
  VideoSourceOption,
} from '../../../types';
import { extractYouTubeVideoId, getYouTubeEmbedUrl, isYouTubeUrl } from '../../../utils/youtube';
import {
  isExternalHttpUrl,
  normalizeExternalHttpUrl,
  resolveMediaFormat,
} from '../../../utils/videoEngines';
import { VideoPlayer } from '../../player/VideoPlayer';

interface VideoLibrarySourcesSectionProps {
  mode: 'video_library' | 'playback_links';
  token: string;
  mediaItems: MediaItem[];
  onRefreshMedia: () => void;
}

export const VideoLibrarySourcesSection: React.FC<VideoLibrarySourcesSectionProps> = ({
  mode,
  token,
  mediaItems,
  onRefreshMedia,
}) => {
  // --- PHYSICAL VIDEO & ALL SITE FILES LIBRARY STATE ---
  const [libraryScope, setLibraryScope] = useState<'videos' | 'all_files'>('videos');
  const [files, setFiles] = useState<PhysicalVideoFile[]>([]);
  const [allSiteFiles, setAllSiteFiles] = useState<SiteFileEntry[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [deletingFileNames, setDeletingFileNames] = useState<string[]>([]);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [isBulkDeletingFiles, setIsBulkDeletingFiles] = useState<boolean>(false);

  // --- PLAYBACK LINKS STATE ---
  const [selectedMediaId, setSelectedMediaId] = useState<string>(mediaItems[0]?.id || '');
  const [sources, setSources] = useState<VideoSourceOption[]>([]);
  const [newLabel, setNewLabel] = useState<string>('مشغل GR');
  const [newUrl, setNewUrl] = useState<string>('');
  const [newFormat, setNewFormat] = useState<'mp4' | 'hls' | 'webm' | 'embed' | 'youtube'>('mp4');
  const [newQuality, setNewQuality] = useState<string>('1080p');
  const [testResults, setTestResults] = useState<Record<string, StreamTestResult>>({});
  const [testingUrlKey, setTestingUrlKey] = useState<string | null>(null);
  const [isSavingLinks, setIsSavingLinks] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const [videoList, fullFiles] = await Promise.all([
        fetchPhysicalVideosLibrary(token),
        fetchAllSiteFiles(token).catch(() => [] as SiteFileEntry[]),
      ]);
      setFiles(videoList);
      setAllSiteFiles(fullFiles);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'فشل تحميل مكتبة الملفات' });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (mode === 'video_library') {
      loadFiles();
    }
  }, [mode, token]);

  useEffect(() => {
    if (mediaItems.length === 0) {
      if (selectedMediaId) setSelectedMediaId('');
      return;
    }
    if (!selectedMediaId || !mediaItems.some((m) => m.id === selectedMediaId)) {
      setSelectedMediaId(mediaItems[0].id);
    }
  }, [mediaItems, selectedMediaId]);

  const selectedMedia =
    mediaItems.find((m) => m.id === selectedMediaId) || mediaItems[0] || null;

  useEffect(() => {
    if (selectedMedia) {
      const baseSources: VideoSourceOption[] =
        Array.isArray(selectedMedia.sources) && selectedMedia.sources.length > 0
          ? selectedMedia.sources
          : selectedMedia.videoUrl
          ? [
              {
                id: 'primary',
                label: `المصدر الرئيسي (${selectedMedia.videoQuality || 'HD'})`,
                url: selectedMedia.videoUrl,
                format: isYouTubeUrl(selectedMedia.videoUrl)
                  ? 'youtube'
                  : selectedMedia.videoUrl.includes('.m3u8')
                  ? 'hls'
                  : 'mp4',
                quality: selectedMedia.videoQuality || '1080p',
                isDefault: true,
              },
            ]
          : [];
      setSources(baseSources);
      setTestResults({});
    }
  }, [selectedMedia?.id, selectedMedia?.updatedAt]);

  const syncLinkedMediaAfterVideoDeletion = async (
    removedVideoUrls: Set<string>,
    serverResult: { deletedMovieIds: string[]; updatedMovies: MediaItem[] }
  ) => {
    const handledIds = new Set<string>([
      ...serverResult.deletedMovieIds,
      ...serverResult.updatedMovies.map((m) => m.id),
    ]);

    for (const delId of serverResult.deletedMovieIds) {
      const match = mediaItems.find((m) => m.id === delId) || ({ id: delId, titleAr: delId } as MediaItem);
      await deleteMovieFromDatabases(match, token).catch(() => {});
    }

    for (const m of mediaItems) {
      if (handledIds.has(m.id)) continue;
      const usesUrl =
        (m.videoUrl && removedVideoUrls.has(m.videoUrl)) ||
        (m.sources || []).some((s) => removedVideoUrls.has(s.url)) ||
        (m.seasons || []).some((sn) =>
          (sn.episodes || []).some((ep) => removedVideoUrls.has(ep.videoUrl))
        );
      if (!usesUrl) continue;

      const remainingSources = (m.sources || []).filter((s) => !removedVideoUrls.has(s.url));
      const remainingSeasons = (m.seasons || []).map((sn) => ({
        ...sn,
        episodes: (sn.episodes || []).filter((ep) => !removedVideoUrls.has(ep.videoUrl)),
      }));
      const epCount = remainingSeasons.reduce((acc, sn) => acc + sn.episodes.length, 0);

      if (m.type !== 'series') {
        const nextUrl = remainingSources[0]?.url || (!removedVideoUrls.has(m.videoUrl) ? m.videoUrl : '');
        if (!nextUrl) {
          await deleteMovieFromDatabases(m, token).catch(() => {});
        } else {
          await updateMovieInDatabases(
            m.id,
            { videoUrl: nextUrl, sources: remainingSources },
            token
          ).catch(() => {});
        }
      } else if (epCount === 0 && remainingSources.length === 0) {
        await deleteMovieFromDatabases(m, token).catch(() => {});
      } else {
        const nextUrl =
          remainingSeasons[0]?.episodes?.[0]?.videoUrl ||
          remainingSources[0]?.url ||
          (!removedVideoUrls.has(m.videoUrl) ? m.videoUrl : '');
        await updateMovieInDatabases(
          m.id,
          { videoUrl: nextUrl || '', sources: remainingSources, seasons: remainingSeasons },
          token
        ).catch(() => {});
      }
    }
  };

  const handleDeleteFileImmediate = async (file: PhysicalVideoFile) => {
    setDeletingFileNames((prev) => [...prev, file.fileName]);
    setSelectedFileNames((prev) => prev.filter((f) => f !== file.fileName));
    setFeedback(null);
    try {
      const res = await deletePhysicalVideoFile(token, file.fileName);
      setFiles((prev) => prev.filter((f) => f.fileName !== file.fileName));
      await syncLinkedMediaAfterVideoDeletion(new Set([file.videoUrl]), res);
      onRefreshMedia();
      setFeedback({
        type: 'success',
        msg: `تم حذف الفيديو "${file.fileName}" وإزالة ارتباطاته من الموقع بالكامل`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر حذف الملف' });
    } finally {
      setDeletingFileNames((prev) => prev.filter((f) => f !== file.fileName));
    }
  };

  const handleBulkDeleteFilesImmediate = async () => {
    const targets = files.filter((f) => selectedFileNames.includes(f.fileName));
    if (targets.length === 0) return;
    setIsBulkDeletingFiles(true);
    setFeedback(null);
    try {
      const names = targets.map((t) => t.fileName);
      const res = await bulkDeletePhysicalVideoFiles(token, names);
      setFiles((prev) => prev.filter((f) => !names.includes(f.fileName)));
      setSelectedFileNames([]);
      await syncLinkedMediaAfterVideoDeletion(new Set(targets.map((t) => t.videoUrl)), res);
      onRefreshMedia();
      setFeedback({
        type: 'success',
        msg: `تم حذف ${targets.length} ملفات فيديو وإزالة ارتباطاتها من الموقع بالكامل`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر حذف الملفات المحددة' });
    } finally {
      setIsBulkDeletingFiles(false);
    }
  };

  const handleRunTestUrl = async (key: string, rawUrl: string) => {
    const url = normalizeExternalHttpUrl(rawUrl);
    setTestingUrlKey(key);
    try {
      const ytId = extractYouTubeVideoId(url);
      if (ytId) {
        setTestResults((prev) => ({
          ...prev,
          [key]: {
            ok: true,
            status: 200,
            format: `YouTube (${ytId})`,
            supportsRange: true,
          },
        }));
        return;
      }
      const result = await testStreamUrl(token, url);
      setTestResults((prev) => ({ ...prev, [key]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [key]: { ok: false, error: err?.message || 'تعذر اختبار الرابط' },
      }));
    } finally {
      setTestingUrlKey(null);
    }
  };

  const saveSourcesList = async (nextSources: VideoSourceOption[], message: string) => {
    if (!selectedMedia) return;
    setIsSavingLinks(true);
    setFeedback(null);
    const defaultSrc = nextSources.find((s) => s.isDefault) || nextSources[0];
    try {
      await updateMovieInDatabases(
        selectedMedia.id,
        {
          sources: nextSources,
          videoUrl: defaultSrc?.url || '',
        },
        token
      );
      setSources(nextSources);
      setFeedback({ type: 'success', msg: message });
      onRefreshMedia();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر حفظ روابط التشغيل' });
    } finally {
      setIsSavingLinks(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const trimmed = normalizeExternalHttpUrl(newUrl);
    const effectiveFormat = isYouTubeUrl(trimmed) ? 'youtube' : newFormat;
    const item: VideoSourceOption = {
      id: `src-${Date.now()}`,
      label: newLabel.trim() || `سيرفر ${sources.length + 1}`,
      url: trimmed,
      format: effectiveFormat,
      quality: newQuality,
      isDefault: sources.length === 0,
    };
    await saveSourcesList([...sources, item], 'تمت إضافة مصدر التشغيل بنجاح');
    setNewUrl('');
  };

  if (mode === 'video_library') {
    const activeFilesCount = libraryScope === 'all_files' ? allSiteFiles.length : files.length;
    const totalBytes =
      libraryScope === 'all_files'
        ? allSiteFiles.reduce((s, f) => s + f.sizeBytes, 0)
        : files.reduce((s, f) => s + f.sizeBytes, 0);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#ff45a2]" />
              <span>
                {libraryScope === 'all_files'
                  ? `جميع ملفات الموقع والمخفية (${activeFilesCount})`
                  : `مكتبة ملفات الفيديو على الخادم (${activeFilesCount})`}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              إجمالي المساحة المستهلكة: {formatFileSize(totalBytes)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center p-1 rounded-full bg-[#121215] border border-white/[0.08] text-xs font-bold">
              <button
                type="button"
                onClick={() => setLibraryScope('videos')}
                className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                  libraryScope === 'videos'
                    ? 'bg-[#ff2e93] text-white font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                الفيديوهات ({files.length})
              </button>
              <button
                type="button"
                onClick={() => setLibraryScope('all_files')}
                className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                  libraryScope === 'all_files'
                    ? 'bg-[#ff2e93] text-white font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                كل الملفات والمخفية ({allSiteFiles.length})
              </button>
            </div>
            <button
              type="button"
              onClick={loadFiles}
              className="px-3.5 py-2 rounded-full bg-[#16161a] hover:bg-[#202026] text-xs font-bold text-zinc-200 border border-white/[0.08] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin text-[#ff45a2]' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{feedback.msg}</span>
            <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedFileNames.length > 0 && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-rose-200">
              تم تحديد {selectedFileNames.length} ملفات فيديو
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedFileNames([])}
                className="px-3 py-1.5 rounded-full bg-[#1a1a20] text-zinc-300 hover:text-white font-bold cursor-pointer"
              >
                إلغاء التحديد
              </button>
              <button
                type="button"
                disabled={isBulkDeletingFiles}
                onClick={handleBulkDeleteFilesImmediate}
                className="px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isBulkDeletingFiles ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>حذف المحدد نهائياً</span>
              </button>
            </div>
          </div>
        )}

        {libraryScope === 'all_files' ? (
          isLoadingFiles ? (
            <div className="py-16 text-center text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff45a2]" />
              <p className="text-xs">جارٍ فحص جميع ملفات الموقع والمخفية...</p>
            </div>
          ) : allSiteFiles.length === 0 ? (
            <div className="py-14 text-center rounded-2xl bg-[#121215] border border-white/[0.07] text-zinc-500">
              <HardDrive className="w-9 h-9 mx-auto mb-2 text-zinc-600" />
              <p className="text-sm font-bold text-zinc-300">لا توجد ملفات مخزنة على الخادم حالياً</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#121215] border border-white/[0.07] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-[#0b0b0e] text-[11px] font-black text-zinc-400">
                      <th className="py-3 px-3">المسار / اسم الملف</th>
                      <th className="py-3 px-3">المجلد</th>
                      <th className="py-3 px-3">الحالة</th>
                      <th className="py-3 px-3">الحجم</th>
                      <th className="py-3 px-3">الأعمال المرتبطة</th>
                      <th className="py-3 px-3">معاينة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {allSiteFiles.map((sf) => (
                      <tr key={sf.relativePath} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-mono text-zinc-200 max-w-xs truncate">
                          {sf.relativePath}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400">{sf.folder}</td>
                        <td className="py-3 px-3">
                          {sf.isHiddenFile ? (
                            <span className="inline-flex items-center gap-1 text-[#ff5ec4] text-[11px] font-bold">
                              <EyeOff className="w-3 h-3" />
                              <span>غير مرتبط</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px] font-bold">ظاهر ومنشور</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-[#ff5ec4] font-bold whitespace-nowrap">
                          {formatFileSize(sf.sizeBytes)}
                        </td>
                        <td className="py-3 px-3">
                          {sf.linkedMediaTitles.length > 0 ? (
                            <span className="text-zinc-300">{sf.linkedMediaTitles.join('، ')}</span>
                          ) : (
                            <span className="text-zinc-500">غير مرتبط</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => setPreviewSrc(sf.url)}
                            className="px-3 py-1.5 rounded-full bg-[#ff2e93]/15 hover:bg-[#ff2e93] text-[#ff5ec4] hover:text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>فتح</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : isLoadingFiles ? (
          <div className="py-16 text-center text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff45a2]" />
            <p className="text-xs">جارٍ فحص مساحة التخزين...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="py-14 text-center rounded-2xl bg-[#121215] border border-white/[0.07] text-zinc-500">
            <HardDrive className="w-9 h-9 mx-auto mb-2 text-zinc-600" />
            <p className="text-sm font-bold text-zinc-300">لا توجد ملفات فيديو مرفوعة محلياً بعد</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#121215] border border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-[#0b0b0e] text-[11px] font-black text-zinc-400">
                    <th className="py-3 px-3 w-9">
                      <input
                        type="checkbox"
                        checked={
                          files.length > 0 &&
                          files.every((f) => selectedFileNames.includes(f.fileName))
                        }
                        onChange={() => {
                          if (files.every((f) => selectedFileNames.includes(f.fileName))) {
                            setSelectedFileNames([]);
                          } else {
                            setSelectedFileNames(files.map((f) => f.fileName));
                          }
                        }}
                        className="accent-[#ff2e93] cursor-pointer"
                        title="تحديد الكل"
                      />
                    </th>
                    <th className="py-3 px-3">اسم الملف</th>
                    <th className="py-3 px-3">الحجم</th>
                    <th className="py-3 px-3">الأعمال المرتبطة</th>
                    <th className="py-3 px-3">تاريخ الرفع</th>
                    <th className="py-3 px-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {files.map((file) => {
                    const clientLinkedTitles = mediaItems
                      .filter(
                        (m) =>
                          m.videoUrl === file.videoUrl ||
                          (m.sources || []).some((s) => s.url === file.videoUrl) ||
                          (m.seasons || []).some((sn) =>
                            (sn.episodes || []).some((ep) => ep.videoUrl === file.videoUrl)
                          )
                      )
                      .map((m) => m.titleAr || m.title);
                    const combinedTitles = Array.from(
                      new Set([...(file.linkedMediaTitles || []), ...clientLinkedTitles])
                    );

                    return (
                      <tr key={file.fileName} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 w-9">
                          <input
                            type="checkbox"
                            checked={selectedFileNames.includes(file.fileName)}
                            onChange={() =>
                              setSelectedFileNames((prev) =>
                                prev.includes(file.fileName)
                                  ? prev.filter((x) => x !== file.fileName)
                                  : [...prev, file.fileName]
                              )
                            }
                            className="accent-[#ff2e93] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-200 max-w-xs truncate">
                          {file.fileName}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-[#ff5ec4] font-bold whitespace-nowrap">
                          {formatFileSize(file.sizeBytes)}
                        </td>
                        <td className="py-3 px-3">
                          {combinedTitles.length > 0 ? (
                            <span className="text-emerald-400 text-[11px] font-bold">
                              {combinedTitles.join(' · ')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-500">غير مرتبط بأي عمل</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          {new Date(file.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewSrc(file.videoUrl)}
                              className="px-3 py-1.5 rounded-full bg-[#ff2e93]/15 hover:bg-[#ff2e93] text-[#ff5ec4] hover:text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>معاينة</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingFileNames.includes(file.fileName)}
                              onClick={() => handleDeleteFileImmediate(file)}
                              className="w-7 h-7 rounded-full bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 flex items-center justify-center cursor-pointer disabled:opacity-50"
                              title="حذف الفيديو من الخادم والموقع فوراً"
                            >
                              {deletingFileNames.includes(file.fileName) ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {previewSrc && (
          <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#161619] border border-white/[0.1] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-300 truncate">{previewSrc}</span>
                <button
                  type="button"
                  onClick={() => setPreviewSrc(null)}
                  className="w-8 h-8 rounded-full bg-[#222227] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-black aspect-video flex items-center justify-center">
                {isYouTubeUrl(previewSrc) ? (
                  <iframe
                    src={getYouTubeEmbedUrl(previewSrc, { autoplay: true }) || ''}
                    title="YouTube Preview"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : /\.(png|jpe?g|webp|gif|svg)$/i.test(previewSrc) ? (
                  <img src={previewSrc} alt="Preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <video src={previewSrc} controls autoPlay className="w-full h-full object-contain" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- PLAYBACK LINKS & LIVE STREAM URL TESTER ---
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-[#ff45a2]" />
          <span>إدارة روابط ومصادر التشغيل</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          إضافة مصادر MP4 أو HLS متعددة لكل عمل، تعيين المصدر الافتراضي، واختبار صلاحية البث فعلياً
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Select Media */}
      <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07]">
        <label className="block text-xs font-bold text-zinc-300 mb-1.5">
          اختر الفيلم أو المسلسل لإدارة مصادره:
        </label>
        <select
          value={selectedMedia?.id || ''}
          onChange={(e) => setSelectedMediaId(e.target.value)}
          className="w-full bg-[#08080a] border border-white/[0.09] rounded-xl px-3 py-2.5 text-xs text-white font-bold"
        >
          {mediaItems.map((m) => (
            <option key={m.id} value={m.id}>
              {m.titleAr} ({m.type === 'series' ? 'مسلسل' : 'فيلم'} · {m.year})
            </option>
          ))}
        </select>
      </div>

      {selectedMedia && (
        <>
          {/* Add Source Form */}
          <form
            onSubmit={handleAddSource}
            className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-black text-[#ff5ec4]">إضافة مصدر تشغيل جديد</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewLabel('مشغل GR')}
                  className="px-3 py-1 rounded-full bg-[#ff2e93]/15 hover:bg-[#ff2e93]/25 text-[#ff5ec4] font-bold text-[11px] cursor-pointer"
                >
                  مشغل GR
                </button>
                <button
                  type="button"
                  onClick={() => setNewLabel('مشغل G')}
                  className="px-3 py-1 rounded-full bg-[#1a1a20] hover:bg-[#25252d] text-zinc-200 font-bold text-[11px] cursor-pointer"
                >
                  مشغل G
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="اسم المصدر (مثال: مشغل GR أو مشغل G)"
                className="sm:col-span-3 bg-[#08080a] border border-white/[0.09] rounded-xl px-3 py-2 text-white"
              />
              <input
                type="text"
                dir="ltr"
                required
                value={newUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  const clean = normalizeExternalHttpUrl(val);
                  const nextVal = /<(?:iframe|embed)\b/i.test(val) && clean ? clean : val;
                  setNewUrl(nextVal);
                  if (nextVal.trim()) {
                    setNewFormat(resolveMediaFormat(nextVal));
                  }
                }}
                placeholder="رابط الفيديو أو الموقع (MP4 / M3U8 / YouTube / Embed / <iframe>)"
                className="sm:col-span-5 bg-[#08080a] border border-white/[0.09] rounded-xl px-3 py-2 text-white font-mono"
              />
              <select
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value as any)}
                className="sm:col-span-2 bg-[#08080a] border border-white/[0.09] rounded-xl px-2.5 py-2 text-white"
              >
                <option value="mp4">MP4</option>
                <option value="hls">HLS (.m3u8)</option>
                <option value="webm">WebM</option>
                <option value="embed">مشغل مدمج (Embed)</option>
                <option value="youtube">YouTube</option>
              </select>
              <input
                type="text"
                value={newQuality}
                onChange={(e) => setNewQuality(e.target.value)}
                placeholder="1080p"
                className="sm:col-span-2 bg-[#08080a] border border-white/[0.09] rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isSavingLinks}
                className="px-4 py-2 rounded-full bg-[#ff2e93] hover:bg-[#ff47a1] text-white font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة وحفظ المصدر</span>
              </button>
              {newUrl.trim() && (
                <>
                  <button
                    type="button"
                    onClick={() => handleRunTestUrl('draft', newUrl.trim())}
                    className="px-4 py-2 rounded-full bg-[#1a1a20] hover:bg-[#25252d] text-sky-300 font-bold border border-white/[0.08] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>اختبار واستخراج الرابط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSrc(normalizeExternalHttpUrl(newUrl))}
                    className="px-4 py-2 rounded-full bg-[#1a1a20] hover:bg-[#25252d] text-[#ff5ec4] font-bold border border-white/[0.08] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>تشغيل معاينة</span>
                  </button>
                </>
              )}
            </div>

            {testResults['draft'] && (
              <div
                className={`p-2.5 rounded-xl border text-[11px] font-mono ${
                  testResults['draft'].ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResults['draft'].ok
                  ? `الرابط يعمل (HTTP ${testResults['draft'].status}) · الصيغة: ${testResults['draft'].format} · Range: ${testResults['draft'].supportsRange ? 'نعم' : 'لا'}${
                      testResults['draft'].extractedStreams?.length
                        ? ` · بثوث مستخرجة: ${testResults['draft'].extractedStreams.length}`
                        : ''
                    }`
                  : testResults['draft'].error}
              </div>
            )}
          </form>

          {/* Existing Sources List */}
          <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-2.5">
            <h3 className="text-xs font-black text-white">
              مصادر التشغيل الحالية ({sources.length})
            </h3>
            {sources.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                لا توجد روابط تشغيل مضافة لهذا العمل بعد.
              </p>
            ) : (
              sources.map((src, idx) => {
                const key = src.id || String(idx);
                const result = testResults[key];
                return (
                  <div
                    key={key}
                    className="p-3 rounded-xl bg-[#0b0b0e] border border-white/[0.05] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-black text-white">{src.label}</span>
                          <span className="text-[11px] font-mono text-zinc-400 uppercase">
                            · {src.format || 'mp4'}
                          </span>
                          {src.quality && (
                            <span className="text-[11px] font-mono text-sky-400">
                              · {src.quality}
                            </span>
                          )}
                          {src.isDefault && (
                            <span className="text-[11px] text-[#ff5ec4] font-bold">
                              · المصدر الافتراضي
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-zinc-400 truncate mt-1" dir="ltr">
                          {src.url}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={testingUrlKey === key}
                          onClick={() => handleRunTestUrl(key, src.url)}
                          className="px-3 py-1.5 rounded-full bg-[#1a1a20] hover:bg-[#25252d] text-sky-300 text-[11px] font-bold border border-white/[0.08] flex items-center gap-1 cursor-pointer"
                        >
                          {testingUrlKey === key ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wifi className="w-3 h-3" />
                          )}
                          <span>اختبار الرابط</span>
                        </button>

                        {!src.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = sources.map((s, i) => ({
                                ...s,
                                isDefault: i === idx,
                              }));
                              saveSourcesList(next, 'تم تعيين المصدر كرابط افتراضي');
                            }}
                            className="px-3 py-1.5 rounded-full bg-[#ff2e93]/15 hover:bg-[#ff2e93]/25 text-[#ff5ec4] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Star className="w-3 h-3" />
                            <span>افتراضي</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const next = sources.filter((_, i) => i !== idx);
                            saveSourcesList(next, 'تم حذف مصدر التشغيل');
                          }}
                          className="w-7 h-7 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
                          title="حذف الرابط"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {result && (
                      <div
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-2 ${
                          result.ok
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {result.ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          {result.ok
                            ? `صالح (HTTP ${result.status}) · ${result.format} · Range: ${result.supportsRange ? 'مدعوم' : 'غير مدعوم'}`
                            : result.error}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {previewSrc && selectedMedia && isExternalHttpUrl(previewSrc) && (
            <VideoPlayer
              media={{
                ...selectedMedia,
                videoUrl: previewSrc,
                sources: [
                  {
                    id: 'preview-source',
                    label: newLabel || 'معاينة المصدر',
                    url: previewSrc,
                    format: resolveMediaFormat(previewSrc),
                    quality: newQuality || 'HD',
                    isDefault: true,
                  },
                ],
              }}
              onClose={() => setPreviewSrc(null)}
            />
          )}
        </>
      )}
    </div>
  );
};
