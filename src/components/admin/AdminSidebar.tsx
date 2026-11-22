import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  Clapperboard,
  Film,
  FolderOpen,
  History,
  Home,
  KeyRound,
  Layers,
  LayoutDashboard,
  Link2,
  ListPlus,
  MessageSquare,
  MonitorPlay,
  Plus,
  PlusCircle,
  RefreshCw,
  Settings,
  Sliders,
  Tags,
  Tv,
  UserCheck,
  Users,
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
  shortLabel: string;
  groupId: string;
  group: string;
  icon: React.FC<{ className?: string }>;
}

export interface AdminWorkspaceGroup {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

export const ADMIN_WORKSPACE_GROUPS: AdminWorkspaceGroup[] = [
  { id: 'overview', label: 'الرئيسية والتحليلات', icon: Home },
  { id: 'cinema', label: 'المكتبة والأفلام', icon: Film },
  { id: 'series_catalog', label: 'المسلسلات والتصنيف', icon: Tv },
  { id: 'community', label: 'الجمهور والتفاعل', icon: Users },
  { id: 'system', label: 'المظهر والنظام', icon: Sliders },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  // 1. Overview & Analytics
  {
    id: 'dashboard',
    label: 'لوحة التحكم الرئيسية',
    shortLabel: 'الرئيسية',
    groupId: 'overview',
    group: 'الرئيسية والتحليلات',
    icon: LayoutDashboard,
  },
  {
    id: 'analytics',
    label: 'الإحصائيات والتحليلات',
    shortLabel: 'الإحصائيات',
    groupId: 'overview',
    group: 'الرئيسية والتحليلات',
    icon: BarChart3,
  },
  {
    id: 'views_management',
    label: 'سجل وإدارة المشاهدات',
    shortLabel: 'المشاهدات',
    groupId: 'overview',
    group: 'الرئيسية والتحليلات',
    icon: Activity,
  },

  // 2. Movies, Upload & Video Library
  {
    id: 'movies',
    label: 'إدارة الأفلام',
    shortLabel: 'الأفلام',
    groupId: 'cinema',
    group: 'المكتبة والأفلام',
    icon: Film,
  },
  {
    id: 'add_movie',
    label: 'إضافة فيلم جديد',
    shortLabel: 'إضافة فيلم',
    groupId: 'cinema',
    group: 'المكتبة والأفلام',
    icon: PlusCircle,
  },
  {
    id: 'video_library',
    label: 'مكتبة الملفات والفيديو',
    shortLabel: 'مكتبة الفيديو',
    groupId: 'cinema',
    group: 'المكتبة والأفلام',
    icon: FolderOpen,
  },
  {
    id: 'playback_links',
    label: 'روابط ومصادر التشغيل',
    shortLabel: 'روابط التشغيل',
    groupId: 'cinema',
    group: 'المكتبة والأفلام',
    icon: Link2,
  },

  // 3. Series & Taxonomy
  {
    id: 'series',
    label: 'إدارة المسلسلات',
    shortLabel: 'المسلسلات',
    groupId: 'series_catalog',
    group: 'المسلسلات والتصنيف',
    icon: Tv,
  },
  {
    id: 'add_series',
    label: 'إضافة مسلسل جديد',
    shortLabel: 'إضافة مسلسل',
    groupId: 'series_catalog',
    group: 'المسلسلات والتصنيف',
    icon: ListPlus,
  },
  {
    id: 'seasons_episodes',
    label: 'المواسم والحلقات',
    shortLabel: 'الحلقات',
    groupId: 'series_catalog',
    group: 'المسلسلات والتصنيف',
    icon: Layers,
  },
  {
    id: 'categories',
    label: 'التصنيفات والأقسام',
    shortLabel: 'التصنيفات',
    groupId: 'series_catalog',
    group: 'المسلسلات والتصنيف',
    icon: Tags,
  },
  {
    id: 'cast_directors',
    label: 'الممثلون والمخرجون',
    shortLabel: 'الطاقم',
    groupId: 'series_catalog',
    group: 'المسلسلات والتصنيف',
    icon: UserCheck,
  },

  // 4. Community & Users
  {
    id: 'users',
    label: 'إدارة المستخدمين',
    shortLabel: 'المستخدمون',
    groupId: 'community',
    group: 'الجمهور والتفاعل',
    icon: Users,
  },
  {
    id: 'comments_ratings',
    label: 'التعليقات والتقييمات',
    shortLabel: 'التعليقات',
    groupId: 'community',
    group: 'الجمهور والتفاعل',
    icon: MessageSquare,
  },
  {
    id: 'notifications',
    label: 'إرسال الإشعارات',
    shortLabel: 'الإشعارات',
    groupId: 'community',
    group: 'الجمهور والتفاعل',
    icon: Bell,
  },

  // 5. Look, Player & System Governance
  {
    id: 'banners_home',
    label: 'البنرات والواجهة',
    shortLabel: 'البنرات',
    groupId: 'system',
    group: 'المظهر والنظام',
    icon: Clapperboard,
  },
  {
    id: 'player_settings',
    label: 'إعدادات المشغل',
    shortLabel: 'المشغل',
    groupId: 'system',
    group: 'المظهر والنظام',
    icon: MonitorPlay,
  },
  {
    id: 'admins_permissions',
    label: 'المديرون والصلاحيات',
    shortLabel: 'الصلاحيات',
    groupId: 'system',
    group: 'المظهر والنظام',
    icon: KeyRound,
  },
  {
    id: 'audit_logs',
    label: 'سجل العمليات',
    shortLabel: 'السجل',
    groupId: 'system',
    group: 'المظهر والنظام',
    icon: History,
  },
  {
    id: 'site_settings',
    label: 'الإعدادات العامة والبريد',
    shortLabel: 'إعدادات الموقع',
    groupId: 'system',
    group: 'المظهر والنظام',
    icon: Settings,
  },
];

export const getWorkspaceGroupForSection = (sectionId: AdminSectionId): AdminWorkspaceGroup => {
  const nav = ADMIN_NAV_ITEMS.find((n) => n.id === sectionId);
  return (
    ADMIN_WORKSPACE_GROUPS.find((g) => g.id === nav?.groupId) || ADMIN_WORKSPACE_GROUPS[0]
  );
};

interface AdminSidebarProps {
  activeSection: AdminSectionId;
  onSelectSection: (section: AdminSectionId) => void;
  counts?: Partial<Record<AdminSectionId, number>>;
  isSuperAdmin?: boolean;
  permissions?: AdminPermissions;
  onTriggerTmdbSync?: () => void;
  isSyncingTmdb?: boolean;
  tmdbConfigured?: boolean;
}

type PopoverMenuId = 'quick_create' | string | null;

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSelectSection,
  counts = {},
  isSuperAdmin = true,
  permissions,
  onTriggerTmdbSync,
  isSyncingTmdb = false,
  tmdbConfigured = false,
}) => {
  const [openMenu, setOpenMenu] = useState<PopoverMenuId>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [popoverTop, setPopoverTop] = useState<number>(84);
  const railContainerRef = useRef<HTMLDivElement>(null);

  const visibleItems = ADMIN_NAV_ITEMS.filter((item) =>
    canViewAdminSection(item.id, isSuperAdmin, permissions)
  );
  const visibleGroups = ADMIN_WORKSPACE_GROUPS.filter((grp) =>
    visibleItems.some((item) => item.groupId === grp.id)
  );
  const activeGroup = getWorkspaceGroupForSection(activeSection);

  // Close floating menu on Escape or outside click
  useEffect(() => {
    if (!openMenu) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (railContainerRef.current && !railContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openMenu]);

  const handleToggleMenu = (menuId: string, buttonEl: HTMLButtonElement) => {
    if (openMenu === menuId) {
      setOpenMenu(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    const maxSafeTop = Math.max(16, window.innerHeight - 360);
    setPopoverTop(Math.min(Math.max(16, rect.top - 10), maxSafeTop));
    setOpenMenu(menuId);
  };

  const quickCreateActions: Array<{
    id: string;
    label: string;
    section?: AdminSectionId;
    action?: () => void;
    icon: React.FC<{ className?: string }>;
  }> = [
    ...(canViewAdminSection('add_movie', isSuperAdmin, permissions)
      ? [{ id: 'qc-movie', label: 'فيلم جديد', section: 'add_movie' as AdminSectionId, icon: Film }]
      : []),
    ...(canViewAdminSection('add_series', isSuperAdmin, permissions)
      ? [{ id: 'qc-series', label: 'مسلسل جديد', section: 'add_series' as AdminSectionId, icon: Tv }]
      : []),
    ...(canViewAdminSection('seasons_episodes', isSuperAdmin, permissions)
      ? [
          {
            id: 'qc-episodes',
            label: 'إضافة حلقة وموسم',
            section: 'seasons_episodes' as AdminSectionId,
            icon: Layers,
          },
        ]
      : []),
    ...(canViewAdminSection('banners_home', isSuperAdmin, permissions)
      ? [
          {
            id: 'qc-banner',
            label: 'تصميم بنر للواجهة',
            section: 'banners_home' as AdminSectionId,
            icon: Clapperboard,
          },
        ]
      : []),
    ...(canViewAdminSection('notifications', isSuperAdmin, permissions)
      ? [
          {
            id: 'qc-notif',
            label: 'إشعار للجمهور',
            section: 'notifications' as AdminSectionId,
            icon: Bell,
          },
        ]
      : []),
    ...(tmdbConfigured && onTriggerTmdbSync
      ? [
          {
            id: 'qc-tmdb',
            label: isSyncingTmdb ? 'جارٍ المزامنة مع TMDB...' : 'مزامنة TMDB الآن',
            action: () => {
              onTriggerTmdbSync();
              setOpenMenu(null);
            },
            icon: RefreshCw,
          },
        ]
      : []),
  ];

  const activeGroupItems =
    openMenu && openMenu !== 'quick_create'
      ? visibleItems.filter((item) => item.groupId === openMenu)
      : [];
  const openGroupMeta =
    openMenu && openMenu !== 'quick_create'
      ? visibleGroups.find((g) => g.id === openMenu)
      : null;

  return (
    <div ref={railContainerRef} className="relative shrink-0 z-40 flex items-start pt-0.5 select-none">
      {/* Vertical Matte Pill Dock Rail (matches reference silhouette) */}
      <aside
        aria-label="أدوات وشريط لوحة التحكم"
        className="w-[54px] sm:w-[62px] rounded-full bg-[#09090b] border border-white/[0.08] py-2.5 sm:py-3 px-1.5 flex flex-col items-center gap-2 sm:gap-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.75)]"
      >
        {/* Top Minimal Emblem */}
        <button
          type="button"
          onClick={() => {
            onSelectSection('dashboard');
            setOpenMenu(null);
          }}
          title="الرئيسية - MASHHAD"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          <MashhadLogo className="w-7 h-7 sm:w-8 sm:h-8" roundedClassName="rounded-xl" />
        </button>

        {/* Radiant Neon Pink-Magenta '+' Quick-Create Orb */}
        <button
          type="button"
          onClick={(e) => handleToggleMenu('quick_create', e.currentTarget)}
          title="إنشاء سريع"
          aria-expanded={openMenu === 'quick_create'}
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer relative ${
            openMenu === 'quick_create'
              ? 'scale-105 ring-2 ring-[#ff85cb]/60'
              : 'hover:scale-105 active:scale-95'
          } bg-gradient-to-br from-[#ff6bc9] via-[#ff2e93] to-[#d4126b] shadow-[0_0_24px_rgba(255,46,147,0.65)]`}
        >
          <Plus
            className={`w-5 h-5 text-[#14030c] stroke-[2.5] transition-transform duration-200 ${
              openMenu === 'quick_create' ? 'rotate-45' : ''
            }`}
          />
        </button>

        <div className="w-6 h-px bg-white/[0.07] my-0.5" />

        {/* 5 Clean Workspace Group Circular Buttons */}
        <div className="flex flex-col items-center gap-2">
          {visibleGroups.map((group) => {
            const Icon = group.icon;
            const isGroupActive = activeGroup.id === group.id;
            const isMenuOpen = openMenu === group.id;
            return (
              <button
                key={group.id}
                type="button"
                title={group.label}
                aria-expanded={isMenuOpen}
                onClick={(e) => handleToggleMenu(group.id, e.currentTarget)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer border relative ${
                  isMenuOpen
                    ? 'bg-[#25252a] border-[#ff2e93]/55 text-[#ff5ec4] shadow-[0_0_18px_rgba(255,46,147,0.28)]'
                    : isGroupActive
                    ? 'bg-[#1f161c] border-[#ff2e93]/40 text-[#ff5ec4]'
                    : 'bg-[#151518] border-white/[0.05] text-zinc-400 hover:bg-[#202024] hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                {isGroupActive && !isMenuOpen && (
                  <span className="absolute -right-0.5 w-1.5 h-3.5 rounded-full bg-[#ff2e93]" />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Connected Floating Matte Charcoal Popover Card */}
      <AnimatePresence>
        {openMenu && (
          <motion.div
            key={openMenu}
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ top: `${popoverTop}px` }}
            dir="rtl"
            className="fixed left-[68px] sm:left-[84px] z-[120] w-[250px] sm:w-[272px] max-w-[calc(100vw-84px)] rounded-[26px] bg-[#1a1a1d]/98 backdrop-blur-2xl border border-white/[0.09] p-2.5 shadow-[0_24px_64px_rgba(0,0,0,0.85)]"
          >
            {openMenu === 'quick_create' ? (
              <div className="space-y-1">
                <p className="px-3.5 pt-1 pb-1.5 text-[11px] font-bold text-zinc-400">
                  إضافة وإجراءات سريعة
                </p>
                {quickCreateActions.map((act) => {
                  const Icon = act.icon;
                  const isHighlighted =
                    hoveredRowId === act.id || (act.section && activeSection === act.section);
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onMouseEnter={() => setHoveredRowId(act.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                      onClick={() => {
                        if (act.action) {
                          act.action();
                        } else if (act.section) {
                          onSelectSection(act.section);
                          setOpenMenu(null);
                        }
                      }}
                      className={`w-full rounded-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'bg-[#2c2c31] text-white font-black'
                          : 'text-zinc-200 hover:bg-[#252529] font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isHighlighted ? 'text-[#ff45a2]' : 'text-zinc-400'
                          } ${act.id === 'qc-tmdb' && isSyncingTmdb ? 'animate-spin' : ''}`}
                        />
                        <span className="truncate">{act.label}</span>
                      </div>
                      <ChevronLeft className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {openGroupMeta && (
                  <p className="px-3.5 pt-1 pb-1.5 text-[11px] font-bold text-zinc-400">
                    {openGroupMeta.label}
                  </p>
                )}
                {activeGroupItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = activeSection === item.id;
                  const isHighlighted = hoveredRowId === item.id || isCurrent;
                  const badge = counts[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setHoveredRowId(item.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                      onClick={() => {
                        onSelectSection(item.id);
                        setOpenMenu(null);
                      }}
                      className={`w-full rounded-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'bg-[#2c2c31] text-white font-black'
                          : 'text-zinc-200 hover:bg-[#252529] font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isHighlighted ? 'text-[#ff45a2]' : 'text-zinc-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {typeof badge === 'number' && badge > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-zinc-400 shrink-0">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
