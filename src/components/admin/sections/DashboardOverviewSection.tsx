import React from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Eye,
  Film,
  Layers,
  Play,
  PlusCircle,
  RefreshCw,
  Shield,
  TrendingUp,
  Tv,
  Users,
} from 'lucide-react';
import { AdminAnalyticsResponse } from '../../../services/adminService';
import { TmdbSyncStatusInfo } from '../../../services/tmdbClient';
import { AdminSectionId, MediaItem } from '../../../types';

interface DashboardOverviewSectionProps {
  analytics: AdminAnalyticsResponse | null;
  isLoading: boolean;
  tmdbSyncStatus?: TmdbSyncStatusInfo | null;
  isSyncingTmdb?: boolean;
  onTriggerTmdbSync?: () => void;
  onRefresh: () => void;
  onNavigate: (section: AdminSectionId) => void;
  onPlayMedia?: (media: MediaItem) => void;
}

export const DashboardOverviewSection: React.FC<DashboardOverviewSectionProps> = ({
  analytics,
  isLoading,
  tmdbSyncStatus,
  isSyncingTmdb,
  onTriggerTmdbSync,
  onRefresh,
  onNavigate,
  onPlayMedia,
}) => {
  if (isLoading && !analytics) {
    return (
      <div className="py-20 text-center text-zinc-400">
        <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2.5 text-[#ff45a2]" />
        <p className="text-xs font-semibold">جارٍ تحميل مؤشرات المنصة من قاعدة البيانات...</p>
      </div>
    );
  }

  const totals = analytics?.totals || {
    movies: 0,
    series: 0,
    episodes: 0,
    users: 0,
    verifiedUsers: 0,
    newUsersInRange: 0,
    views: 0,
    dailyViews: 0,
    weeklyViews: 0,
    monthlyViews: 0,
    comments: 0,
  };

  const chartSeries = analytics?.chartSeries || [];
  const maxChartVal = Math.max(1, ...chartSeries.map((c) => Math.max(c.views, c.newUsers)));

  const kpiCards = [
    {
      label: 'إجمالي الأفلام',
      value: totals.movies,
      sub: 'فيلم مسجل بالمنصة',
      icon: Film,
      color: 'text-[#ff45a2]',
      section: 'movies' as AdminSectionId,
    },
    {
      label: 'إجمالي المسلسلات',
      value: totals.series,
      sub: 'مسلسل وعمل درامي',
      icon: Tv,
      color: 'text-sky-400',
      section: 'series' as AdminSectionId,
    },
    {
      label: 'إجمالي الحلقات',
      value: totals.episodes,
      sub: 'حلقة مرفوعة ومربوطة',
      icon: Layers,
      color: 'text-violet-400',
      section: 'seasons_episodes' as AdminSectionId,
    },
    {
      label: 'إجمالي المستخدمين',
      value: totals.users,
      sub: `${totals.verifiedUsers} حساب موثق`,
      icon: Users,
      color: 'text-emerald-400',
      section: 'users' as AdminSectionId,
    },
    {
      label: 'إجمالي المشاهدات',
      value: totals.views,
      sub: `${totals.dailyViews} اليوم / ${totals.weeklyViews} هذا الأسبوع`,
      icon: Eye,
      color: 'text-rose-400',
      section: 'views_management' as AdminSectionId,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white">
            نظرة عامة على منصة MASHHAD
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            بيانات حية متزامنة مباشرة مع قاعدة البيانات وسجلات المشاهدة الفعلية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('add_movie')}
            className="px-4 py-2 rounded-full bg-[#ff2e93] hover:bg-[#ff47a1] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-[0_6px_20px_rgba(255,46,147,0.3)]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة فيلم جديد</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-full bg-[#16161a] hover:bg-[#202026] text-zinc-300 text-xs font-bold border border-white/[0.08] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#ff45a2]' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* 5 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigate(kpi.section)}
              className="text-right p-4 rounded-2xl bg-[#121215] border border-white/[0.07] hover:border-[#ff2e93]/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  {kpi.label}
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-2xl font-black text-white font-mono tabular-nums">
                {kpi.value.toLocaleString('en-US')}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">{kpi.sub}</p>
            </button>
          );
        })}
      </div>

      {/* 24-Hour Automatic TMDB Database Sync Status */}
      {tmdbSyncStatus?.configured && (
        <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <RefreshCw
                className={`w-4 h-4 text-emerald-400 ${
                  isSyncingTmdb || tmdbSyncStatus.isSyncing ? 'animate-spin' : ''
                }`}
              />
              <h3 className="text-xs sm:text-sm font-black text-white">
                المزامنة التلقائية مع TMDB (كل 24 ساعة)
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400">
              {tmdbSyncStatus.lastSyncAt > 0
                ? `آخر مزامنة: ${new Date(tmdbSyncStatus.lastSyncAt).toLocaleString('ar-EG')} · أُضيف ${tmdbSyncStatus.lastAddedCount} عمل جديد (${tmdbSyncStatus.lastAddedMoviesCount} فيلم، ${tmdbSyncStatus.lastAddedSeriesCount} مسلسل) · تم منع ${tmdbSyncStatus.lastSkippedDuplicatesCount} مكرر`
                : 'جارٍ تجهيز أول دورة مزامنة تلقائية في الخلفية...'}
            </p>
            {tmdbSyncStatus.nextSyncAt > 0 && (
              <p className="text-[10px] text-zinc-500 font-mono">
                المزامنة التلقائية القادمة: {new Date(tmdbSyncStatus.nextSyncAt).toLocaleString('ar-EG')}
              </p>
            )}
          </div>

          {onTriggerTmdbSync && (
            <button
              type="button"
              onClick={onTriggerTmdbSync}
              disabled={Boolean(isSyncingTmdb || tmdbSyncStatus.isSyncing)}
              className="px-4 py-2 rounded-full bg-[#1d1d22] hover:bg-[#27272e] border border-white/[0.09] text-[#ff5ec4] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingTmdb || tmdbSyncStatus.isSyncing ? 'animate-spin' : ''}`}
              />
              <span>
                {isSyncingTmdb || tmdbSyncStatus.isSyncing ? 'جارٍ المزامنة...' : 'مزامنة فورية الآن'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Middle Grid: Views Chart + Recent Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Views Chart */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#ff45a2]" />
              <h3 className="text-xs sm:text-sm font-black text-white">
                الرسم البياني للمشاهدات والأعضاء الجدد (آخر 14 يوماً)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-[11px] font-bold text-[#ff5ec4] hover:underline cursor-pointer"
            >
              التحليلات التفصيلية
            </button>
          </div>

          {chartSeries.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-zinc-500">
              لا توجد بيانات مشاهدات مسجلة في هذا النطاق بعد
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-2 pt-4 px-1 border-b border-white/[0.06]">
                {chartSeries.map((point) => {
                  const viewH = Math.max(4, Math.round((point.views / maxChartVal) * 100));
                  const userH = Math.max(2, Math.round((point.newUsers / maxChartVal) * 100));
                  return (
                    <div
                      key={point.dateKey}
                      className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                      title={`${point.dateKey}: ${point.views} مشاهدة، ${point.newUsers} عضو جديد`}
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 h-32">
                        <div
                          className="w-1/2 max-w-[14px] rounded-t-md bg-[#ff2e93]/90 group-hover:bg-[#ff5ec4] transition-all"
                          style={{ height: `${point.views === 0 ? 4 : viewH}%` }}
                        />
                        <div
                          className="w-1/2 max-w-[10px] rounded-t-md bg-emerald-400/75 group-hover:bg-emerald-300 transition-all"
                          style={{ height: `${point.newUsers === 0 ? 2 : userH}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-zinc-500 font-mono tabular-nums pb-1">
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#ff2e93] inline-block" />
                  <span>المشاهدات المسجلة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block" />
                  <span>التسجيلات الجديدة</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Admin Audit Logs */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff45a2]" />
              <h3 className="text-xs sm:text-sm font-black text-white">آخر العمليات في لوحة التحكم</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('audit_logs')}
              className="text-[11px] font-bold text-[#ff5ec4] hover:underline cursor-pointer"
            >
              عرض السجل الكامل
            </button>
          </div>

          {!analytics?.recentLogs?.length ? (
            <p className="text-xs text-zinc-500 py-10 text-center">
              لم تسجل أي عمليات إدارية بعد.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {analytics.recentLogs.slice(0, 7).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-[#0b0b0e] border border-white/[0.05] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{log.action}</p>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.createdAt).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom 3-Column Real Rankings: Latest Content + Top Movies + Top Series */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Latest Added */}
        <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-white flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#ff45a2]" />
              <span>أحدث المحتويات المضافة</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('movies')}
              className="text-[11px] text-[#ff5ec4] hover:underline cursor-pointer"
            >
              الكل
            </button>
          </div>
          {!analytics?.latestContent?.length ? (
            <p className="text-xs text-zinc-500 py-6 text-center">لا يوجد محتوى مضاف بعد</p>
          ) : (
            <div className="space-y-2">
              {analytics.latestContent.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-[#0b0b0e] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.titleAr}
                        referrerPolicy="no-referrer"
                        className="w-9 h-12 rounded-lg object-cover shrink-0 bg-zinc-900"
                      />
                    ) : (
                      <div className="w-9 h-12 rounded-lg bg-[#19191f] border border-white/[0.06] flex items-center justify-center text-[#ff45a2]/70 shrink-0">
                        <Film className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.titleAr || item.title}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {item.type === 'series' ? 'مسلسل' : 'فيلم'} · {item.year}
                      </p>
                    </div>
                  </div>
                  {onPlayMedia && (
                    <button
                      type="button"
                      onClick={() => onPlayMedia(item)}
                      className="w-7 h-7 rounded-full bg-[#ff2e93]/15 hover:bg-[#ff2e93] text-[#ff5ec4] hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      title="تشغيل"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Movies */}
        <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>أكثر الأفلام مشاهدة</span>
            </h3>
            <span className="text-[10px] text-zinc-500">المشاهدات</span>
          </div>
          {!analytics?.topMovies?.length ? (
            <p className="text-xs text-zinc-500 py-6 text-center">لا توجد أفلام متاحة بعد</p>
          ) : (
            <div className="space-y-2">
              {analytics.topMovies.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b0b0e] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-[#1a1a20] text-[10px] font-mono font-black text-[#ff5ec4] flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white truncate">
                      {item.titleAr || item.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-zinc-300 shrink-0">
                    {(item.viewsCount || 0).toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Series */}
        <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-white flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-sky-400" />
              <span>أكثر المسلسلات مشاهدة</span>
            </h3>
            <span className="text-[10px] text-zinc-500">المشاهدات</span>
          </div>
          {!analytics?.topSeries?.length ? (
            <p className="text-xs text-zinc-500 py-6 text-center">لا توجد مسلسلات مسجلة بعد</p>
          ) : (
            <div className="space-y-2">
              {analytics.topSeries.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b0b0e] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-[#1a1a20] text-[10px] font-mono font-black text-sky-400 flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white truncate">
                      {item.titleAr || item.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-zinc-300 shrink-0">
                    {(item.viewsCount || 0).toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
