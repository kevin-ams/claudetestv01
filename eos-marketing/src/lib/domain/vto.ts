import "server-only";
import { db } from "@/lib/db";
import type { VTO } from "./types";
import { orgAnchorTeam } from "./teams";

// El V/TO es uno para toda la organización: se guarda en el primer equipo y lo ven y editan todos.

export async function getVTO(teamId: number): Promise<VTO | null> {
  const anchor = await orgAnchorTeam(teamId);
  await db().sql`INSERT INTO vto (team_id) VALUES (${anchor}) ON CONFLICT (team_id) DO NOTHING`;
  const rows = await db().sql`SELECT * FROM vto WHERE team_id = ${anchor}`;
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
  teamId = await orgAnchorTeam(teamId);
  await db().sql`INSERT INTO vto (team_id) VALUES (${teamId}) ON CONFLICT (team_id) DO NOTHING`;
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
