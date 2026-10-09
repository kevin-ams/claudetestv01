import "server-only";
import { db } from "@/lib/db";
import { weekStartISO } from "@/lib/utils/dates";

export type L10Event = {
  id: number;
  team_id: number;
  title: string;
  detail: string;
  event_date: string | null;
  /** Lunes de la semana en cuya L10 se lee; null = la próxima L10. */
  week_from: string | null;
  created_by: number | null;
  author_name: string | null;
  from_team_id: number | null;
  from_team_name: string | null;
  meeting_id: number | null;
  /** Fecha de la L10 en que se leyó (eventos anteriores). */
  meeting_date: string | null;
  created_at: string;
  /** Equipos a los que se envió (solo eventos propios). */
  sent_to: { team_id: number; team_name: string; read: boolean }[];
};

type Filter = { teamId: number } & (
  | { kind: "pending"; dueOnly: boolean }
  | { kind: "meeting"; meetingId: number }
  | { kind: "past"; limit: number }
);

async function list(f: Filter): Promise<L10Event[]> {
  const week = weekStartISO();
  const pending = f.kind === "pending";
  const dueOnly = f.kind === "pending" && f.dueOnly;
  const meetingId = f.kind === "meeting" ? f.meetingId : null;
  const past = f.kind === "past";
  const limit = f.kind === "past" ? f.limit : 500;
  const rows = (await db().sql`
    SELECT e.id, e.team_id, e.title, e.detail, to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
      to_char(e.week_from, 'YYYY-MM-DD') AS week_from, e.created_by,
      u.name AS author_name, e.from_team_id, ft.name AS from_team_name, e.meeting_id,
      to_char(COALESCE(m.started_at, m.created_at), 'YYYY-MM-DD') AS meeting_date, e.created_at,
      COALESCE((
        SELECT json_agg(json_build_object('team_id', c.team_id, 'team_name', ct.name, 'read', c.meeting_id IS NOT NULL) ORDER BY ct.name)
        FROM l10_events c JOIN teams ct ON ct.id = c.team_id WHERE c.origin_id = e.id
      ), '[]'::json) AS sent_to
    FROM l10_events e
    LEFT JOIN users u ON u.id = e.created_by
    LEFT JOIN teams ft ON ft.id = e.from_team_id
    LEFT JOIN meetings m ON m.id = e.meeting_id
    WHERE e.team_id = ${f.teamId}
      AND (
        (${pending}::boolean AND e.meeting_id IS NULL AND (NOT ${dueOnly}::boolean OR e.week_from IS NULL OR e.week_from <= ${week}::date))
        OR e.meeting_id = ${meetingId}::int
        OR (${past}::boolean AND e.meeting_id IS NOT NULL)
      )
    ORDER BY
      CASE WHEN ${past}::boolean THEN COALESCE(m.started_at, m.created_at) END DESC NULLS LAST,
      e.week_from ASC NULLS FIRST, e.event_date ASC NULLS LAST, e.id ASC
    LIMIT ${limit}
  `) as L10Event[];
  return rows.map((r) => ({ ...r, sent_to: typeof r.sent_to === "string" ? JSON.parse(r.sent_to) : r.sent_to }));
}

/**
 * Eventos pendientes del equipo (propios y recibidos). Con `dueOnly`, solo los que tocan en la
 * L10 de esta semana (sin semana o con semana hasta hoy); sin él, también los programados.
 */
export function listPendingEvents(teamId: number, dueOnly = true) {
  return list({ teamId, kind: "pending", dueOnly });
}

/** Eventos que se leyeron en una reunión. */
export function listMeetingEvents(teamId: number, meetingId: number) {
  return list({ teamId, kind: "meeting", meetingId });
}

/** Eventos ya leídos en L10 anteriores (para reutilizarlos o reenviarlos). */
export function listPastEvents(teamId: number, limit = 30) {
  return list({ teamId, kind: "past", limit });
}

