"use client";

import { Button, Input, Tabs } from "@heroui/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ScorecardMetric,
  ScorecardOwner,
  ScorecardTarget,
} from "@/lib/domain/types";
import { formatWeekLabel } from "@/lib/utils/dates";
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
  return ok ? "bg-green-bg" : "bg-red-bg";
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
    <Input
      className={`shadow-none w-16 rounded border border-transparent bg-transparent px-1 py-1 text-center text-sm outline-none focus:border-primary ${className}`}
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
  );
}

function TargetCell({
  metricId,
  ownerId,
  value,
}: {
  metricId: number;
  ownerId: number;
  value: number | null;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(value === null ? "" : String(value));
  const [, startTransition] = useTransition();

  return (
    <Input
      className="shadow-none w-16 rounded border border-border bg-card px-1 py-1 text-center text-sm font-semibold outline-none focus:border-primary"
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
}: {
  owners: ScorecardOwner[];
  metrics: ScorecardMetric[];
  targets: ScorecardTarget[];
  grid: Grid;
  weeks: string[];
  /** En la reunión L10: levanta un Issue a partir de un indicador. */
  onRaiseIssue?: (metric: ScorecardMetric, ownerName: string) => void;
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
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60">
              <th className="min-w-[220px] px-3 py-2 text-left font-semibold">
                Indicador
              </th>
              <th className="px-2 py-2 text-center font-semibold">Meta</th>
              {weeks.map((w) => (
                <th key={w} className="px-1 py-2 text-center font-medium text-muted">
                  {formatWeekLabel(w)}
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

              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium">{m.name}</p>
                    {m.predicts && <p className="text-xs text-muted">{m.predicts}</p>}
                    <p className="mt-0.5 text-[11px] text-muted">
                      {m.direction === "higher_better" ? "Mayor mejor" : "Menor mejor"}
                    </p>
                    {onRaiseIssue && (
                      <Button size="sm" variant="outline"
                        type="button"
                        className="text-[11px] text-red h-6 px-2"
                        onPress={() => onRaiseIssue(m, activeOwner.name)}
                      >
                        → Issue
                      </Button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <TargetCell metricId={m.id} ownerId={activeOwner.id} value={target} />
                  </td>
                  {weeks.map((w, i) => (
                    <td key={w} className="px-1 py-1 text-center">
                      {activeOwner.is_rollup ? (
                        <div
                          className={`rounded px-1 py-1 text-sm ${statusClass(values[i], target, m.direction)}`}
                        >
                          {values[i] === null ? "-" : values[i]}
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
                  <td className="px-2 py-2 text-center font-semibold">
                    {avg === null ? "-" : m.format === "percentage" ? `${avg}%` : avg}
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
