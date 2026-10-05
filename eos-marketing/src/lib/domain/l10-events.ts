import "server-only";
import { db } from "@/lib/db";

export type L10Event = {
  id: number;
  team_id: number;
  title: string;
  detail: string;
  event_date: string | null;
  created_by: number | null;
  author_name: string | null;
  from_team_id: number | null;
  from_team_name: string | null;
  meeting_id: number | null;
  created_at: string;
  /** Equipos a los que se envió (solo eventos propios). */
  sent_to: { team_id: number; team_name: string; read: boolean }[];
};

async function list(where: { teamId: number; meetingId: number | null }): Promise<L10Event[]> {
  const rows = (await db().sql`
    SELECT e.id, e.team_id, e.title, e.detail, to_char(e.event_date, 'YYYY-MM-DD') AS event_date, e.created_by,
      u.name AS author_name, e.from_team_id, ft.name AS from_team_name, e.meeting_id, e.created_at,
      COALESCE((
        SELECT json_agg(json_build_object('team_id', c.team_id, 'team_name', ct.name, 'read', c.meeting_id IS NOT NULL) ORDER BY ct.name)
        FROM l10_events c JOIN teams ct ON ct.id = c.team_id WHERE c.origin_id = e.id
      ), '[]'::json) AS sent_to
    FROM l10_events e
    LEFT JOIN users u ON u.id = e.created_by
    LEFT JOIN teams ft ON ft.id = e.from_team_id
    WHERE e.team_id = ${where.teamId}
      AND ((${where.meetingId}::int IS NULL AND e.meeting_id IS NULL) OR e.meeting_id = ${where.meetingId}::int)
    ORDER BY e.event_date ASC NULLS LAST, e.id ASC
  `) as L10Event[];
  return rows.map((r) => ({ ...r, sent_to: typeof r.sent_to === "string" ? JSON.parse(r.sent_to) : r.sent_to }));
}

/** Eventos pendientes: se leerán en la próxima L10 del equipo (propios y recibidos). */
export function listPendingEvents(teamId: number) {
  return list({ teamId, meetingId: null });
}

/** Eventos que se leyeron en una reunión. */
export function listMeetingEvents(teamId: number, meetingId: number) {
  return list({ teamId, meetingId });
}

async function getOwnPending(teamId: number, id: number) {
  const rows = (await db().sql`
    SELECT id, from_team_id FROM l10_events WHERE id = ${id} AND team_id = ${teamId} AND meeting_id IS NULL
  `) as { id: number; from_team_id: number | null }[];
  return rows[0] ?? null;
}

export async function createEvent(input: { teamId: number; title: string; detail: string; eventDate: string | null; userId: number }) {
  const rows = (await db().sql`
    INSERT INTO l10_events (team_id, title, detail, event_date, created_by)
    VALUES (${input.teamId}, ${input.title}, ${input.detail}, ${input.eventDate}, ${input.userId})
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

/** Edita un evento propio pendiente; las copias enviadas que aún no se leen se actualizan también. */
export async function updateEvent(input: { teamId: number; id: number; title: string; detail: string; eventDate: string | null }) {
  const e = await getOwnPending(input.teamId, input.id);
  if (!e || e.from_team_id !== null) return false;
  await db().sql`
    UPDATE l10_events SET title = ${input.title}, detail = ${input.detail}, event_date = ${input.eventDate}
    WHERE id = ${input.id} OR (origin_id = ${input.id} AND meeting_id IS NULL)
  `;
  return true;
}

/** Quita un evento pendiente (propio o recibido). Las copias enviadas que no se han leído también se quitan. */
export async function deleteEvent(teamId: number, id: number) {
  const e = await getOwnPending(teamId, id);
  if (!e) return false;
  await db().sql`DELETE FROM l10_events WHERE origin_id = ${id} AND meeting_id IS NULL`;
  await db().sql`DELETE FROM l10_events WHERE id = ${id}`;
  return true;
}

/** Envía un evento propio a la próxima L10 de otros equipos (una copia por equipo, sin repetir). */
export async function sendEvent(input: { teamId: number; id: number; toTeamIds: number[]; userId: number }) {
  const e = await getOwnPending(input.teamId, input.id);
  if (!e || e.from_team_id !== null) return 0;
  const rows = (await db().sql`
    INSERT INTO l10_events (team_id, title, detail, event_date, created_by, from_team_id, origin_id)
    SELECT t.id, e.title, e.detail, e.event_date, e.created_by, e.team_id, e.id
    FROM l10_events e, teams t
    WHERE e.id = ${input.id} AND t.id = ANY(${input.toTeamIds}::int[]) AND t.id <> e.team_id
      AND NOT EXISTS (SELECT 1 FROM l10_events c WHERE c.origin_id = e.id AND c.team_id = t.id)
    RETURNING id
  `) as { id: number }[];
  return rows.length;
}

/** Al terminar la L10, los eventos pendientes quedan como leídos en esa reunión. */
export async function attachPendingEvents(teamId: number, meetingId: number) {
  await db().sql`UPDATE l10_events SET meeting_id = ${meetingId} WHERE team_id = ${teamId} AND meeting_id IS NULL`;
}
