import "server-only";
import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth/token";
import type { ModuleKey } from "@/lib/auth/modules";

export type ActivityModule = ModuleKey | "equipo" | "roles" | "equipos";

export type ActivityEntry = {
  id: number;
  user_id: number | null;
  user_name: string;
  module: ActivityModule;
  action: string;
  detail: string;
  created_at: string;
};

/**
 * Registra una acción importante en la bitácora del equipo (Ajustes > Log).
 * Nunca rompe la acción principal: si falla, solo se avisa en el servidor.
 */
export async function logActivity(
  session: Pick<SessionPayload, "teamId" | "userId" | "name">,
  module: ActivityModule,
  action: string,
  detail = ""
) {
  try {
    await db().sql`
      INSERT INTO activity_log (team_id, user_id, user_name, module, action, detail)
      VALUES (${session.teamId}, ${session.userId}, ${session.name}, ${module}, ${action}, ${detail.slice(0, 500)})
    `;
  } catch (e) {
    console.error("[log] No se pudo registrar la acción:", e);
  }
}

export async function listActivity(
  teamId: number,
  filters: { module?: string; userId?: number; limit?: number } = {}
): Promise<ActivityEntry[]> {
  const rows = await db().sql`
    SELECT id, user_id, user_name, module, action, detail, created_at
    FROM activity_log
    WHERE team_id = ${teamId}
      AND (${filters.module ?? null}::text IS NULL OR module = ${filters.module ?? null})
      AND (${filters.userId ?? null}::int IS NULL OR user_id = ${filters.userId ?? null})
    ORDER BY created_at DESC, id DESC
    LIMIT ${filters.limit ?? 300}
  `;
  return rows as ActivityEntry[];
}

type Named = "control_milestones" | "rocks" | "rock_milestones" | "todos" | "issues" | "careers" | "scorecard_metrics" | "scorecard_owners" | "accountability_seats";

/** Nombre legible de un registro para la bitácora (antes de modificarlo o borrarlo). */
export async function labelOf(kind: Named, id: number): Promise<string> {
  let rows: Record<string, unknown>[] = [];
  switch (kind) {
    case "control_milestones":
      rows = await db().sql`SELECT label FROM control_milestones WHERE id = ${id}`;
      break;
    case "rocks":
      rows = await db().sql`SELECT title AS label FROM rocks WHERE id = ${id}`;
      break;
    case "rock_milestones":
      rows = await db().sql`
        SELECT m.title || ' (Rock: ' || r.title || ')' AS label
        FROM rock_milestones m JOIN rocks r ON r.id = m.rock_id WHERE m.id = ${id}`;
      break;
    case "todos":
      rows = await db().sql`SELECT title AS label FROM todos WHERE id = ${id}`;
      break;
    case "issues":
      rows = await db().sql`SELECT title AS label FROM issues WHERE id = ${id}`;
      break;
    case "careers":
      rows = await db().sql`SELECT COALESCE(NULLIF(code, '') || ' · ', '') || name AS label FROM careers WHERE id = ${id}`;
      break;
    case "scorecard_metrics":
      rows = await db().sql`SELECT name AS label FROM scorecard_metrics WHERE id = ${id}`;
      break;
    case "scorecard_owners":
      rows = await db().sql`SELECT name AS label FROM scorecard_owners WHERE id = ${id}`;
      break;
    case "accountability_seats":
      rows = await db().sql`SELECT title AS label FROM accountability_seats WHERE id = ${id}`;
      break;
  }
  return String(rows[0]?.label ?? `#${id}`);
}
