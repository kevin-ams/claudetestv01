"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { countAdmins, createAdmin, getAdminByEmail } from "@/lib/domain/admins";
import { verifyPassword } from "@/lib/auth/password";
import { endAdminSession, startAdminSession } from "@/lib/auth/session";

export type FormState = { error: string | null; ok?: boolean; message?: string };

const setupSchema = z.object({
  name: z.string().trim().min(2, "Tu nombre es muy corto"),
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // Solo se permite crear el primer administrador; los demás se agregan desde el panel.
  if ((await countAdmins()) > 0) redirect("/admin/login");

  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = await createAdmin(parsed.data);
  await startAdminSession({ adminId: admin.id, name: admin.name, email: admin.email });
  redirect("/admin");
}

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = await getAdminByEmail(parsed.data.email);
  if (!admin || !(await verifyPassword(parsed.data.password, admin.password_hash))) {
    return { error: "Correo o contraseña incorrectos" };
  }

  await startAdminSession({ adminId: admin.id, name: admin.name, email: admin.email });
  redirect("/admin");
}

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/login");
}
