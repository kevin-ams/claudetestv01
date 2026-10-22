"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH, verifyPassword, verifyPasswordOrDummy } from "@/lib/auth/password";
import { createSessionCookie, requireSession } from "@/lib/auth/session";
import {
  countUsers,
  createPasswordUser,
  getUserByEmail,
  getUserById,
  setPassword,
  touchLogin,
} from "@/lib/domain/users";
import type { User } from "@/lib/domain/types";

// `values` devuelve lo que se escribió (sin contraseñas): React limpia el formulario
// después de cada envío y así no se pierde lo capturado cuando hay un error.
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

function keep(form: FormData, ...keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));
}

const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);

async function startSession(user: User) {
  await touchLogin(user.id);
  await createSessionCookie({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
  });
}

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export async function passwordLoginAction(_: FormState, form: FormData): Promise<FormState> {
  const values = keep(form, "email");
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const user = await getUserByEmail(parsed.data.email);
  const valid = await verifyPasswordOrDummy(parsed.data.password, user?.password_hash ?? null);
  if (!user || !valid) return { error: "Correo o contraseña incorrectos", values };
  if (!user.active) return { error: "Tu acceso está desactivado. Contacta a un administrador.", values };

  await startSession(user);
  redirect("/");
}

const setupSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre"),
  email: z.string().trim().email("Correo inválido"),
  password: passwordField,
});

// Crea el primer administrador cuando la base está vacía (sin depender de Google).
export async function setupAdminAction(_: FormState, form: FormData): Promise<FormState> {
  if ((await countUsers()) > 0) redirect("/login");

  const parsed = setupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: keep(form, "name", "email") };
  }

  const user = await createPasswordUser({ ...parsed.data, role: "admin" });
  await startSession(user);
  redirect("/");
}

const changePasswordSchema = z
  .object({
    current: z.string(),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden" });

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await getUserById(session.userId);
  if (!user) return { error: "El usuario no existe" };
  // Quien solo usa Google puede crear su primera contraseña sin la actual.
  if (user.password_hash && !(await verifyPassword(parsed.data.current, user.password_hash))) {
    return { error: "La contraseña actual no es correcta" };
  }

  await setPassword(user.id, parsed.data.password);
  return { ok: "Contraseña actualizada" };
}
