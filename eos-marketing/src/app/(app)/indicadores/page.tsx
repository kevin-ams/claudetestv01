import { Card } from "@heroui/react";
import { getSession } from "@/lib/auth/session";
import { listAliases, listCareers, listRecentImports, listWeekly, weeklyGoals } from "@/lib/domain/careers";
import { mergeWeekly, money, num } from "@/lib/domain/careers-shared";
import { listTeamMembers } from "@/lib/domain/users";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { formatWeekRange, lastClosedWeek, shiftWeek } from "@/lib/utils/dates";
import { CareerBoard } from "./career-board";
import { Toolbar } from "./toolbar";
import { ExportButton } from "@/components/export-button";
import { LoadCatalogButton } from "./load-catalog-button";

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const week = sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? shiftWeek(sp.semana, 0) : lastClosedWeek();

  const [careers, weekly, goals, members, aliases, imports] = await Promise.all([
    listCareers(session.teamId),
    listWeekly(session.teamId, week),
    weeklyGoals(session.teamId, week),
    listTeamMembers(session.teamId),
    listAliases(session.teamId),
    listRecentImports(session.teamId),
  ]);
  const rows = mergeWeekly(careers, weekly, goals);
  const programs = [...new Set(careers.map((c) => c.program))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Indicadores de carrera</h1>
          <p className="text-sm text-muted">
            Leads recibidos y consumo de presupuesto por carrera, contra la meta semanal.
          </p>
        </div>
        <ExportButton kind="indicadores" defaultFrom={shiftWeek(week, -11)} defaultTo={week} />
      </div>

      <Toolbar
        week={week}
        weekLabel={`Semana ${formatWeekRange(week)}`}
        defaultWeek={lastClosedWeek()}
        careers={careers.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
        aliases={aliases}
        members={members}
        programs={programs}
        acConfigured={isActiveCampaignConfigured()}
      />

      {careers.length === 0 ? (
        <Card className="flex flex-col gap-3 p-6">
          <p className="text-sm text-muted">
            Este equipo todavía no tiene carreras. Carga el catálogo del equipo de marketing
            (carreras, responsables y el Rock de Kevin) o agrégalas una por una con &quot;+ Carrera&quot;.
          </p>
          <LoadCatalogButton />
        </Card>
      ) : (
        <CareerBoard rows={rows} members={members} week={week} />
      )}

      {imports.length > 0 && (
        <Card className="block gap-0 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Últimas actualizaciones</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {imports.map((imp) => (
              <li key={imp.id} className="flex flex-wrap gap-x-2 text-muted">
                <span className="font-medium text-foreground">
                  {imp.kind === "budget_csv" ? "Consumo CSV" : "Leads ActiveCampaign"}
                </span>
                <span>· semana {imp.week_start}</span>
                <span>
                  · {imp.careers_updated} carreras ·{" "}
                  {imp.kind === "budget_csv" ? money(imp.total) : `${num(imp.total)} leads`}
                </span>
                {imp.file_name && <span>· {imp.file_name}</span>}
                <span>
                  · {imp.user_name ?? "—"}, {new Date(imp.created_at).toLocaleString("es-GT")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
