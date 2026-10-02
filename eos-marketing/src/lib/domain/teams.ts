import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
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

// ---------- Logo de la organización (esquina superior izquierda) ----------

const logoKey = (teamId: number) => `logos/${teamId}`;

export function teamLogoUrl(team: Pick<Team, "id" | "logo_mime" | "logo_updated_at"> | null): string | null {
  if (!team?.logo_mime) return null;
  return `/api/logo/${team.id}?v=${Date.parse(team.logo_updated_at ?? "") || 1}`;
}

export async function setTeamLogo(teamId: number, image: Uint8Array, mime: string) {
  await (await storage()).put(logoKey(teamId), image);
  await db().sql`UPDATE teams SET logo_mime = ${mime}, logo_updated_at = NOW() WHERE id = ${teamId}`;
}

export async function removeTeamLogo(teamId: number) {
  await (await storage()).remove(logoKey(teamId));
  await db().sql`UPDATE teams SET logo_mime = NULL, logo_updated_at = NOW() WHERE id = ${teamId}`;
}

export async function getTeamLogo(teamId: number): Promise<{ image: Uint8Array; mime: string } | null> {
  const rows = (await db().sql`SELECT logo_mime FROM teams WHERE id = ${teamId}`) as { logo_mime: string | null }[];
  const mime = rows[0]?.logo_mime;
  if (!mime) return null;
  const image = await (await storage()).get(logoKey(teamId));
  return image ? { image, mime } : null;
}