async function getEvent(teamId: number, id: number) {
  const rows = (await db().sql`
    SELECT id, from_team_id, meeting_id FROM l10_events WHERE id = ${id} AND team_id = ${teamId}
  `) as { id: number; from_team_id: number | null; meeting_id: number | null }[];
  return rows[0] ?? null;
}

export async function createEvent(input: {
  teamId: number;
  title: string;
  detail: string;
  eventDate: string | null;
  weekFrom: string | null;
  userId: number;
}) {
  const rows = (await db().sql`
    INSERT INTO l10_events (team_id, title, detail, event_date, week_from, created_by)
    VALUES (${input.teamId}, ${input.title}, ${input.detail}, ${input.eventDate}, ${input.weekFrom}, ${input.userId})
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

/** Edita un evento propio pendiente; las copias enviadas que aún no se leen se actualizan también. */
export async function updateEvent(input: {
  teamId: number;
  id: number;
  title: string;
  detail: string;
  eventDate: string | null;
  weekFrom: string | null;
}) {
  const e = await getEvent(input.teamId, input.id);
  if (!e || e.meeting_id !== null || e.from_team_id !== null) return false;
  await db().sql`
    UPDATE l10_events SET title = ${input.title}, detail = ${input.detail}, event_date = ${input.eventDate}, week_from = ${input.weekFrom}
    WHERE id = ${input.id} OR (origin_id = ${input.id} AND meeting_id IS NULL)
  `;
  return true;
}

/** Quita un evento pendiente (propio o recibido). Las copias enviadas que no se han leído también se quitan. */
export async function deleteEvent(teamId: number, id: number) {
  const e = await getEvent(teamId, id);
  if (!e || e.meeting_id !== null) return false;
  await db().sql`DELETE FROM l10_events WHERE origin_id = ${id} AND meeting_id IS NULL`;
  await db().sql`DELETE FROM l10_events WHERE id = ${id}`;
  return true;
}

/**
 * Envía un evento propio (pendiente o ya leído) a la L10 de otros equipos: la próxima o la de
 * la semana indicada. No se duplica si ese equipo ya lo tiene pendiente.
 */
export async function sendEvent(input: { teamId: number; id: number; toTeamIds: number[]; weekFrom: string | null; userId: number }) {
  const e = await getEvent(input.teamId, input.id);
  if (!e || e.from_team_id !== null) return 0;
  const rows = (await db().sql`
    INSERT INTO l10_events (team_id, title, detail, event_date, week_from, created_by, from_team_id, origin_id)
    SELECT t.id, e.title, e.detail, e.event_date, ${input.weekFrom}::date, ${input.userId}, e.team_id, e.id
    FROM l10_events e, teams t
    WHERE e.id = ${input.id} AND t.id = ANY(${input.toTeamIds}::int[]) AND t.id <> e.team_id
      AND NOT EXISTS (SELECT 1 FROM l10_events c WHERE c.origin_id = e.id AND c.team_id = t.id AND c.meeting_id IS NULL)
    RETURNING id
  `) as { id: number }[];
  return rows.length;
}

/** Vuelve a usar un evento (ya leído o recibido) en la L10 de este equipo: la próxima o la de una semana. */
export async function reuseEvent(input: { teamId: number; id: number; weekFrom: string | null; userId: number }) {
  const rows = (await db().sql`
    INSERT INTO l10_events (team_id, title, detail, event_date, week_from, created_by, from_team_id)
    SELECT e.team_id, e.title, e.detail, e.event_date, ${input.weekFrom}::date, ${input.userId}, e.from_team_id
    FROM l10_events e WHERE e.id = ${input.id} AND e.team_id = ${input.teamId}
    RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}

/** Al terminar la L10, los eventos que tocaban esta semana quedan como leídos en esa reunión. */
export async function attachPendingEvents(teamId: number, meetingId: number) {
  await db().sql`
    UPDATE l10_events SET meeting_id = ${meetingId}
    WHERE team_id = ${teamId} AND meeting_id IS NULL AND (week_from IS NULL OR week_from <= ${weekStartISO()}::date)
  `;
}
