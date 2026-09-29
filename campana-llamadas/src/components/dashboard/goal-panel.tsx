"use client";

import type { AgentGoal } from "@/lib/calls/analytics";
import { ChartCard, Empty, fmtPct } from "./charts";

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Status({ value, goal }: { value: number; goal: number }) {
  const met = value >= goal;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        met ? "bg-green-bg text-green" : "bg-red-bg text-red"
      }`}
    >
      <span aria-hidden>{met ? "✓" : "✗"}</span>
      {met ? "Meta cumplida" : `Faltan ${goal - value}`}
    </span>
  );
}

function Progress({ value, goal }: { value: number; goal: number }) {
  const pct = Math.min(value / goal, 1);
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct * 100}%`, background: value >= goal ? "var(--green)" : "#2a78d6" }}
      />
    </div>
  );
}

export function GoalPanel({ goals, goal }: { goals: AgentGoal[]; goal: number }) {
  const dated = goals.filter((g) => g.days.length > 0);
  const allDays = [...new Set(dated.flatMap((g) => g.days.map((d) => d.day)))].sort();
  const noDates = goals.filter((g) => g.days.length === 0);
  const undated = goals.reduce((s, g) => s + g.undatedEffective, 0);

  return (
    <>
      <ChartCard
        title={`Meta diaria: ${goal} llamadas efectivas por asesor`}
        subtitle="Último día con llamadas de cada asesor y su promedio en el período filtrado"
      >
        {dated.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
            {dated.map((g) => (
              <div key={g.agent} className="break-inside-avoid rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{g.agent}</p>
                    <p className="text-xs text-muted">Último día: {fmtDay(g.lastDay!.day)}</p>
                  </div>
                  <Status value={g.lastDay!.effective} goal={goal} />
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums">
                  {g.lastDay!.effective}
                  <span className="text-base font-medium text-muted"> / {goal} efectivas</span>
                </p>
                <div className="mt-2">
                  <Progress value={g.lastDay!.effective} goal={goal} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted">Promedio diario</dt>
                    <dd className="text-sm font-semibold tabular-nums">{g.avgEffective.toFixed(1)} efectivas</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Días con meta cumplida</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                      {g.daysMet} de {g.days.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Acumulado del período</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                      {g.periodEffective} / {g.periodGoal} ({fmtPct(g.periodEffective / g.periodGoal)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Para llegar a la meta</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                      {g.callsNeeded ? `~${g.callsNeeded} llamadas/día` : "–"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-muted">
                  Con su tasa de contacto actual de {fmtPct(g.contactRate)}.
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No hay llamadas con fecha en esta selección.</Empty>
        )}
        {noDates.length > 0 && (
          <p className="mt-3 rounded-lg bg-red-bg px-3 py-2 text-xs text-red">
            <span aria-hidden>⚠ </span>
            Sin fecha para medir la meta: {noDates.map((g) => g.agent).join(", ")}. Ninguna de sus
            llamadas en esta selección tiene “Día”.
          </p>
        )}
        {undated > 0 && (
          <p className="mt-3 text-xs text-muted">
            {undated} llamadas efectivas no tienen “Día” y no cuentan para la meta diaria.
          </p>
        )}
      </ChartCard>

      <ChartCard title="Efectivas por día vs meta" subtitle={`✓ = llegó a ${goal} efectivas ese día`}>
        {allDays.length ? (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Asesor</th>
                  {allDays.map((d) => (
                    <th key={d} className="px-2 text-center">
                      {fmtDay(d)}
                    </th>
                  ))}
                  <th className="pl-2 text-right">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {dated.map((g) => {
                  const byDay = new Map(g.days.map((d) => [d.day, d]));
                  return (
                    <tr key={g.agent} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-medium">{g.agent}</td>
                      {allDays.map((day) => {
                        const d = byDay.get(day);
                        if (!d) {
                          return (
                            <td key={day} className="px-2 text-center text-muted">
                              –
                            </td>
                          );
                        }
                        const met = d.effective >= goal;
                        return (
                          <td key={day} className="px-1 py-1 text-center">
                            <span
                              className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${
                                met ? "bg-green-bg text-green" : "bg-red-bg text-red"
                              }`}
                              title={`${d.effective} efectivas de ${d.calls} llamadas`}
                            >
                              <span aria-hidden>{met ? "✓" : "✗"}</span>
                              {d.effective}/{goal}
                            </span>
                            <span className="block text-[10px] text-muted">{d.calls} llam.</span>
                          </td>
                        );
                      })}
                      <td className="pl-2 text-right font-semibold tabular-nums">{g.avgEffective.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </ChartCard>
    </>
  );
}
