const timeZone = process.env.APP_TIMEZONE || "America/Guatemala";

export const fechaHora = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone });

const soloFecha = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeZone: "UTC" });

/** Formatea una fecha "YYYY-MM-DD" (sin hora) tal cual, sin corrimiento de zona. */
export function formatFecha(isoDate: string): string {
  return soloFecha.format(new Date(`${isoDate}T00:00:00Z`));
}
