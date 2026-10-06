import Link from "next/link";
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
            <span className="rounded-lg bg-accent px-2 py-1 text-xs font-black text-accent-foreground">GES</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Revisión de Artes</p>
              <p className="truncate font-bold">{facultad.nombre}</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
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
