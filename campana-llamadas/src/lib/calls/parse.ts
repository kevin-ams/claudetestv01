import type {
  CallOutcome,
  CallRecord,
  InterestLevel,
  PriorContact,
} from "./types";

export type RawSheet = { title: string; values: string[][] };

/** Minúsculas, sin acentos ni espacios extra: "  INTERÉS " -> "interes". */
export function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Encabezados esperados (normalizados). Se buscan por nombre, así que el orden de
// las columnas en la hoja puede cambiar sin romper el dashboard.
const COLUMNS = {
  program: ["carrera", "programa"],
  email: ["email", "correo"],
  firstName: ["first name", "nombre"],
  lastName: ["last name", "apellido"],
  phone: ["phone number", "telefono"],
  leadDate: ["date created", "fecha creacion"],
  outcome: ["estado llamada"],
  priorContact: ["ya lo llamaron", "ya lo contactaron", "¿ya lo contactaron?"],
  interest: ["interes"],
  notes: ["observaciones"],
  agent: ["llamada por", "asesor"],
  callDate: ["dia", "fecha llamada"],
  callTime: ["hora"],
} as const;

type ColumnKey = keyof typeof COLUMNS;

function mapHeader(header: string[]): Partial<Record<ColumnKey, number>> {
  const normalized = header.map(norm);
  const map: Partial<Record<ColumnKey, number>> = {};
  for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
    const idx = normalized.findIndex((h) =>
      (COLUMNS[key] as readonly string[]).includes(h)
    );
    if (idx !== -1) map[key] = idx;
  }
  return map;
}

/** Una hoja es de contactos si trae al menos CARRERA y ESTADO LLAMADA. */
export function isCallsSheet(values: string[][]): boolean {
  const map = mapHeader(values[0] ?? []);
  return map.program !== undefined && map.outcome !== undefined;
}

function sheetMeta(title: string): Pick<CallRecord, "faculty" | "level"> {
  const t = norm(title).replace(/^contactos\s*/, "");
  const level = /postgrado|maestria|posgrado/.test(t)
    ? "Postgrado"
    : /pregrado|licenciatura/.test(t)
      ? "Pregrado"
      : "Otro";
  const faculty =
    t
      .replace(/postgrados?|posgrados?|pregrados?/g, "")
      .trim()
      .toUpperCase() || title;
  return { faculty, level };
}

export function parseOutcome(raw: string): CallOutcome {
  const v = norm(raw);
  if (!v) return "pendiente";
  if (v.includes("efectiva")) return "efectiva";
  if (v.includes("no contesto") || v.includes("buzon")) return "no_contesto";
  if (v.includes("equivocado") || v.includes("no existe")) return "numero_equivocado";
  return "otro";
}

export function parsePriorContact(raw: string): PriorContact | null {
  const v = norm(raw);
  if (!v) return null;
  if (v.startsWith("no recuerda") || v.includes("no esta seguro")) return "no_recuerda";
  if (v === "si" || v.startsWith("si ")) return "si";
  if (v === "no" || v.startsWith("no ")) return "no";
  return null;
}

/** "INTERÉS" puede traer varios valores separados por coma. */
export function parseInterests(raw: string): InterestLevel[] {
  const v = norm(raw);
  if (!v) return [];
  const found: InterestLevel[] = [];
  if (/(^|,)\s*interesad/.test(v)) found.push("interesado");
  if (v.includes("solo quiere informacion") || v.includes("dudas")) found.push("solo_info");
  if (v.includes("inscrito")) found.push("inscrito");
  if (v.includes("no interesa") || v.includes("no le interesa")) found.push("no_interesa");
  return found;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Acepta "24/09/2026", "24-9-26", "2026-09-24", "2026-09-24 11:14:58" o un serial de Sheets. */
export function parseDate(raw: string): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(year, +m[2], +m[1]);
  }
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    // Serial de Google Sheets: días desde 1899-12-30.
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 86400000);
    return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Acepta "11:03", "11:03:00", "14.24", "2:15 p. m.", "2:15 PM". */
export function parseTime(raw: string): { hour: number; label: string } | null {
  const v = norm(raw).replace(/\s/g, "");
  if (!v) return null;
  const m = v.match(/^(\d{1,2})[:.](\d{1,2})(?::\d{1,2})?(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return null;
  let hour = +m[1];
  const minute = +m[2];
  if (m[3]?.startsWith("p") && hour < 12) hour += 12;
  if (m[3]?.startsWith("a") && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, label: `${pad(hour)}:${pad(minute)}` };
}

function titleCase(value: string): string {
  const v = value.replace(/\s+/g, " ").trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

export function parseSheet(sheet: RawSheet): { records: CallRecord[]; warnings: string[] } {
  const [header = [], ...rows] = sheet.values;
  const col = mapHeader(header);
  const meta = sheetMeta(sheet.title);
  const warnings: string[] = [];
  const cell = (row: string[], key: ColumnKey) =>
    col[key] === undefined ? "" : String(row[col[key]!] ?? "").trim();

  const records: CallRecord[] = [];
  rows.forEach((row, i) => {
    const program = cell(row, "program");
    const email = cell(row, "email");
    const phone = cell(row, "phone");
    if (!program && !email && !phone) return;

    const outcomeRaw = cell(row, "outcome");
    const outcome = parseOutcome(outcomeRaw);
    const agentRaw = cell(row, "agent");
    const time = parseTime(cell(row, "callTime"));
    const callDateRaw = cell(row, "callDate");
    const callDate = parseDate(callDateRaw);
    if (callDateRaw && !callDate) {
      warnings.push(`${sheet.title} fila ${i + 2}: fecha "${callDateRaw}" no reconocida`);
    }

    records.push({
      id: `${sheet.title}#${i + 2}`,
      sheet: sheet.title,
      ...meta,
      program: program || "(Sin carrera)",
      name: [cell(row, "firstName"), cell(row, "lastName")].filter(Boolean).join(" "),
      phone,
      email,
      leadDate: parseDate(cell(row, "leadDate")),
      outcome,
      outcomeRaw: outcome === "otro" ? outcomeRaw : "",
      priorContact: parsePriorContact(cell(row, "priorContact")),
      interests: parseInterests(cell(row, "interest")),
      notes: cell(row, "notes"),
      agent: agentRaw ? titleCase(agentRaw) : null,
      callDate,
      callHour: time?.hour ?? null,
      callTime: time?.label ?? null,
    });
  });

  return { records, warnings };
}

export function parseWorkbook(sheets: RawSheet[]) {
  const records: CallRecord[] = [];
  const warnings: string[] = [];
  for (const sheet of sheets) {
    if (!isCallsSheet(sheet.values)) continue;
    const parsed = parseSheet(sheet);
    records.push(...parsed.records);
    warnings.push(...parsed.warnings);
  }
  return { records, warnings };
}
