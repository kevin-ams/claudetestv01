/**
 * Sincronización manual de leads en segundo plano (hasta 15 minutos): la lanza el botón
 * "Sincronizar ahora" y sigue aunque se cierre la página. Llama a /api/cron/activecampaign en
 * tandas (cada una revisa unos segundos el historial y retoma donde quedó) hasta terminar;
 * al terminar, esa ruta guarda los leads de la semana en curso.
 */
export default async (req: Request) => {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    console.error("[ac-sync-background] No autorizado");
    return;
  }
  const { fresh } = (await req.json().catch(() => ({}))) as { fresh?: string };
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
  console.log("[ac-sync-background] se agotó el tiempo; la sincronización horaria continúa lo pendiente.");
};

export const config = { background: true };
