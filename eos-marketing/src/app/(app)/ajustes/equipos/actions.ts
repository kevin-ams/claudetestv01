"use server";

import { redirect } from "next/navigation";
import { isTeamAdmin } from "@/lib/auth/access";
import { createSessionCookie, requireSession } from "@/lib/auth/session";
import { createTeam, seedNewTeam } from "@/lib/domain/teams";
import { addTeamMember } from "@/lib/domain/users";
import { ADMIN_ROLE } from "@/lib/domain/roles";

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
  await createSessionCookie({ ...session, teamId: team.id });
  redirect("/ajustes/equipo");
}
