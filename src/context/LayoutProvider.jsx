import React, { createContext, useContext, useState } from 'react';

const LAYOUT_KEY = 'digiwms-shadcn-layout';

const defaultLayout = {
  variant: 'inset', // 'inset' | 'floating' | 'sidebar'
  collapsible: 'icon', // 'icon' | 'offcanvas'
};

const LayoutContext = createContext({
  ...defaultLayout,
  setVariant: () => {},
  setCollapsible: () => {},
  resetLayout: () => {},
});

export function LayoutProvider({ children }) {
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) return { ...defaultLayout, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return defaultLayout;
  });

  const persist = (next) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const setVariant = (variant) => persist({ ...layout, variant });
  const setCollapsible = (collapsible) => persist({ ...layout, collapsible });
  const resetLayout = () => persist(defaultLayout);

  return (
    <LayoutContext.Provider
      value={{
        variant: layout.variant,
        collapsible: layout.collapsible,
        setVariant,
        setCollapsible,
        resetLayout,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
