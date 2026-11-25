import React, { useState } from 'react';
import { Settings, RotateCcw, X, Check } from 'lucide-react';
import { useTheme } from '@/context/ThemeProvider';
import { useLayout } from '@/context/LayoutProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function MiniPreview({ active, label, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-1.5 text-left"
    >
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-lg border-2 p-1.5 transition-all',
          active
            ? 'border-primary ring-2 ring-primary/15'
            : 'border-border hover:border-muted-foreground/50'
        )}
      >
        {children}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <span
        className={cn(
          'text-xs font-medium',
          active ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function ConfigDrawer() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { variant, setVariant, collapsible, setCollapsible, resetLayout } =
    useLayout();

  const handleReset = () => {
    setTheme('light');
    resetLayout();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="rounded-full"
        title="Pengaturan Tampilan (Shadcn Admin)"
      >
        <Settings className="h-[1.1rem] w-[1.1rem]" />
        <span className="sr-only">Open theme settings</span>
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px] animate-in fade-in-0"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-sm flex-col border-l bg-background text-foreground shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Theme Settings
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sesuaikan tampilan dan tata letak sesuai gaya shadcn-admin.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
              {/* Theme Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Theme</span>
                  {theme !== 'light' && (
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MiniPreview
                    label="System"
                    active={theme === 'system'}
                    onClick={() => setTheme('system')}
                  >
                    <div className="flex h-12 w-full overflow-hidden rounded border">
                      <div className="w-1/2 bg-white p-1.5 space-y-1">
                        <div className="h-1.5 w-6 rounded bg-slate-300" />
                        <div className="h-1.5 w-8 rounded bg-slate-200" />
                      </div>
                      <div className="w-1/2 bg-slate-950 p-1.5 space-y-1">
                        <div className="h-1.5 w-6 rounded bg-slate-700" />
                        <div className="h-1.5 w-8 rounded bg-slate-800" />
                      </div>
                    </div>
                  </MiniPreview>

                  <MiniPreview
                    label="Light"
                    active={theme === 'light'}
                    onClick={() => setTheme('light')}
                  >
                    <div className="h-12 w-full rounded border bg-white p-1.5 space-y-1.5">
                      <div className="h-2 w-10 rounded bg-slate-900/80" />
                      <div className="h-1.5 w-14 rounded bg-slate-200" />
                      <div className="h-1.5 w-11 rounded bg-slate-200" />
                    </div>
                  </MiniPreview>

                  <MiniPreview
                    label="Dark"
                    active={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                  >
                    <div className="h-12 w-full rounded border border-slate-800 bg-slate-950 p-1.5 space-y-1.5">
                      <div className="h-2 w-10 rounded bg-slate-200" />
                      <div className="h-1.5 w-14 rounded bg-slate-800" />
                      <div className="h-1.5 w-11 rounded bg-slate-800" />
                    </div>
                  </MiniPreview>
                </div>
              </div>

              {/* Sidebar Variant */}
              <div className="space-y-2.5">
                <span className="text-sm font-semibold block">Sidebar</span>
                <div className="grid grid-cols-3 gap-3">
                  <MiniPreview
                    label="Inset"
                    active={variant === 'inset'}
                    onClick={() => setVariant('inset')}
                  >
                    <div className="flex h-12 w-full gap-1 rounded bg-muted p-1">
                      <div className="w-4 rounded-sm bg-muted-foreground/20" />
                      <div className="flex-1 rounded-md border bg-background shadow-sm" />
                    </div>
                  </MiniPreview>

                  <MiniPreview
                    label="Floating"
                    active={variant === 'floating'}
                    onClick={() => setVariant('floating')}
                  >
                    <div className="flex h-12 w-full gap-1.5 rounded bg-background p-1">
                      <div className="w-4 rounded-md border bg-card shadow-sm" />
                      <div className="flex-1 rounded-sm bg-muted/40" />
                    </div>
                  </MiniPreview>

                  <MiniPreview
                    label="Sidebar"
                    active={variant === 'sidebar'}
                    onClick={() => setVariant('sidebar')}
                  >
                    <div className="flex h-12 w-full overflow-hidden rounded border bg-background">
                      <div className="w-4 border-r bg-muted/50" />
                      <div className="flex-1 bg-background" />
                    </div>
                  </MiniPreview>
                </div>
              </div>

              {/* Layout / Collapsible */}
              <div className="space-y-2.5">
                <span className="text-sm font-semibold block">
                  Sidebar Collapse Mode
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <MiniPreview
                    label="Icon Rail"
                    active={collapsible === 'icon'}
                    onClick={() => setCollapsible('icon')}
                  >
                    <div className="flex h-10 w-full gap-1 rounded bg-muted/60 p-1">
                      <div className="flex w-3 flex-col items-center gap-1 rounded-sm bg-background py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      </div>
                      <div className="flex-1 rounded-sm bg-background border" />
                    </div>
                  </MiniPreview>

                  <MiniPreview
                    label="Offcanvas"
                    active={collapsible === 'offcanvas'}
                    onClick={() => setCollapsible('offcanvas')}
                  >
                    <div className="flex h-10 w-full rounded bg-muted/60 p-1">
                      <div className="flex-1 rounded-sm bg-background border" />
                    </div>
                  </MiniPreview>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4">
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleReset}
              >
                Reset Semua Pengaturan
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
