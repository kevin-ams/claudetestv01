"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/vto", label: "V/TO", icon: "🧭" },
  { href: "/accountability", label: "Organigrama", icon: "🗂️" },
  { href: "/rocks", label: "Rocks", icon: "🪨" },
  { href: "/scorecard", label: "Scorecard", icon: "📊" },
  { href: "/indicadores", label: "Indicadores de carrera", icon: "🎓" },
  { href: "/issues", label: "Issues", icon: "⚠️" },
  { href: "/todos", label: "To-Dos", icon: "✅" },
  { href: "/meeting", label: "Reunión L10", icon: "⏱️" },
  { href: "/settings/team", label: "Equipo", icon: "👥" },
];

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
        className="fixed left-4 top-4 z-30 rounded-md border border-border bg-card p-2 shadow-sm md:hidden"
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-primary text-primary-foreground transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="text-lg font-bold tracking-tight">EOS · Marketing</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
