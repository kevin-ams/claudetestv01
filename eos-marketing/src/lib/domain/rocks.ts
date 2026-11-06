import "server-only";
import { db } from "@/lib/db";
import type { Rock, RockMilestone, RockStatus } from "./types";

export async function listRocks(
  teamId: number,
  quarter: number,
  year: number
): Promise<Rock[]> {
  const rows = await db().sql`
    SELECT * FROM rocks
    WHERE team_id = ${teamId} AND quarter = ${quarter} AND year = ${year}
    ORDER BY is_company_rock DESC, sort_order ASC, id ASC
  `;
  return rows as Rock[];
}

export async function listRockQuarters(
  teamId: number
): Promise<{ quarter: number; year: number }[]> {
  const rows = await db().sql`
    SELECT DISTINCT quarter, year FROM rocks WHERE team_id = ${teamId}
    ORDER BY year DESC, quarter DESC
  `;
  return rows as { quarter: number; year: number }[];
}

export async function createRock(input: {
  teamId: number;
  ownerId: number | null;
  title: string;
  description: string;
  isCompanyRock: boolean;
  quarter: number;
  year: number;
  dueDate: string | null;
}) {
  const rows = await db().sql`
    INSERT INTO rocks (team_id, owner_id, title, description, is_company_rock, quarter, year, due_date)
    VALUES (${input.teamId}, ${input.ownerId}, ${input.title}, ${input.description}, ${input.isCompanyRock}, ${input.quarter}, ${input.year}, ${input.dueDate})
    RETURNING *
  `;
  return rows[0] as Rock;
}

// Las funciones por id reciben el equipo; los hitos se validan a través de su Rock.

/** Rock del equipo (null si no existe o es de otro equipo). */
export async function getRock(teamId: number, rockId: number): Promise<Rock | null> {
  const rows = await db().sql`SELECT * FROM rocks WHERE id = ${rockId} AND team_id = ${teamId}`;
  return (rows[0] as Rock) ?? null;
}

export async function updateRockStatus(teamId: number, rockId: number, status: RockStatus): Promise<boolean> {
  const rows = await db().sql`UPDATE rocks SET status = ${status} WHERE id = ${rockId} AND team_id = ${teamId} RETURNING id`;
  return rows.length > 0;
}

export async function updateRock(
  teamId: number,
  rockId: number,
  input: {
    title: string;
    description: string;
    ownerId: number | null;
    dueDate: string | null;
    isCompanyRock: boolean;
  }
) {
  await db().sql`
    UPDATE rocks SET
      title = ${input.title},
      description = ${input.description},
      owner_id = ${input.ownerId},
      due_date = ${input.dueDate},
      is_company_rock = ${input.isCompanyRock}
    WHERE id = ${rockId} AND team_id = ${teamId}
  `;
}

export async function deleteRock(teamId: number, rockId: number): Promise<boolean> {
  const rows = await db().sql`DELETE FROM rocks WHERE id = ${rockId} AND team_id = ${teamId} RETURNING id`;
  return rows.length > 0;
}

export async function listMilestones(teamId: number, rockId: number): Promise<RockMilestone[]> {
  const rows = await db().sql`
    SELECT m.* FROM rock_milestones m JOIN rocks r ON r.id = m.rock_id
    WHERE m.rock_id = ${rockId} AND r.team_id = ${teamId}
    ORDER BY m.due_date ASC NULLS LAST, m.sort_order ASC, m.id ASC
  `;
  return rows as RockMilestone[];
}

export async function listMilestonesForRocks(
  rockIds: number[]
): Promise<RockMilestone[]> {
  if (rockIds.length === 0) return [];
  const rows = await db().sql`
    SELECT * FROM rock_milestones WHERE rock_id = ANY(${rockIds})
    ORDER BY due_date ASC NULLS LAST, sort_order ASC, id ASC
  `;
  return rows as RockMilestone[];
}

export async function addMilestone(input: {
  rockId: number;
  title: string;
  dueDate: string | null;
  sortOrder: number;
}) {
  const rows = await db().sql`
    INSERT INTO rock_milestones (rock_id, title, due_date, sort_order)
    VALUES (${input.rockId}, ${input.title}, ${input.dueDate}, ${input.sortOrder})
    RETURNING *
  `;
  return rows[0] as RockMilestone;
}

/** Hito del equipo con el título de su Rock (null si es de otro equipo). */
export async function getMilestone(teamId: number, milestoneId: number): Promise<(RockMilestone & { rock_title: string }) | null> {
  const rows = await db().sql`
    SELECT m.*, r.title AS rock_title FROM rock_milestones m JOIN rocks r ON r.id = m.rock_id
    WHERE m.id = ${milestoneId} AND r.team_id = ${teamId}
  `;
  return (rows[0] as RockMilestone & { rock_title: string }) ?? null;
}

export async function toggleMilestone(teamId: number, milestoneId: number, done: boolean): Promise<boolean> {
  const rows = await db().sql`
    UPDATE rock_milestones m SET done = ${done} FROM rocks r
    WHERE m.id = ${milestoneId} AND r.id = m.rock_id AND r.team_id = ${teamId} RETURNING m.id
  `;
  return rows.length > 0;
}

export async function setMilestoneDueDate(teamId: number, milestoneId: number, dueDate: string | null): Promise<boolean> {
  const rows = await db().sql`
    UPDATE rock_milestones m SET due_date = ${dueDate} FROM rocks r
    WHERE m.id = ${milestoneId} AND r.id = m.rock_id AND r.team_id = ${teamId} RETURNING m.id
  `;
  return rows.length > 0;
}

export async function deleteMilestone(teamId: number, milestoneId: number): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM rock_milestones m USING rocks r
    WHERE m.id = ${milestoneId} AND r.id = m.rock_id AND r.team_id = ${teamId} RETURNING m.id
  `;
  return rows.length > 0;
}
