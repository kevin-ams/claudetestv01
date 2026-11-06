/**
 * Sincronización de leads en segundo plano (hasta 15 minutos): la lanzan el botón "Sincronizar ahora"
 * y la función programada ac-weekly-sync, y sigue aunque se cierre la página. Llama a /api/cron/activecampaign en
 * tandas (cada una revisa unos segundos el historial y retoma donde quedó) hasta terminar;
 * al terminar, esa ruta guarda los leads de la semana en curso.
 */
export default async (req: Request) => {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    console.error("[ac-sync-background] No autorizado");
    return;
  }
  const { fresh, chain } = (await req.json().catch(() => ({}))) as { fresh?: string; chain?: number };
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const started = Date.now();
  // Se deja margen antes de los 15 minutos de la función.
  while (Date.now() - started < 13 * 60 * 1000) {
    const res = await fetch(`${base}/api/cron/activecampaign${fresh ? `?fresh=${encodeURIComponent(fresh)}` : ""}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = (await res.json().catch(() => ({}))) as { done?: boolean; errors?: string[]; week?: string };
    if (!res.ok) {
      console.error("[ac-sync-background]", res.status, body);
      return;
    }
    if (body.errors?.length) console.warn("[ac-sync-background] errores:", body.errors);
    if (body.done) {
      console.log(`[ac-sync-background] listo: semana ${body.week}`);
      return;
    }
  }
  // La pasada semanal automática no tiene otra oportunidad hasta el lunes siguiente: si no alcanzó el
  // tiempo, se relanza a sí misma (máximo 3 veces) para terminar.
  if (typeof chain === "number" && chain < 3) {
    await fetch(`${base}/.netlify/functions/ac-sync-background`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fresh, chain: chain + 1 }),
    }).catch((e) => console.error("[ac-sync-background] no se pudo continuar:", e));
    console.log(`[ac-sync-background] se agotó el tiempo; continúa (tanda ${chain + 2}).`);
    return;
  }
  console.log("[ac-sync-background] se agotó el tiempo; lo pendiente se revisa en la próxima sincronización.");
};

export const config = { background: true };
