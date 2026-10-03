import { timingSafeEqual } from "node:crypto";
import { finishSync, scanStep, writeWeek } from "@/lib/domain/ac-sync";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { shiftWeek, weekStartISO } from "@/lib/utils/dates";

const TZ = process.env.EOS_TIMEZONE || "America/Guatemala";

/**
 * POST /api/cron/activecampaign — sincronización automática (todos los equipos).
 * La llama cada hora la función programada de Netlify (netlify/functions/ac-weekly-sync.mts)
 * con "Authorization: Bearer $CRON_SECRET", varias veces hasta que responde done = true.
 * Cada llamada revisa el historial de tratos unos segundos y retoma donde quedó; al terminar
 * guarda los leads calificados de la semana en curso. Los lunes también cierra la semana
 * anterior (para incluir los tratos que entraron en sus últimas horas).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) {
    // Sin revelar el secreto: indica si falta configurarlo en el servidor.
    return Response.json({ error: secret.length < 16 ? "CRON_SECRET no está configurado en el servidor" : "No autorizado" }, { status: 401 });
  }
  if (!isActiveCampaignConfigured()) {
    const missing = ["ACTIVECAMPAIGN_API_URL", "ACTIVECAMPAIGN_API_KEY"].filter((k) => !process.env[k]);
    return Response.json({ error: `ActiveCampaign sin configurar: falta ${missing.join(" y ")}` }, { status: 503 });
  }

  const week = weekStartISO();
  // Un embudo revisado en los últimos 45 minutos cuenta como al día en esta pasada horaria.
  const r = await scanStep({ teamId: null, freshAfter: new Date(Date.now() - 45 * 60 * 1000), budgetMs: 8000 });
  if (r.done && r.pipelinesTotal > 0) {
    const counts = await writeWeek({ teamId: null, weekStart: week, userId: null, current: true });
    await finishSync({ teamId: null, weekStart: week, userId: null, auto: true, counts, log: false });
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(new Date());
    if (weekday === "Mon") await writeWeek({ teamId: null, weekStart: shiftWeek(week, -1), userId: null, current: false });
  }
  return Response.json({ week, ...r });
}
