import "server-only";
import { db } from "@/lib/db";
import { dealStageChanges, dealsUpdatedSince, firstEntry, normCareer, stageGroupMap } from "@/lib/integrations/activecampaign";
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

const TZ = process.env.EOS_TIMEZONE || "America/Guatemala";
/** Primera revisión de un embudo: tratos modificados en las últimas 27 semanas (cubre las 26 de la comparativa). */
const HISTORY_DAYS = 27 * 7;
const PAGE_SIZE = 25;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Embudos vinculados (de un equipo o de todos). */
async function linkedPipelines(teamId: number | null): Promise<string[]> {
  const rows = (await db().sql`
    SELECT DISTINCT l.pipeline_id FROM career_ac_links l
    JOIN careers c ON c.id = l.career_id AND c.archived = FALSE
    WHERE (${teamId}::int IS NULL OR l.team_id = ${teamId}::int)
    ORDER BY l.pipeline_id
  `) as { pipeline_id: string }[];
  return rows.map((r) => r.pipeline_id);
}

type ScanRow = { pipeline_id: string; since_date: string; page_offset: number; next_since: string; scanned_at: string | null };

export type ScanProgress = {
  done: boolean;
  pipelinesDone: number;
  pipelinesTotal: number;
  /** Tratos cuyo historial se revisó en esta tanda. */
  checked: number;
  errors: string[];
};

/**
 * Revisa el historial de los tratos de los embudos vinculados durante `budgetMs` y guarda la
 * fecha en que cada trato entró al embudo. Retoma donde quedó; un embudo cuenta como al día si
 * se terminó de revisar después de `freshAfter`. Solo vuelve a pedir el historial de un trato
 * si cambió desde la última revisión.
 */
