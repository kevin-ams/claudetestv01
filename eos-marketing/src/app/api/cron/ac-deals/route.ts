import { timingSafeEqual } from "node:crypto";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { runSyncStep } from "@/lib/domain/deals-sync";

/**
 * POST /api/cron/ac-deals — sincronización automática del Dashboard de tratos.
 * La llama cada hora la función programada netlify/functions/ac-deals-sync.mts con
 * "Authorization: Bearer $CRON_SECRET", varias veces hasta que responde done = true.
 * Cada llamada trabaja unos segundos y retoma donde quedó.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: secret.length < 16 ? "CRON_SECRET no está configurado en el servidor" : "No autorizado" }, { status: 401 });
  if (!isActiveCampaignConfigured()) return Response.json({ error: "ActiveCampaign sin configurar" }, { status: 503 });

  const start = new URL(request.url).searchParams.get("start") === "1";
  const p = await runSyncStep(start ? "incremental" : "continue", 8000);
  return Response.json({ ...p, done: p.phase === "done" || Boolean(p.error) });
}
