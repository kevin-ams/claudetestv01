import "server-only";
import { config } from "@/lib/config/server";
import { safeEqual } from "./crypto";

/** Rutas /api/cron/*: solo con "Authorization: Bearer $CRON_SECRET" (comparación en tiempo constante). */
export function cronAuthorized(request: Request): { ok: true } | { ok: false; response: Response } {
  const secret = config.app.cronSecret() ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length >= 16 && safeEqual(given, secret)) return { ok: true };
  return {
    ok: false,
    response: Response.json({ error: secret.length < 16 ? "CRON_SECRET no está configurado en el servidor" : "No autorizado" }, { status: 401 }),
  };
}
