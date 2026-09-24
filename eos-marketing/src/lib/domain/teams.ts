import "server-only";
import { db } from "@/lib/db";
import type { Team } from "./types";

export async function createTeam(name: string): Promise<Team> {
  const rows = await db().sql`
    INSERT INTO teams (name) VALUES (${name}) RETURNING *
  `;
  return rows[0] as Team;
}

export async function getTeam(id: number): Promise<Team | null> {
  const rows = await db().sql`SELECT * FROM teams WHERE id = ${id}`;
  return (rows[0] as Team) ?? null;
}

export async function renameTeam(id: number, name: string) {
  await db().sql`UPDATE teams SET name = ${name} WHERE id = ${id}`;
}

/** Crea el V/TO vacío de un equipo nuevo. */
export async function seedNewTeam(teamId: number) {
  await db().sql`
    INSERT INTO vto (team_id) VALUES (${teamId})
    ON CONFLICT (team_id) DO NOTHING
  `;
}

export async function setTeamThemeColor(id: number, color: string) {
  await db().sql`UPDATE teams SET theme_color = ${color} WHERE id = ${id}`;
}
