"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/domain/activity";
import { isLocked, LOCKED_MESSAGE, recordAttempt } from "@/lib/security/attempts";
import { clientIp, recordSecurityEvent } from "@/lib/security/events";
import { confirmEnrollment, disableMfa, getMfaMode, mfaStatus, startEnrollment, verifyMfa } from "@/lib/security/mfa";

export type MfaStart = { ok: true; qrDataUrl: string; manualKey: string } | { ok: false; message: string };
export type MfaConfirm = { ok: true; recoveryCodes: string[] } | { ok: false; message: string };

/** Paso 1: QR y clave para la app de autenticación (solo si la organización ofrece el doble factor). */
export async function startMfaAction(): Promise<MfaStart> {
  const session = await requireSession();
  if ((await getMfaMode(session.teamId)) === "off") return { ok: false, message: "El doble factor no está disponible en tu organización." };
  if ((await mfaStatus(session.userId)).enabled) return { ok: false, message: "Ya tienes el doble factor activo." };
  const r = await startEnrollment(session.userId, session.email);
  return { ok: true, ...r };
}

/** Paso 2: confirma con el primer código; devuelve los códigos de recuperación (se muestran una sola vez). */
export async function confirmMfaAction(code: string): Promise<MfaConfirm> {
  const session = await requireSession();
  const ip = await clientIp();
  if (await isLocked("mfa", session.email, ip)) return { ok: false, message: LOCKED_MESSAGE };
  const codes = await confirmEnrollment(session.userId, String(code ?? ""));
  if (!codes) {
    await recordAttempt("mfa", session.email, ip, false);
    return { ok: false, message: "El código no coincide. Revisa que la hora de tu teléfono sea automática e intenta con el código nuevo." };
  }
  await recordSecurityEvent({ type: "mfa_enabled", userId: session.userId, teamId: session.teamId, email: session.email, ip });
  await logActivity(session, "equipo", "Activó el doble factor", session.name);
  revalidatePath("/perfil");
  return { ok: true, recoveryCodes: codes };
}

/** Desactivar el propio doble factor: pide un código vigente (o de recuperación). */
export async function disableMfaAction(code: string): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  const ip = await clientIp();
  if (await isLocked("mfa", session.email, ip)) return { ok: false, message: LOCKED_MESSAGE };
  if (!(await verifyMfa(session.userId, String(code ?? "")))) {
    await recordAttempt("mfa", session.email, ip, false);
    return { ok: false, message: "Código incorrecto." };
  }
  await disableMfa(session.userId);
  await recordSecurityEvent({ type: "mfa_disabled", userId: session.userId, teamId: session.teamId, email: session.email, ip });
  await logActivity(session, "equipo", "Desactivó el doble factor", session.name);
  revalidatePath("/perfil");
  return { ok: true, message: "Doble factor desactivado." };
}
