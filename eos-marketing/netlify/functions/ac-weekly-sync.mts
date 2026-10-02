// Sincronización semanal de leads desde ActiveCampaign: cada lunes a las 6:00 a. m. de
// Guatemala (12:00 UTC). Llama a /api/cron/activecampaign en tandas hasta terminar.
async function acWeeklySync() {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[ac-weekly-sync] Faltan APP_URL/URL o CRON_SECRET");
    return;
  }
  let offset = 0;
  let week = "";
  for (let i = 0; i < 25; i++) {
    const res = await fetch(`${base}/api/cron/activecampaign?offset=${offset}${week ? `&semana=${week}` : ""}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = (await res.json().catch(() => ({}))) as { done?: boolean; next?: number; week?: string; errors?: string[] };
    if (!res.ok) {
      console.error("[ac-weekly-sync]", res.status, body);
      return;
    }
    if (body.errors?.length) console.warn("[ac-weekly-sync] errores:", body.errors);
    week = body.week ?? week;
    if (body.done) {
      console.log(`[ac-weekly-sync] listo: semana ${week}`);
      return;
    }
    offset = body.next ?? offset + 4;
  }
  console.warn("[ac-weekly-sync] se alcanzó el máximo de tandas; quedan etapas pendientes.");
}

export default acWeeklySync;

export const config = { schedule: "0 12 * * 1" };
