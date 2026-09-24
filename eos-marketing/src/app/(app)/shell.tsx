"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";
import { SIDEBAR_COOKIE } from "@/lib/theme";


type ShellState = {
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /** En escritorio colapsa el menú a solo íconos; en celular lo abre. */
  toggleSidebar: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = use(ShellContext);
  if (!ctx) throw new Error("useShell debe usarse dentro de <AppShell>");
  return ctx;
}

export function AppShell({ initialCollapsed, children }: { initialCollapsed: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "open" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);

  return (
    <ShellContext value={{ collapsed, mobileOpen, setMobileOpen, toggleSidebar }}>
      <div className="group/shell flex min-h-screen flex-1 bg-background" data-collapsed={collapsed}>
        {children}
      </div>
    </ShellContext>
  );
}
