"use server";

import { revalidatePath } from "next/cache";
import { createSessionCookie, requireSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/domain/activity";
import { PRONOUNS, removeAvatar, setAvatar, updateProfile } from "@/lib/domain/profile";
import { imageMime, sniffImage, MAX_IMAGE_BYTES } from "@/lib/domain/announcements";
import { isHexColor } from "@/lib/theme";
import { passwordProblem } from "@/lib/auth/password-policy";
import { recordSecurityEvent } from "@/lib/security/events";

export type ProfileResult = { ok: boolean; message: string };

export async function saveProfileAction(input: {
  name: string;
  pronoun: string;
  color: string;
  useColorTheme: boolean;
}): Promise<ProfileResult> {
  const session = await requireSession();
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) return { ok: false, message: "Escribe tu nombre." };
  const pronoun = PRONOUNS.some((p) => p.key === input.pronoun) ? input.pronoun : "";
  const color = isHexColor(input.color) ? input.color.toLowerCase() : "";
  await updateProfile(session.userId, { name, pronoun, color, useColorTheme: Boolean(color) && input.useColorTheme });
  // El nombre va en la sesión: se renueva para que se vea de inmediato.
  if (name !== session.name) await createSessionCookie({ ...session, name });
  await logActivity({ ...session, name }, "equipo", "Actualizó su perfil", name);
  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil guardado." };
}

export async function uploadAvatarAction(formData: FormData): Promise<ProfileResult> {
  const session = await requireSession();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige una imagen." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "La imagen pesa más de 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageMime(file) && sniffImage(bytes);
  if (!mime) return { ok: false, message: "Usa una imagen PNG, JPG, WEBP o GIF." };
  await setAvatar(session.userId, bytes, mime);
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto actualizada." };
}

export async function removeAvatarAction(): Promise<ProfileResult> {
  const session = await requireSession();
  await removeAvatar(session.userId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Foto quitada." };
}

export async function changePasswordAction(current: string, next: string): Promise<ProfileResult> {
  const session = await requireSession();
  const weak = passwordProblem(next, session.email);
  if (weak) return { ok: false, message: weak };
  const rows = (await db().sql`SELECT password_hash FROM users WHERE id = ${session.userId}`) as { password_hash: string }[];
  if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) {
    return { ok: false, message: "La contraseña actual no es correcta." };
  }
  const hash = await hashPassword(next);
  await db().sql`UPDATE users SET password_hash = ${hash} WHERE id = ${session.userId}`;
  await logActivity(session, "equipo", "Cambió su contraseña", session.name);
  await recordSecurityEvent({ type: "password_changed", userId: session.userId, teamId: session.teamId, email: session.email });
  return { ok: true, message: "Contraseña cambiada." };
}
