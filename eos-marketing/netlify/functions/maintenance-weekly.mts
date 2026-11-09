// Mantenimiento semanal (ISO 27001 8.10): borra datos técnicos vencidos (intentos de acceso de más de 30 días,
// caché del asistente, eventos de seguridad de más de un año, enlaces de contraseña viejos y tokens revocados).
// Una sola consulta corta por semana: domingo a las 2:17 a. m. de Guatemala (8:17 UTC), fuera del horario de uso.
async function maintenanceWeekly() {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[mantenimiento] Faltan APP_URL/URL o CRON_SECRET");
    return;
  }
  const res = await fetch(`${base}/api/cron/mantenimiento`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25000),
  });
  console.log("[mantenimiento]", res.status, await res.text().catch(() => ""));
}

export default maintenanceWeekly;

export const config = { schedule: "17 8 * * 0" };
