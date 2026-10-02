import "server-only";
import { db } from "@/lib/db";
import { countFor, countStage } from "@/lib/integrations/activecampaign";
import { logImport, setWeeklyLeads } from "./careers";
import { formatWeekRange } from "@/lib/utils/dates";

export type CareerAcLink = {
  career_id: number;
  team_id: number;
  pipeline_id: string;
  pipeline_name: string;
  stage_id: string;
  stage_name: string;
  career_value: string;
  last_count: number | null;
  last_synced_at: string | null;
  last_error: string;
};

export async function listLinks(teamId: number): Promise<CareerAcLink[]> {
  return (await db().sql`
    SELECT career_id, team_id, pipeline_id, pipeline_name, stage_id, stage_name, career_value, last_count, last_synced_at, last_error
    FROM career_ac_links WHERE team_id = ${teamId}
  `) as CareerAcLink[];
}

export async function saveLink(
  teamId: number,
  link: Pick<CareerAcLink, "career_id" | "pipeline_id" | "pipeline_name" | "stage_id" | "stage_name" | "career_value">
) {
  await db().sql`
    INSERT INTO career_ac_links (career_id, team_id, pipeline_id, pipeline_name, stage_id, stage_name, career_value)
    VALUES (${link.career_id}, ${teamId}, ${link.pipeline_id}, ${link.pipeline_name}, ${link.stage_id}, ${link.stage_name}, ${link.career_value})
    ON CONFLICT (career_id) DO UPDATE SET
      pipeline_id = EXCLUDED.pipeline_id, pipeline_name = EXCLUDED.pipeline_name,
      stage_id = EXCLUDED.stage_id, stage_name = EXCLUDED.stage_name, career_value = EXCLUDED.career_value,
      last_count = NULL, last_synced_at = NULL, last_error = '', updated_at = NOW()
  `;
}

export async function deleteLink(teamId: number, careerId: number) {
  await db().sql`DELETE FROM career_ac_links WHERE career_id = ${careerId} AND team_id = ${teamId}`;
}

export async function lastSync(teamId: number): Promise<{ at: string | null; detail: string }> {
  const rows = (await db().sql`SELECT ac_last_sync_at AS at, ac_last_sync_detail AS detail FROM teams WHERE id = ${teamId}`) as {
    at: string | null;
    detail: string;
  }[];
  return rows[0] ?? { at: null, detail: "" };
}

/** Etapas a consultar (una consulta por etapa sirve a todas las carreras vinculadas a ella). */
async function stageKeys(teamId: number | null): Promise<{ team_id: number; stage_id: string }[]> {
  return (await db().sql`
    SELECT DISTINCT l.team_id, l.stage_id FROM career_ac_links l
    JOIN careers c ON c.id = l.career_id AND c.archived = FALSE
    WHERE (${teamId}::int IS NULL OR l.team_id = ${teamId}::int)
    ORDER BY l.team_id, l.stage_id
  `) as { team_id: number; stage_id: string }[];
}

export type SyncChunkResult = {
  done: boolean;
  next: number;
  totalStages: number;
  errors: string[];
};

/**
 * Procesa `size` etapas a partir de `offset`: cuenta los tratos que hay en cada una y
 * escribe los leads de la semana `weekStart` (solo esa semana; las anteriores no cambian).
 * Se llama en tandas para no exceder el tiempo máximo de una función en Netlify.
 */
export async function syncChunk(input: {
  teamId: number | null;
  weekStart: string;
  offset: number;
  size: number;
  userId: number | null;
}): Promise<SyncChunkResult> {
  const keys = await stageKeys(input.teamId);
  const slice = keys.slice(input.offset, input.offset + input.size);
  const errors: string[] = [];
  for (const key of slice) {
    const links = (await db().sql`
      SELECT l.career_id, l.career_value, l.stage_name FROM career_ac_links l
      JOIN careers c ON c.id = l.career_id AND c.archived = FALSE
      WHERE l.team_id = ${key.team_id} AND l.stage_id = ${key.stage_id}
    `) as { career_id: number; career_value: string; stage_name: string }[];
    try {
      const stage = await countStage(key.stage_id);
      for (const l of links) {
        const n = countFor(stage, l.career_value);
        await setWeeklyLeads({ careerId: l.career_id, weekStart: input.weekStart, leads: n, source: "activecampaign", userId: input.userId });
        await db().sql`
          UPDATE career_ac_links SET last_count = ${n}, last_synced_at = NOW(), last_error = '' WHERE career_id = ${l.career_id}
        `;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${links[0]?.stage_name ?? key.stage_id}: ${msg}`);
      await db().sql`
        UPDATE career_ac_links SET last_error = ${msg.slice(0, 300)}, last_synced_at = NOW()
        WHERE team_id = ${key.team_id} AND stage_id = ${key.stage_id}
      `;
    }
  }
  const next = input.offset + slice.length;
  return { done: next >= keys.length, next, totalStages: keys.length, errors };
}

/** Cierra la sincronización: guarda "última actualización" y el registro de importación. */
export async function finishSync(input: { teamId: number | null; weekStart: string; userId: number | null; auto: boolean }) {
  const teams = (await db().sql`
    SELECT l.team_id, COUNT(*) FILTER (WHERE l.last_error = '')::int AS ok, COUNT(*) FILTER (WHERE l.last_error <> '')::int AS failed,
      COALESCE(SUM(l.last_count) FILTER (WHERE l.last_error = ''), 0)::int AS total
    FROM career_ac_links l JOIN careers c ON c.id = l.career_id AND c.archived = FALSE
    WHERE (${input.teamId}::int IS NULL OR l.team_id = ${input.teamId}::int)
    GROUP BY l.team_id
  `) as { team_id: number; ok: number; failed: number; total: number }[];
  for (const t of teams) {
    const detail =
      `Semana ${formatWeekRange(input.weekStart)} · ${t.ok} carrera(s) · ${t.total} lead(s)` +
      (t.failed ? ` · ${t.failed} con error` : "") +
      (input.auto ? " · automática" : "");
    await db().sql`UPDATE teams SET ac_last_sync_at = NOW(), ac_last_sync_detail = ${detail} WHERE id = ${t.team_id}`;
    await logImport({
      teamId: t.team_id,
      kind: "activecampaign",
      weekStart: input.weekStart,
      fileName: null,
      careersUpdated: t.ok,
      total: t.total,
      userId: input.userId,
    });
  }
  return teams;
}