export async function scanStep(input: { teamId: number | null; freshAfter: Date; budgetMs: number }): Promise<ScanProgress> {
  const started = Date.now();
  const left = () => input.budgetMs - (Date.now() - started);
  const pipelines = await linkedPipelines(input.teamId);
  const errors: string[] = [];
  let checked = 0;
  if (pipelines.length === 0) return { done: true, pipelinesDone: 0, pipelinesTotal: 0, checked, errors };

  const since0 = isoDate(new Date(Date.now() - HISTORY_DAYS * 864e5));
  for (const id of pipelines) {
    await db().sql`INSERT INTO ac_pipeline_scans (pipeline_id, since_date) VALUES (${id}, ${since0}) ON CONFLICT (pipeline_id) DO NOTHING`;
  }
  const isFresh = (r: ScanRow) => r.page_offset === 0 && r.scanned_at !== null && new Date(r.scanned_at) >= input.freshAfter;
  const load = async () =>
    ((await db().sql`SELECT pipeline_id, since_date, page_offset, next_since, scanned_at FROM ac_pipeline_scans`) as ScanRow[]).filter((r) =>
      pipelines.includes(r.pipeline_id)
    );

  let groupOf: Map<string, string> | null = null;
  for (const scan of await load()) {
    if (isFresh(scan)) continue;
    if (left() < 1500) break;
    try {
      groupOf ??= await stageGroupMap();
      let { page_offset: offset, next_since: nextSince } = scan;
      // Páginas de tratos modificados desde since_date, del más antiguo al más reciente.
      while (left() > 1500) {
        const deals = await dealsUpdatedSince(scan.pipeline_id, scan.since_date, offset, PAGE_SIZE);
        const known = new Map(
          (
            (await db().sql`
              SELECT deal_id, deal_mdate FROM ac_deal_entries
              WHERE pipeline_id = ${scan.pipeline_id} AND deal_id = ANY(${deals.map((d) => d.id)}::text[])
            `) as { deal_id: string; deal_mdate: string }[]
          ).map((r) => [r.deal_id, r.deal_mdate])
        );
        let finishedPage = true;
        for (const deal of deals) {
          if (deal.mdate > nextSince) nextSince = deal.mdate;
          if (known.get(deal.id) === deal.mdate) continue;
          if (left() < 1500) {
            finishedPage = false;
            break;
          }
          const changes = await dealStageChanges(deal.id);
          const entered = firstEntry(deal, changes, groupOf, scan.pipeline_id);
          await db().sql`
            INSERT INTO ac_deal_entries (deal_id, pipeline_id, career_value, career_norm, entered_at, deal_mdate, checked_at)
            VALUES (${deal.id}, ${scan.pipeline_id}, ${deal.career}, ${normCareer(deal.career)}, ${entered}, ${deal.mdate}, NOW())
            ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET
              career_value = EXCLUDED.career_value, career_norm = EXCLUDED.career_norm, entered_at = EXCLUDED.entered_at,
              deal_mdate = EXCLUDED.deal_mdate, checked_at = NOW()
          `;
          checked++;
        }
        if (!finishedPage) break;
        if (deals.length < PAGE_SIZE) {
          // Embudo al día: la próxima pasada empieza un día antes de la última modificación vista.
          const next = nextSince ? isoDate(new Date(Date.parse(nextSince) - 864e5)) : scan.since_date;
          await db().sql`
            UPDATE ac_pipeline_scans SET since_date = ${next < scan.since_date ? scan.since_date : next}, page_offset = 0,
              next_since = '', scanned_at = NOW(), updated_at = NOW()
            WHERE pipeline_id = ${scan.pipeline_id}
          `;
          break;
        }
        offset += deals.length;
        await db().sql`
          UPDATE ac_pipeline_scans SET page_offset = ${offset}, next_since = ${nextSince}, updated_at = NOW()
          WHERE pipeline_id = ${scan.pipeline_id}
        `;
      }
    } catch (e) {
      errors.push(`Embudo ${scan.pipeline_id}: ${e instanceof Error ? e.message : String(e)}`);
      await db().sql`
        UPDATE career_ac_links SET last_error = ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}
        WHERE pipeline_id = ${scan.pipeline_id}
      `;
      // Para no quedarse atascado: se marca como revisado y se reintenta en la siguiente pasada.
      await db().sql`UPDATE ac_pipeline_scans SET scanned_at = NOW(), updated_at = NOW() WHERE pipeline_id = ${scan.pipeline_id}`;
    }
  }
  const after = await load();
  const pipelinesDone = after.filter(isFresh).length;
  return { done: pipelinesDone === pipelines.length, pipelinesDone, pipelinesTotal: pipelines.length, checked, errors };
}

/** Leads calificados de la semana por carrera vinculada: tratos que entraron al embudo esa semana. */
export async function weekCounts(teamId: number | null, weekStart: string) {
  const links = (await db().sql`
    SELECT l.career_id, l.team_id, l.pipeline_id, l.career_value, c.code, c.name
    FROM career_ac_links l JOIN careers c ON c.id = l.career_id AND c.archived = FALSE
    WHERE (${teamId}::int IS NULL OR l.team_id = ${teamId}::int)
    ORDER BY c.name
  `) as { career_id: number; team_id: number; pipeline_id: string; career_value: string; code: string; name: string }[];
  const rows = (await db().sql`
    SELECT pipeline_id, career_norm, COUNT(*)::int AS n FROM ac_deal_entries
    WHERE entered_at >= (${weekStart}::date::timestamp AT TIME ZONE ${TZ})
      AND entered_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${TZ})
    GROUP BY pipeline_id, career_norm
  `) as { pipeline_id: string; career_norm: string; n: number }[];
  return links.map((l) => {
    const value = normCareer(l.career_value);
    const leads = rows
      .filter((r) => r.pipeline_id === l.pipeline_id && (!value || r.career_norm === value))
      .reduce((sum, r) => sum + r.n, 0);
    return { ...l, leads };
  });
}

/**
 * Escribe los leads de la semana en Indicadores (todas las carreras vinculadas) y, si es la
 * semana en curso, el "último conteo" de cada vínculo.
 */
