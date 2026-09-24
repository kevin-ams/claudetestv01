import type {
  ScorecardMetric,
  ScorecardOwner,
  ScorecardTarget,
  ScorecardEntry,
  Direction,
} from "./types";

export type ScorecardGrid = Map<string, number | null>;

function cellKey(metricId: number, ownerId: number, week: string) {
  return `${metricId}:${ownerId}:${week}`;
}

export function buildScorecardGrid(
  metrics: ScorecardMetric[],
  owners: ScorecardOwner[],
  targets: ScorecardTarget[],
  entries: ScorecardEntry[],
  weeks: string[]
): ScorecardGrid {
  const grid: ScorecardGrid = new Map();

  for (const e of entries) {
    grid.set(cellKey(e.metric_id, e.owner_id, e.week_start), e.value);
  }

  const rollupOwners = owners.filter((o) => o.is_rollup);
  const baseOwners = owners.filter((o) => !o.is_rollup);

  for (const metric of metrics) {
    for (const week of weeks) {
      for (const rollup of rollupOwners) {
        const values = baseOwners
          .map((o) => grid.get(cellKey(metric.id, o.id, week)))
          .filter((v): v is number => v !== null && v !== undefined);

        if (values.length === 0) {
          grid.set(cellKey(metric.id, rollup.id, week), null);
          continue;
        }

        const sum = values.reduce((a, b) => a + b, 0);
        const value = metric.aggregation === "average" ? sum / values.length : sum;
        grid.set(cellKey(metric.id, rollup.id, week), Math.round(value * 100) / 100);
      }
    }
  }

  return grid;
}

export function getCell(
  grid: ScorecardGrid,
  metricId: number,
  ownerId: number,
  week: string
): number | null {
  return grid.get(cellKey(metricId, ownerId, week)) ?? null;
}

export function targetFor(
  targets: ScorecardTarget[],
  metricId: number,
  ownerId: number
): number | null {
  const t = targets.find((t) => t.metric_id === metricId && t.owner_id === ownerId);
  return t ? t.target_value : null;
}

export type CellStatus = "green" | "red" | "empty";

export function statusFor(
  value: number | null,
  target: number | null,
  direction: Direction
): CellStatus {
  if (value === null || target === null) return "empty";
  const onTarget =
    direction === "higher_better" ? value >= target : value <= target;
  return onTarget ? "green" : "red";
}

export function formatValue(
  value: number | null,
  format: ScorecardMetric["format"]
): string {
  if (value === null) return "-";
  if (format === "percentage") return `${value}%`;
  if (format === "currency") return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${value}`;
}

export function averageForOwner(
  grid: ScorecardGrid,
  metric: ScorecardMetric,
  ownerId: number,
  weeks: string[]
): number | null {
  const values = weeks
    .map((w) => getCell(grid, metric.id, ownerId, w))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}
