import "server-only";
import { z } from "zod";

/**
 * Configuración del servidor (control ISO 27001 8.9 / 8.24). Es el ÚNICO lugar que lee `process.env`, regla que
 * revisa ESLint (`no-restricted-properties`). Cada variable se valida al leerla:
 *
 * - Los secretos nunca tienen valor por omisión. En producción, sin `AUTH_SECRET`, la app no firma ni acepta
 *   sesiones (falla segura); en desarrollo usa una clave local de prueba.
 * - Una integración opcional sin su clave queda apagada y lo muestra Ajustes › Diagnóstico (sin el valor).
 * - Nada de aquí llega al navegador: el módulo es `server-only` y no hay variables `NEXT_PUBLIC_*`.
 *
 * El inventario completo, con alcance en Netlify y rotación, está en `docs/seguridad/configuracion.md`.
 */

/* eslint-disable no-restricted-properties -- este módulo es el único autorizado a leer process.env */
const raw = (name: string): string | undefined => {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? undefined : v.trim();
};
/* eslint-enable no-restricted-properties */

const url = (name: string): string | undefined => {
  const v = raw(name);
  if (!v) return undefined;
  const ok = z.url().safeParse(v);
  if (!ok.success) {
    console.error(`[config] ${name} no es una URL válida; se ignora.`);
    return undefined;
  }
  return v.replace(/\/$/, "");
};

export const isProduction = () => raw("NODE_ENV") === "production";
export const isDevelopment = () => !isProduction();

/** Error de configuración: la operación no puede continuar de forma segura. */
export class ConfigError extends Error {}

const DEV_AUTH_SECRET = "dev-only-insecure-secret-not-for-production";

export const config = {
  auth: {
    /** Clave que firma las sesiones. En producción es obligatoria: sin ella se lanza un error (no hay clave por omisión). */
    secret(): string {
      const s = raw("AUTH_SECRET");
      if (s) return s;
      if (isProduction()) throw new ConfigError("Falta AUTH_SECRET: la app no puede firmar ni aceptar sesiones.");
      return DEV_AUTH_SECRET;
    },
    secretStatus(): "ok" | "short" | "missing" {
      const s = raw("AUTH_SECRET");
      return !s ? "missing" : s.length < 32 ? "short" : "ok";
    },
    /** Correos del dueño de la plataforma (opcional). */
    platformOwnerEmails(): string[] {
      return (raw("PLATFORM_OWNER_EMAILS") ?? "")
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    },
  },
  app: {
    /** URL pública de la app (enlaces en correos y llamadas a funciones). `URL` la define Netlify. */
    url: (): string | undefined => url("APP_URL") ?? url("URL"),
    /** Solo APP_URL (para los enlaces de los correos; si no está, se usa el dominio de la petición). */
    explicitUrl: (): string | undefined => url("APP_URL"),
    cronSecret: (): string | undefined => raw("CRON_SECRET"),
  },
  db: {
    forceLocal: () => raw("EOS_FORCE_LOCAL_DB") === "1",
    dataDir: () => raw("EOS_DATA_DIR"),
    uploadsDir: () => raw("EOS_UPLOADS_DIR"),
  },
  activeCampaign: {
    url: () => url("ACTIVECAMPAIGN_API_URL"),
    apiKey: () => raw("ACTIVECAMPAIGN_API_KEY"),
    configured: () => Boolean(url("ACTIVECAMPAIGN_API_URL") && raw("ACTIVECAMPAIGN_API_KEY")),
  },
  clickUp: {
    token: () => raw("CLICKUP_API_TOKEN"),
    url: () => url("CLICKUP_API_URL") ?? "https://api.clickup.com/api/v2",
    spaceName: () => raw("CLICKUP_SPACE_NAME") ?? "Marketing",
    spaceId: () => raw("CLICKUP_SPACE_ID"),
  },
  email: {
    resendKey: () => raw("RESEND_API_KEY"),
    from: () => raw("RESEND_FROM") ?? "EOS Nivel 10 <onboarding@resend.dev>",
    resendUrl: () => url("RESEND_API_URL") ?? "https://api.resend.com",
  },
  ai: {
    anthropicKey: () => raw("ANTHROPIC_API_KEY"),
    globalMonthlyCapUsd(): number {
      const v = Number(raw("AI_GLOBAL_MONTHLY_CAP_USD"));
      return Number.isFinite(v) && v > 0 ? v : 20;
    },
  },
  analytics: {
    /** ID público del proyecto de Clarity (no es secreto: va en la página). */
    clarityProjectId(): string | null {
      const id = raw("CLARITY_PROJECT_ID") ?? "";
      return /^[a-z0-9]{6,20}$/i.test(id) ? id : null;
    },
  },
};

export type ConfigItem = { name: string; secret: boolean; required: boolean; status: "ok" | "missing" | "warning"; note: string };

/** Estado de la configuración para Diagnóstico: nombres y si están, nunca valores. */
export function configReport(): ConfigItem[] {
  const has = (n: string) => Boolean(raw(n));
  const item = (name: string, secret: boolean, required: boolean, note: string, ok = has(name)): ConfigItem => ({
    name,
    secret,
    required,
    status: ok ? "ok" : required ? "missing" : "warning",
    note,
  });
  const auth = config.auth.secretStatus();
  return [
    { name: "AUTH_SECRET", secret: true, required: true, status: auth === "ok" ? "ok" : auth === "short" ? "warning" : "missing", note: auth === "short" ? "Firma las sesiones. Es corta: se recomiendan 32 caracteres o más." : "Firma las sesiones." },
    item("CRON_SECRET", true, true, "Protege las sincronizaciones programadas."),
    item("APP_URL", false, false, "URL pública para los enlaces de los correos (si no, se usa la de Netlify).", Boolean(config.app.url())),
    item("RESEND_API_KEY", true, false, "Envío de correos (Resend)."),
    item("ACTIVECAMPAIGN_API_KEY", true, false, "Sincronización de leads (ActiveCampaign).", config.activeCampaign.configured()),
    item("CLICKUP_API_TOKEN", true, false, "Importar tareas de ClickUp."),
    item("ANTHROPIC_API_KEY", true, false, "Asistente IA (premium)."),
    item("CLARITY_PROJECT_ID", false, false, "Analítica de uso (Microsoft Clarity).", Boolean(config.analytics.clarityProjectId())),
    item("PLATFORM_OWNER_EMAILS", false, false, "Dueño de la plataforma (si no, la primera cuenta)."),
  ];
}
