import "server-only";
import { db } from "@/lib/db";
import type {
  ScorecardOwner,
  ScorecardMetric,
  ScorecardTarget,
  ScorecardEntry,
  Direction,
  MetricFormat,
  Aggregation,
} from "./types";

export async function listOwners(teamId: number): Promise<ScorecardOwner[]> {
  const rows = await db().sql`
    SELECT * FROM scorecard_owners WHERE team_id = ${teamId} ORDER BY sort_order ASC, id ASC
  `;
  return rows as ScorecardOwner[];
}

export async function createOwner(
  teamId: number,
  name: string,
  isRollup: boolean
): Promise<ScorecardOwner> {
  const rows = await db().sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM scorecard_owners WHERE team_id = ${teamId}
  `;
  const next = (rows[0] as { next: number }).next;
  const inserted = await db().sql`
    INSERT INTO scorecard_owners (team_id, name, is_rollup, sort_order)
    VALUES (${teamId}, ${name}, ${isRollup}, ${next})
    RETURNING *
  `;
  return inserted[0] as ScorecardOwner;
}

export async function deleteOwner(ownerId: number) {
  await db().sql`DELETE FROM scorecard_owners WHERE id = ${ownerId}`;
}

export async function listMetrics(teamId: number): Promise<ScorecardMetric[]> {
  const rows = await db().sql`
    SELECT * FROM scorecard_metrics
    WHERE team_id = ${teamId} AND archived = FALSE
    ORDER BY sort_order ASC, id ASC
  `;
  return rows as ScorecardMetric[];
}

export async function createMetric(input: {
  teamId: number;
  name: string;
  predicts: string;
  direction: Direction;
  format: MetricFormat;
  aggregation: Aggregation;
}): Promise<ScorecardMetric> {
  const rows = await db().sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM scorecard_metrics WHERE team_id = ${input.teamId}
  `;
  const next = (rows[0] as { next: number }).next;
  const inserted = await db().sql`
    INSERT INTO scorecard_metrics (team_id, name, predicts, direction, format, aggregation, sort_order)
    VALUES (${input.teamId}, ${input.name}, ${input.predicts}, ${input.direction}, ${input.format}, ${input.aggregation}, ${next})
    RETURNING *
  `;
  return inserted[0] as ScorecardMetric;
}

export async function archiveMetric(metricId: number) {
  await db().sql`UPDATE scorecard_metrics SET archived = TRUE WHERE id = ${metricId}`;
}

export async function listTargets(teamId: number): Promise<ScorecardTarget[]> {
  const rows = await db().sql`
    SELECT st.metric_id, st.owner_id, st.target_value
    FROM scorecard_targets st
    JOIN scorecard_metrics sm ON sm.id = st.metric_id
    WHERE sm.team_id = ${teamId}
  `;
  return rows as ScorecardTarget[];
}

export async function setTarget(
  metricId: number,
  ownerId: number,
  value: number
) {
  await db().sql`
    INSERT INTO scorecard_targets (metric_id, owner_id, target_value)
    VALUES (${metricId}, ${ownerId}, ${value})
    ON CONFLICT (metric_id, owner_id) DO UPDATE SET target_value = ${value}
  `;
}

export async function listEntries(
  teamId: number,
  weeks: string[]
): Promise<ScorecardEntry[]> {
  if (weeks.length === 0) return [];
  const rows = await db().sql`
    SELECT se.*
    FROM scorecard_entries se
    JOIN scorecard_metrics sm ON sm.id = se.metric_id
    WHERE sm.team_id = ${teamId} AND se.week_start = ANY(${weeks}::date[])
  `;
  return rows as ScorecardEntry[];
}

export async function upsertEntry(input: {
  metricId: number;
  ownerId: number;
  weekStart: string;
  value: number | null;
  enteredBy: number;
}) {
  if (input.value === null) {
    await db().sql`
      DELETE FROM scorecard_entries
      WHERE metric_id = ${input.metricId} AND owner_id = ${input.ownerId} AND week_start = ${input.weekStart}
    `;
    return;
  }
  await db().sql`
    INSERT INTO scorecard_entries (metric_id, owner_id, week_start, value, entered_by)
    VALUES (${input.metricId}, ${input.ownerId}, ${input.weekStart}, ${input.value}, ${input.enteredBy})
    ON CONFLICT (metric_id, owner_id, week_start)
    DO UPDATE SET value = ${input.value}, entered_by = ${input.enteredBy}, entered_at = NOW()
  `;
}
