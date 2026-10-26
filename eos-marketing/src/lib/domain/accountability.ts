import "server-only";
import { db } from "@/lib/db";
import type { Seat } from "./types";
import { orgTeamIds } from "./teams";

// Organigrama de responsabilidades: uno para toda la organización (todos los equipos lo ven y editan).
// Cada puesto puede tener varias personas (accountability_seat_people).

export async function listSeats(teamId: number): Promise<Seat[]> {
  const teams = await orgTeamIds(teamId);
  const rows = (await db().sql`
    SELECT s.*, COALESCE((
      SELECT json_agg(p.user_id ORDER BY p.sort_order, p.user_id) FROM accountability_seat_people p WHERE p.seat_id = s.id
    ), '[]'::json) AS people
    FROM accountability_seats s
    WHERE s.team_id = ANY(${teams}::int[])
    ORDER BY s.parent_seat_id NULLS FIRST, s.sort_order ASC, s.id ASC
  `) as (Seat & { people: number[] | string })[];
  return rows.map((r) => ({
    ...r,
    roles: typeof r.roles === "string" ? JSON.parse(r.roles) : r.roles,
    people: typeof r.people === "string" ? JSON.parse(r.people) : r.people,
  }));
}

/** Personas de todos los equipos de la organización (para asignar a los puestos). */
export async function listOrgMembers(teamId: number): Promise<{ id: number; name: string; email: string }[]> {
  const teams = await orgTeamIds(teamId);
  return (await db().sql`
    SELECT DISTINCT u.id, u.name, u.email FROM users u JOIN team_members tm ON tm.user_id = u.id
    WHERE tm.team_id = ANY(${teams}::int[])
    ORDER BY u.name ASC
  `) as { id: number; name: string; email: string }[];
}

async function seatInOrg(teamId: number, seatId: number): Promise<boolean> {
  const teams = await orgTeamIds(teamId);
  const rows = await db().sql`SELECT 1 FROM accountability_seats WHERE id = ${seatId} AND team_id = ANY(${teams}::int[])`;
  return rows.length > 0;
}

async function setPeople(seatId: number, userIds: number[]) {
  await db().sql`DELETE FROM accountability_seat_people WHERE seat_id = ${seatId}`;
  for (const [i, uid] of userIds.entries()) {
    await db().sql`INSERT INTO accountability_seat_people (seat_id, user_id, sort_order) VALUES (${seatId}, ${uid}, ${i}) ON CONFLICT DO NOTHING`;
  }
  // user_id queda con la primera persona (compatibilidad con resúmenes y exportaciones).
  await db().sql`UPDATE accountability_seats SET user_id = ${userIds[0] ?? null} WHERE id = ${seatId}`;
}

export async function createSeat(input: {
  teamId: number;
  parentSeatId: number | null;
  title: string;
  people: number[];
  roles: string[];
}): Promise<Seat> {
  const next = (await db().sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM accountability_seats WHERE parent_seat_id IS NOT DISTINCT FROM ${input.parentSeatId}::int
  `) as { next: number }[];
  const rows = (await db().sql`
    INSERT INTO accountability_seats (team_id, parent_seat_id, title, user_id, roles, sort_order)
    VALUES (${input.teamId}, ${input.parentSeatId}, ${input.title}, NULL, ${JSON.stringify(input.roles)}::jsonb, ${next[0]?.next ?? 0})
    RETURNING *
  `) as Seat[];
  await setPeople(rows[0].id, input.people);
  return rows[0];
}

export async function updateSeat(
  teamId: number,
  seatId: number,
  input: { title: string; people: number[]; roles: string[]; parentSeatId: number | null }
): Promise<boolean> {
  if (!(await seatInOrg(teamId, seatId))) return false;
  await db().sql`
    UPDATE accountability_seats
    SET title = ${input.title}, roles = ${JSON.stringify(input.roles)}::jsonb, parent_seat_id = ${input.parentSeatId}
    WHERE id = ${seatId}
  `;
  await setPeople(seatId, input.people);
  return true;
}

/** Mueve un puesto antes o después de sus hermanos (mismo jefe). */
export async function moveSeat(teamId: number, seatId: number, direction: "left" | "right") {
  const seats = await listSeats(teamId);
  const seat = seats.find((s) => s.id === seatId);
  if (!seat) return;
  const siblings = seats.filter((s) => s.parent_seat_id === seat.parent_seat_id);
  const i = siblings.findIndex((s) => s.id === seatId);
  const j = direction === "left" ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;
  const order = siblings.map((s) => s.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (const [k, id] of order.entries()) await db().sql`UPDATE accountability_seats SET sort_order = ${k} WHERE id = ${id}`;
}

/** Elimina un puesto; los que dependían de él suben a reportar al puesto de arriba. */
export async function deleteSeat(teamId: number, seatId: number) {
  if (!(await seatInOrg(teamId, seatId))) return;
  await db().sql`
    UPDATE accountability_seats c
    SET parent_seat_id = p.parent_seat_id
    FROM accountability_seats p
    WHERE p.id = ${seatId} AND c.parent_seat_id = p.id
  `;
  await db().sql`DELETE FROM accountability_seats WHERE id = ${seatId}`;
}

/** ¿Se puede poner `parentId` como jefe de `seatId`? (misma organización y sin ciclos) */
export async function canReportTo(teamId: number, seatId: number | null, parentId: number | null): Promise<boolean> {
  if (parentId === null) return true;
  const seats = await listSeats(teamId);
  if (!seats.some((s) => s.id === parentId)) return false;
  if (seatId === null) return true;
  for (let cur: number | null = parentId; cur !== null; ) {
    if (cur === seatId) return false;
    cur = seats.find((s) => s.id === cur)?.parent_seat_id ?? null;
  }
  return true;
}

/** Personas válidas (de la organización), sin repetir. */
export async function orgPeople(teamId: number, ids: unknown[]): Promise<number[]> {
  const members = new Set((await listOrgMembers(teamId)).map((m) => m.id));
  return [...new Set(ids.map((v) => Number(v)).filter((n) => members.has(n)))].slice(0, 50);
}
