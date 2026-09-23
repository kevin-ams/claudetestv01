import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import {
  CONTROL_STAGES,
  DEFAULT_MILESTONES,
  normalizeMilestones,
  type MilestoneDef,
  type StageKey,
} from "./career-control";

type Row = {
  id: number;
  key: string;
  stage: StageKey;
  label: string;
  actions: string;
  done_when: string;
  days: number;
  depends_on: string[];
  is_launch: boolean;
  sort_order: number;
};

export type ControlMilestone = MilestoneDef & { id: number };

function toDef(r: Row): ControlMilestone {
  return {
    id: r.id,
    key: r.key,
    stage: r.stage,
    label: r.label,
    actions: r.actions,
    doneWhen: r.done_when,
    days: r.days,
    dependsOn: r.depends_on,
    isLaunch: r.is_launch,
  };
}

async function insertDefaults(teamId: number) {
  for (let i = 0; i < DEFAULT_MILESTONES.length; i++) {
    const m = DEFAULT_MILESTONES[i];
    await db().sql`
      INSERT INTO control_milestones (team_id, key, stage, label, actions, done_when, days, depends_on, is_launch, sort_order)
      VALUES (${teamId}, ${m.key}, ${m.stage}, ${m.label}, ${m.actions}, ${m.doneWhen}, ${m.days},
              ${JSON.stringify(m.dependsOn)}::jsonb, ${Boolean(m.isLaunch)}, ${i})
      ON CONFLICT (team_id, key) DO NOTHING
    `;
  }
}

/** Hitos del equipo en orden (etapa, posición). La primera vez carga los predeterminados. */
export async function listControlMilestones(teamId: number): Promise<ControlMilestone[]> {
  let rows = (await db().sql`
    SELECT * FROM control_milestones WHERE team_id = ${teamId} ORDER BY sort_order ASC, id ASC
  `) as Row[];
  if (rows.length === 0) {
    await insertDefaults(teamId);
    rows = (await db().sql`
      SELECT * FROM control_milestones WHERE team_id = ${teamId} ORDER BY sort_order ASC, id ASC
    `) as Row[];
  }
  const defs = rows.map(toDef);
  const byKey = new Map(defs.map((d) => [d.key, d]));
  return normalizeMilestones(defs).map((d) => ({ ...d, id: byKey.get(d.key)!.id }));
}

export async function getControlMilestone(id: number) {
  const rows = (await db().sql`SELECT * FROM control_milestones WHERE id = ${id}`) as (Row & { team_id: number })[];
  return rows[0] ?? null;
}

/** Guarda posiciones consecutivas según el orden normalizado. */
async function renumber(teamId: number, ordered: { id: number }[]) {
  for (let i = 0; i < ordered.length; i++) {
    await db().sql`UPDATE control_milestones SET sort_order = ${i} WHERE id = ${ordered[i].id} AND team_id = ${teamId}`;
  }
}

export async function createControlMilestone(teamId: number, stage: StageKey, label: string) {
  const list = await listControlMilestones(teamId);
  const key = `h_${randomBytes(4).toString("hex")}`;
  // Por defecto depende del último hito de su etapa o de una etapa anterior.
  const stageIdx = (k: StageKey) => CONTROL_STAGES.findIndex((s) => s.key === k);
  const previous = list.filter((m) => stageIdx(m.stage) <= stageIdx(stage)).at(-1);
  const inserted = (await db().sql`
    INSERT INTO control_milestones (team_id, key, stage, label, days, depends_on, sort_order)
    VALUES (${teamId}, ${key}, ${stage}, ${label}, 3, ${JSON.stringify(previous ? [previous.key] : [])}::jsonb, 9999)
    RETURNING id
  `) as { id: number }[];
  const updated = await listControlMilestones(teamId);
  await renumber(teamId, updated);
  return inserted[0].id;
}

