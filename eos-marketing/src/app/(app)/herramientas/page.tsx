import Link from "next/link";
import { buttonVariants } from "@heroui/styles";
import { requireModulePage } from "@/lib/auth/access";
import { listVisibleTools } from "@/lib/domain/tools";
import { ArrowUpRightFromSquare } from "@gravity-ui/icons";
import { ToolIcon } from "@/components/tool-icon";
import { groupByCategory, type Tool } from "@/lib/domain/tools-shared";

export default async function ToolsIndexPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const access = await requireModulePage("herramientas");
  const { categoria } = await searchParams;
  const tools = await listVisibleTools({
    teamId: access.session.teamId,
    userId: access.session.userId,
    roleId: access.roleId,
    isAdmin: access.isAdmin,
  });
  const groups = groupByCategory(tools);
  const selected = groups.some((g) => g.category === categoria) ? categoria : null;
  const shown = selected ? groups.filter((g) => g.category === selected) : groups;
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted hover:border-primary hover:text-primary"
    }`;

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
        <>
          {groups.length > 1 && (
            <nav aria-label="Categorías" className="flex flex-wrap gap-2">
              <Link href="/herramientas" className={chip(!selected)}>
                Todas · {tools.length}
              </Link>
              {groups.map((g) => (
                <Link key={g.category} href={`/herramientas?categoria=${encodeURIComponent(g.category)}`} className={chip(selected === g.category)}>
                  {g.category} · {g.tools.length}
                </Link>
              ))}
            </nav>
          )}
          {shown.map((g) => (
            <section key={g.category} className="flex flex-col gap-3">
              {groups.length > 1 && <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{g.category}</h2>}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.tools.map((t) => (
                  <ToolCard key={t.id} tool={t} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function ToolCard({ tool: t }: { tool: Tool }) {
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <ToolIcon name={t.icon} kind={t.kind} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold group-hover:text-primary">{t.name}</p>
        {t.description && <p className="text-sm text-muted">{t.description}</p>}
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          {t.kind === "link" ? (
            <>
              Abre en una pestaña nueva <ArrowUpRightFromSquare width={12} height={12} aria-hidden />
            </>
          ) : (
            "Se abre dentro de la app"
          )}
        </p>
      </div>
    </>
  );
  const cls = "card card--default group flex h-full flex-row items-start gap-3 p-4 transition hover:border-primary hover:shadow-md";
  return (
    <li>
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
}
