"use server";

import { redirect } from "next/navigation";
import { getUserByEmail } from "@/lib/domain/users";
import { sendPasswordResetEmail } from "@/lib/domain/account-emails";
import { resetPasswordWithToken, tokenRequestedRecently } from "@/lib/domain/password-tokens";
import { EMAIL_RE } from "@/lib/email";
import { passwordProblem } from "@/lib/auth/password-policy";
import { isLocked, recordAttempt } from "@/lib/security/attempts";
import { clientIp, recordSecurityEvent } from "@/lib/security/events";

export type RecoverState = { error: string | null; sent?: boolean; email?: string };

/** Pide el enlace. Siempre responde lo mismo para no revelar qué correos tienen cuenta. */
export async function requestPasswordResetAction(_prev: RecoverState, formData: FormData): Promise<RecoverState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Escribe un correo válido.", email };
  const ip = await clientIp();
  if (await isLocked("reset", email, ip)) return { error: null, sent: true, email };
  await recordAttempt("reset", email, ip, false); // cuenta como intento para limitar pedidos repetidos
  const user = await getUserByEmail(email);
  if (user) await recordSecurityEvent({ type: "password_reset_requested", userId: user.id, email, ip });
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
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };
  const done = await resetPasswordWithToken(token, password);
  if (!done) return { error: "El enlace venció o ya se usó. Pide uno nuevo en “¿Olvidaste tu contraseña?”." };
  await recordSecurityEvent({ type: "password_reset_done", userId: done.user_id, email: done.email });
  redirect(`/login?restablecida=1`);
}
