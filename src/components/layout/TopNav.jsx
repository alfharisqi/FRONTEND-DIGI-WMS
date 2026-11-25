import React from 'react';
import { cn } from '@/lib/utils';

export function TopNav({ links, activeTab, onSelectTab, className }) {
  return (
    <nav
      className={cn(
        'hidden items-center space-x-4 lg:flex xl:space-x-6',
        className
      )}
    >
      {links.map((link) => {
        const isActive = link.matchTabs
          ? link.matchTabs.includes(activeTab)
          : activeTab === link.id;
        return (
          <button
            key={link.id}
            type="button"
            onClick={() => onSelectTab(link.id)}
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {link.label}
          </button>
        );
      })}
    </nav>
  );
}
