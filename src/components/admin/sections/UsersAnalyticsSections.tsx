import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Eye,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  AdminAnalyticsResponse,
  AdminUserRecord,
  AdminViewsResponse,
  AnalyticsRange,
  deleteAdminUser,
  fetchAdminAnalytics,
  fetchAdminUsers,
  fetchAdminViews,
  resetAdminViews,
  updateAdminUser,
} from '../../../services/adminService';
import { AdminConfirmDialog } from '../AdminConfirmDialog';

interface UsersAnalyticsSectionsProps {
  mode: 'users' | 'analytics' | 'views_management';
  token: string;
  onViewsReset?: () => void;
}

export const UsersAnalyticsSections: React.FC<UsersAnalyticsSectionsProps> = ({
  mode,
  token,
  onViewsReset,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // --- USERS ---
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [inspectUser, setInspectUser] = useState<AdminUserRecord | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUserRecord | null>(null);
  const [isMutatingUser, setIsMutatingUser] = useState<boolean>(false);

  // --- ANALYTICS ---
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);

  // --- VIEWS ---
  const [viewsData, setViewsData] = useState<AdminViewsResponse | null>(null);
  const [loadingViews, setLoadingViews] = useState<boolean>(false);
  const [confirmResetViews, setConfirmResetViews] = useState<boolean>(false);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await fetchAdminUsers(token);
      setUsers(list);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر تحميل المستخدمين' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAnalytics = async (targetRange: AnalyticsRange = range) => {
    setLoadingAnalytics(true);
    try {
      const data = await fetchAdminAnalytics(token, targetRange);
      setAnalytics(data);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر تحميل الإحصائيات' });
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadViews = async () => {
    setLoadingViews(true);
    try {
      const data = await fetchAdminViews(token);
      setViewsData(data);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'تعذر تحميل المشاهدات' });
    } finally {
      setLoadingViews(false);
    }
  };

  useEffect(() => {
    setFeedback(null);
    if (mode === 'users') loadUsers();
    if (mode === 'analytics') loadAnalytics(range);
    if (mode === 'views_management') loadViews();
  }, [mode, token]);

  // --- 1. USERS MANAGEMENT ---
  if (mode === 'users') {
    const filteredUsers = users.filter((u) => {
      const q = userSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || u.name || '').toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>إدارة المستخدمين ({filteredUsers.length})</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              عرض الحسابات المسجلة، تفعيل أو تعطيل الحسابات، تعديل الصلاحيات، ومتابعة النشاط
            </p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            className="px-3.5 py-2 rounded-full bg-[#16161a] hover:bg-[#202026] text-xs font-bold text-zinc-200 border border-white/[0.08] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin text-[#ff45a2]' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs border flex items-center justify-between ${
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

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد الإلكتروني..."
            className="w-full bg-[#121215] border border-white/[0.08] rounded-2xl pr-10 pl-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff2e93]/70"
          />
        </div>

        {loadingUsers ? (
          <div className="py-16 text-center text-zinc-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff45a2]" />
            <span>جارٍ تحميل المستخدمين...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-14 text-center rounded-2xl bg-[#121215] border border-white/[0.07] text-zinc-500 text-xs">
            لا توجد حسابات مطابقة للبحث.
          </div>
        ) : (
          <div className="rounded-2xl bg-[#121215] border border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-[#0b0b0e] text-[11px] font-black text-zinc-400">
                    <th className="py-3 px-3">المستخدم</th>
                    <th className="py-3 px-3">الحالة والتوثيق</th>
                    <th className="py-3 px-3">الدور</th>
                    <th className="py-3 px-3">المشاهدات</th>
                    <th className="py-3 px-3">تاريخ الانضمام</th>
                    <th className="py-3 px-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredUsers.map((u) => {
                    const isPrimary = u.email.toLowerCase() === 'frassa.wwindows@gmail.com';
                    const initial = (u.displayName || u.name || u.email || 'U').trim().charAt(0).toUpperCase();
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            {u.picture ? (
                              <img
                                src={u.picture}
                                alt={u.displayName}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#ff2e93]/20 text-[#ff5ec4] font-black flex items-center justify-center shrink-0">
                                {initial}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-black text-white truncate max-w-[170px]">
                                {u.displayName || u.name}
                              </p>
                              <p className="text-[11px] font-mono text-zinc-400 truncate max-w-[190px]">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`text-[11px] font-bold ${
                                u.disabled ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {u.disabled ? 'معطل' : 'نشط'}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {u.emailVerified ? 'بريد موثق' : 'غير موثق'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {isPrimary ? (
                            <span className="px-2.5 py-1 rounded-full bg-[#ff2e93]/20 text-[#ff6bc9] text-[10px] font-black inline-flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              المطور الرئيسي
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              disabled={isMutatingUser}
                              onChange={async (e) => {
                                const nextRole = e.target.value;
                                setIsMutatingUser(true);
                                setFeedback(null);
                                try {
                                  await updateAdminUser(token, u.id, { role: nextRole });
                                  await loadUsers();
                                  setFeedback({
                                    type: 'success',
                                    msg: `تم تغيير دور "${u.displayName || u.email}" بنجاح`,
                                  });
                                } catch (err: any) {
                                  setFeedback({ type: 'error', msg: err?.message || 'تعذر تغيير دور المستخدم' });
                                } finally {
                                  setIsMutatingUser(false);
                                }
                              }}
                              className="bg-[#08080a] border border-white/[0.09] rounded-xl px-2.5 py-1 text-[11px] text-white"
                            >
                              <option value="عضو VIP">عضو VIP</option>
                              <option value="مشاهد">مشاهد</option>
                              <option value="محرر">محرر</option>
                              <option value="عضو مسجل">عضو مسجل</option>
                            </select>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono tabular-nums text-zinc-300">
                          {u.recentViewsCount || 0}
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('ar-EG') : '-'}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectUser(u)}
                              className="w-7 h-7 rounded-full bg-[#1a1a20] hover:bg-[#25252d] text-zinc-300 flex items-center justify-center cursor-pointer"
                              title="تفاصيل الحساب"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {!isPrimary && (
                              <>
                                <button
                                  type="button"
                                  disabled={isMutatingUser}
                                  onClick={async () => {
                                    setIsMutatingUser(true);
                                    setFeedback(null);
                                    try {
                                      await updateAdminUser(token, u.id, { disabled: !u.disabled });
                                      await loadUsers();
                                      setFeedback({
                                        type: 'success',
                                        msg: u.disabled ? 'تم تفعيل حساب المستخدم' : 'تم تعطيل حساب المستخدم',
                                      });
                                    } catch (err: any) {
                                      setFeedback({ type: 'error', msg: err?.message || 'تعذر تحديث حالة الحساب' });
                                    } finally {
                                      setIsMutatingUser(false);
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                    u.disabled
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : 'bg-amber-500/15 text-amber-300'
                                  }`}
                                >
                                  {u.disabled ? (
                                    <>
                                      <Unlock className="w-3 h-3" />
                                      <span>تفعيل</span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-3 h-3" />
                                      <span>تعطيل</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUser(u)}
                                  className="w-7 h-7 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
                                  title="حذف الحساب"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
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

        {/* Inspect User Modal */}
        {inspectUser && (
          <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
            <div className="bg-[#161619] border border-white/[0.09] rounded-3xl w-full max-w-md p-5 space-y-4 text-xs shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                <h3 className="text-sm font-black text-white">ملف المستخدم والنشاط</h3>
                <button
                  type="button"
                  onClick={() => setInspectUser(null)}
                  className="w-8 h-8 rounded-full bg-[#222227] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2.5 text-zinc-300">
                <p>
                  <span className="text-zinc-500">الاسم: </span>
                  <strong className="text-white">{inspectUser.displayName}</strong>
                </p>
                <p>
                  <span className="text-zinc-500">البريد: </span>
                  <span className="font-mono text-[#ff5ec4]">{inspectUser.email}</span>
                </p>
                <p>
                  <span className="text-zinc-500">عدد المشاهدات المسجلة: </span>
                  <span className="font-mono text-white tabular-nums">{inspectUser.recentViewsCount || 0}</span>
                </p>
                <p>
                  <span className="text-zinc-500">آخر نشاط: </span>
                  <span className="font-mono">
                    {inspectUser.lastSeenAt
                      ? new Date(inspectUser.lastSeenAt).toLocaleString('ar-EG')
                      : '-'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        <AdminConfirmDialog
          isOpen={Boolean(confirmDeleteUser)}
          title="حذف حساب المستخدم"
          message={`هل أنت متأكد من حذف حساب "${confirmDeleteUser?.email || ''}" نهائياً؟`}
          confirmLabel="حذف الحساب"
          isLoading={isMutatingUser}
          onConfirm={async () => {
            if (!confirmDeleteUser) return;
            setIsMutatingUser(true);
            try {
              await deleteAdminUser(token, confirmDeleteUser.id);
              setConfirmDeleteUser(null);
              loadUsers();
            } catch (err: any) {
              setFeedback({ type: 'error', msg: err?.message || 'فشل حذف الحساب' });
            } finally {
              setIsMutatingUser(false);
            }
          }}
          onCancel={() => setConfirmDeleteUser(null)}
        />
      </div>
    );
  }

  // --- 2. ANALYTICS ---
  if (mode === 'analytics') {
    const totals = analytics?.totals;
    const series = analytics?.chartSeries || [];
    const maxVal = Math.max(1, ...series.map((s) => Math.max(s.views, s.newUsers)));

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#ff45a2]" />
              <span>الإحصائيات والتحليلات التفصيلية</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              متابعة المشاهدات اليومية والأسبوعية والشهرية ونمو التسجيلات وتفاعل الجمهور
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full bg-[#121215] border border-white/[0.08]">
            {([
              { id: '7d', label: '7 أيام' },
              { id: '30d', label: '30 يوماً' },
              { id: '90d', label: '3 أشهر' },
              { id: 'all', label: 'الكل' },
            ] as const).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRange(r.id);
                  loadAnalytics(r.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                  range === r.id
                    ? 'bg-[#ff2e93] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {loadingAnalytics && !analytics ? (
          <div className="py-16 text-center text-zinc-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff45a2]" />
            <span>جارٍ حساب الإحصائيات...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07]">
                <p className="text-xs text-zinc-400">مشاهدات اليوم</p>
                <p className="text-2xl font-black text-[#ff5ec4] font-mono mt-1 tabular-nums">
                  {totals?.dailyViews || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07]">
                <p className="text-xs text-zinc-400">مشاهدات آخر 7 أيام</p>
                <p className="text-2xl font-black text-white font-mono mt-1 tabular-nums">
                  {totals?.weeklyViews || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07]">
                <p className="text-xs text-zinc-400">مشاهدات الشهر</p>
                <p className="text-2xl font-black text-sky-400 font-mono mt-1 tabular-nums">
                  {totals?.monthlyViews || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07]">
                <p className="text-xs text-zinc-400">أعضاء جدد في الفترة</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-1 tabular-nums">
                  {totals?.newUsersInRange || 0}
                </p>
              </div>
            </div>

            {/* Chart */}
            <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-4">
              <h3 className="text-xs font-black text-white">تطور المشاهدات اليومية</h3>
              <div className="h-52 flex items-end justify-between gap-2 pt-4 border-b border-white/[0.06]">
                {series.map((pt) => {
                  const pct = Math.max(4, Math.round((pt.views / maxVal) * 100));
                  return (
                    <div key={pt.dateKey} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                        {pt.views > 0 ? pt.views : ''}
                      </span>
                      <div
                        className="w-full max-w-[26px] rounded-t-lg bg-[#ff2e93]/90 hover:bg-[#ff5ec4] transition-all"
                        style={{ height: `${pt.views === 0 ? 4 : pct}%` }}
                      />
                      <span className="text-[10px] font-mono text-zinc-500 pb-1">{pt.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- 3. VIEWS MANAGEMENT ---
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#ff45a2]" />
            <span>إدارة سجل المشاهدات</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            متابعة عدد مشاهدات كل عمل وآخر عمليات التشغيل المسجلة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadViews}
            className="px-3.5 py-2 rounded-full bg-[#16161a] hover:bg-[#202026] text-xs font-bold text-zinc-200 border border-white/[0.08] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingViews ? 'animate-spin text-[#ff45a2]' : ''}`} />
            <span>تحديث</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmResetViews(true)}
            className="px-4 py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تصفير المشاهدات</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {loadingViews ? (
        <div className="py-16 text-center text-zinc-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff45a2]" />
          <span>جارٍ تحميل السجل...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-2.5">
            <h3 className="text-xs font-black text-white">إحصائيات المشاهدة حسب العمل</h3>
            {!viewsData?.mediaStats?.length ? (
              <p className="text-xs text-zinc-500 py-6 text-center">لا توجد أعمال بعد</p>
            ) : (
              viewsData.mediaStats.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl bg-[#0b0b0e] border border-white/[0.05] flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-white truncate max-w-[230px]">{m.titleAr}</span>
                  <span className="font-mono font-black text-[#ff5ec4] tabular-nums">
                    {m.viewsCount.toLocaleString('en-US')} مشاهدة
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-2.5">
            <h3 className="text-xs font-black text-white">سجل التشغيل الزمني الأخير</h3>
            {!viewsData?.logs?.length ? (
              <p className="text-xs text-zinc-500 py-6 text-center">لا توجد مشاهدات مسجلة حتى الآن</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
                {viewsData.logs.slice(0, 50).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-[#0b0b0e] border border-white/[0.05] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{log.mediaTitle}</p>
                      <p className="text-[11px] font-mono text-zinc-500 truncate">
                        {log.userEmail || 'زائر'}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                      {new Date(log.timestamp).toLocaleString('ar-EG')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AdminConfirmDialog
        isOpen={confirmResetViews}
        title="تصفير عدادات المشاهدة"
        message="سيتم مسح سجل المشاهدات وإعادة تعيين العدادات لجميع الأفلام والمسلسلات إلى 0. هل تريد المتابعة؟"
        confirmLabel="تصفير الآن"
        isLoading={isMutatingUser}
        onConfirm={async () => {
          setIsMutatingUser(true);
          setFeedback(null);
          try {
            await resetAdminViews(token);
            setConfirmResetViews(false);
            await loadViews();
            onViewsReset?.();
            setFeedback({ type: 'success', msg: 'تم تصفير سجل المشاهدات بنجاح' });
          } catch (err: any) {
            setConfirmResetViews(false);
            setFeedback({ type: 'error', msg: err?.message || 'فشل تصفير المشاهدات' });
          } finally {
            setIsMutatingUser(false);
          }
        }}
        onCancel={() => setConfirmResetViews(false)}
      />
    </div>
  );
};
