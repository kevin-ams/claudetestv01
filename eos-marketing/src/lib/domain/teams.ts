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

/** Correos a los que se envía la planificación semanal (p. ej. jefatura). */
export async function setPlanningRecipients(teamId: number, recipients: string) {
  await db().sql`UPDATE teams SET planning_recipients = ${recipients} WHERE id = ${teamId}`;
}

/** Correo al que llegan las respuestas de los correos del equipo ("" = la persona que envía). */
export async function setTeamReplyTo(teamId: number, email: string) {
  await db().sql`UPDATE teams SET reply_to = ${email} WHERE id = ${teamId}`;
}

/** "Responder a" de los correos del equipo: el configurado en Ajustes › Equipo o, si no hay, `fallback`. */
export async function teamReplyTo(teamId: number, fallback?: string): Promise<string | undefined> {
  const rows = (await db().sql`SELECT reply_to FROM teams WHERE id = ${teamId}`) as { reply_to: string }[];
  return rows[0]?.reply_to || fallback;
}

// --- Organización: todos los equipos reales (cada demo es su propia organización) ---------------

/** Equipos de la misma organización que `teamId` (incluido él). */
export async function orgTeamIds(teamId: number): Promise<number[]> {
  const rows = (await db().sql`
    SELECT t.id FROM teams t, teams me
    WHERE me.id = ${teamId} AND t.is_demo = me.is_demo AND (NOT t.is_demo OR t.demo_owner_id = me.demo_owner_id)
    ORDER BY t.id
  `) as { id: number }[];
  return rows.map((r) => r.id);
}

/** Equipo donde se guarda lo que es de toda la organización (V/TO): el primero creado. */
export async function orgAnchorTeam(teamId: number): Promise<number> {
  return (await orgTeamIds(teamId))[0] ?? teamId;
}
