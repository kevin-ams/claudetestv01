import { getAccess } from "@/lib/auth/access";
import { createBackup, recordBackupEvent } from "@/lib/backup";
import { logActivity } from "@/lib/domain/activity";

/** GET /api/respaldo → respaldo completo de la base (.json.gz). Solo administradores. */
export async function GET() {
  const access = await getAccess();
  if (!access) return new Response("No autenticado", { status: 401 });
  if (!access.isAdmin) return new Response("Solo un administrador puede descargar respaldos", { status: 403 });

  const { file, tables, rows } = await createBackup();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const detail = `${tables} tablas · ${rows} registros · ${Math.round(file.length / 1024)} KB`;
  await recordBackupEvent("download", access.session, detail);
  await logActivity(access.session, "ajustes", "Descargó respaldo", detail);
  return new Response(new Blob([file as BlobPart], { type: "application/gzip" }), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="eos-marketing-respaldo_${stamp}.json.gz"`,
      "Cache-Control": "no-store",
    },
  });
}
