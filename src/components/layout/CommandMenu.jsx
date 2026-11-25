import React, { useEffect, useState } from 'react';
import { Search, Moon, Sun, Laptop, ArrowRight, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeProvider';

export function CommandMenu({ open, onOpenChange, navGroups, onSelectTab }) {
  const [query, setQuery] = useState('');
  const { setTheme } = useTheme();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-[2px] pt-[12vh] p-4 animate-in fade-in-0"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik perintah atau cari halaman..."
            className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 custom-scrollbar">
          {filteredGroups.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada menu yang cocok dengan &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.title} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          onOpenChange(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div className="mt-2 border-t pt-2">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Tema Tampilan
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  onOpenChange(false);
                }}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  onOpenChange(false);
                }}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme('system');
                  onOpenChange(false);
                }}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              >
                <Laptop className="h-3.5 w-3.5" />
                System
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
