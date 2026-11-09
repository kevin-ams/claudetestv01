/**
 * Celda CSV. Los textos vienen de los leads (datos externos): si empiezan con = + - @ o tabulador, Excel los
 * ejecutaría como fórmula, así que se anteponen con un apóstrofo (OWASP: CSV injection).
 */
export function csvCell(v: string | number | null) {
  let s = v === null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
