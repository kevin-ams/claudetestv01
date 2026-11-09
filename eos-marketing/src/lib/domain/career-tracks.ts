import "server-only";
import { db } from "@/lib/db";
import type { CareerTrack, TrackStatus } from "./types";
import type { MilestoneKey } from "./career-control";

export type TrackRow = CareerTrack & {
  program: string;
  code: string;
  name: string;
  level: string;
  owner_id: number | null;
  done: Partial<Record<MilestoneKey, string>>;
};

export async function listTracks(teamId: number): Promise<TrackRow[]> {
  const tracks = (await db().sql`
    SELECT t.*, c.program, c.code, c.name, c.level, c.owner_id
    FROM career_tracks t
    JOIN careers c ON c.id = t.career_id
    WHERE c.team_id = ${teamId} AND c.archived = FALSE
    ORDER BY c.sort_order ASC, c.id ASC
  `) as Omit<TrackRow, "done">[];
  const done = (await db().sql`
    SELECT m.career_id, m.milestone, m.done_on
    FROM career_track_milestones m
    JOIN careers c ON c.id = m.career_id
    WHERE c.team_id = ${teamId}
  `) as { career_id: number; milestone: MilestoneKey; done_on: string }[];

  const byCareer = new Map<number, Partial<Record<MilestoneKey, string>>>();
  for (const d of done) {
    byCareer.set(d.career_id, { ...(byCareer.get(d.career_id) ?? {}), [d.milestone]: d.done_on });
  }
  return tracks.map((t) => ({ ...t, done: byCareer.get(t.career_id) ?? {} }));
}

export async function trackTeam(careerId: number): Promise<number | null> {
  const rows = (await db().sql`
    SELECT c.team_id FROM career_tracks t JOIN careers c ON c.id = t.career_id WHERE t.career_id = ${careerId}
  `) as { team_id: number }[];
  return rows[0]?.team_id ?? null;
}

export async function addTracks(careerIds: number[], startDate: string, userId: number) {
  for (const id of careerIds) {
    await db().sql`
      INSERT INTO career_tracks (career_id, start_date, updated_by)
      VALUES (${id}, ${startDate}, ${userId})
      ON CONFLICT (career_id) DO NOTHING
    `;
  }
}

export async function removeTrack(careerId: number) {
  await db().sql`DELETE FROM career_tracks WHERE career_id = ${careerId}`;
}

async function touch(careerId: number, userId: number) {
  await db().sql`UPDATE career_tracks SET updated_at = NOW(), updated_by = ${userId} WHERE career_id = ${careerId}`;
}

/**
 * Mueve la tarjeta a una columna del tablero: los hitos anteriores quedan
 * completados (conservando su fecha si ya lo estaban) y el hito destino y
 * los siguientes quedan pendientes. `null` = todos completados. `keys` es el
 * orden de los hitos del equipo.
 */
export async function moveTrack(
  careerId: number,
  keys: MilestoneKey[],
  column: MilestoneKey | null,
  userId: number
) {
  const upTo = column === null ? keys.length : keys.indexOf(column);
  const complete = keys.slice(0, upTo);
  const pending = keys.slice(upTo);
  for (const key of complete) {
    await db().sql`
      INSERT INTO career_track_milestones (career_id, milestone, done_on, done_by)
      VALUES (${careerId}, ${key}, CURRENT_DATE, ${userId})
      ON CONFLICT (career_id, milestone) DO NOTHING
    `;
  }
  if (pending.length) {
    await db().sql`
      DELETE FROM career_track_milestones WHERE career_id = ${careerId} AND milestone = ANY(${pending})
    `;
  }
  await touch(careerId, userId);
}

export async function setMilestoneDone(
  careerId: number,
  milestone: MilestoneKey,
  doneOn: string | null,
  userId: number
) {
  if (doneOn) {
    await db().sql`
      INSERT INTO career_track_milestones (career_id, milestone, done_on, done_by)
      VALUES (${careerId}, ${milestone}, ${doneOn}, ${userId})
      ON CONFLICT (career_id, milestone) DO UPDATE SET done_on = ${doneOn}, done_by = ${userId}
    `;
  } else {
    await db().sql`DELETE FROM career_track_milestones WHERE career_id = ${careerId} AND milestone = ${milestone}`;
  }
  await touch(careerId, userId);
}

export async function updateTrack(
  careerId: number,
  input: { status?: TrackStatus; labels?: string[]; notes?: string; startDate?: string },
  userId: number
) {
  if (input.status) {
    await db().sql`UPDATE career_tracks SET status = ${input.status} WHERE career_id = ${careerId}`;
  }
  if (input.labels) {
    await db().sql`UPDATE career_tracks SET labels = ${JSON.stringify(input.labels)}::jsonb WHERE career_id = ${careerId}`;
  }
  if (input.notes !== undefined) {
    await db().sql`UPDATE career_tracks SET notes = ${input.notes} WHERE career_id = ${careerId}`;
  }
  if (input.startDate) {
    await db().sql`UPDATE career_tracks SET start_date = ${input.startDate} WHERE career_id = ${careerId}`;
  }
  await touch(careerId, userId);
}
