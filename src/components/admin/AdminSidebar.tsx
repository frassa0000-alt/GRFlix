import React from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  FolderOpen,
  History,
  KeyRound,
  LayoutDashboard,
  Layers,
  Link2,
  ListPlus,
  MessageSquare,
  MonitorPlay,
  PlusCircle,
  Settings,
  Tags,
  Tv,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import { AdminPermissions, AdminSectionId } from '../../types';
import { MashhadLogo } from '../common/MashhadLogo';

export const canViewAdminSection = (
  id: AdminSectionId,
  isSuperAdmin: boolean = true,
  permissions?: AdminPermissions
): boolean => {
  if (isSuperAdmin || !permissions) return true;
  switch (id) {
    case 'admins_permissions':
      return false;
    case 'users':
      return Boolean(permissions.canManageUsers);
    case 'add_movie':
    case 'add_series':
    case 'seasons_episodes':
    case 'video_library':
      return Boolean(permissions.canUpload);
    case 'movies':
    case 'series':
    case 'categories':
    case 'cast_directors':
    case 'playback_links':
      return Boolean(
        permissions.canUpload || permissions.canEditMedia || permissions.canDeleteMedia
      );
    case 'comments_ratings':
    case 'notifications':
      return Boolean(
        permissions.canEditMedia || permissions.canManageUsers || permissions.canManageSettings
      );
    case 'banners_home':
    case 'player_settings':
    case 'site_settings':
    case 'audit_logs':
      return Boolean(permissions.canManageSettings);
    case 'dashboard':
    case 'analytics':
    case 'views_management':
    default:
      return true;
  }
};

export interface AdminNavItem {
  id: AdminSectionId;
  label: string;
  group: string;
  icon: React.FC<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  // 1. Overview
  { id: 'dashboard', label: 'الرئيسية Dashboard', group: 'نظرة عامة', icon: LayoutDashboard },

  // 2-7. Content & Library
  { id: 'movies', label: 'إدارة الأفلام', group: 'المحتوى والوسائط', icon: Film },
  { id: 'add_movie', label: 'إضافة فيلم جديد', group: 'المحتوى والوسائط', icon: PlusCircle },
  { id: 'series', label: 'إدارة المسلسلات', group: 'المحتوى والوسائط', icon: Tv },
  { id: 'add_series', label: 'إضافة مسلسل جديد', group: 'المحتوى والوسائط', icon: ListPlus },
  { id: 'seasons_episodes', label: 'إدارة المواسم والحلقات', group: 'المحتوى والوسائط', icon: Layers },
  { id: 'video_library', label: 'مكتبة الفيديوهات', group: 'المحتوى والوسائط', icon: FolderOpen },

  // 8-9. Metadata & Taxonomy
  { id: 'categories', label: 'إدارة التصنيفات', group: 'التصنيف والطاقم', icon: Tags },
  { id: 'cast_directors', label: 'إدارة الممثلين والمخرجين', group: 'التصنيف والطاقم', icon: UserCheck },

  // 10-12. Users & Community
  { id: 'users', label: 'إدارة المستخدمين', group: 'الجمهور والتفاعل', icon: Users },
  { id: 'comments_ratings', label: 'التعليقات والتقييمات', group: 'الجمهور والتفاعل', icon: MessageSquare },
  { id: 'notifications', label: 'الإشعارات', group: 'الجمهور والتفاعل', icon: Bell },

  // 13-16. Analytics, Home & Streaming
  { id: 'analytics', label: 'الإحصائيات والتحليلات', group: 'البث والتحليلات', icon: BarChart3 },
  { id: 'views_management', label: 'إدارة المشاهدات', group: 'البث والتحليلات', icon: Activity },
  { id: 'banners_home', label: 'إدارة البنرات والواجهة الرئيسية', group: 'البث والتحليلات', icon: Clapperboard },
  { id: 'playback_links', label: 'إدارة روابط التشغيل', group: 'البث والتحليلات', icon: Link2 },

  // 17-20. System & Governance
  { id: 'player_settings', label: 'إعدادات مشغل الفيديو', group: 'النظام والصلاحيات', icon: MonitorPlay },
  { id: 'admins_permissions', label: 'إدارة الصلاحيات والمديرين', group: 'النظام والصلاحيات', icon: KeyRound },
  { id: 'audit_logs', label: 'سجل العمليات', group: 'النظام والصلاحيات', icon: History },
  { id: 'site_settings', label: 'إعدادات الموقع', group: 'النظام والصلاحيات', icon: Settings },
];

interface AdminSidebarProps {
  activeSection: AdminSectionId;
  onSelectSection: (section: AdminSectionId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  counts?: Partial<Record<AdminSectionId, number>>;
  isSuperAdmin?: boolean;
  permissions?: AdminPermissions;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  counts = {},
  isSuperAdmin = true,
  permissions,
}) => {
  const visibleItems = ADMIN_NAV_ITEMS.filter((item) =>
    canViewAdminSection(item.id, isSuperAdmin, permissions)
  );
  const groups = Array.from(new Set(visibleItems.map((item) => item.group)));

  const renderNavBody = (isMobileDrawer: boolean) => {
    const showLabels = isMobileDrawer || !collapsed;

    return (
      <div className="flex flex-col h-full bg-[#0a0a0e] border-r border-white/10 select-none" dir="rtl">
        {/* Sidebar Brand & Collapse */}
        <div className="h-14 px-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
          {showLabels ? (
            <div className="flex items-center gap-2.5 truncate">
              <MashhadLogo className="w-8 h-8" roundedClassName="rounded-xl" />
              <div className="truncate">
                <p className="text-xs font-black text-white tracking-wide truncate">MASHHAD</p>
                <p className="text-[10px] text-[#ea1d24] font-bold truncate">لوحة التحكم الشاملة</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <MashhadLogo className="w-8 h-8" roundedClassName="rounded-xl" />
            </div>
          )}

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              aria-label="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white items-center justify-center border border-white/10 cursor-pointer shrink-0"
              title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            >
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4 no-scrollbar">
          {groups.map((group) => {
            const items = visibleItems.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-1">
                {showLabels && (
                  <p className="px-2.5 pb-1 text-[10px] font-bold text-zinc-500 tracking-wider">
                    {group}
                  </p>
                )}
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  const badge = counts[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={!showLabels ? item.label : undefined}
                      onClick={() => {
                        onSelectSection(item.id);
                        if (isMobileDrawer) onCloseMobile();
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer group relative ${
                        isActive
                          ? 'bg-amber-400 text-black font-black shadow-md shadow-amber-500/15'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-black' : 'text-zinc-400 group-hover:text-amber-400'
                          }`}
                        />
                        {showLabels && <span className="truncate">{item.label}</span>}
                      </div>

                      {showLabels && typeof badge === 'number' && badge > 0 && (
                        <span
                          className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ${
                            isActive
                              ? 'bg-black/15 text-black font-black'
                              : 'bg-white/[0.06] text-zinc-400'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <>
      {/* Fixed Left Desktop Sidebar (ltr positioning fixed left-0 regardless of RTL main container) */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-30 transition-all duration-200 ${
          collapsed ? 'w-[74px]' : 'w-64'
        }`}
      >
        {renderNavBody(false)}
      </aside>

      {/* Mobile Responsive Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          <div className="w-72 max-w-[85vw] h-full shadow-2xl">{renderNavBody(true)}</div>
          <div className="flex-1 bg-black/75 backdrop-blur-xs" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};
