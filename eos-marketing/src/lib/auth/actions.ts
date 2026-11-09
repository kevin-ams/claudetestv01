"use server";

import { ADMIN_ROLE } from "@/lib/domain/roles";
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
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionCookie, destroySessionCookie, getSession } from "@/lib/auth/session";
import { passwordProblem } from "@/lib/auth/password-policy";
import { clearMfaChallenge, readMfaChallenge, startMfaChallenge } from "@/lib/auth/mfa-session";
import { db } from "@/lib/db";
import { clearFailures, isLocked, LOCKED_MESSAGE, recordAttempt } from "@/lib/security/attempts";
import { alertOwners, clientIp, recordSecurityEvent } from "@/lib/security/events";
import { mfaStatus, verifyMfa } from "@/lib/security/mfa";

const setupSchema = z.object({
  teamName: z.string().trim().min(2, "El nombre del equipo es muy corto"),
  name: z.string().trim().min(2, "Tu nombre es muy corto"),
  email: z.string().trim().email("Correo inválido"),
  password: z.string(),
});

/**
 * `email` se devuelve en los errores de login para no borrar lo que la persona escribió.
 * `mfa`: la contraseña fue correcta y falta el código de doble factor.
 */
export type FormState = { error: string | null; email?: string; mfa?: boolean };

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
  const weak = passwordProblem(parsed.data.password, parsed.data.email);
  if (weak) return { error: weak };

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
  await addTeamMember(team.id, user.id, "Líder de equipo", ADMIN_ROLE);
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

// Hash de referencia: si el correo no existe se compara igual contra él, para que el tiempo de respuesta no revele
// qué correos tienen cuenta.
let dummyHash: Promise<string> | null = null;

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", email: String(formData.get("email") ?? "") };
  }
  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();
  if (await isLocked("password", email, ip)) return { error: LOCKED_MESSAGE, email };

  const user = await getUserByEmail(email);
  const valid = user
    ? await verifyPassword(parsed.data.password, user.password_hash)
    : await verifyPassword(parsed.data.password, await (dummyHash ??= hashPassword("referencia-sin-cuenta")));
  if (!user || !valid) {
    const locked = await recordAttempt("password", email, ip, false);
    await recordSecurityEvent({ type: locked ? "login_locked" : "login_failed", userId: user?.id ?? null, email, ip });
    if (locked && user) await alertOwners("login_locked", "Cuenta bloqueada por intentos", `La cuenta ${email} se bloqueó 15 minutos tras 5 contraseñas incorrectas (IP ${ip ?? "desconocida"}).`, email);
    return { error: "Correo o contraseña incorrectos", email };
  }

  const teams = await getUserTeams(user.id);
  if (teams.length === 0) {
    return { error: "Tu cuenta no pertenece a ningún equipo todavía. Contacta a tu administrador.", email };
  }
  await recordAttempt("password", email, ip, true);
  await clearFailures("password", email);

  // Doble factor: si la persona lo activó, falta el código antes de entrar.
  if ((await mfaStatus(user.id)).enabled) {
    await startMfaChallenge(user.id, email);
    return { error: null, email, mfa: true };
  }
  await finishLogin(user, teams[0].id, ip, "contraseña");
  redirect("/");
}

async function finishLogin(user: { id: number; name: string; email: string; role: "admin" | "member" }, teamId: number, ip: string | null, how: string) {
  await createSessionCookie({ userId: user.id, teamId, role: user.role, name: user.name, email: user.email });
  await db().sql`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;
  await recordSecurityEvent({ type: "login_ok", userId: user.id, teamId, email: user.email, ip, detail: how });
}

/** Segundo paso con doble factor: código de la app o código de recuperación. */
export async function verifyMfaLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const challenge = await readMfaChallenge();
  if (!challenge) return { error: "El tiempo para escribir el código terminó. Vuelve a ingresar tu contraseña." };
  const { userId, email } = challenge;
  const ip = await clientIp();
  if (await isLocked("mfa", email, ip)) return { error: LOCKED_MESSAGE, email, mfa: true };
  const code = String(formData.get("code") ?? "");
  const how = await verifyMfa(userId, code);
  if (!how) {
    const locked = await recordAttempt("mfa", email, ip, false);
    await recordSecurityEvent({ type: locked ? "login_locked" : "mfa_failed", userId, email, ip });
    if (locked) await alertOwners("login_locked", "Cuenta bloqueada por intentos", `La cuenta ${email} se bloqueó 15 minutos tras 5 códigos de doble factor incorrectos (IP ${ip ?? "desconocida"}).`, email);
    return { error: "Código incorrecto.", email, mfa: true };
  }
  await recordAttempt("mfa", email, ip, true);
  await clearFailures("mfa", email);
  const user = await getUserByEmail(email);
  const teams = user ? await getUserTeams(user.id) : [];
  if (!user || user.id !== userId || teams.length === 0) return { error: "No se pudo iniciar sesión." };
  await clearMfaChallenge();
  if (how === "recovery") await recordSecurityEvent({ type: "mfa_recovery_used", userId, email, ip, detail: `Quedan ${(await mfaStatus(userId)).recoveryLeft}` });
  await finishLogin(user, teams[0].id, ip, how === "recovery" ? "contraseña + código de recuperación" : "contraseña + doble factor");
  redirect("/");
}

export async function cancelMfaLoginAction() {
  await clearMfaChallenge();
  redirect("/login");
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
