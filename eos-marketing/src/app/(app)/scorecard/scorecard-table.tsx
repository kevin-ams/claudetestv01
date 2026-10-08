"use client";

import { ArrowRight } from "@gravity-ui/icons";
import { Button, Input, Tabs } from "@heroui/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ScorecardMetric,
  ScorecardOwner,
  ScorecardTarget,
} from "@/lib/domain/types";
import { formatWeekLabel } from "@/lib/utils/dates";
import { isCalculated } from "@/lib/domain/scorecard-shared";
import { upsertEntryAction, setTargetAction } from "./actions";

type Grid = Record<string, number | null>;

function cellKey(metricId: number, ownerId: number, week: string) {
  return `${metricId}:${ownerId}:${week}`;
}

function statusClass(
  value: number | null,
  target: number | null,
  direction: ScorecardMetric["direction"]
) {
  if (value === null || target === null) return "";
  const ok = direction === "higher_better" ? value >= target : value <= target;
  return ok ? "bg-green-bg text-green" : "bg-red-bg text-red font-semibold";
}

function EditableCell({
  metricId,
  ownerId,
  week,
  value,
  className,
}: {
  metricId: number;
  ownerId: number;
  week: string;
  value: number | null;
  className: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(value === null ? "" : String(value));
  const [, startTransition] = useTransition();

  return (
    <div className={`rounded ${className}`}>
    <Input
      aria-label="Valor de la semana"
      className="shadow-none w-14 rounded border border-transparent bg-transparent px-0.5 py-1 text-center text-sm text-inherit outline-none focus:border-primary"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = local.trim() === "" ? null : Number(local);
        if (parsed !== null && Number.isNaN(parsed)) return;
        if (parsed === value) return;
        startTransition(async () => {
          await upsertEntryAction(metricId, ownerId, week, parsed);
          router.refresh();
        });
      }}
    />
    </div>
  );
}

function TargetCell({
  metricId,
  ownerId,
  value,
  editable,
}: {
  metricId: number;
  ownerId: number;
  value: number | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(value === null ? "" : String(value));
  const [, startTransition] = useTransition();

  if (!editable) {
    return (
      <span className="inline-block w-14 py-1 text-center text-sm font-semibold" title="Solo un administrador cambia las metas">
        {value === null ? "-" : value}
      </span>
    );
  }
  return (
    <Input
      aria-label="Meta"
      className="shadow-none w-14 rounded border border-border bg-card px-1 py-1 text-center text-sm font-semibold outline-none focus:border-primary"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = Number(local);
        if (Number.isNaN(parsed) || parsed === value) return;
        startTransition(async () => {
          await setTargetAction(metricId, ownerId, parsed);
          router.refresh();
        });
      }}
    />
  );
}

export function ScorecardTable({
  owners,
  metrics,
  targets,
  grid,
  weeks,
  onRaiseIssue,
  canEditTargets = false,
  currentWeek,
}: {
  owners: ScorecardOwner[];
  metrics: ScorecardMetric[];
  targets: ScorecardTarget[];
  grid: Grid;
  weeks: string[];
  /** En la reunión L10: levanta un Issue a partir de un indicador. */
  onRaiseIssue?: (metric: ScorecardMetric, ownerName: string) => void;
  /** Solo administradores cambian metas. */
  canEditTargets?: boolean;
  /** Semana en curso (se resalta). */
  currentWeek?: string;
}) {
  const [activeOwnerId, setActiveOwnerId] = useState(owners[0]?.id);
  const activeOwner = owners.find((o) => o.id === activeOwnerId) ?? owners[0];

  if (!activeOwner) {
    return <p className="text-sm text-muted">Agrega al menos un dueño de indicadores para empezar.</p>;
  }

  const targetFor = (metricId: number) =>
    targets.find((t) => t.metric_id === metricId && t.owner_id === activeOwner.id)
      ?.target_value ?? null;

  return (
    <div>
      <Tabs
        className="mb-4"
        selectedKey={String(activeOwner.id)}
        onSelectionChange={(key) => setActiveOwnerId(Number(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Dueño del Scorecard">
            {owners.map((o) => (
              <Tabs.Tab key={o.id} id={String(o.id)}>
                {o.name}
                {o.is_rollup && " (rollup)"}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60">
              <th className="sticky left-0 z-10 min-w-[200px] bg-card px-3 py-2 text-left font-semibold">
                Indicador
              </th>
              <th className="px-2 py-2 text-center font-semibold">Meta</th>
              {weeks.map((w) => (
                <th
                  key={w}
                  className={`px-1 py-2 text-center font-medium ${w === currentWeek ? "text-primary" : w > (currentWeek ?? "9") ? "text-muted/60" : "text-muted"}`}
                  title={w === currentWeek ? "Semana en curso" : undefined}
                >
                  {formatWeekLabel(w)}
                  {w === currentWeek && <span className="block text-[10px] font-normal">esta semana</span>}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-semibold">Prom.</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const target = targetFor(m.id);
              const values = weeks.map((w) => grid[cellKey(m.id, activeOwner.id, w)] ?? null);
              const nonNull = values.filter((v): v is number => v !== null);
              const avg =
                nonNull.length > 0
                  ? Math.round((nonNull.reduce((a, b) => a + b, 0) / nonNull.length) * 100) / 100
                  : null;
              const calc = isCalculated(m);
              const unit = (v: number | null) => (v === null ? "-" : m.format === "percentage" ? `${v}%` : v);
              const calcLabel = calc
                ? `${metrics.find((x) => x.id === m.calc_numerator_id)?.name ?? "?"} ÷ ${metrics.find((x) => x.id === m.calc_denominator_id)?.name ?? "?"}`
                : "";

              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 min-w-[200px] max-w-[240px] bg-card px-3 py-2">
                    <p className="font-medium">{m.name}</p>
                    {m.predicts && <p className="text-xs text-muted">{m.predicts}</p>}
                    <p className="mt-0.5 text-[11px] text-muted">
                      {m.direction === "higher_better" ? "Mayor mejor" : "Menor mejor"}
                      {calc && <span className="ml-1 rounded bg-primary/10 px-1 text-primary" title={calcLabel}>Calculado</span>}
                    </p>
                    {onRaiseIssue && (
                      <Button size="sm" variant="outline"
                        type="button"
                        className="text-[11px] text-red h-6 px-2"
                        onPress={() => onRaiseIssue(m, activeOwner.name)}
                      >
                        <ArrowRight width={12} height={12} aria-hidden /> Issue
                      </Button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <TargetCell metricId={m.id} ownerId={activeOwner.id} value={target} editable={canEditTargets} />
                  </td>
                  {weeks.map((w, i) => (
                    <td key={w} className="px-0.5 py-1 text-center">
                      {activeOwner.is_rollup || calc ? (
                        <div
                          className={`rounded px-1 py-1 text-sm ${statusClass(values[i], target, m.direction)}`}
                          title={calc ? `Calculado: ${calcLabel}` : undefined}
                        >
                          {unit(values[i])}
                        </div>
                      ) : (
                        <EditableCell
                          metricId={m.id}
                          ownerId={activeOwner.id}
                          week={w}
                          value={values[i]}
                          className={statusClass(values[i], target, m.direction)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center font-semibold">
                    <div className={`rounded px-1 py-1 ${statusClass(avg, target, m.direction)}`}>{unit(avg)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {activeOwner.is_rollup && (
        <p className="mt-2 text-xs text-muted">
          Esta columna se calcula automáticamente ({activeOwner.name}) sumando o
          promediando los dueños individuales — no se edita directamente.
        </p>
      )}
    </div>
  );
}
