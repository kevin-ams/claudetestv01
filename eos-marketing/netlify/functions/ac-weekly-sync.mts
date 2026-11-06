// Sincronización automática de leads calificados desde ActiveCampaign.
//
// Antes esta función programada hacía el trabajo ella misma, pero Netlify la corta a los ~15 s:
// nunca terminaba ("quedan embudos por revisar"), y aun así despertaba la base de datos cada hora,
// las 24 horas. Ahora solo lanza la función en segundo plano (ac-sync-background, hasta 15 min), que
// llama a /api/cron/activecampaign en tandas hasta terminar y guardar la semana en curso.
//
// Horario (UTC; Guatemala = UTC-6): cada 2 horas de 7:07 a 17:07 hora de Guatemala, de lunes a sábado.
// Fuera de ese horario la base de datos puede apagarse (no se cobra cómputo mientras está apagada).
// Los lunes, la primera pasada también cierra la semana anterior.
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
    body: "{}",
  });
  // Las funciones en segundo plano responden 202 de inmediato y siguen trabajando.
  if (res.status !== 202) console.error("[ac-sync] No se pudo lanzar la sincronización en segundo plano:", res.status);
  else console.log("[ac-sync] sincronización lanzada en segundo plano");
}

export default acWeeklySync;

export const config = { schedule: "7 13,15,17,19,21,23 * * 1-6" };