export async function writeWeek(input: { teamId: number | null; weekStart: string; userId: number | null; current: boolean }) {
  const counts = await weekCounts(input.teamId, input.weekStart);
  for (const c of counts) {
    await setWeeklyLeads({ careerId: c.career_id, weekStart: input.weekStart, leads: c.leads, source: "activecampaign", userId: input.userId });
    if (input.current) {
      await db().sql`UPDATE career_ac_links SET last_count = ${c.leads}, last_synced_at = NOW(), last_error = '' WHERE career_id = ${c.career_id}`;
    }
  }
  return counts;
}

/** Cierra la sincronización: guarda "última actualización" y, si se pide, el registro de importación. */
export async function finishSync(input: {
  teamId: number | null;
  weekStart: string;
  userId: number | null;
  auto: boolean;
  counts: { team_id: number; leads: number }[];
  log: boolean;
}) {
  const byTeam = new Map<number, { ok: number; total: number }>();
  for (const c of input.counts) {
    const t = byTeam.get(c.team_id) ?? { ok: 0, total: 0 };
    t.ok++;
    t.total += c.leads;
    byTeam.set(c.team_id, t);
  }
  const teams = [...byTeam.entries()].map(([team_id, t]) => ({ team_id, ...t }));
  for (const t of teams) {
    const detail = `Semana ${formatWeekRange(input.weekStart)} · ${t.ok} carrera(s) · ${t.total} lead(s)` + (input.auto ? " · automática" : "");
    await db().sql`UPDATE teams SET ac_last_sync_at = NOW(), ac_last_sync_detail = ${detail} WHERE id = ${t.team_id}`;
    if (input.log) {
      await logImport({ teamId: t.team_id, kind: "activecampaign", weekStart: input.weekStart, fileName: null, careersUpdated: t.ok, total: t.total, userId: input.userId });
    }
  }
  return teams;
}

// --- Semanas anteriores (solo administradores) ------------------------------------

export type BackfillRow = {
  career_id: number;
  code: string;
  name: string;
  /** Leads guardados hoy en esa semana (null = sin dato). */
  current: number | null;
  current_source: string | null;
  /** Leads calificados de esa semana según el historial de ActiveCampaign. */
  incoming: number;
};

/** Comparativa de una semana: lo guardado contra lo que dice el historial (no escribe nada). */
export async function backfillPreview(teamId: number, weekStart: string): Promise<BackfillRow[]> {
  const counts = await weekCounts(teamId, weekStart);
  const saved = new Map(
    (
      (await db().sql`
        SELECT w.career_id, w.leads, w.leads_source FROM career_weekly w
        JOIN careers c ON c.id = w.career_id AND c.team_id = ${teamId}
        WHERE w.week_start = ${weekStart}
      `) as { career_id: number; leads: number | null; leads_source: string | null }[]
    ).map((r) => [r.career_id, r])
  );
  return counts.map((c) => {
    const s = saved.get(c.career_id);
    return {
      career_id: c.career_id,
      code: c.code,
      name: c.name,
      current: s?.leads === null || s?.leads === undefined ? null : Number(s.leads),
      current_source: s?.leads_source ?? null,
      incoming: c.leads,
    };
  });
}

/** Escribe en `weekStart` los valores confirmados en la comparativa (solo carreras vinculadas del equipo). */
export async function applyBackfill(input: {
  teamId: number;
  weekStart: string;
  rows: { careerId: number; leads: number }[];
  userId: number;
}): Promise<{ updated: number; total: number }> {
  const linked = new Set((await listLinks(input.teamId)).map((l) => l.career_id));
  let updated = 0;
  let total = 0;
  for (const r of input.rows) {
    if (!linked.has(r.careerId) || !Number.isInteger(r.leads) || r.leads < 0) continue;
    await setWeeklyLeads({ careerId: r.careerId, weekStart: input.weekStart, leads: r.leads, source: "activecampaign", userId: input.userId });
    updated++;
    total += r.leads;
  }
  if (updated) {
    await logImport({ teamId: input.teamId, kind: "activecampaign", weekStart: input.weekStart, fileName: null, careersUpdated: updated, total, userId: input.userId });
  }
  return { updated, total };
}
