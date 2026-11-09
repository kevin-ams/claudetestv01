"use server";

import { logActivity } from "@/lib/domain/activity";
import { redirect } from "next/navigation";
import { isTeamAdmin } from "@/lib/auth/access";
import { createSessionCookie, requireSession } from "@/lib/auth/session";
import { createTeam, seedNewTeam } from "@/lib/domain/teams";
import { addTeamMember } from "@/lib/domain/users";
import { ADMIN_ROLE } from "@/lib/domain/roles";
import { findGesTeam, GES_TEAM_NAME, importComunicacionGes } from "@/lib/domain/ges-import";

export type TeamResult = { ok: boolean; message: string };

/** Crea un equipo vacío; quien lo crea queda como Administrador y entra a él. */
export async function createTeamAction(name: string): Promise<TeamResult> {
  const session = await requireSession();
  if (!(await isTeamAdmin())) return { ok: false, message: "Solo un administrador puede crear equipos." };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, message: "Escribe el nombre del equipo." };
  const team = await createTeam(trimmed);
  await seedNewTeam(team.id);
  await addTeamMember(team.id, session.userId, undefined, ADMIN_ROLE);
  await logActivity(session, "equipos", "Creó equipo", trimmed);
  await logActivity({ ...session, teamId: team.id }, "equipos", "Creó este equipo", trimmed);
  await createSessionCookie({ ...session, teamId: team.id });
  redirect("/ajustes/equipo");
}

/** Crea el equipo Comunicación GES con su plan de contenido, coberturas e indicadores. */
export async function importGesTeamAction(): Promise<TeamResult> {
  const session = await requireSession();
  if (!(await isTeamAdmin())) return { ok: false, message: "Solo un administrador puede crear equipos." };
  if (await findGesTeam(session.userId)) return { ok: false, message: `Ya perteneces al equipo ${GES_TEAM_NAME}.` };
  const r = await importComunicacionGes(session);
  const detail = `${r.counts.metrics} indicadores, ${r.counts.entries} valores semanales, ${r.counts.pieces} piezas, ${r.counts.coverages} coberturas`;
  await logActivity(session, "equipos", "Creó equipo desde plantilla", `${GES_TEAM_NAME}: ${detail}`);
  await logActivity({ ...session, teamId: r.teamId }, "equipos", "Creó este equipo e importó datos", detail);
  await createSessionCookie({ ...session, teamId: r.teamId });
  redirect("/calendario");
}
