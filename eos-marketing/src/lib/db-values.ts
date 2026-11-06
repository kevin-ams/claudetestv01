/**
 * Lectura uniforme de columnas que cada driver puede entregar distinto (PGlite en local, Neon en la nube):
 * JSON/JSONB como objeto o como texto, y arreglos de Postgres como arreglo o como literal "{a,b}".
 */

/** JSON/JSONB: objeto ya interpretado o texto; `fallback` si viene vacío o no se puede leer. */
export function asJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== "string") return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** Elementos de un literal de arreglo de Postgres ("{a,"b c",NULL}"), sin anidar. */
function pgArrayItems(v: string): (string | null)[] {
  const body = v.trim().replace(/^\{/, "").replace(/\}$/, "");
  if (!body) return [];
  const out: (string | null)[] = [];
  let cur = "";
  let quoted = false;
  let wasQuoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === "\\") cur += body[++i] ?? "";
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') {
      quoted = true;
      wasQuoted = true;
    } else if (ch === ",") {
      out.push(!wasQuoted && cur === "NULL" ? null : cur);
      cur = "";
      wasQuoted = false;
    } else cur += ch;
  }
  out.push(!wasQuoted && cur === "NULL" ? null : cur);
  return out;
}

/** text[]: arreglo de textos (sin nulos). */
export function asStrings(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined).map(String);
  if (typeof v === "string") return pgArrayItems(v).filter((x): x is string => x !== null);
  return [];
}

/** int[] / real[] / JSON de números: arreglo de números finitos. */
export function asNumbers(v: unknown): number[] {
  const items = Array.isArray(v) ? v : typeof v === "string" ? (v.trim().startsWith("[") ? asJson<unknown[]>(v, []) : pgArrayItems(v)) : [];
  return items.filter((x) => x !== null && x !== undefined && x !== "").map(Number).filter(Number.isFinite);
}
