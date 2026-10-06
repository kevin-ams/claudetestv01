import Link from "next/link";
import { Logo } from "@/components/logo";
import { MenuAyuda } from "@/components/guia/menu-ayuda";
import { Button } from "@heroui/react";
import { requirePortal } from "@/lib/auth/session";
import { salirAction } from "../actions";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { session, facultad } = await requirePortal();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-separator bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/portal" className="flex min-w-0 items-center gap-3">
            <Logo size={40} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Revisión de Artes</p>
              <p className="truncate font-bold">{facultad.nombre}</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <MenuAyuda email={session.email} />
            <div className="hidden text-right text-xs sm:block" data-guia="usuario">
              <p className="font-medium">{session.name}</p>
              <p className="text-muted">{session.email}</p>
            </div>
            <form action={salirAction}>
              <Button type="submit" size="sm" variant="tertiary">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
