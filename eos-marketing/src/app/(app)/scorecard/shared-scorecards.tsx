import { Card, Chip } from "@heroui/react";
import type { SharedScorecard } from "@/lib/domain/scorecard";
import type { ScorecardMetric, ScorecardOwner } from "@/lib/domain/types";
import { buildScorecardGrid, formatValue, getCell, statusFor, targetFor } from "@/lib/domain/scorecard-shared";
import { formatWeekLabel } from "@/lib/utils/dates";

const CELL: Record<string, string> = { green: "text-green", red: "bg-red-bg text-red font-semibold", empty: "text-muted" };

/** Indicadores que otros equipos comparten con este (solo lectura). */
export function SharedScorecards({ shared, weeks }: { shared: SharedScorecard[]; weeks: string[] }) {
  if (shared.length === 0) return null;
  return (
    <section className="mt-8 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">De otros equipos</h2>
        <p className="text-sm text-muted">Indicadores que otros equipos hicieron visibles para ustedes. Solo lectura.</p>
      </div>
      {shared.map((sc) => {
        const grid = buildScorecardGrid(sc.metrics, sc.owners, sc.targets, sc.entries, weeks);
        // Un renglón por dueño con meta o datos; si el indicador aún no tiene, uno vacío.
        const rows = sc.metrics.flatMap((m): { m: ScorecardMetric; o: ScorecardOwner | null }[] => {
          const withData = sc.owners
            .filter((o) => targetFor(sc.targets, m.id, o.id) !== null || weeks.some((w) => getCell(grid, m.id, o.id, w) !== null))
            .map((o) => ({ m, o }));
          return withData.length ? withData : [{ m, o: null }];
        });
        return (
          <Card key={sc.teamId} className="block gap-0 overflow-x-auto p-0">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Chip size="sm" variant="soft" color="accent">
                {sc.teamName}
              </Chip>
              <span className="text-sm text-muted">{sc.metrics.length} indicador(es)</span>
            </div>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2">Indicador</th>
                  <th className="px-2">Dueño</th>
                  <th className="px-2 text-right">Meta</th>
                  {weeks.map((w) => (
                    <th key={w} className="px-2 text-right">
                      {formatWeekLabel(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ m, o }) => {
                  if (!o) {
                    return (
                      <tr key={`${m.id}-empty`} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{m.name}</td>
                        <td colSpan={2 + weeks.length} className="px-2 text-muted">
                          Sin metas ni datos todavía.
                        </td>
                      </tr>
                    );
                  }
                  const target = targetFor(sc.targets, m.id, o.id);
                  return (
                    <tr key={`${m.id}-${o.id}`} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{m.name}</td>
                      <td className="px-2 text-muted">
                        {o.name}
                        {o.is_rollup && " (rollup)"}
                      </td>
                      <td className="px-2 text-right tabular-nums">{formatValue(target, m.format)}</td>
                      {weeks.map((w) => {
                        const v = getCell(grid, m.id, o.id, w);
                        return (
                          <td key={w} className={`px-2 text-right tabular-nums ${CELL[statusFor(v, target, m.direction)]}`}>
                            {formatValue(v, m.format)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
    </section>
  );
}
