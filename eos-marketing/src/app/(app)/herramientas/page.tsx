import Link from "next/link";
import { buttonVariants } from "@heroui/styles";
import { requireModulePage } from "@/lib/auth/access";
import { listVisibleTools } from "@/lib/domain/tools";

export default async function ToolsIndexPage() {
  const access = await requireModulePage("herramientas");
  const tools = await listVisibleTools({
    teamId: access.session.teamId,
    userId: access.session.userId,
    roleId: access.roleId,
    isAdmin: access.isAdmin,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Otras herramientas</h1>
          <p className="text-sm text-muted">Accesos directos y sitios que el equipo usa a diario.</p>
        </div>
        {access.isAdmin && (
          <Link href="/ajustes/herramientas" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Administrar herramientas
          </Link>
        )}
      </div>

      {tools.length === 0 ? (
        <p className="card card--default p-6 text-sm text-muted">
          {access.isAdmin
            ? "Todavía no hay herramientas. Agrégalas en Ajustes › Caja de herramientas."
            : "Todavía no tienes herramientas disponibles."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const body = (
              <>
                <span className="text-3xl" aria-hidden>
                  {t.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold group-hover:text-primary">{t.name}</p>
                  {t.description && <p className="text-sm text-muted">{t.description}</p>}
                  <p className="mt-1 text-xs text-muted">{t.kind === "link" ? "Abre en una pestaña nueva ↗" : "Se abre dentro de la app"}</p>
                </div>
              </>
            );
            const cls = "card card--default group flex h-full flex-row items-start gap-3 p-4 transition hover:border-primary hover:shadow-md";
            return (
              <li key={t.id}>
                {t.kind === "link" ? (
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className={cls}>
                    {body}
                  </a>
                ) : (
                  <Link href={`/herramientas/${t.id}`} className={cls}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
