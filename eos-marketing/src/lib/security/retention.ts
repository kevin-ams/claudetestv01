import "server-only";
import { db } from "@/lib/db";

/**
 * Retención de datos (ISO 27001 8.10 / 5.33). Se ejecuta una vez por semana (función programada `maintenance-weekly`).
 * Solo borra datos técnicos que ya no sirven; los datos de negocio (EOS, vault, actividad, consumo de IA) se
 * conservan mientras la organización los use. Ver docs/seguridad/datos.md.
 */
export const RETENTION = {
  authAttemptsDays: 30,
  aiAnswerCacheDays: 1,
  securityEventsDays: 365,
  passwordTokensDays: 30,
  revokedApiTokensDays: 180,
} as const;

export async function purgeExpiredData(): Promise<Record<string, number>> {
  const count = async (rows: Promise<Record<string, unknown>[]>) => (await rows).length;
  return {
    auth_attempts: await count(db().sql`
      DELETE FROM auth_attempts WHERE created_at < NOW() - make_interval(days => ${RETENTION.authAttemptsDays}) RETURNING id`),
    ai_answer_cache: await count(db().sql`
      DELETE FROM ai_answer_cache WHERE created_at < NOW() - make_interval(days => ${RETENTION.aiAnswerCacheDays}) RETURNING key`),
    // El disparador de la tabla solo permite borrar eventos de más de un año.
    security_events: await count(db().sql`
      DELETE FROM security_events WHERE created_at < NOW() - make_interval(days => ${RETENTION.securityEventsDays}) RETURNING id`),
    password_tokens: await count(db().sql`
      DELETE FROM password_tokens WHERE created_at < NOW() - make_interval(days => ${RETENTION.passwordTokensDays}) RETURNING user_id`),
    api_tokens: await count(db().sql`
      DELETE FROM api_tokens WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - make_interval(days => ${RETENTION.revokedApiTokensDays}) RETURNING id`),
  };
}
