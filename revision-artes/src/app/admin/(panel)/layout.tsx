import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { logoutAction } from "../auth-actions";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-bold">
              Revisión de Artes
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
              <button type="submit" className="btn btn-secondary !px-3 !py-1.5 text-xs">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
