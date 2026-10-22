import { requireSession } from "@/lib/auth/session";
import { Sidebar } from "./sidebar";

export default async function CrmLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold">{session.name}</p>
            <p className="text-xs text-muted">{session.email}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            {initials}
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn btn-ghost text-xs">
              Salir
            </button>
          </form>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
