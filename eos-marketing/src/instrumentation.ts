/**
 * Zona horaria del equipo para fechas y semanas (lunes a domingo). En Netlify
 * los servidores están en UTC; sin esto la semana cambiaría el domingo a las 6 p. m.
 */
export function register() {
  process.env.TZ = process.env.EOS_TIMEZONE || "America/Guatemala";
}
