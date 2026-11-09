import { TIMEZONE } from "@/lib/config/shared";
/**
 * Zona horaria del equipo para fechas y semanas (lunes a domingo). En Netlify
 * los servidores están en UTC; sin esto la semana cambiaría el domingo a las 6 p. m.
 */
export function register() {
  // eslint-disable-next-line no-restricted-properties -- fija la zona horaria del proceso
  process.env.TZ = TIMEZONE;
}
