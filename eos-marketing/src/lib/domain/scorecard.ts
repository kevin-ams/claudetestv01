import "server-only";
import { db } from "@/lib/db";
import { formulaError, parseFormula, usedVars, type MetricFormula } from "./scorecard-formula";
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

/** Borra un dueño del equipo; devuelve su nombre (o null si no es del equipo). */
export async function deleteOwner(teamId: number, ownerId: number): Promise<string | null> {
  const rows = (await db().sql`DELETE FROM scorecard_owners WHERE id = ${ownerId} AND team_id = ${teamId} RETURNING name`) as { name: string }[];
  return rows[0]?.name ?? null;
}

/** Nombre de un indicador del equipo (archivado o no); null si no es del equipo. */
export async function getMetricName(teamId: number, metricId: number): Promise<string | null> {
  if (!Number.isInteger(metricId)) return null;
  const rows = (await db().sql`SELECT name FROM scorecard_metrics WHERE id = ${metricId} AND team_id = ${teamId}`) as { name: string }[];
  return rows[0]?.name ?? null;
}

/** Indicador + dueño, solo si ambos son del equipo (para validar antes de escribir una celda). */
export async function getScorecardCell(
  teamId: number,
  metricId: number,
  ownerId: number
): Promise<{ metric: string; owner: string } | null> {
  if (!Number.isInteger(metricId) || !Number.isInteger(ownerId)) return null;
  const rows = (await db().sql`
    SELECT m.name AS metric, o.name AS owner
    FROM scorecard_metrics m JOIN scorecard_owners o ON o.team_id = m.team_id
    WHERE m.id = ${metricId} AND o.id = ${ownerId} AND m.team_id = ${teamId}
  `) as { metric: string; owner: string }[];
  return rows[0] ?? null;
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

/**
 * Vuelve calculado (con fórmula) o manual (`formula` null) un indicador del equipo.
 * Las variables deben ser indicadores activos del equipo, sin el propio ni ciclos. Devuelve el error o null.
 */
export async function setMetricFormula(teamId: number, metricId: number, formula: MetricFormula | null): Promise<string | null> {
  const metrics = await listMetrics(teamId);
  if (!metrics.some((m) => m.id === metricId)) return "Indicador no encontrado.";
  if (formula) {
    const used = usedVars(formula);
    const vars = Object.fromEntries(used.map((v) => [v, formula.vars[v]]));
    const clean: MetricFormula = { expr: formula.expr.trim().slice(0, 300), vars };
    const err = formulaError(clean);
    if (err) return err;
    for (const id of Object.values(vars)) {
      if (id === metricId) return "Un indicador no puede usarse a sí mismo.";
      if (!metrics.some((m) => m.id === id)) return "Una variable apunta a un indicador que no existe o está archivado.";
    }
    // Sin ciclos: ningún indicador usado puede depender (directa o indirectamente) de este.
    const deps = new Map(metrics.map((m) => [m.id, Object.values(parseFormula(m.calc_formula)?.vars ?? {})]));
    deps.set(metricId, Object.values(vars));
    const reaches = (from: number, visited = new Set<number>()): boolean => {
      if (from === metricId) return true;
      if (visited.has(from)) return false;
      visited.add(from);
      return (deps.get(from) ?? []).some((id) => reaches(id, visited));
    };
    if (Object.values(vars).some((id) => reaches(id))) {
      return "La fórmula crea un ciclo: un indicador usado depende de este.";
    }
    await db().sql`
      UPDATE scorecard_metrics SET calc_formula = ${JSON.stringify(clean)}::jsonb, calc_numerator_id = NULL, calc_denominator_id = NULL
      WHERE id = ${metricId} AND team_id = ${teamId}
    `;
    return null;
  }
  await db().sql`
    UPDATE scorecard_metrics SET calc_formula = NULL, calc_numerator_id = NULL, calc_denominator_id = NULL
    WHERE id = ${metricId} AND team_id = ${teamId}
  `;
  return null;
}

/** Archiva un indicador; no se puede si una fórmula activa lo usa (devuelve esos indicadores). */
export async function archiveMetric(teamId: number, metricId: number): Promise<string[]> {
  const metrics = await listMetrics(teamId);
  const users = metrics.filter((m) => m.id !== metricId && Object.values(parseFormula(m.calc_formula)?.vars ?? {}).includes(metricId));
  if (users.length) return users.map((m) => m.name);
  await db().sql`UPDATE scorecard_metrics SET archived = TRUE, archived_at = NOW() WHERE id = ${metricId} AND team_id = ${teamId}`;
  return [];
}

export async function listArchivedMetrics(teamId: number): Promise<ScorecardMetric[]> {
  const rows = await db().sql`
    SELECT * FROM scorecard_metrics WHERE team_id = ${teamId} AND archived = TRUE
    ORDER BY archived_at DESC NULLS LAST, id DESC
  `;
  return rows as ScorecardMetric[];
}

/** Restaura un indicador archivado al final de la lista (con sus datos y metas). */
export async function restoreMetric(teamId: number, metricId: number) {
  await db().sql`
    UPDATE scorecard_metrics SET archived = FALSE, archived_at = NULL,
      sort_order = (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM scorecard_metrics WHERE team_id = ${teamId} AND archived = FALSE)
    WHERE id = ${metricId} AND team_id = ${teamId}
  `;
}

/** Sube o baja un indicador una posición. */
export async function moveMetric(teamId: number, metricId: number, direction: "up" | "down") {
  const metrics = await listMetrics(teamId);
  const i = metrics.findIndex((m) => m.id === metricId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= metrics.length) return;
  const order = metrics.map((m) => m.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (let k = 0; k < order.length; k++) {
    await db().sql`UPDATE scorecard_metrics SET sort_order = ${k} WHERE id = ${order[k]} AND team_id = ${teamId}`;
  }
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
  teamId: number,
  metricId: number,
  ownerId: number,
  value: number
) {
  // Solo si indicador y dueño son del equipo (INSERT … SELECT no inserta nada si no).
  await db().sql`
    INSERT INTO scorecard_targets (metric_id, owner_id, target_value)
    SELECT m.id, o.id, ${value} FROM scorecard_metrics m JOIN scorecard_owners o ON o.team_id = m.team_id
    WHERE m.id = ${metricId} AND o.id = ${ownerId} AND m.team_id = ${teamId}
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
  teamId: number;
  metricId: number;
  ownerId: number;
  weekStart: string;
  value: number | null;
  enteredBy: number;
}) {
  if (input.value === null) {
    await db().sql`
      DELETE FROM scorecard_entries e USING scorecard_metrics m
      WHERE e.metric_id = ${input.metricId} AND e.owner_id = ${input.ownerId} AND e.week_start = ${input.weekStart}
        AND m.id = e.metric_id AND m.team_id = ${input.teamId}
    `;
    return;
  }
  await db().sql`
    INSERT INTO scorecard_entries (metric_id, owner_id, week_start, value, entered_by)
    SELECT m.id, o.id, ${input.weekStart}, ${input.value}, ${input.enteredBy}
    FROM scorecard_metrics m JOIN scorecard_owners o ON o.team_id = m.team_id
    WHERE m.id = ${input.metricId} AND o.id = ${input.ownerId} AND m.team_id = ${input.teamId}
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
      SELECT ${metricId}, t.id FROM teams t JOIN teams me ON me.id = ${teamId}
      WHERE t.id = ANY(${targets}::int[]) AND t.organization_id = me.organization_id
      ON CONFLICT DO NOTHING
    `;
  }
  return true;
}

/** Otros equipos de la misma organización (a los que se puede compartir o enviar). */
export async function listShareableTeams(teamId: number) {
  const rows = await db().sql`
    SELECT t.id, t.name FROM teams t JOIN teams me ON me.organization_id = t.organization_id
    WHERE me.id = ${teamId} AND t.id <> me.id
    ORDER BY t.name ASC
  `;
  return rows as { id: number; name: string }[];
}

export type SharedScorecard = {
  teamId: number;
  teamName: string;
  metrics: ScorecardMetric[];
  /** Indicadores que usan las fórmulas pero no se comparten: entran al cálculo sin mostrarse. */
  support: ScorecardMetric[];
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
      AND t.organization_id = me.organization_id
      AND (s.team_id IS NOT NULL OR m.shared_all)
    ORDER BY t.name ASC, m.sort_order ASC, m.id ASC
  `) as (ScorecardMetric & { team_name: string })[];
  const byTeam = new Map<number, SharedScorecard>();
  for (const m of metrics) {
    if (!byTeam.has(m.team_id)) {
      byTeam.set(m.team_id, { teamId: m.team_id, teamName: m.team_name, metrics: [], support: [], owners: [], targets: [], entries: [] });
    }
    byTeam.get(m.team_id)!.metrics.push(m);
  }
  for (const sc of byTeam.values()) {
    // Variables de las fórmulas (y las de sus fórmulas) que no están compartidas.
    const all = await listMetrics(sc.teamId);
    const need = new Set(sc.metrics.map((m) => m.id));
    for (let changed = true; changed; ) {
      changed = false;
      for (const m of all) {
        if (!need.has(m.id)) continue;
        for (const id of Object.values(parseFormula(m.calc_formula)?.vars ?? {})) {
          if (!need.has(id)) {
            need.add(id);
            changed = true;
          }
        }
      }
    }
    sc.support = all.filter((m) => need.has(m.id) && !sc.metrics.some((x) => x.id === m.id));
    const ids = [...need];
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
