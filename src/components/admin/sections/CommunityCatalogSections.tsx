import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  Edit3,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  Tags,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  createAdminNotification,
  createCategory,
  createPerson,
  deleteAdminComment,
  deleteAdminNotification,
  deleteCategory,
  deletePerson,
  fetchAdminComments,
  fetchAdminNotifications,
  updateAdminComment,
  updateAdminNotification,
  updateCategory,
  updatePerson,
} from '../../../services/adminService';
import { CategoryItem, CommentItem, NotificationItem, PersonItem } from '../../../types';
import { AdminConfirmDialog } from '../AdminConfirmDialog';

interface CommunityCatalogSectionsProps {
  mode: 'categories' | 'cast_directors' | 'comments_ratings' | 'notifications';
  token: string;
  categories: CategoryItem[];
  people: PersonItem[];
  onRefreshCategories: () => void;
  onRefreshPeople: () => void;
  onCategoriesUpdated?: () => void;
}

export const CommunityCatalogSections: React.FC<CommunityCatalogSectionsProps> = ({
  mode,
  token,
  categories,
  people,
  onRefreshCategories,
  onRefreshPeople,
  onCategoriesUpdated,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Categories State
  const [catNameAr, setCatNameAr] = useState<string>('');
  const [catNameEn, setCatNameEn] = useState<string>('');
  const [catSlug, setCatSlug] = useState<string>('');
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);

  // People State
  const [personName, setPersonName] = useState<string>('');
  const [personRole, setPersonRole] = useState<'actor' | 'director' | 'both'>('actor');
  const [personNationality, setPersonNationality] = useState<string>('');
  const [personAvatarUrl, setPersonAvatarUrl] = useState<string>('');
  const [personBio, setPersonBio] = useState<string>('');
  const [personSearch, setPersonSearch] = useState<string>('');
  const [editingPerson, setEditingPerson] = useState<PersonItem | null>(null);

  // Comments State
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentFilter, setCommentFilter] = useState<'all' | 'approved' | 'pending' | 'hidden'>('all');
  const [loadingComments, setLoadingComments] = useState<boolean>(false);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifMessage, setNotifMessage] = useState<string>('');
  const [notifType, setNotifType] = useState<'info' | 'new_release' | 'alert'>('new_release');
  const [notifTarget, setNotifTarget] = useState<'all' | 'members'>('all');
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'category' | 'person' | 'comment' | 'notification';
    id: string;
    label: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const data = await fetchAdminComments(token);
      setComments(data);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'فشل تحميل التعليقات' });
    } finally {
      setLoadingComments(false);
    }
  };

  const loadNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const data = await fetchAdminNotifications(token);
      setNotifications(data);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'فشل تحميل الإشعارات' });
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    setFeedback(null);
    if (mode === 'comments_ratings') loadComments();
    if (mode === 'notifications') loadNotifications();
  }, [mode, token]);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setIsProcessing(true);
    try {
      if (confirmDelete.kind === 'category') {
        await deleteCategory(token, confirmDelete.id);
        onRefreshCategories();
        onCategoriesUpdated?.();
      } else if (confirmDelete.kind === 'person') {
        await deletePerson(token, confirmDelete.id);
        onRefreshPeople();
      } else if (confirmDelete.kind === 'comment') {
        await deleteAdminComment(token, confirmDelete.id);
        await loadComments();
      } else if (confirmDelete.kind === 'notification') {
        await deleteAdminNotification(token, confirmDelete.id);
        await loadNotifications();
      }
      setConfirmDelete(null);
      setFeedback({ type: 'success', msg: 'تم الحذف بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر تنفيذ الحذف' });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 1. CATEGORIES ---
  if (mode === 'categories') {
    const sortedCategories = [...categories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    const handleAddOrUpdateCat = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!catNameAr.trim()) return;
      setIsProcessing(true);
      setFeedback(null);
      try {
        if (editingCat) {
          await updateCategory(token, editingCat.id, {
            nameAr: catNameAr.trim(),
            nameEn: catNameEn.trim() || catNameAr.trim(),
            slug: catSlug.trim() || editingCat.slug,
          });
          setEditingCat(null);
        } else {
          await createCategory(token, {
            nameAr: catNameAr.trim(),
            nameEn: catNameEn.trim() || catNameAr.trim(),
            slug: catSlug.trim(),
          });
        }
        setCatNameAr('');
        setCatNameEn('');
        setCatSlug('');
        onRefreshCategories();
        onCategoriesUpdated?.();
        setFeedback({ type: 'success', msg: 'تم حفظ التصنيف بنجاح' });
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'فشل حفظ التصنيف' });
      } finally {
        setIsProcessing(false);
      }
    };

    const handleMoveCategory = async (idx: number, direction: -1 | 1) => {
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= sortedCategories.length) return;
      const cur = sortedCategories[idx];
      const other = sortedCategories[targetIdx];
      const curOrder = cur.order || idx + 1;
      const otherOrder = other.order || targetIdx + 1;
      const finalCurOrder = curOrder === otherOrder ? targetIdx + 1 : otherOrder;
      const finalOtherOrder = curOrder === otherOrder ? idx + 1 : curOrder;
      setIsProcessing(true);
      setFeedback(null);
      try {
        await Promise.all([
          updateCategory(token, cur.id, { order: finalCurOrder }),
          updateCategory(token, other.id, { order: finalOtherOrder }),
        ]);
        onRefreshCategories();
        onCategoriesUpdated?.();
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'تعذر تغيير ترتيب التصنيف' });
      } finally {
        setIsProcessing(false);
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <Tags className="w-5 h-5 text-amber-400" />
            <span>إدارة التصنيفات ({categories.length})</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            إضافة وتعديل وترتيب وإظهار أو إخفاء تصنيفات الأفلام والمسلسلات
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        <form
          onSubmit={handleAddOrUpdateCat}
          className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs items-end"
        >
          <div className="sm:col-span-4">
            <label className="block text-zinc-400 font-bold mb-1">اسم التصنيف بالعربية *</label>
            <input
              type="text"
              required
              value={catNameAr}
              onChange={(e) => setCatNameAr(e.target.value)}
              placeholder="مثال: تشويق وإثارة"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-zinc-400 font-bold mb-1">الاسم بالإنجليزية</label>
            <input
              type="text"
              dir="ltr"
              value={catNameEn}
              onChange={(e) => setCatNameEn(e.target.value)}
              placeholder="Thriller"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-zinc-400 font-bold mb-1">المعرّف (Slug)</label>
            <input
              type="text"
              dir="ltr"
              value={catSlug}
              onChange={(e) => setCatSlug(e.target.value)}
              placeholder="thriller"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
          <div className="sm:col-span-2 flex gap-1.5">
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black cursor-pointer"
            >
              {editingCat ? 'تحديث' : 'إضافة'}
            </button>
            {editingCat && (
              <button
                type="button"
                onClick={() => {
                  setEditingCat(null);
                  setCatNameAr('');
                  setCatNameEn('');
                  setCatSlug('');
                }}
                className="px-2.5 py-2 rounded-xl bg-zinc-900 text-zinc-300 border border-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-[#111116] border border-white/[0.08] divide-y divide-white/[0.05]">
          {sortedCategories.map((cat, idx) => (
            <div
              key={cat.id}
              className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-zinc-900 text-amber-400 font-mono font-bold flex items-center justify-center">
                  {cat.order || idx + 1}
                </span>
                <div>
                  <p className="font-black text-white">{cat.nameAr}</p>
                  <p className="text-[11px] font-mono text-zinc-400">
                    {cat.nameEn} • {cat.slug}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={idx === 0 || isProcessing}
                  onClick={() => handleMoveCategory(idx, -1)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 flex items-center justify-center cursor-pointer"
                  title="تقديم للأعلى"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === sortedCategories.length - 1 || isProcessing}
                  onClick={() => handleMoveCategory(idx, 1)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 flex items-center justify-center cursor-pointer"
                  title="تأخير للأسفل"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={async () => {
                    try {
                      await updateCategory(token, cat.id, { isVisible: !cat.isVisible });
                      onRefreshCategories();
                      onCategoriesUpdated?.();
                      setFeedback({
                        type: 'success',
                        msg: cat.isVisible ? 'تم إخفاء التصنيف بنجاح' : 'تم إظهار التصنيف بنجاح',
                      });
                    } catch (err: any) {
                      setFeedback({ type: 'error', msg: err?.message || 'تعذر تغيير حالة التصنيف' });
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border ${
                    cat.isVisible
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {cat.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{cat.isVisible ? 'ظاهر' : 'مخفي'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCat(cat);
                    setCatNameAr(cat.nameAr);
                    setCatNameEn(cat.nameEn);
                    setCatSlug(cat.slug);
                  }}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete({ kind: 'category', id: cat.id, label: cat.nameAr })
                  }
                  className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <AdminConfirmDialog
          isOpen={Boolean(confirmDelete)}
          title="حذف التصنيف"
          message={`هل تريد حذف تصنيف "${confirmDelete?.label || ''}"؟`}
          confirmLabel="حذف"
          isLoading={isProcessing}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    );
  }

  // --- 2. CAST & DIRECTORS ---
  if (mode === 'cast_directors') {
    const filteredPeople = people.filter(
      (p) =>
        !personSearch.trim() ||
        p.name.toLowerCase().includes(personSearch.toLowerCase()) ||
        (p.nationality || '').toLowerCase().includes(personSearch.toLowerCase())
    );

    const handleSavePerson = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!personName.trim()) return;
      setIsProcessing(true);
      try {
        if (editingPerson) {
          await updatePerson(token, editingPerson.id, {
            name: personName.trim(),
            role: personRole,
            nationality: personNationality.trim(),
            avatarUrl: personAvatarUrl.trim(),
            bio: personBio.trim(),
          });
          setEditingPerson(null);
        } else {
          await createPerson(token, {
            name: personName.trim(),
            role: personRole,
            nationality: personNationality.trim(),
            avatarUrl: personAvatarUrl.trim(),
            bio: personBio.trim(),
          });
        }
        setPersonName('');
        setPersonNationality('');
        setPersonAvatarUrl('');
        setPersonBio('');
        onRefreshPeople();
        setFeedback({ type: 'success', msg: 'تم حفظ بيانات الفنان / المخرج بنجاح' });
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'تعذر الحفظ' });
      } finally {
        setIsProcessing(false);
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <span>إدارة الممثلين والمخرجين ({people.length})</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            أضف أسماء الممثلين والمخرجين لربطهم مباشرة بالأفلام والمسلسلات
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        <form
          onSubmit={handleSavePerson}
          className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="text"
              required
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="الاسم الكامل *"
              className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
            <select
              value={personRole}
              onChange={(e) => setPersonRole(e.target.value as any)}
              className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            >
              <option value="actor">ممثل</option>
              <option value="director">مخرج</option>
              <option value="both">ممثل ومخرج</option>
            </select>
            <input
              type="text"
              value={personNationality}
              onChange={(e) => setPersonNationality(e.target.value)}
              placeholder="الجنسية (اختياري)"
              className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={isProcessing}
                className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingPerson ? 'حفظ التعديل' : 'إضافة'}</span>
              </button>
              {editingPerson && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPerson(null);
                    setPersonName('');
                    setPersonBio('');
                    setPersonAvatarUrl('');
                    setPersonNationality('');
                  }}
                  className="px-2.5 rounded-xl bg-zinc-900 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="url"
              dir="ltr"
              value={personAvatarUrl}
              onChange={(e) => setPersonAvatarUrl(e.target.value)}
              placeholder="رابط الصورة الشخصية (اختياري)"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
            <input
              type="text"
              value={personBio}
              onChange={(e) => setPersonBio(e.target.value)}
              placeholder="نبذة مختصرة..."
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
            />
          </div>
        </form>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={personSearch}
            onChange={(e) => setPersonSearch(e.target.value)}
            placeholder="بحث باسم الممثل أو المخرج..."
            className="w-full bg-[#111116] border border-white/[0.08] rounded-xl pr-9 pl-3 py-2 text-xs text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPeople.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-zinc-500 rounded-2xl bg-[#111116] border border-white/[0.08]">
              لا توجد سجلات مضافة بعد.
            </div>
          ) : (
            filteredPeople.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-[#111116] border border-white/[0.08] flex items-start justify-between gap-2 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {p.avatarUrl && (
                    <img
                      src={p.avatarUrl}
                      alt={p.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-black text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[10px] font-bold">
                        {p.role === 'director' ? 'مخرج' : p.role === 'both' ? 'ممثل ومخرج' : 'ممثل'}
                      </span>
                      {p.nationality && <span className="text-[11px] text-zinc-400">{p.nationality}</span>}
                    </div>
                    {p.bio && <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2">{p.bio}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPerson(p);
                      setPersonName(p.name);
                      setPersonRole(p.role);
                      setPersonNationality(p.nationality || '');
                      setPersonAvatarUrl(p.avatarUrl || '');
                      setPersonBio(p.bio || '');
                    }}
                    className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ kind: 'person', id: p.id, label: p.name })}
                    className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <AdminConfirmDialog
          isOpen={Boolean(confirmDelete)}
          title="حذف السجل"
          message={`هل تريد حذف "${confirmDelete?.label || ''}"؟`}
          confirmLabel="حذف"
          isLoading={isProcessing}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    );
  }

  // --- 3. COMMENTS & RATINGS ---
  if (mode === 'comments_ratings') {
    const visibleComments = comments.filter((c) =>
      commentFilter === 'all' ? true : c.status === commentFilter
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <span>التعليقات والتقييمات ({comments.length})</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              مراجعة تعليقات المشاهدين وتقييماتهم والموافقة عليها أو إخفاؤها
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={loadComments}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingComments ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
            {(['all', 'approved', 'pending', 'hidden'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setCommentFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  commentFilter === st
                    ? 'bg-amber-400 text-black border-amber-400'
                    : 'bg-[#111116] text-zinc-400 border-white/10'
                }`}
              >
                {st === 'all' ? 'الكل' : st === 'approved' ? 'مقبول' : st === 'pending' ? 'بانتظار المراجعة' : 'مخفي'}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {loadingComments ? (
          <div className="py-16 text-center text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
            <p className="text-xs">جارٍ تحميل التعليقات...</p>
          </div>
        ) : visibleComments.length === 0 ? (
          <div className="py-14 text-center rounded-2xl bg-[#111116] border border-white/[0.08] text-zinc-500 text-xs">
            لا توجد تعليقات أو تقييمات مسجلة في هذا التصنيف بعد.
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleComments.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] flex flex-wrap items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white">{c.userName}</span>
                    <span className="text-zinc-500">على:</span>
                    <span className="text-amber-400 font-bold">{c.mediaTitle}</span>
                    <span className="flex items-center gap-0.5 text-amber-400 font-mono">
                      <Star className="w-3 h-3 fill-current" />
                      {c.rating}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : c.status === 'hidden'
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'bg-amber-400/15 text-amber-300'
                      }`}
                    >
                      {c.status === 'approved' ? 'معتمد' : c.status === 'hidden' ? 'مخفي' : 'معلق'}
                    </span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed">{c.text}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  {c.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateAdminComment(token, c.id, { status: 'approved' });
                          await loadComments();
                          setFeedback({ type: 'success', msg: 'تم اعتماد التعليق بنجاح' });
                        } catch (err: any) {
                          setFeedback({ type: 'error', msg: err?.message || 'تعذر اعتماد التعليق' });
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>اعتماد</span>
                    </button>
                  )}
                  {c.status !== 'hidden' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateAdminComment(token, c.id, { status: 'hidden' });
                          await loadComments();
                          setFeedback({ type: 'success', msg: 'تم إخفاء التعليق' });
                        } catch (err: any) {
                          setFeedback({ type: 'error', msg: err?.message || 'تعذر إخفاء التعليق' });
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>إخفاء</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDelete({ kind: 'comment', id: c.id, label: c.userName })
                    }
                    className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <AdminConfirmDialog
          isOpen={Boolean(confirmDelete)}
          title="حذف التعليق"
          message="هل أنت متأكد من حذف هذا التعليق نهائياً؟"
          confirmLabel="حذف التعليق"
          isLoading={isProcessing}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    );
  }

  // --- 4. NOTIFICATIONS ---
  const handleSendNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;
    setIsProcessing(true);
    try {
      await createAdminNotification(token, {
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        type: notifType,
        target: notifTarget,
      });
      setNotifTitle('');
      setNotifMessage('');
      await loadNotifications();
      setFeedback({ type: 'success', msg: 'تم إرسال الإشعار ونشره بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'فشل إرسال الإشعار' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <span>إدارة وإرسال الإشعارات ({notifications.length})</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          إرسال تنبيهات وإشعارات للأعمال الجديدة أو الصيانة لجميع الزوار والأعضاء
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <form
        onSubmit={handleSendNotif}
        className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            required
            value={notifTitle}
            onChange={(e) => setNotifTitle(e.target.value)}
            placeholder="عنوان الإشعار *"
            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
          />
          <select
            value={notifType}
            onChange={(e) => setNotifType(e.target.value as any)}
            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
          >
            <option value="new_release">إصدار جديد</option>
            <option value="info">معلومة عامة</option>
            <option value="alert">تنبيه هام</option>
          </select>
          <select
            value={notifTarget}
            onChange={(e) => setNotifTarget(e.target.value as any)}
            className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
          >
            <option value="all">جميع الزوار والأعضاء</option>
            <option value="members">الأعضاء المسجلون فقط</option>
          </select>
        </div>

        <textarea
          rows={2}
          required
          value={notifMessage}
          onChange={(e) => setNotifMessage(e.target.value)}
          placeholder="نص الإشعار..."
          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-white"
        />

        <button
          type="submit"
          disabled={isProcessing}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>إرسال الإشعار الآن</span>
        </button>
      </form>

      {loadingNotifs ? (
        <div className="py-12 text-center text-zinc-400 text-xs">جارٍ التحميل...</div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-[#111116] border border-white/[0.08] text-zinc-500 text-xs">
          لم يتم إرسال أي إشعارات بعد.
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-3.5 rounded-2xl bg-[#111116] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-white">{n.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {n.target === 'members' ? 'الأعضاء' : 'الجميع'}
                  </span>
                </div>
                <p className="text-zinc-400 mt-1">{n.message}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateAdminNotification(token, n.id, { isActive: !n.isActive });
                      await loadNotifications();
                      setFeedback({
                        type: 'success',
                        msg: n.isActive ? 'تم إيقاف الإشعار' : 'تم تفعيل الإشعار',
                      });
                    } catch (err: any) {
                      setFeedback({ type: 'error', msg: err?.message || 'تعذر تغيير حالة الإشعار' });
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
                    n.isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {n.isActive ? 'نشط' : 'موقوف'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete({ kind: 'notification', id: n.id, label: n.title })
                  }
                  className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminConfirmDialog
        isOpen={Boolean(confirmDelete)}
        title="حذف الإشعار"
        message={`هل تريد حذف إشعار "${confirmDelete?.label || ''}"؟`}
        confirmLabel="حذف"
        isLoading={isProcessing}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
