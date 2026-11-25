import React, { useState, useRef, useEffect } from 'react';
import { Activity, BookOpen, LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProfileDropdown({
  currentUser,
  onNavigate,
  onOpenHealth,
  onOpenGuidebook,
  onLogout,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((prev) => !prev)}
        className="relative h-8 w-8 rounded-full p-0"
        title={`${currentUser?.full_name || 'User'} (${currentUser?.role || 'Staff'})`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </div>
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-2.5 py-2 border-b">
            <p className="text-sm font-medium leading-none truncate">
              {currentUser?.full_name || 'Operator DIGI WMS'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
              {currentUser?.username ? `@${currentUser.username} · ` : ''}
              {currentUser?.role || 'STAFF'}
            </p>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                onNavigate('pengaturan');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Pengaturan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenHealth();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Activity className="h-4 w-4 text-emerald-500" />
              <span>Diagnostik Server</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenGuidebook();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>Panduan Aplikasi</span>
            </button>
          </div>

          <div className="border-t pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
