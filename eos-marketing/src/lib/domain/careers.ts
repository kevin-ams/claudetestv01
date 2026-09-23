import "server-only";
import { db } from "@/lib/db";
import type { Career, CareerImport, CareerLevel, CareerWeekly, LeadsSource, BudgetSource } from "./types";

export async function listCareers(teamId: number): Promise<Career[]> {
  const rows = await db().sql`
    SELECT * FROM careers
    WHERE team_id = ${teamId} AND archived = FALSE
    ORDER BY sort_order ASC, id ASC
  `;
  return rows as Career[];
}

export async function getCareer(careerId: number): Promise<Career | null> {
  const rows = await db().sql`SELECT * FROM careers WHERE id = ${careerId}`;
  return (rows[0] as Career) ?? null;
}

export async function createCareer(input: {
  teamId: number;
  program: string;
  code: string;
  name: string;
  level: CareerLevel;
  ownerId: number | null;
  leadsGoal?: number;
  budgetGoal?: number;
}): Promise<Career> {
  const rows = await db().sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM careers WHERE team_id = ${input.teamId}
  `;
  const next = (rows[0] as { next: number }).next;
  const inserted = await db().sql`
    INSERT INTO careers (team_id, program, code, name, level, owner_id, leads_goal, budget_goal, sort_order)
    VALUES (${input.teamId}, ${input.program}, ${input.code}, ${input.name}, ${input.level},
            ${input.ownerId}, ${input.leadsGoal ?? 0}, ${input.budgetGoal ?? 0}, ${next})
    RETURNING *
  `;
  return inserted[0] as Career;
}

export async function updateCareer(
  careerId: number,
  input: { program: string; code: string; name: string; level: CareerLevel; ownerId: number | null }
) {
  await db().sql`
    UPDATE careers SET
      program = ${input.program},
      code = ${input.code},
      name = ${input.name},
      level = ${input.level},
      owner_id = ${input.ownerId}
    WHERE id = ${careerId}
  `;
}

export async function setCareerOwner(careerId: number, ownerId: number | null) {
  await db().sql`UPDATE careers SET owner_id = ${ownerId} WHERE id = ${careerId}`;
}

export async function setCareerGoal(careerId: number, field: "leads" | "budget", value: number) {
  if (field === "leads") {
    await db().sql`UPDATE careers SET leads_goal = ${value} WHERE id = ${careerId}`;
  } else {
    await db().sql`UPDATE careers SET budget_goal = ${value} WHERE id = ${careerId}`;
  }
}

export async function archiveCareer(careerId: number) {
  await db().sql`UPDATE careers SET archived = TRUE WHERE id = ${careerId}`;
}

export async function listWeekly(teamId: number, weekStart: string): Promise<CareerWeekly[]> {
  const rows = await db().sql`
    SELECT cw.*
    FROM career_weekly cw
    JOIN careers c ON c.id = cw.career_id
    WHERE c.team_id = ${teamId} AND cw.week_start = ${weekStart}
  `;
  return rows as CareerWeekly[];
}

export async function setWeeklyLeads(input: {
  careerId: number;
  weekStart: string;
  leads: number | null;
  source: LeadsSource;
  userId: number;
}) {
  const source = input.leads === null ? null : input.source;
  await db().sql`
    INSERT INTO career_weekly (career_id, week_start, leads, leads_source, updated_by)
    VALUES (${input.careerId}, ${input.weekStart}, ${input.leads}, ${source}, ${input.userId})
    ON CONFLICT (career_id, week_start) DO UPDATE SET
      leads = ${input.leads}, leads_source = ${source},
      updated_by = ${input.userId}, updated_at = NOW()
  `;
}

export async function setWeeklyBudget(input: {
  careerId: number;
  weekStart: string;
  spent: number | null;
  source: BudgetSource;
  userId: number;
}) {
  const source = input.spent === null ? null : input.source;
  await db().sql`
    INSERT INTO career_weekly (career_id, week_start, budget_spent, budget_source, updated_by)
    VALUES (${input.careerId}, ${input.weekStart}, ${input.spent}, ${source}, ${input.userId})
    ON CONFLICT (career_id, week_start) DO UPDATE SET
      budget_spent = ${input.spent}, budget_source = ${source},
      updated_by = ${input.userId}, updated_at = NOW()
  `;
}

/** Suma al consumo existente (modo "sumar" del importador). */
export async function addWeeklyBudget(input: {
  careerId: number;
  weekStart: string;
  amount: number;
  userId: number;
}) {
  await db().sql`
    INSERT INTO career_weekly (career_id, week_start, budget_spent, budget_source, updated_by)
    VALUES (${input.careerId}, ${input.weekStart}, ${input.amount}, 'csv', ${input.userId})
    ON CONFLICT (career_id, week_start) DO UPDATE SET
      budget_spent = COALESCE(career_weekly.budget_spent, 0) + ${input.amount},
      budget_source = 'csv', updated_by = ${input.userId}, updated_at = NOW()
  `;
}

export async function listAliases(teamId: number): Promise<Record<string, number>> {
  const rows = (await db().sql`
    SELECT alias, career_id FROM career_campaign_aliases WHERE team_id = ${teamId}
  `) as { alias: string; career_id: number }[];
  return Object.fromEntries(rows.map((r) => [r.alias, r.career_id]));
}

export async function saveAlias(teamId: number, alias: string, careerId: number) {
  await db().sql`
    INSERT INTO career_campaign_aliases (team_id, alias, career_id)
    VALUES (${teamId}, ${alias}, ${careerId})
    ON CONFLICT (team_id, alias) DO UPDATE SET career_id = ${careerId}
  `;
}

export async function logImport(input: {
  teamId: number;
  kind: CareerImport["kind"];
  weekStart: string;
  fileName: string | null;
  careersUpdated: number;
  total: number;
  userId: number;
}) {
  await db().sql`
    INSERT INTO career_imports (team_id, kind, week_start, file_name, careers_updated, total, created_by)
    VALUES (${input.teamId}, ${input.kind}, ${input.weekStart}, ${input.fileName},
            ${input.careersUpdated}, ${input.total}, ${input.userId})
  `;
}

export async function listRecentImports(teamId: number, limit = 5) {
  const rows = await db().sql`
    SELECT ci.*, u.name AS user_name
    FROM career_imports ci
    LEFT JOIN users u ON u.id = ci.created_by
    WHERE ci.team_id = ${teamId}
    ORDER BY ci.created_at DESC
    LIMIT ${limit}
  `;
  return rows as (CareerImport & { user_name: string | null })[];
}
