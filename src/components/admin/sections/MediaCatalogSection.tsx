import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Eye,
  EyeOff,
  Film,
  Flame,
  Layers,
  Play,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import { CategoryItem, MediaItem, MediaType } from '../../../types';
import {
  deleteMovieFromDatabases,
  deleteMoviesBatchFromDatabases,
  formatAdminErrorMessage,
  formatFileSize,
  updateMovieInDatabases,
} from '../../../services/movieService';
import { getYouTubeThumbnailUrl, isYouTubeUrl } from '../../../utils/youtube';

interface MediaCatalogSectionProps {
  mode: 'movie' | 'series';
  mediaItems: MediaItem[];
  categories: CategoryItem[];
  token: string;
  isLoading: boolean;
  onRefresh: () => void;
  onAddNew: () => void;
  onManageSeasons?: (seriesId: string) => void;
  onPlayMedia?: (media: MediaItem) => void;
}

export const MediaCatalogSection: React.FC<MediaCatalogSectionProps> = ({
  mode,
  mediaItems,
  categories,
  token,
  isLoading,
  onRefresh,
  onAddNew,
  onManageSeasons,
  onPlayMedia,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'hidden'>('all');

  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const baseList = useMemo(() => {
    if (mode === 'series') {
      return mediaItems.filter((m) => m.type === 'series');
    }
    return mediaItems.filter((m) => m.type !== 'series');
  }, [mediaItems, mode]);

  const availableYears = useMemo(() => {
    const yrs = Array.from(new Set(baseList.map((m) => Number(m.year)).filter(Boolean)));
    return yrs.sort((a, b) => b - a);
  }, [baseList]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseList.filter((m) => {
      if (
        q &&
        !(m.titleAr || '').toLowerCase().includes(q) &&
        !(m.title || '').toLowerCase().includes(q) &&
        !(m.director || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filterGenre !== 'all' && !(m.genres || []).includes(filterGenre)) {
        return false;
      }
      if (filterYear !== 'all' && String(m.year) !== filterYear) {
        return false;
      }
      if (filterStatus === 'published' && m.isPublished === false) {
        return false;
      }
      if (filterStatus === 'hidden' && m.isPublished !== false) {
        return false;
      }
      return true;
    });
  }, [baseList, searchQuery, filterGenre, filterYear, filterStatus]);

  const quickUpdate = async (item: MediaItem, updates: Partial<MediaItem>) => {
    setActionError(null);
    try {
      await updateMovieInDatabases(item.id, updates, token);
      onRefresh();
    } catch (err: any) {
      setActionError(formatAdminErrorMessage(err, 'تعذر تحديث البيانات'));
    }
  };

  const handleImmediateDelete = async (item: MediaItem) => {
    setDeletingIds((prev) => [...prev, item.id]);
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    setActionError(null);
    try {
      await deleteMovieFromDatabases(item, token);
      onRefresh();
    } catch (err: any) {
      setActionError(formatAdminErrorMessage(err, 'فشل حذف المحتوى'));
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const handleBulkDeleteImmediate = async () => {
    const targets = filtered.filter((m) => selectedIds.includes(m.id));
    if (targets.length === 0) return;
    setIsBulkDeleting(true);
    setActionError(null);
    try {
      await deleteMoviesBatchFromDatabases(targets, token);
      setSelectedIds([]);
      onRefresh();
    } catch (err: any) {
      setActionError(formatAdminErrorMessage(err, 'فشل حذف الأعمال المحددة'));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const visibleSet = new Set(filtered.map((m) => m.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filtered.map((m) => m.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingEdit(true);
    setActionError(null);
    try {
      const nextVideoUrl = (editingItem.videoUrl || '').trim();
      const isYt = isYouTubeUrl(nextVideoUrl);
      const nextPoster =
        (editingItem.posterUrl || '').trim() ||
        (isYt ? getYouTubeThumbnailUrl(nextVideoUrl, 'hq') || '' : '');

      const cleanTitleAr =
        (editingItem.titleAr || '').trim() || (editingItem.title || '').trim() || 'عمل سينمائي';

      await updateMovieInDatabases(
        editingItem.id,
        {
          titleAr: cleanTitleAr,
          title: (editingItem.title || '').trim() || cleanTitleAr,
          type: editingItem.type as MediaType,
          description: editingItem.description || '',
          posterUrl: nextPoster,
          bannerUrl: (editingItem.bannerUrl || '').trim() || nextPoster,
          videoUrl: nextVideoUrl,
          isComingSoon: !nextVideoUrl && editingItem.type !== 'series',
          storageType: isYt ? 'youtube' : editingItem.storageType || 'server',
          year: Number(editingItem.year) || new Date().getFullYear(),
          duration: editingItem.duration || '120 دقيقة',
          videoQuality: editingItem.videoQuality || '1080p',
          ageRating: editingItem.ageRating || '+16',
          rating: Number(editingItem.rating) || 8.5,
          director: editingItem.director || '',
          displayOrder: Number(editingItem.displayOrder) || 0,
          isPublished: editingItem.isPublished,
          isFeatured: Boolean(editingItem.isFeatured),
          isLatest: editingItem.isLatest !== false,
          isMostWatched: Boolean(editingItem.isMostWatched),
          genres: Array.isArray(editingItem.genres) ? editingItem.genres : ['action'],
        },
        token
      );
      setEditingItem(null);
      onRefresh();
    } catch (err: any) {
      setActionError(formatAdminErrorMessage(err, 'تعذر حفظ التعديلات'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            {mode === 'series' ? (
              <Tv className="w-5 h-5 text-sky-400" />
            ) : (
              <Film className="w-5 h-5 text-amber-400" />
            )}
            <span>
              {mode === 'series' ? 'إدارة المسلسلات' : 'إدارة الأفلام'} ({filtered.length})
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            بحث، فلترة، تعديل، نشر وإخفاء، وترتيب الظهور والمحتوى المميز
          </p>
        </div>

        <button
          type="button"
          onClick={onAddNew}
          className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{mode === 'series' ? 'إضافة مسلسل جديد' : 'إضافة فيلم جديد'}</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-3 rounded-2xl bg-[#111116] border border-white/[0.08]">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم العربي أو الإنجليزي..."
            className="w-full bg-zinc-950 border border-white/10 focus:border-amber-400 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none"
          />
        </div>

        <select
          value={filterGenre}
          onChange={(e) => setFilterGenre(e.target.value)}
          className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="all">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.nameAr}
            </option>
          ))}
        </select>

        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="all">كل السنوات</option>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="all">كل الحالات</option>
          <option value="published">منشور</option>
          <option value="hidden">مخفي</option>
        </select>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-rose-200">
            تم تحديد {selectedIds.length} {mode === 'series' ? 'مسلسلات' : 'أفلام'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white font-bold cursor-pointer"
            >
              إلغاء التحديد
            </button>
            <button
              type="button"
              disabled={isBulkDeleting}
              onClick={handleBulkDeleteImmediate}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isBulkDeleting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>حذف المحدد نهائياً من الموقع</span>
            </button>
          </div>
        </div>
      )}

      {/* Table (Desktop) & Cards (Mobile) */}
      {isLoading ? (
        <div className="py-16 text-center text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
          <p className="text-xs">جارٍ تحميل المحتوى...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center rounded-2xl bg-[#111116] border border-white/[0.08] text-zinc-500">
          <p className="text-sm font-bold text-zinc-300">لا توجد نتائج مطابقة</p>
          <p className="text-xs mt-1">أضف محتوى جديداً أو قم بتعديل معايير البحث والفلترة</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#111116] border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-zinc-950/60 text-[11px] font-black text-zinc-400">
                  <th className="py-3 px-3 w-9">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="accent-amber-400 cursor-pointer"
                      title="تحديد الكل"
                    />
                  </th>
                  <th className="py-3 px-3">العمل</th>
                  <th className="py-3 px-3">السنة والجودة</th>
                  <th className="py-3 px-3">المشاهدات</th>
                  <th className="py-3 px-3">الترتيب</th>
                  <th className="py-3 px-3">الظهور والتمييز</th>
                  <th className="py-3 px-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {filtered.map((item) => {
                  const totalEps = (item.seasons || []).reduce(
                    (sum, s) => sum + (s.episodes?.length || 0),
                    0
                  );
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 w-9">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelectOne(item.id)}
                          className="accent-amber-400 cursor-pointer"
                          aria-label={`تحديد ${item.titleAr}`}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3 min-w-[210px]">
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt={item.titleAr}
                              className="w-10 h-14 rounded-lg object-cover bg-zinc-900 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-amber-400/60 shrink-0">
                              <Film className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-black text-white truncate max-w-[200px]">
                              {item.titleAr || item.title}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                              {item.title}
                            </p>
                            {mode === 'series' ? (
                              <span className="text-[10px] text-sky-400 font-mono">
                                {(item.seasons || []).length} مواسم • {totalEps} حلقة
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {item.fileSizeBytes ? formatFileSize(item.fileSizeBytes) : item.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-zinc-300 whitespace-nowrap">
                        <div>{item.year}</div>
                        <div className="text-amber-400 font-bold">{item.videoQuality || 'HD'}</div>
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums text-zinc-300 whitespace-nowrap">
                        {(item.viewsCount || 0).toLocaleString('en-US')}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              quickUpdate(item, {
                                displayOrder: Math.max(0, (item.displayOrder || 0) - 1),
                              })
                            }
                            className="w-6 h-6 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                            title="تقديم الترتيب"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono text-[11px] text-zinc-300">
                            {item.displayOrder || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              quickUpdate(item, {
                                displayOrder: (item.displayOrder || 0) + 1,
                              })
                            }
                            className="w-6 h-6 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                            title="تأخير الترتيب"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              quickUpdate(item, { isPublished: !(item.isPublished !== false) })
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer border ${
                              item.isPublished !== false
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-900 text-zinc-400 border-white/10'
                            }`}
                          >
                            {item.isPublished !== false ? (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>منشور</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>مخفي</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => quickUpdate(item, { isFeatured: !item.isFeatured })}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer border ${
                              item.isFeatured
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                : 'bg-zinc-900 text-zinc-500 border-white/10'
                            }`}
                            title="تعيين كعمل مميز في البانر الرئيسي"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>مميز</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => quickUpdate(item, { isLatest: !(item.isLatest !== false) })}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer border ${
                              item.isLatest !== false
                                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                : 'bg-zinc-900 text-zinc-500 border-white/10'
                            }`}
                            title="تضمين في أحدث الإضافات"
                          >
                            <Flame className="w-3 h-3" />
                            <span>أحدث</span>
                          </button>

                          {!item.videoUrl && item.type !== 'series' && (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              قريباً
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {onPlayMedia && (
                            <button
                              type="button"
                              onClick={() => onPlayMedia(item)}
                              className="w-7 h-7 rounded-lg bg-amber-400/15 hover:bg-amber-400 text-amber-400 hover:text-black flex items-center justify-center cursor-pointer transition-colors"
                              title="معاينة وتشغيل"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}

                          {mode === 'series' && onManageSeasons && (
                            <button
                              type="button"
                              onClick={() => onManageSeasons(item.id)}
                              className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              title="إدارة المواسم والحلقات"
                            >
                              <Layers className="w-3 h-3" />
                              <span>الحلقات</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setEditingItem({ ...item })}
                            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center border border-white/10 cursor-pointer"
                            title="تعديل البيانات"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={deletingIds.includes(item.id)}
                            onClick={() => handleImmediateDelete(item)}
                            className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 flex items-center justify-center cursor-pointer disabled:opacity-50"
                            title="حذف الفيديو فوراً من الموقع"
                          >
                            {deletingIds.includes(item.id) ? (
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

      {/* Edit Modal */}
      {editingItem && (
        <div
          className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          <form
            onSubmit={handleSaveEdit}
            className="bg-[#111116] border border-white/15 rounded-2xl w-full max-w-2xl p-5 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white">
                تعديل بيانات: {editingItem.titleAr}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">الاسم بالعربية</label>
                <input
                  type="text"
                  required
                  value={editingItem.titleAr}
                  onChange={(e) => setEditingItem({ ...editingItem, titleAr: e.target.value })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  dir="ltr"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">رابط البوستر</label>
                <input
                  type="url"
                  dir="ltr"
                  value={editingItem.posterUrl}
                  onChange={(e) => setEditingItem({ ...editingItem, posterUrl: e.target.value })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">رابط الخلفية (Banner)</label>
                <input
                  type="url"
                  dir="ltr"
                  value={editingItem.bannerUrl || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, bannerUrl: e.target.value })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-zinc-400 mb-1 font-bold">
                  رابط الفيديو أو يوتيوب (YouTube / MP4 / HLS)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={editingItem.videoUrl || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, videoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... أو /uploads/videos/..."
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">السنة</label>
                <input
                  type="number"
                  value={editingItem.year}
                  onChange={(e) => setEditingItem({ ...editingItem, year: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">الجودة</label>
                <input
                  type="text"
                  value={editingItem.videoQuality || ''}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, videoQuality: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">المخرج</label>
                <input
                  type="text"
                  value={editingItem.director || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, director: e.target.value })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">ترتيب الظهور</label>
                <input
                  type="number"
                  value={editingItem.displayOrder || 0}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, displayOrder: Number(e.target.value) })
                  }
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block text-zinc-400 mb-1 font-bold">الوصف</label>
              <textarea
                rows={3}
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="text-xs">
              <label className="block text-zinc-400 mb-1.5 font-bold">التصنيفات</label>
              <div className="flex flex-wrap gap-1.5">
                {(categories.length > 0
                  ? categories.map((c) => ({ slug: c.slug, nameAr: c.nameAr }))
                  : [
                      { slug: 'action', nameAr: 'أكشن' },
                      { slug: 'drama', nameAr: 'دراما' },
                      { slug: 'sci-fi', nameAr: 'خيال علمي' },
                      { slug: 'horror', nameAr: 'رعب وتشويق' },
                      { slug: 'comedy', nameAr: 'كوميديا' },
                      { slug: 'adventure', nameAr: 'مغامرات' },
                      { slug: 'crime', nameAr: 'جريمة' },
                      { slug: 'romance', nameAr: 'رومانسي' },
                      { slug: 'anime', nameAr: 'أنمي' },
                    ]
                ).map((g) => {
                  const curGenres = Array.isArray(editingItem.genres) ? editingItem.genres : [];
                  const active = curGenres.includes(g.slug);
                  return (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? curGenres.length > 1
                            ? curGenres.filter((x) => x !== g.slug)
                            : curGenres
                          : [...curGenres, g.slug];
                        setEditingItem({ ...editingItem, genres: next });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
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

            <div className="flex flex-wrap gap-4 text-xs text-zinc-200 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.isPublished !== false}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, isPublished: e.target.checked })
                  }
                  className="accent-amber-400"
                />
                <span>منشور</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingItem.isFeatured)}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, isFeatured: e.target.checked })
                  }
                  className="accent-amber-400"
                />
                <span>مميز</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.isLatest !== false}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, isLatest: e.target.checked })
                  }
                  className="accent-amber-400"
                />
                <span>أحدث الإضافات</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingItem.isMostWatched)}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, isMostWatched: e.target.checked })
                  }
                  className="accent-amber-400"
                />
                <span>الأكثر مشاهدة</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-xs font-bold border border-white/10 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs cursor-pointer disabled:opacity-60"
              >
                {isSavingEdit ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
