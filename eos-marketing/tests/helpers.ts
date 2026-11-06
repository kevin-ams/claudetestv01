import { db } from "@/lib/db";
import { ADMIN_ROLE, PREMIUM_ROLE, ensureTeamRoles } from "@/lib/domain/roles";
import { createTeam } from "@/lib/domain/teams";
import { addTeamMember, createUser } from "@/lib/domain/users";

let n = 0;

/** Persona con un rol en un equipo. */
export async function person(teamId: number, role: string = PREMIUM_ROLE) {
  n++;
  const u = await createUser({ name: `Persona ${n}`, email: `p${n}-${Date.now()}@test.local`, password: "secreto1234", role: "member" });
  await ensureTeamRoles(teamId);
  await addTeamMember(teamId, u.id, undefined, role);
  return u;
}

/** Organización real: equipos que no son demo (todos comparten vault, V/TO y organigrama). */
export async function realTeam(name: string) {
  const t = await createTeam(name);
  await ensureTeamRoles(t.id);
  return t;
}

/** Otra organización: un equipo demo es su propia organización (la de su dueño). */
export async function demoOrg(name: string) {
  const t = await realTeam(name);
  const owner = await person(t.id, PREMIUM_ROLE);
  await db().sql`UPDATE teams SET is_demo = TRUE, demo_owner_id = ${owner.id} WHERE id = ${t.id}`;
  return { team: t, owner };
}

export { ADMIN_ROLE, PREMIUM_ROLE };
