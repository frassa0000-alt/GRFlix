import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
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
}

export const UsersAnalyticsSections: React.FC<UsersAnalyticsSectionsProps> = ({ mode, token }) => {
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
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-200 border border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
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

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد الإلكتروني..."
            className="w-full bg-[#111116] border border-white/[0.08] rounded-xl pr-9 pl-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        {loadingUsers ? (
          <div className="py-16 text-center text-zinc-400 text-xs">جارٍ تحميل المستخدمين...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-14 text-center rounded-2xl bg-[#111116] border border-white/[0.08] text-zinc-500 text-xs">
            لا توجد حسابات مطابقة للبحث.
          </div>
        ) : (
          <div className="rounded-2xl bg-[#111116] border border-white/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-zinc-950/60 text-[11px] font-black text-zinc-400">
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
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                u.picture ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.name || 'U')}&background=facc15&color=000`
                              }
                              alt={u.displayName}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
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
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded w-fit ${
                                u.disabled
                                  ? 'bg-rose-500/15 text-rose-300'
                                  : 'bg-emerald-500/15 text-emerald-300'
                              }`}
                            >
                              {u.disabled ? 'معطل' : 'نشط'}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {u.emailVerified ? 'بريد موثق' : 'غير موثق'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {isPrimary ? (
                            <span className="px-2 py-1 rounded-lg bg-amber-400/20 text-amber-300 text-[10px] font-black inline-flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              المطور الرئيسي
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={async (e) => {
                                await updateAdminUser(token, u.id, { role: e.target.value });
                                loadUsers();
                              }}
                              className="bg-zinc-950 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                            >
                              <option value="عضو VIP">عضو VIP</option>
                              <option value="مشاهد">مشاهد</option>
                              <option value="محرر">محرر</option>
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
                              className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                              title="تفاصيل الحساب"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {!isPrimary && (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateAdminUser(token, u.id, { disabled: !u.disabled });
                                    loadUsers();
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
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
                                  className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center cursor-pointer"
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
          <div className="fixed inset-0 z-[125] bg-black/85 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-[#111116] border border-white/15 rounded-2xl w-full max-w-md p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white">ملف المستخدم والنشاط</h3>
                <button
                  type="button"
                  onClick={() => setInspectUser(null)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-400 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 text-zinc-300">
                <p>
                  <span className="text-zinc-500">الاسم: </span>
                  <strong className="text-white">{inspectUser.displayName}</strong>
                </p>
                <p>
                  <span className="text-zinc-500">البريد: </span>
                  <span className="font-mono text-amber-400">{inspectUser.email}</span>
                </p>
                <p>
                  <span className="text-zinc-500">عدد المشاهدات المسجلة: </span>
                  <span className="font-mono text-white">{inspectUser.recentViewsCount || 0}</span>
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
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <span>الإحصائيات والتحليلات التفصيلية</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              متابعة المشاهدات اليومية والأسبوعية والشهرية ونمو التسجيلات وتفاعل الجمهور
            </p>
          </div>

          <div className="flex items-center gap-1.5">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  range === r.id
                    ? 'bg-amber-400 text-black border-amber-400'
                    : 'bg-[#111116] text-zinc-400 border-white/10'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loadingAnalytics && !analytics ? (
          <div className="py-16 text-center text-zinc-400 text-xs">جارٍ حساب الإحصائيات...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08]">
                <p className="text-xs text-zinc-400">مشاهدات اليوم</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-1 tabular-nums">
                  {totals?.dailyViews || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08]">
                <p className="text-xs text-zinc-400">مشاهدات آخر 7 أيام</p>
                <p className="text-2xl font-black text-white font-mono mt-1 tabular-nums">
                  {totals?.weeklyViews || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08]">
                <p className="text-xs text-zinc-400">مشاهدات الشهر</p>
                <p className="text-2xl font-black text-sky-400 font-mono mt-1 tabular-nums">
                  {totals?.monthlyViews || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08]">
                <p className="text-xs text-zinc-400">أعضاء جدد في الفترة</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-1 tabular-nums">
                  {totals?.newUsersInRange || 0}
                </p>
              </div>
            </div>

            {/* Chart */}
            <div className="p-5 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4">
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
                        className="w-full max-w-[26px] rounded-t-lg bg-amber-400/90 transition-all"
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
            <Activity className="w-5 h-5 text-rose-400" />
            <span>إدارة سجل المشاهدات</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            متابعة عدد مشاهدات كل عمل وآخر عمليات التشغيل المسجلة
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmResetViews(true)}
          className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-black flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>تصفير المشاهدات</span>
        </button>
      </div>

      {loadingViews ? (
        <div className="py-16 text-center text-zinc-400 text-xs">جارٍ تحميل السجل...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white">إحصائيات المشاهدة حسب العمل</h3>
            {!viewsData?.mediaStats?.length ? (
              <p className="text-xs text-zinc-500 py-6 text-center">لا توجد أعمال بعد</p>
            ) : (
              viewsData.mediaStats.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl bg-zinc-950/90 border border-white/[0.05] flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-white truncate max-w-[230px]">{m.titleAr}</span>
                  <span className="font-mono font-black text-amber-400 tabular-nums">
                    {m.viewsCount.toLocaleString('en-US')} مشاهدة
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white">سجل التشغيل الزمني الأخير</h3>
            {!viewsData?.logs?.length ? (
              <p className="text-xs text-zinc-500 py-6 text-center">لا توجد مشاهدات مسجلة حتى الآن</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
                {viewsData.logs.slice(0, 50).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-zinc-950/90 border border-white/[0.05] flex items-center justify-between gap-2 text-xs"
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
        onConfirm={async () => {
          await resetAdminViews(token);
          setConfirmResetViews(false);
          loadViews();
        }}
        onCancel={() => setConfirmResetViews(false)}
      />
    </div>
  );
};
