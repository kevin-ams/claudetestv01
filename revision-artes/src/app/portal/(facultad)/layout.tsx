import Link from "next/link";
import { Confeti } from "@/components/celebracion/confeti";
import { BotonVolver } from "@/components/boton-volver";
import { Logo } from "@/components/logo";
import { MenuAyuda } from "@/components/guia/menu-ayuda";
import { Button } from "@heroui/react";
import { requirePortal } from "@/lib/auth/session";
import { salirAction } from "../actions";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { session, facultad } = await requirePortal();
  return (
    <div className="ambient-bg flex flex-1 flex-col">
      <header className="sticky top-2 z-30 mx-2 mt-2 md:top-3 md:mx-auto md:mt-3 md:w-[calc(100%-2rem)] md:max-w-6xl">
        <div className="glass flex h-14 items-center justify-between gap-4 rounded-2xl px-3">
          <Link href="/portal" className="flex min-w-0 items-center gap-3">
            <Logo size={36} />
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
      <Confeti />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <BotonVolver inicio="/portal" />
        {children}
      </main>
    </div>
  );
}
