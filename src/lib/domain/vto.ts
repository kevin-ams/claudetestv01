import "server-only";
import { db } from "@/lib/db";
import type { VTO } from "./types";

export async function getVTO(teamId: number): Promise<VTO | null> {
  const rows = await db().sql`SELECT * FROM vto WHERE team_id = ${teamId}`;
  return (rows[0] as VTO) ?? null;
}

export type VTOField =
  | "core_values"
  | "core_focus"
  | "ten_year_target"
  | "marketing_strategy"
  | "three_year_picture"
  | "one_year_plan";

export async function updateVTOField(
  teamId: number,
  field: VTOField,
  value: unknown,
  userId: number
) {
  const json = JSON.stringify(value);
  switch (field) {
    case "core_values":
      await db().sql`UPDATE vto SET core_values = ${json}::jsonb, updated_at = NOW(), updated_by = ${userId} WHERE team_id = ${teamId}`;
      return;
    case "core_focus":
      await db().sql`UPDATE vto SET core_focus = ${json}::jsonb, updated_at = NOW(), updated_by = ${userId} WHERE team_id = ${teamId}`;
      return;
    case "ten_year_target":
      await db().sql`UPDATE vto SET ten_year_target = ${String(value)}, updated_at = NOW(), updated_by = ${userId} WHERE team_id = ${teamId}`;
      return;
    case "marketing_strategy":
      await db().sql`UPDATE vto SET marketing_strategy = ${json}::jsonb, updated_at = NOW(), updated_by = ${userId} WHERE team_id = ${teamId}`;
      return;
    case "three_year_picture":
      await db().sql`UPDATE vto SET three_year_picture = ${json}::jsonb, updated_at = NOW(), updated_by = ${userId} WHERE team_id = ${teamId}`;
      return;
    case "one_year_plan":
      await db().sql`UPDATE vto SET one_year_plan = ${json}::jsonb, updated_at = NOW(), updated_by = ${userId} WHERE team_id = ${teamId}`;
      return;
  }
}
