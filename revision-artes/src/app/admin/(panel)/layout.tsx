import Link from "next/link";
import { Button } from "@heroui/react";
import { requireAdmin } from "@/lib/auth/session";
import { logoutAction } from "../auth-actions";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-separator bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link href="/admin" className="flex items-center gap-2 font-bold">
              <span className="rounded-lg bg-accent px-2 py-1 text-xs font-black text-accent-foreground">GES</span>
              <span>GES: Administrador de Revisión de Artes</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/admin" className="text-muted hover:text-foreground">
                Facultades
              </Link>
              <Link href="/admin/administradores" className="text-muted hover:text-foreground">
                Administradores
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{admin.name}</span>
            <form action={logoutAction}>
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
