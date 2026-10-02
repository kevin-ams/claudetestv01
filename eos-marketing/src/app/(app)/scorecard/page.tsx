import { getSession } from "@/lib/auth/session";
import {
  listOwners,
  listMetrics,
  listTargets,
  listEntries,
  listMetricSharing,
  listShareableTeams,
  listSharedScorecards,
} from "@/lib/domain/scorecard";
import { SharedScorecards } from "./shared-scorecards";
import { buildScorecardGrid } from "@/lib/domain/scorecard-shared";
import { formatWeekLabel, lastNWeeks, shiftWeek, weekStartISO } from "@/lib/utils/dates";
import { isTeamAdmin } from "@/lib/auth/access";
import { WeekSlider } from "./week-slider";
import { ScorecardTable } from "./scorecard-table";
import { ScorecardAdmin } from "./scorecard-admin";
import { ExportButton } from "@/components/export-button";

/** Ventana de 13 semanas (un trimestre), de la más antigua a la más nueva, con 3 semanas por delante. */
const WINDOW = 13;
const AHEAD = 3;

export default async function ScorecardPage({ searchParams }: PageProps<"/scorecard">) {
  const session = await getSession();
  if (!session) return null;

  const raw = Number((await searchParams).semanas);
  const offset = Number.isInteger(raw) ? Math.max(-52, Math.min(8, raw)) : 0;
  const current = weekStartISO();
  const weeks = lastNWeeks(WINDOW, shiftWeek(current, AHEAD + offset));
  const admin = await isTeamAdmin();
  const [owners, metrics, targets, entries, sharing, shareTeams, shared] = await Promise.all([
    listOwners(session.teamId),
    listMetrics(session.teamId),
    listTargets(session.teamId),
    listEntries(session.teamId, weeks),
    listMetricSharing(session.teamId),
    listShareableTeams(session.teamId),
    listSharedScorecards(session.teamId, lastNWeeks(4)),
  ]);

  const gridMap = buildScorecardGrid(metrics, owners, targets, entries, weeks);
  const grid = Object.fromEntries(gridMap);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scorecard</h1>
          <p className="text-sm text-muted">
            Los 5 a 15 números que predicen el desempeño de tu negocio, revisados cada semana.
          </p>
        </div>
        <ExportButton kind="scorecard" defaultFrom={weeks[0]} defaultTo={weeks[weeks.length - 1]} />
      </div>

      {metrics.length === 0 || owners.length === 0 ? (
        <p className="mb-6 text-sm text-muted">
          Todavía no hay indicadores configurados. Agrégalos abajo en &quot;Gestionar
          indicadores y dueños&quot;.
        </p>
      ) : (
        <div className="mb-6">
          <WeekSlider
            offset={offset}
            label={`${formatWeekLabel(weeks[0])} – ${formatWeekLabel(weeks[weeks.length - 1])}`}
          />
          <ScorecardTable
            canEditTargets={admin}
            currentWeek={current}
            owners={owners}
            metrics={metrics}
            targets={targets}
            grid={grid}
            weeks={weeks}
          />
        </div>
      )}

      <ScorecardAdmin metrics={metrics} owners={owners} sharing={sharing} shareTeams={shareTeams} />

      <SharedScorecards shared={shared} weeks={lastNWeeks(4)} />
    </div>
  );
}
