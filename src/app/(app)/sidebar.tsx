"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { MODULES, NAV_ORDER } from "@/lib/ui/modules";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3.5 z-30 rounded-lg border border-border bg-card p-2 shadow-sm md:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={18} aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col overflow-hidden text-white transition-transform duration-300 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background:
            "radial-gradient(400px 300px at 0% 0%, rgb(99 102 241 / 0.35), transparent 70%), radial-gradient(400px 300px at 100% 100%, rgb(217 70 239 / 0.25), transparent 70%), linear-gradient(180deg, #172a45 0%, #1b2150 100%)",
        }}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-5">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
              <Sparkles size={16} aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight">
              EOS <span className="text-white/60">·</span> Nivel 10
            </span>
          </Link>
          <button
            className="rounded-md p-1 text-white/70 hover:bg-white/10 md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {NAV_ORDER.map((key) => {
            const item = MODULES[key];
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={key}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`tone-${key} group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-white/70 hover:translate-x-0.5 hover:bg-white/8 hover:text-white"
                }`}
              >
                {active && (
                  <span
                    className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-tone"
                    aria-hidden
                  />
                )}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                    active
                      ? "icon-chip-solid"
                      : "bg-white/8 text-tone group-hover:scale-110 group-hover:bg-white/15"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.2} aria-hidden />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-[11px] text-white/40">
          Visión · Tracción · Salud
        </div>
      </aside>
    </>
  );
}
