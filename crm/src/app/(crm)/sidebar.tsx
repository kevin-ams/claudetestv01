"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { NAV_SECTIONS } from "./nav";

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
        className="fixed left-4 top-4 z-30 rounded-lg border border-border bg-card p-2 shadow-sm md:hidden"
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-border bg-card transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-brand-tint text-brand"
                          : "text-ink/75 hover:bg-brand-tint/60 hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
