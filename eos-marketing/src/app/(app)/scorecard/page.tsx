import { getSession } from "@/lib/auth/session";
import {
  listOwners,
  listMetrics,
  listTargets,
  listEntries,
} from "@/lib/domain/scorecard";
import { buildScorecardGrid } from "@/lib/domain/scorecard-shared";
import { lastNWeeks } from "@/lib/utils/dates";
import { ScorecardTable } from "./scorecard-table";
import { ScorecardAdmin } from "./scorecard-admin";
import { ExportButton } from "@/components/export-button";

export default async function ScorecardPage() {
  const session = await getSession();
  if (!session) return null;

  const weeks = lastNWeeks(8);
  const [owners, metrics, targets, entries] = await Promise.all([
    listOwners(session.teamId),
    listMetrics(session.teamId),
    listTargets(session.teamId),
    listEntries(session.teamId, weeks),
  ]);

  const gridMap = buildScorecardGrid(metrics, owners, targets, entries, weeks);
  const grid = Object.fromEntries(gridMap);

  return (
    <div className="mx-auto max-w-6xl">
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
          <ScorecardTable
            owners={owners}
            metrics={metrics}
            targets={targets}
            grid={grid}
            weeks={weeks}
          />
        </div>
      )}

      <ScorecardAdmin metrics={metrics} owners={owners} />
    </div>
  );
}
