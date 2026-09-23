"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  countUsers,
  createUser,
  getUserByEmail,
  addTeamMember,
  getUserTeams,
  isUserInTeam,
} from "@/lib/domain/users";
import { createTeam, seedNewTeam } from "@/lib/domain/teams";
import { seedMarketingTeam } from "@/lib/domain/marketing-seed";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie, destroySessionCookie, getSession } from "@/lib/auth/session";

const setupSchema = z.object({
  teamName: z.string().trim().min(2, "El nombre del equipo es muy corto"),
  name: z.string().trim().min(2, "Tu nombre es muy corto"),
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type FormState = { error: string | null };

export async function setupAdminAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if ((await countUsers()) > 0) {
    redirect("/login");
  }

  const parsed = setupSchema.safeParse({
    teamName: formData.get("teamName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return { error: "Ya existe una cuenta con ese correo" };
  }

  const team = await createTeam(parsed.data.teamName);
  await seedNewTeam(team.id);
  const user = await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    role: "admin",
  });
  await addTeamMember(team.id, user.id, "Líder de equipo");
  await seedMarketingTeam(team.id);

  await createSessionCookie({
    userId: user.id,
    teamId: team.id,
    role: "admin",
    name: user.name,
    email: user.email,
  });

  redirect("/");
}

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const user = await getUserByEmail(parsed.data.email);
  if (!user) {
    return { error: "Correo o contraseña incorrectos" };
  }
  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) {
    return { error: "Correo o contraseña incorrectos" };
  }

  const teams = await getUserTeams(user.id);
  if (teams.length === 0) {
    return { error: "Tu cuenta no pertenece a ningún equipo todavía. Contacta a tu administrador." };
  }

  await createSessionCookie({
    userId: user.id,
    teamId: teams[0].id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  redirect("/");
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}

export async function switchTeamAction(teamId: number) {
  const session = await getSession();
  if (!session) redirect("/login");
  const allowed = await isUserInTeam(session.userId, teamId);
  if (!allowed) return;
  await createSessionCookie({ ...session, teamId });
  redirect("/");
}