export async function updateControlMilestone(
  teamId: number,
  id: number,
  input: {
    label: string;
    stage: StageKey;
    actions: string;
    doneWhen: string;
    days: number;
    dependsOn: string[];
    isLaunch: boolean;
  }
) {
  const current = await getControlMilestone(id);
  if (!current || current.team_id !== teamId) return;
  if (input.isLaunch) {
    await db().sql`UPDATE control_milestones SET is_launch = FALSE WHERE team_id = ${teamId}`;
  }
  // Si cambia de etapa, pasa al final de la nueva etapa.
  const sortOrder = input.stage !== current.stage ? 9999 : current.sort_order;
  await db().sql`
    UPDATE control_milestones SET
      label = ${input.label},
      stage = ${input.stage},
      actions = ${input.actions},
      done_when = ${input.doneWhen},
      days = ${input.days},
      depends_on = ${JSON.stringify(input.dependsOn.filter((d) => d !== current.key))}::jsonb,
      is_launch = ${input.isLaunch},
      sort_order = ${sortOrder}
    WHERE id = ${id}
  `;
  await renumber(teamId, await listControlMilestones(teamId));
}

/** Sube o baja un hito dentro de su etapa. */
export async function moveControlMilestone(teamId: number, id: number, delta: -1 | 1) {
  const list = await listControlMilestones(teamId);
  const idx = list.findIndex((m) => m.id === id);
  const other = list[idx + delta];
  if (idx === -1 || !other || other.stage !== list[idx].stage) return;
  // El que queda después no puede ser dependencia del que queda antes: el de
  // adelante hereda las dependencias del que salta, para no romper la cadena.
  const [first, second] = delta === -1 ? [list[idx], other] : [other, list[idx]];
  if (first.dependsOn.includes(second.key)) {
    const deps = [...new Set([...first.dependsOn.filter((d) => d !== second.key), ...second.dependsOn])];
    await db().sql`UPDATE control_milestones SET depends_on = ${JSON.stringify(deps)}::jsonb WHERE id = ${first.id}`;
  }
  [list[idx], list[idx + delta]] = [list[idx + delta], list[idx]];
  await renumber(teamId, list);
}

/** Cuántas carreras del equipo tienen este hito marcado como completado. */
export async function countCompletions(teamId: number, key: string): Promise<number> {
  const rows = (await db().sql`
    SELECT COUNT(*)::int AS n FROM career_track_milestones m
    JOIN careers c ON c.id = m.career_id
    WHERE c.team_id = ${teamId} AND m.milestone = ${key}
  `) as { n: number }[];
  return rows[0].n;
}

export async function deleteControlMilestone(teamId: number, id: number) {
  const current = await getControlMilestone(id);
  if (!current || current.team_id !== teamId) return;
  const list = await listControlMilestones(teamId);
  const removed = list.find((m) => m.id === id)!;
  // Quien dependía de este hito pasa a depender de sus dependencias (no se rompe la cadena).
  for (const m of list) {
    if (!m.dependsOn.includes(removed.key)) continue;
    const deps = [...new Set([...m.dependsOn.filter((d) => d !== removed.key), ...removed.dependsOn])];
    await db().sql`UPDATE control_milestones SET depends_on = ${JSON.stringify(deps)}::jsonb WHERE id = ${m.id}`;
  }
  await db().sql`
    DELETE FROM career_track_milestones
    WHERE milestone = ${removed.key}
      AND career_id IN (SELECT id FROM careers WHERE team_id = ${teamId})
  `;
  await db().sql`DELETE FROM control_milestones WHERE id = ${id}`;
  await renumber(teamId, await listControlMilestones(teamId));
}

/** Vuelve a los 12 hitos predeterminados; se conserva el avance de los que coinciden. */
export async function resetControlMilestones(teamId: number) {
  const defaultKeys = DEFAULT_MILESTONES.map((m) => m.key);
  await db().sql`
    DELETE FROM career_track_milestones
    WHERE NOT (milestone = ANY(${defaultKeys}))
      AND career_id IN (SELECT id FROM careers WHERE team_id = ${teamId})
  `;
  await db().sql`DELETE FROM control_milestones WHERE team_id = ${teamId}`;
  await insertDefaults(teamId);
}
