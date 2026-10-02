"use server";

import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/auth/access";
import { parseBackup, recordBackupEvent, restoreBackup } from "@/lib/backup";
import { logActivity } from "@/lib/domain/activity";
import { appUrl, emailFrom, emailLayout, escapeHtml, sendEmail } from "@/lib/email";

export type RestoreResult = { ok: boolean; message: string };

export async function restoreBackupAction(formData: FormData): Promise<RestoreResult> {
  const access = await getAccess();
  if (!access?.isAdmin) return { ok: false, message: "Solo un administrador puede restaurar un respaldo." };
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "RESTAURAR") {
    return { ok: false, message: 'Escribe RESTAURAR para confirmar.' };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige el archivo de respaldo." };
  try {
    const backup = parseBackup(new Uint8Array(await file.arrayBuffer()));
    const { tables, rows } = await restoreBackup(backup);
    const detail = `${file.name} (del ${backup.created_at.slice(0, 10)}) · ${tables} tablas · ${rows} registros`;
    await recordBackupEvent("restore", access.session, detail);
    // La bitácora restaurada es la del respaldo; se agrega la restauración si el equipo sigue existiendo.
    await logActivity(access.session, "ajustes", "Restauró respaldo", detail);
    revalidatePath("/", "layout");
    return { ok: true, message: `Respaldo restaurado: ${rows} registros. Si tu usuario no existía en esa copia, tendrás que volver a entrar.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo restaurar el respaldo." };
  }
}

/** Correo de prueba a quien lo pide (para comprobar Resend y el dominio). */
export async function sendTestEmailAction(): Promise<RestoreResult> {
  const access = await getAccess();
  if (!access?.isAdmin) return { ok: false, message: "Solo un administrador puede enviar la prueba." };
  const s = access.session;
  return sendEmail({
    to: [s.email],
    subject: "Prueba de correo · EOS Nivel 10",
    html: emailLayout({
      title: "¡El correo funciona!",
      intro: `Hola ${escapeHtml(s.name)}, este es un correo de prueba enviado desde ${escapeHtml(await appUrl())} con el remitente <b>${escapeHtml(emailFrom())}</b>.`,
    }),
  });
}
