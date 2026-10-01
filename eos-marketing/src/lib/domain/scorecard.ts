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

// ---------- Indicadores compartidos entre equipos ----------

export type MetricSharing = { shared_all: boolean; team_ids: number[] };

/** Con quién comparte cada indicador del equipo. */
export async function listMetricSharing(teamId: number): Promise<Record<number, MetricSharing>> {
  const rows = await db().sql`
    SELECT m.id, m.shared_all,
      COALESCE(ARRAY_AGG(s.team_id) FILTER (WHERE s.team_id IS NOT NULL), '{}') AS team_ids
    FROM scorecard_metrics m
    LEFT JOIN scorecard_metric_shares s ON s.metric_id = m.id
    WHERE m.team_id = ${teamId} AND m.archived = FALSE
    GROUP BY m.id
  `;
  return Object.fromEntries(
    (rows as { id: number; shared_all: boolean; team_ids: number[] }[]).map((r) => [
      r.id,
      { shared_all: r.shared_all, team_ids: r.team_ids.map(Number) },
    ])
  );
}

export async function setMetricSharing(teamId: number, metricId: number, sharedAll: boolean, teamIds: number[]) {
  const owned = await db().sql`SELECT 1 FROM scorecard_metrics WHERE id = ${metricId} AND team_id = ${teamId}`;
  if (owned.length === 0) return false;
  await db().sql`UPDATE scorecard_metrics SET shared_all = ${sharedAll} WHERE id = ${metricId}`;
  await db().sql`DELETE FROM scorecard_metric_shares WHERE metric_id = ${metricId}`;
  const targets = sharedAll ? [] : [...new Set(teamIds)].filter((id) => id !== teamId);
  if (targets.length > 0) {
    await db().sql`
      INSERT INTO scorecard_metric_shares (metric_id, team_id)
      SELECT ${metricId}, t.id FROM teams t WHERE t.id = ANY(${targets}::int[])
      ON CONFLICT DO NOTHING
    `;
  }
  return true;
}

/** Otros equipos a los que se puede compartir (mismo tipo: real o demo). */
export async function listShareableTeams(teamId: number) {
  const rows = await db().sql`
    SELECT t.id, t.name FROM teams t, teams me
    WHERE me.id = ${teamId} AND t.id <> me.id AND t.is_demo = me.is_demo
      AND (NOT t.is_demo OR t.demo_owner_id = me.demo_owner_id)
    ORDER BY t.name ASC
  `;
  return rows as { id: number; name: string }[];
}

export type SharedScorecard = {
  teamId: number;
  teamName: string;
  metrics: ScorecardMetric[];
  owners: ScorecardOwner[];
  targets: ScorecardTarget[];
  entries: ScorecardEntry[];
};

/** Indicadores que otros equipos hicieron visibles para este equipo, con sus datos. */
export async function listSharedScorecards(teamId: number, weeks: string[]): Promise<SharedScorecard[]> {
  const metrics = (await db().sql`
    SELECT DISTINCT m.*, t.name AS team_name
    FROM scorecard_metrics m
    JOIN teams t ON t.id = m.team_id
    JOIN teams me ON me.id = ${teamId}
    LEFT JOIN scorecard_metric_shares s ON s.metric_id = m.id AND s.team_id = me.id
    WHERE m.team_id <> me.id AND m.archived = FALSE
      AND (s.team_id IS NOT NULL OR (m.shared_all AND t.is_demo = me.is_demo
        AND (NOT t.is_demo OR t.demo_owner_id = me.demo_owner_id)))
    ORDER BY t.name ASC, m.sort_order ASC, m.id ASC
  `) as (ScorecardMetric & { team_name: string })[];
  const byTeam = new Map<number, SharedScorecard>();
  for (const m of metrics) {
    if (!byTeam.has(m.team_id)) {
      byTeam.set(m.team_id, { teamId: m.team_id, teamName: m.team_name, metrics: [], owners: [], targets: [], entries: [] });
    }
    byTeam.get(m.team_id)!.metrics.push(m);
  }
  for (const sc of byTeam.values()) {
    const ids = sc.metrics.map((m) => m.id);
    const [owners, targets, entries] = await Promise.all([
      listOwners(sc.teamId),
      db().sql`SELECT metric_id, owner_id, target_value FROM scorecard_targets WHERE metric_id = ANY(${ids}::int[])`,
      weeks.length
        ? db().sql`SELECT * FROM scorecard_entries WHERE metric_id = ANY(${ids}::int[]) AND week_start = ANY(${weeks}::date[])`
        : Promise.resolve([]),
    ]);
    sc.owners = owners;
    sc.targets = targets as ScorecardTarget[];
    sc.entries = entries as ScorecardEntry[];
  }
  return [...byTeam.values()];
}
