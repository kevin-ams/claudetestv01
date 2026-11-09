import { getAccess } from "@/lib/auth/access";
import { createBackup, recordBackupEvent } from "@/lib/backup";
import { logActivity } from "@/lib/domain/activity";
import { isPlatformOwner } from "@/lib/auth/platform";
import { recordSecurityEvent } from "@/lib/security/events";

/**
 * GET /api/respaldo → respaldo completo de la base (.json.gz). Incluye a TODAS las organizaciones y las contraseñas
 * cifradas, así que solo lo descarga el dueño de la plataforma (ISO 27001 8.2 / 8.12 / 8.13).
 */
export async function GET() {
  const access = await getAccess();
  if (!access) return new Response("No autenticado", { status: 401 });
  if (!(await isPlatformOwner(access.session.userId))) return new Response("Solo el dueño de la plataforma puede descargar respaldos", { status: 403 });

  const { file, tables, rows } = await createBackup();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const detail = `${tables} tablas · ${rows} registros · ${Math.round(file.length / 1024)} KB`;
  await recordBackupEvent("download", access.session, detail);
  await logActivity(access.session, "ajustes", "Descargó respaldo", detail);
  await recordSecurityEvent({ type: "backup_downloaded", userId: access.session.userId, teamId: access.session.teamId, email: access.session.email, detail });
  return new Response(new Blob([file as BlobPart], { type: "application/gzip" }), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="eos-marketing-respaldo_${stamp}.json.gz"`,
      "Cache-Control": "no-store",
    },
  });
}
