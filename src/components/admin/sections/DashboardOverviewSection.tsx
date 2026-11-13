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
import { AdminSectionId, MediaItem } from '../../../types';

interface DashboardOverviewSectionProps {
  analytics: AdminAnalyticsResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigate: (section: AdminSectionId) => void;
  onPlayMedia?: (media: MediaItem) => void;
}

export const DashboardOverviewSection: React.FC<DashboardOverviewSectionProps> = ({
  analytics,
  isLoading,
  onRefresh,
  onNavigate,
  onPlayMedia,
}) => {
  if (isLoading && !analytics) {
    return (
      <div className="py-20 text-center text-zinc-400">
        <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2.5 text-amber-400" />
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
      color: 'text-amber-400',
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
            نظرة عامة على منصة GoldenFlix
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            بيانات حية متزامنة مباشرة مع قاعدة البيانات وسجلات المشاهدة الفعلية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('add_movie')}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>رفع فيلم جديد</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
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
              className="text-right p-4 rounded-2xl bg-[#111116] border border-white/[0.08] hover:border-amber-400/35 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">
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

      {/* Middle Grid: Views Chart + Recent Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Views Chart */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-black text-white">
                الرسم البياني للمشاهدات والأعضاء الجدد (آخر 14 يوماً)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
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
                          className="w-1/2 max-w-[14px] rounded-t-md bg-amber-400/90 group-hover:bg-amber-300 transition-all"
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
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" />
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
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-black text-white">آخر العمليات في لوحة التحكم</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('audit_logs')}
              className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
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
                  className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.05] flex items-start justify-between gap-2"
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
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-white flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>أحدث المحتويات المضافة</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('movies')}
              className="text-[11px] text-amber-400 hover:underline cursor-pointer"
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
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={item.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200'}
                      alt={item.titleAr}
                      className="w-9 h-12 rounded-lg object-cover shrink-0 bg-zinc-900"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.titleAr || item.title}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {item.type === 'series' ? 'مسلسل' : 'فيلم'} • {item.year}
                      </p>
                    </div>
                  </div>
                  {onPlayMedia && (
                    <button
                      type="button"
                      onClick={() => onPlayMedia(item)}
                      className="w-7 h-7 rounded-lg bg-amber-400/15 hover:bg-amber-400 text-amber-400 hover:text-black flex items-center justify-center shrink-0 cursor-pointer transition-colors"
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
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
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
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-zinc-800 text-[10px] font-mono font-black text-amber-400 flex items-center justify-center shrink-0">
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
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] space-y-3">
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
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-zinc-800 text-[10px] font-mono font-black text-sky-400 flex items-center justify-center shrink-0">
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
