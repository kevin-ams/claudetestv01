import { getSession } from "@/lib/auth/session";
import { careerHistory } from "@/lib/domain/careers";
import { listEntries, listMetrics, listOwners, listTargets } from "@/lib/domain/scorecard";
import { buildScorecardGrid } from "@/lib/domain/scorecard-shared";
import { listTeamMembers } from "@/lib/domain/users";
import { lastClosedWeek, shiftWeek } from "@/lib/utils/dates";
import { AnalysisBoard } from "./analysis-board";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const to = sp.hasta && DATE.test(sp.hasta) ? shiftWeek(sp.hasta, 0) : lastClosedWeek();
  const from = sp.desde && DATE.test(sp.desde) && sp.desde <= to ? shiftWeek(sp.desde, 0) : shiftWeek(to, -11);

  const [history, members, owners, metrics, targets] = await Promise.all([
    careerHistory(session.teamId, from, to),
    listTeamMembers(session.teamId),
    listOwners(session.teamId),
    listMetrics(session.teamId),
    listTargets(session.teamId),
  ]);
  const entries = await listEntries(session.teamId, history.weeks);
  const grid = Object.fromEntries(buildScorecardGrid(metrics, owners, targets, entries, history.weeks));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Análisis</h1>
        <p className="text-sm text-muted">
          Gráficas de leads, consumo de presupuesto y Scorecard en el tiempo. Pasa el cursor sobre
          las gráficas para ver cada valor.
        </p>
      </div>
      <AnalysisBoard
        from={from}
        to={to}
        history={history}
        members={members}
        scorecard={{ owners, metrics, targets, grid }}
      />
    </div>
  );
}
