import { timingSafeEqual } from "node:crypto";
import { finishSync, syncChunk } from "@/lib/domain/ac-sync";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { lastClosedWeek } from "@/lib/utils/dates";

/**
 * POST /api/cron/activecampaign?offset=N — sincronización semanal automática (todos los equipos).
 * La llama la función programada de Netlify (netlify/functions/ac-weekly-sync.mts) con
 * "Authorization: Bearer $CRON_SECRET", en tandas hasta que responde done = true.
 * Guarda los leads en la semana que acaba de cerrar.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!isActiveCampaignConfigured()) return Response.json({ error: "ActiveCampaign sin configurar" }, { status: 503 });

  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const week = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("semana") ?? "") ? url.searchParams.get("semana")! : lastClosedWeek();
  const r = await syncChunk({ teamId: null, weekStart: week, offset, size: 4, userId: null });
  if (r.done && r.totalStages > 0) await finishSync({ teamId: null, weekStart: week, userId: null, auto: true });
  return Response.json({ week, ...r });
}
