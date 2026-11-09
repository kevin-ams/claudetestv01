"use server";

import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/auth/access";
import { logActivity } from "@/lib/domain/activity";
import type { ActionResult } from "@/lib/actions";
import { accessReview } from "@/lib/security/access-review";
import { alertOwners, recordSecurityEvent } from "@/lib/security/events";
import { disableMfa, isMfaMode, setMfaMode } from "@/lib/security/mfa";

/** Activar o apagar la opción de doble factor de la organización: solo el Administrador Premium. */
export async function setMfaModeAction(mode: string): Promise<ActionResult> {
  const access = await getAccess();
  if (!access?.isPremium) return { ok: false, message: "Solo el Administrador Premium cambia esta opción." };
  if (!isMfaMode(mode)) return { ok: false, message: "Opción no válida." };
  await setMfaMode(access.session.teamId, mode);
  const label = mode === "optional" ? "disponible (cada persona lo activa en su perfil)" : "apagado";
  await logActivity(access.session, "ajustes", "Cambió el doble factor", label);
  await recordSecurityEvent({ type: "mfa_mode_changed", userId: access.session.userId, teamId: access.session.teamId, email: access.session.email, detail: label });
  revalidatePath("/ajustes/seguridad");
  revalidatePath("/perfil");
  return { ok: true, message: mode === "optional" ? "Doble factor disponible: cada persona puede activarlo en su perfil." : "Doble factor apagado para nuevas activaciones." };
}

/** Quitar el doble factor de alguien que perdió su teléfono y sus códigos: solo el Administrador Premium. */
export async function resetMfaAction(userId: number): Promise<ActionResult> {
  const access = await getAccess();
  if (!access?.isPremium) return { ok: false, message: "Solo el Administrador Premium puede restablecer el doble factor." };
  const target = (await accessReview(access.session.teamId)).find((r) => r.user_id === Number(userId));
  if (!target) return { ok: false, message: "Esa persona no es de tu organización." };
  if (!target.mfa) return { ok: false, message: `${target.name} no tiene doble factor activo.` };
  await disableMfa(target.user_id);
  await logActivity(access.session, "ajustes", "Restableció el doble factor", target.name);
  await recordSecurityEvent({ type: "mfa_reset", userId: target.user_id, actorId: access.session.userId, teamId: access.session.teamId, email: target.email });
  await alertOwners("mfa_reset", "Se quitó el doble factor de una cuenta", `${access.session.name} quitó el doble factor de ${target.name} (${target.email}).`, target.email);
  revalidatePath("/ajustes/seguridad");
  return { ok: true, message: `Se quitó el doble factor de ${target.name}. Podrá entrar solo con su contraseña y volver a activarlo.` };
}
