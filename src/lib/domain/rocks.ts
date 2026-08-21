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

export async function updateRockStatus(rockId: number, status: RockStatus) {
  await db().sql`UPDATE rocks SET status = ${status} WHERE id = ${rockId}`;
}

export async function updateRock(
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
    WHERE id = ${rockId}
  `;
}

export async function deleteRock(rockId: number) {
  await db().sql`DELETE FROM rocks WHERE id = ${rockId}`;
}

export async function listMilestones(rockId: number): Promise<RockMilestone[]> {
  const rows = await db().sql`
    SELECT * FROM rock_milestones WHERE rock_id = ${rockId} ORDER BY sort_order ASC, id ASC
  `;
  return rows as RockMilestone[];
}

export async function listMilestonesForRocks(
  rockIds: number[]
): Promise<RockMilestone[]> {
  if (rockIds.length === 0) return [];
  const rows = await db().sql`
    SELECT * FROM rock_milestones WHERE rock_id = ANY(${rockIds}) ORDER BY sort_order ASC, id ASC
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

export async function toggleMilestone(milestoneId: number, done: boolean) {
  await db().sql`UPDATE rock_milestones SET done = ${done} WHERE id = ${milestoneId}`;
}

export async function deleteMilestone(milestoneId: number) {
  await db().sql`DELETE FROM rock_milestones WHERE id = ${milestoneId}`;
}
