// Dashboard de tratos: cada hora (minuto 37) trae de ActiveCampaign los tratos nuevos o
// modificados. Llama a /api/cron/ac-deals en tandas hasta terminar o agotar el tiempo de la
// función; lo pendiente sigue en la siguiente hora.
async function acDealsSync() {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[ac-deals] Faltan APP_URL/URL o CRON_SECRET");
    return;
  }
  const started = Date.now();
  // Las funciones programadas tienen ~30 s: no se empieza una tanda nueva después de 18 s.
  for (let first = true; Date.now() - started < 18000; first = false) {
    const res = await fetch(`${base}/api/cron/ac-deals${first ? "?start=1" : ""}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = (await res.json().catch(() => ({}))) as { done?: boolean; error?: string | null; pendingEnrich?: number };
    if (!res.ok) {
      console.error("[ac-deals]", res.status, body);
      return;
    }
    if (body.error) console.warn("[ac-deals] error:", body.error);
    if (body.done) {
      console.log("[ac-deals] listo");
      return;
    }
  }
  console.log("[ac-deals] quedan tratos por leer; sigue en la próxima hora.");
}

export default acDealsSync;

export const config = { schedule: "37 * * * *" };
