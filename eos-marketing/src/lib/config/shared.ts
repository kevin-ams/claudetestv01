/**
 * Configuración NO secreta que también pueden importar módulos que llegan al navegador.
 * Aquí nunca va una clave: si lo importa un componente de cliente, `process.env.*` vale `undefined` y se usa el valor
 * por omisión. Todo lo secreto vive en `./server.ts` (solo servidor).
 */

/** Zona horaria del equipo para fechas y semanas (lunes a domingo). */
// eslint-disable-next-line no-restricted-properties -- único punto de lectura de esta variable no secreta
export const TIMEZONE: string = (typeof process !== "undefined" && process.env.EOS_TIMEZONE?.trim()) || "America/Guatemala";
