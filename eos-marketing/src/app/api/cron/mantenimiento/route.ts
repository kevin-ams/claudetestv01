import { cronAuthorized } from "@/lib/security/cron-auth";
import { purgeExpiredData } from "@/lib/security/retention";

/**
 * POST /api/cron/mantenimiento — retención de datos técnicos (ISO 27001 8.10). La llama la función programada
 * `maintenance-weekly` (domingos) con "Authorization: Bearer $CRON_SECRET".
 */
export async function POST(request: Request) {
  const auth = cronAuthorized(request);
  if (!auth.ok) return auth.response;
  const purged = await purgeExpiredData();
  console.log("[mantenimiento]", JSON.stringify(purged));
  return Response.json({ ok: true, purged });
}
