// Sincronización automática de los leads semanales (Indicadores de carrera) desde ActiveCampaign.
// No toca el Dashboard AC: ese se sincroniza solo a mano.
//
// Corre UNA vez por semana: el lunes a las 7:07 (hora de Guatemala = 13:07 UTC). Cierra la semana
// anterior con sus leads finales (y deja la nueva semana en cero). Durante la semana, los leads se
// actualizan solo cuando alguien pulsa "Sincronizar ahora".
//
// Antes corría cada hora, 24/7, y Netlify la cortaba a los ~15 s sin terminar. Ahora solo lanza la
// función en segundo plano (ac-sync-background, hasta 15 min), que trabaja en tandas hasta terminar.
async function acWeeklySync() {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[ac-sync] Faltan APP_URL/URL o CRON_SECRET");
    return;
  }
  const res = await fetch(`${base}/.netlify/functions/ac-sync-background`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ chain: 0 }),
  });
  // Las funciones en segundo plano responden 202 de inmediato y siguen trabajando.
  if (res.status !== 202) console.error("[ac-sync] No se pudo lanzar la sincronización en segundo plano:", res.status);
  else console.log("[ac-sync] sincronización lanzada en segundo plano");
}

export default acWeeklySync;

export const config = { schedule: "7 13 * * 1" };
