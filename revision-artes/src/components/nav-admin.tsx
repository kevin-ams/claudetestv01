"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/admin", etiqueta: "Facultades", activo: (p: string) => p === "/admin" || p.startsWith("/admin/facultades") || p.startsWith("/admin/artes") },
  { href: "/admin/disenadores", etiqueta: "Diseñadores", activo: (p: string) => p.startsWith("/admin/disenadores") },
  { href: "/admin/administradores", etiqueta: "Administradores", activo: (p: string) => p.startsWith("/admin/administradores") },
];

/** Menú del admin; la sección actual va como pastilla en relieve. */
export function NavAdmin() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 text-sm" aria-label="Secciones">
      {ENLACES.map((e) => {
        const activo = e.activo(pathname);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={`rounded-xl px-3 py-1.5 transition-colors ${
              activo ? "nav-active font-semibold text-foreground" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {e.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
