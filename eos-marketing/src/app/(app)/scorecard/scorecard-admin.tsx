"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Card, Input } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useState, useTransition } from "react";
import type { ScorecardMetric, ScorecardOwner } from "@/lib/domain/types";
import type { MetricSharing } from "@/lib/domain/scorecard";
import { MetricSharingControl } from "./metric-sharing";
import {
  createMetricAction,
  archiveMetricAction,
  createOwnerAction,
  deleteOwnerAction,
  setMetricCalcAction,
} from "./actions";

export function ScorecardAdmin({
  metrics,
  owners,
  sharing,
  shareTeams,
}: {
  metrics: ScorecardMetric[];
  owners: ScorecardOwner[];
  sharing: Record<number, MetricSharing>;
  shareTeams: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const manual = metrics.filter((m) => m.calc_numerator_id === null);

  return (
    <Card className="block gap-0 p-4">
      <Button size="sm" variant="ghost"
        className="text-sm text-primary"
        onPress={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar" : "Gestionar indicadores y dueños"}
      </Button>

      {open && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Indicadores</h4>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {metrics.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 border-b border-border pb-1">
                  <span className="pt-1.5">{m.name}</span>
                  <div className="flex items-start gap-1">
                    <CalcControl metric={m} metrics={metrics} />
                    <MetricSharingControl
                      metricId={m.id}
                      sharing={sharing[m.id] ?? { shared_all: false, team_ids: [] }}
                      teams={shareTeams}
                    />
                    <Button size="sm" variant="ghost"
                      className="text-xs text-red"
                      onPress={() => archiveMetricAction(m.id)}
                    >
                      Archivar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <form action={createMetricAction} className="flex flex-col gap-2">
              <Input fullWidth name="name" required placeholder="Nombre del indicador" />
              <Input fullWidth name="predicts" placeholder="¿Qué predice?" />
              <div className="flex gap-2">
                <AppSelect fullWidth name="direction" defaultValue="higher_better">
                  <option value="higher_better">Mayor mejor</option>
                  <option value="lower_better">Menor mejor</option>
                </AppSelect>
                <AppSelect fullWidth name="format" defaultValue="count">
                  <option value="count">Conteo</option>
                  <option value="percentage">%</option>
                  <option value="currency">Moneda</option>
                </AppSelect>
                <AppSelect fullWidth name="aggregation" defaultValue="sum">
                  <option value="sum">Suma (rollup)</option>
                  <option value="average">Promedio (rollup)</option>
                </AppSelect>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted">
                  Opcional — indicador calculado (p. ej. % Hygiene = Hygiene ÷ Cadencia). Si es %, se multiplica por 100.
                </p>
                <div className="flex gap-2">
                  <AppSelect fullWidth name="calcNumeratorId" defaultValue="-" aria-label="Numerador">
                    <option value="-">Manual (sin cálculo)</option>
                    {manual.map((x) => (
                      <option key={x.id} value={String(x.id)}>
                        {x.name}
                      </option>
                    ))}
                  </AppSelect>
                  <span className="self-center text-muted">÷</span>
                  <AppSelect fullWidth name="calcDenominatorId" defaultValue="-" aria-label="Denominador">
                    <option value="-">—</option>
                    {manual.map((x) => (
                      <option key={x.id} value={String(x.id)}>
                        {x.name}
                      </option>
                    ))}
                  </AppSelect>
                </div>
              </div>
              <Button variant="primary" type="submit" className="self-start">
                + Agregar indicador
              </Button>
            </form>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Dueños del scorecard</h4>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {owners.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    {o.name}
                    {o.is_rollup && " (rollup)"}
                  </span>
                  <Button size="sm" variant="ghost"
                    className="text-xs text-red"
                    onPress={() => deleteOwnerAction(o.id)}
                  >
                    Eliminar
                  </Button>
                </li>
              ))}
            </ul>
            <form action={createOwnerAction} className="flex flex-col gap-2">
              <Input fullWidth name="name" required placeholder="Nombre del dueño" />
              <AppCheckbox name="isRollup" className="flex items-center gap-2 text-sm">
                Es un rollup calculado (ej. &quot;General&quot;)
              </AppCheckbox>
              <Button variant="primary" type="submit" className="self-start">
                + Agregar dueño
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Cambia un indicador entre manual y calculado (numerador ÷ denominador). */
function CalcControl({ metric, metrics }: { metric: ScorecardMetric; metrics: ScorecardMetric[] }) {
  const [editing, setEditing] = useState(false);
  const [num, setNum] = useState(metric.calc_numerator_id ? String(metric.calc_numerator_id) : "-");
  const [den, setDen] = useState(metric.calc_denominator_id ? String(metric.calc_denominator_id) : "-");
  const [pending, start] = useTransition();
  const options = metrics.filter((m) => m.id !== metric.id && m.calc_numerator_id === null);
  const calc = metric.calc_numerator_id !== null;
  if (!editing) {
    return (
      <Button size="sm" variant="ghost" className={`text-xs ${calc ? "text-primary" : ""}`} onPress={() => setEditing(true)}>
        {calc ? "Calculado" : "Calcular"}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
      <AppSelect aria-label="Numerador" value={num} onChange={(e) => setNum(e.target.value)} className="w-56">
        <option value="-">Manual (sin cálculo)</option>
        {options.map((x) => (
          <option key={x.id} value={String(x.id)}>
            {x.name}
          </option>
        ))}
      </AppSelect>
      <span className="text-center text-xs text-muted">÷</span>
      <AppSelect aria-label="Denominador" value={den} onChange={(e) => setDen(e.target.value)} className="w-56">
        <option value="-">—</option>
        {options.map((x) => (
          <option key={x.id} value={String(x.id)}>
            {x.name}
          </option>
        ))}
      </AppSelect>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="primary"
          isPending={pending}
          onPress={() =>
            start(async () => {
              const n = num === "-" ? null : Number(num);
              const d = den === "-" ? null : Number(den);
              await setMetricCalcAction(metric.id, n, d);
              setEditing(false);
            })
          }
        >
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
