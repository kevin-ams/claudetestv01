// Sincronización de leads calificados desde ActiveCampaign: cada hora (minuto 7). Llama a
// /api/cron/activecampaign en tandas (cada una revisa unos segundos el historial de tratos y
// retoma donde quedó) hasta terminar o hasta agotar el tiempo de esta función; lo pendiente
// sigue en la siguiente hora. Al terminar se guarda la semana en curso.
async function acWeeklySync() {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[ac-sync] Faltan APP_URL/URL o CRON_SECRET");
    return;
  }
  const started = Date.now();
  // Las funciones programadas tienen ~30 s: no se empieza una tanda nueva después de 18 s.
  while (Date.now() - started < 18000) {
    const res = await fetch(`${base}/api/cron/activecampaign`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = (await res.json().catch(() => ({}))) as { done?: boolean; week?: string; errors?: string[]; pipelinesDone?: number; pipelinesTotal?: number };
    if (!res.ok) {
      console.error("[ac-sync]", res.status, body);
      return;
    }
    if (body.errors?.length) console.warn("[ac-sync] errores:", body.errors);
    if (body.done) {
      console.log(`[ac-sync] listo: semana ${body.week}`);
      return;
    }
  }
  console.log("[ac-sync] quedan embudos por revisar; sigue en la próxima hora.");
}

export default acWeeklySync;

export const config = { schedule: "7 * * * *" };
