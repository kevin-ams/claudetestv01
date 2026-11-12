import Link from "next/link";
import { Confeti } from "@/components/celebracion/confeti";
import { BotonVolver } from "@/components/boton-volver";
import { Logo } from "@/components/logo";
import { Button } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { contarNoLeidos, listAvisos } from "@/lib/domain/avisos";
import { Campanita } from "@/components/avisos/campanita";
import { NavAdmin } from "@/components/nav-admin";
import { logoutAction } from "../auth-actions";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const [avisos, noLeidos] = await Promise.all([listAvisos(admin.adminId), contarNoLeidos(admin.adminId)]);
  return (
    <div className="ambient-bg flex flex-1 flex-col">
      <header className="sticky top-2 z-30 mx-2 mt-2 print:hidden md:top-3 md:mx-auto md:mt-3 md:w-[calc(100%-2rem)] md:max-w-6xl">
        <div className="glass flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link href="/admin" className="flex items-center gap-2 font-bold">
              <Logo size={36} />
              <span>GES: Administrador de Revisión de Artes</span>
            </Link>
            <NavAdmin />
          </div>
          <div className="flex items-center gap-3">
            <Campanita inicial={{ avisos, noLeidos }} />
            <span className="hidden text-sm text-muted sm:inline">{admin.name}</span>
            <form action={logoutAction}>
              <Button type="submit" size="sm" variant="tertiary">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <Confeti />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <BotonVolver inicio="/admin" />
        {children}
      </main>
    </div>
  );
}
