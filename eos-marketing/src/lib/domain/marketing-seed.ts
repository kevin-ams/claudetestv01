import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createUser, addTeamMember, getUserByEmail, listTeamMembers } from "./users";
import { createCareer } from "./careers";
import { createRock, addMilestone } from "./rocks";
import { CAREER_CATALOG, MARKETING_ROSTER, type RosterName } from "./careers-catalog";

/** Correo provisional para las personas del equipo que aún no tienen acceso. */
export function placeholderEmail(name: string) {
  return `${name.toLowerCase()}@marketing.local`;
}

/**
 * Asegura que las personas del roster estén en el equipo. Si ya hay un
 * miembro con ese primer nombre (por ejemplo, el administrador), se usa.
 */
async function ensureRoster(teamId: number): Promise<Map<RosterName, number>> {
  const members = await listTeamMembers(teamId);
  const userIdByName = new Map<RosterName, number>();

  for (const name of MARKETING_ROSTER) {
    const member = members.find((m) => m.name.trim().split(/\s+/)[0]?.toLowerCase() === name.toLowerCase());
    if (member) {
      userIdByName.set(name, member.id);
      continue;
    }
    const email = placeholderEmail(name);
    const existing = await getUserByEmail(email);
    const user =
      existing ??
      (await createUser({
        name,
        email,
        // Contraseña aleatoria: el administrador define el acceso real desde "Equipo".
        password: randomBytes(24).toString("hex"),
        role: "member",
      }));
    await addTeamMember(teamId, user.id);
    userIdByName.set(name, user.id);
  }
  return userIdByName;
}

/**
 * Carga el equipo de marketing: las personas del roster, las carreras con su
 * responsable (solo si el equipo aún no tiene carreras) y los Rocks iniciales
 * de Kevin. Se puede volver a correr sin duplicar nada.
 */
export async function seedMarketingTeam(teamId: number): Promise<{ careers: number }> {
  const userIdByName = await ensureRoster(teamId);

  const existing = await db().sql`SELECT 1 FROM careers WHERE team_id = ${teamId} LIMIT 1`;
  let created = 0;
  if (existing.length === 0) {
    for (const [program, code, name, level, owner] of CAREER_CATALOG) {
      await createCareer({
        teamId,
        program,
        code,
        name,
        level,
        ownerId: userIdByName.get(owner) ?? null,
      });
      created++;
    }
  }

  await seedKevinRocks(teamId, userIdByName.get("Kevin") ?? null);
  return { careers: created };
}

async function seedKevinRocks(teamId: number, kevinId: number | null) {
  const exists = await db().sql`
    SELECT 1 FROM rocks WHERE team_id = ${teamId} AND title = 'Dashboard de Active'
  `;
  if (exists.length > 0) return;

  // Q4 2026: el tercer trimestre cierra la semana de arranque del sistema.
  const rock = await createRock({
    teamId,
    ownerId: kevinId,
    title: "Dashboard de Active",
    description:
      "Dashboard con los leads de ActiveCampaign por carrera, programa y responsable, conectado al módulo de Indicadores de carrera.",
    isCompanyRock: false,
    quarter: 4,
    year: 2026,
    dueDate: "2026-12-18",
  });

  const milestones: [string, string][] = [
    ["Definir KPIs y vistas del dashboard con el equipo", "2026-10-09"],
    ["Obtener acceso a la API de ActiveCampaign y mapear el campo de carrera", "2026-10-23"],
    ["Conectar la sincronización semanal de leads al sistema", "2026-11-13"],
    ["Construir las vistas por carrera, programa y responsable", "2026-12-04"],
    ["Validar datos con el equipo y lanzar", "2026-12-18"],
  ];
  for (let i = 0; i < milestones.length; i++) {
    await addMilestone({ rockId: rock.id, title: milestones[i][0], dueDate: milestones[i][1], sortOrder: i });
  }
}
