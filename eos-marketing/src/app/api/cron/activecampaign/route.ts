import { finishSync, scanStep, writeWeek } from "@/lib/domain/ac-sync";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { shiftWeek, weekStartISO } from "@/lib/utils/dates";
import { TIMEZONE } from "@/lib/config/shared";
import { config } from "@/lib/config/server";
import { cronAuthorized } from "@/lib/security/cron-auth";

const TZ = TIMEZONE;

/**
 * POST /api/cron/activecampaign — sincronización automática (todos los equipos).
 * La llama la función en segundo plano ac-sync-background (botón "Sincronizar ahora" o la programada ac-weekly-sync, los lunes 7:07)
 * con "Authorization: Bearer $CRON_SECRET", varias veces hasta que responde done = true.
 * Cada llamada revisa el historial de tratos unos segundos y retoma donde quedó; al terminar
 * guarda los leads calificados de la semana en curso. Los lunes también cierra la semana
 * anterior (para incluir los tratos que entraron en sus últimas horas).
 */
export async function POST(request: Request) {
  const auth = cronAuthorized(request);
  if (!auth.ok) return auth.response;
  if (!isActiveCampaignConfigured()) {
    const missing = [
      ...(config.activeCampaign.url() ? [] : ["ACTIVECAMPAIGN_API_URL"]),
      ...(config.activeCampaign.apiKey() ? [] : ["ACTIVECAMPAIGN_API_KEY"]),
    ];
    return Response.json({ error: `ActiveCampaign sin configurar: falta ${missing.join(" y ")}` }, { status: 503 });
  }

  const week = weekStartISO();
  // Un embudo revisado en los últimos 45 minutos cuenta como al día en esta pasada horaria. Una
  // sincronización manual (?fresh=ISO) pide revisar de nuevo lo que no se revisó desde ese momento.
  const fresh = Date.parse(new URL(request.url).searchParams.get("fresh") ?? "");
  const freshAfter =
    Number.isFinite(fresh) && fresh <= Date.now() && fresh > Date.now() - 864e5 ? new Date(fresh) : new Date(Date.now() - 45 * 60 * 1000);
  const r = await scanStep({ teamId: null, freshAfter, budgetMs: 8000 });
  if (r.done && r.pipelinesTotal > 0) {
    const counts = await writeWeek({ teamId: null, weekStart: week, userId: null, current: true });
    await finishSync({ teamId: null, weekStart: week, userId: null, auto: true, counts, log: false });
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(new Date());
    if (weekday === "Mon") await writeWeek({ teamId: null, weekStart: shiftWeek(week, -1), userId: null, current: false });
  }
  return Response.json({ week, ...r });
}
