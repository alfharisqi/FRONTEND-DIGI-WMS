import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  ChevronsUpDown,
  Command,
  LogOut,
  X,
  Warehouse,
  Radio,
  Check,
  Activity,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WORKSPACES = [
  { id: 'main', name: 'DIGI WMS', plan: 'Enterprise RFID + POS', icon: Command },
  { id: 'rack', name: 'Gudang Zona A–D', plan: 'Putaway & Stock Ledger', icon: Warehouse },
  { id: 'gate', name: 'RFID Gate Terminal', plan: 'UHF 920–923 MHz Live', icon: Radio },
];

export function AppSidebar({
  navGroups,
  activeTab,
  onSelectTab,
  sidebarOpen,
  onCloseMobile,
  sidebarCollapsed,
  variant = 'inset',
  collapsible = 'icon',
  currentUser,
  onOpenGuidebook,
  onOpenHealth,
  onLogout,
}) {
  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);
  const [teamOpen, setTeamOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const teamRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const onOutside = (e) => {
      if (teamRef.current && !teamRef.current.contains(e.target)) {
        setTeamOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const initials = String(currentUser?.full_name || 'DW')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const ActiveIcon = activeWorkspace.icon;
  const isOffcanvasHidden = sidebarCollapsed && collapsible === 'offcanvas';
  const isIconCollapsed = sidebarCollapsed && collapsible === 'icon';

  return (
    <>
      {sidebarOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] md:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col text-sidebar-foreground transition-all duration-200 md:relative shrink-0',
          variant === 'inset' && 'bg-muted/40 dark:bg-sidebar',
          variant === 'floating' &&
            'bg-sidebar md:m-2 md:rounded-xl md:border md:shadow-md',
          variant === 'sidebar' && 'bg-sidebar border-r border-sidebar-border',
          isOffcanvasHidden
            ? 'w-64 md:w-0 md:overflow-hidden md:m-0 md:border-0'
            : isIconCollapsed
            ? 'w-64 md:w-[68px]'
            : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Shadcn Admin TeamSwitcher Header */}
        <div
          ref={teamRef}
          className={cn(
            'relative flex h-16 shrink-0 items-center px-3',
            isIconCollapsed && 'md:justify-center md:px-2'
          )}
        >
          <button
            type="button"
            onClick={() => setTeamOpen((prev) => !prev)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent',
              isIconCollapsed && 'md:justify-center md:p-1'
            )}
          >
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <ActiveIcon className="size-4" />
            </div>
            <div
              className={cn(
                'grid flex-1 text-left text-sm leading-tight min-w-0',
                isIconCollapsed && 'md:hidden'
              )}
            >
              <span className="truncate font-semibold">{activeWorkspace.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {activeWorkspace.plan}
              </span>
            </div>
            <ChevronsUpDown
              className={cn(
                'ml-auto size-4 shrink-0 text-muted-foreground',
                isIconCollapsed && 'md:hidden'
              )}
            />
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent"
            title="Tutup Menu"
          >
            <X className="h-4 w-4" />
          </button>

          {teamOpen && (
            <div className="absolute left-3 top-14 z-50 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Workspace Gudang
              </div>
              {WORKSPACES.map((ws) => {
                const WsIcon = ws.icon;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      setActiveWorkspace(ws);
                      setTeamOpen(false);
                      if (ws.id === 'rack') onSelectTab('stok-rak');
                      else if (ws.id === 'gate') onSelectTab('rfid-gate');
                      else onSelectTab('dashboard');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border bg-background">
                      <WsIcon className="size-3.5" />
                    </div>
                    <span className="flex-1 text-left truncate font-medium text-xs">
                      {ws.name}
                    </span>
                    {activeWorkspace.id === ws.id && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          data-tour="sidebar-nav"
          className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4 custom-scrollbar"
        >
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {isIconCollapsed ? (
                <div className="hidden md:block my-2 border-t border-sidebar-border mx-2" />
              ) : null}
              <p
                className={cn(
                  'px-2.5 text-[11px] font-medium text-muted-foreground/80',
                  isIconCollapsed && 'md:hidden'
                )}
              >
                {group.title}
              </p>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTab(item.id)}
                      title={isIconCollapsed ? item.label : undefined}
                      className={cn(
                        'group flex w-full items-center rounded-md text-sm font-medium transition-colors',
                        isIconCollapsed
                          ? 'md:justify-center md:px-0 px-2.5 py-2'
                          : 'gap-2.5 px-2.5 py-1.5',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive
                            ? 'text-sidebar-primary'
                            : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
                        )}
                      />
                      <span
                        className={cn(
                          'truncate flex-1 text-left text-[13px]',
                          isIconCollapsed && 'md:hidden'
                        )}
                      >
                        {item.label}
                      </span>
                      {item.badge && !isIconCollapsed && (
                        <span
                          className={cn(
                            'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                            item.badgeVariant === 'destructive'
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-primary text-primary-foreground'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Shadcn Admin NavUser Footer Dropdown */}
        <div
          ref={userRef}
          data-tour="sidebar-user-profile"
          className="relative p-2.5"
        >
          <button
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className={cn(
              'flex w-full items-center rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent',
              isIconCollapsed ? 'md:justify-center' : 'gap-2.5'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className={cn('flex-1 min-w-0', isIconCollapsed && 'md:hidden')}>
              <p className="truncate text-xs font-semibold">
                {currentUser?.full_name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground font-mono">
                {currentUser?.role}
              </p>
            </div>
            <ChevronsUpDown
              className={cn(
                'ml-auto size-4 shrink-0 text-muted-foreground',
                isIconCollapsed && 'md:hidden'
              )}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-14 left-2.5 z-50 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
              <div className="px-2.5 py-2 border-b">
                <p className="text-xs font-semibold truncate">
                  {currentUser?.full_name}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  @{currentUser?.username || 'operator'} · {currentUser?.role}
                </p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onSelectTab('pengaturan');
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs hover:bg-accent"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  Pengaturan Sistem
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenHealth?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs hover:bg-accent"
                >
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                  Diagnostik Server
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenGuidebook?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs hover:bg-accent"
                >
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  Panduan Aplikasi
                </button>
              </div>
              <div className="border-t pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Keluar (Logout)
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
