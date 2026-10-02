"use server";

import { redirect } from "next/navigation";
import { getUserByEmail } from "@/lib/domain/users";
import { sendPasswordResetEmail } from "@/lib/domain/account-emails";
import { resetPasswordWithToken, tokenRequestedRecently } from "@/lib/domain/password-tokens";
import { EMAIL_RE } from "@/lib/email";

export type RecoverState = { error: string | null; sent?: boolean; email?: string };

/** Pide el enlace. Siempre responde lo mismo para no revelar qué correos tienen cuenta. */
export async function requestPasswordResetAction(_prev: RecoverState, formData: FormData): Promise<RecoverState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Escribe un correo válido.", email };
  const user = await getUserByEmail(email);
  if (user && !(await tokenRequestedRecently(user.id))) {
    const r = await sendPasswordResetEmail(user);
    if (!r.ok) console.error("[recuperar]", r.message);
  }
  return { error: null, sent: true, email };
}

export type ResetState = { error: string | null };

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };
  const done = await resetPasswordWithToken(token, password);
  if (!done) return { error: "El enlace venció o ya se usó. Pide uno nuevo en “¿Olvidaste tu contraseña?”." };
  redirect(`/login?restablecida=1`);
}
