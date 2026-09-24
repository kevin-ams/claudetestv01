"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Magnifier, Xmark } from "@gravity-ui/icons";
import { Button, Chip, Input, Tooltip } from "@heroui/react";
import { NAV_GROUPS, SETTINGS_ITEM, isActive, type NavBadge, type NavItem } from "./nav";
import { useShell } from "./shell";

function initials(name: string) {
  const words = name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return "EQ";
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function NavLink({
  item,
  active,
  count,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { Icon } = item;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        active
          ? "bg-accent-soft font-medium text-foreground"
          : "text-foreground/80 hover:bg-default hover:text-foreground"
      } ${collapsed ? "md:justify-center md:px-0" : ""}`}
    >
      <Icon className={`size-4 shrink-0 ${active ? "text-accent" : "text-muted"}`} aria-hidden />
      <span className={`truncate ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
      {count !== undefined && count > 0 && (
        <>
          <Chip size="sm" variant="soft" className={`ml-auto tabular-nums ${collapsed ? "md:hidden" : ""}`}>
            {count}
          </Chip>
          {collapsed && (
            <span className="absolute right-1.5 top-1.5 hidden size-2 rounded-full bg-accent md:block" aria-hidden />
          )}
        </>
      )}
    </Link>
  );

  return (
    <Tooltip delay={0} isDisabled={!collapsed}>
      <Tooltip.Trigger className="block">{link}</Tooltip.Trigger>
      <Tooltip.Content placement="right">
        <p>
          {item.label}
          {count ? ` · ${count}` : ""}
        </p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function Sidebar({ teamName, counts }: { teamName: string; counts: Record<NavBadge, number> }) {
  const pathname = usePathname();
  const { collapsed, mobileOpen, setMobileOpen } = useShell();
  const [query, setQuery] = useState<string | null>(null);
  const close = () => setMobileOpen(false);

  const q = normalize(query ?? "");
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !q || normalize(i.label).includes(q)),
  })).filter((g) => g.items.length > 0);
  const showSettings = !q || normalize(SETTINGS_ITEM.label).includes(q);
  // En modo colapsado (solo escritorio) se ocultan textos y buscador.
  const narrow = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={close} aria-hidden />}

      <aside
        aria-label="Menú principal"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-[width,transform] duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        } ${narrow ? "md:w-16" : ""}`}
      >
        <div className={`flex h-16 shrink-0 items-center gap-2.5 px-3 ${narrow ? "md:justify-center md:px-0" : ""}`}>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground"
            aria-hidden
          >
            {initials(teamName)}
          </span>
          <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${narrow ? "md:hidden" : ""}`}>{teamName}</span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className={narrow ? "md:hidden" : ""}
            aria-label={query === null ? "Buscar en el menú" : "Cerrar búsqueda"}
            onPress={() => setQuery(query === null ? "" : null)}
          >
            {query === null ? <Magnifier /> : <Xmark />}
          </Button>
        </div>

        {query !== null && !narrow && (
          <div className="px-3 pb-2">
            <Input
              autoFocus
              fullWidth
              aria-label="Buscar sección"
              placeholder="Buscar sección…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery(null)}
            />
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-3">
          {groups.map((group, gi) => (
            <div key={group.label ?? gi} className="flex flex-col gap-0.5">
              {group.label && (
                <p className={`px-2.5 pb-1 text-xs font-medium text-muted ${narrow ? "md:hidden" : ""}`}>{group.label}</p>
              )}
              {group.label && narrow && <hr className="mx-3 mb-1 hidden border-border md:block" />}
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  count={item.badge ? counts[item.badge] : undefined}
                  collapsed={narrow}
                  onNavigate={close}
                />
              ))}
            </div>
          ))}
          {groups.length === 0 && !showSettings && <p className="px-2.5 text-sm text-muted">Sin resultados.</p>}
        </nav>

        {showSettings && (
          <div className="border-t border-border p-2">
            <NavLink
              item={SETTINGS_ITEM}
              active={isActive(pathname, SETTINGS_ITEM.href)}
              collapsed={narrow}
              onNavigate={close}
            />
          </div>
        )}
      </aside>
    </>
  );
}
