import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { weekStartISO } from "@/lib/utils/dates";
import { listTeamMembers } from "./users";
import { createPiece, updatePiece, type PieceInput } from "./editorial";
import type { EditorialPiece } from "./editorial-shared";

/**
 * Importa semanas del Plan de contenido publicado en Google Sheets (Archivo › Compartir ›
 * Publicar en la Web) al calendario editorial. Se lee la pestaña del calendario: encabezados
 * "Semana · Fecha · Pieza / Tema · Pilar · Capa · Asignacion · Frente · Audiencia · Facultad /
 * Carrera · CTA sugerido · Estado · Nota", secciones "SEMANA … (5 AL 9 oct)" y, dentro de cada
 * semana, las filas después de "[+] … BUFFER" son de buffer.
 */

export type SheetPiece = {
  title: string;
  pub_date: string | null;
  pilar: string;
  capa: string;
  assignee: string;
  frente: string;
  audiencia: string;
  facultad: string;
  carrera: string;
  cta: string;
  status: string;
  note: string;
  link: string;
  is_buffer: boolean;
};

export type SheetWeek = { key: string; label: string; weekStart: string | null; pieces: SheetPiece[] };

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

const norm = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[​\s]+/g, " ").trim();
const clean = (v: string) => v.replace(/​/g, "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();

/** Enlace publicado de Google Sheets → descarga en Excel. */
export function sheetExportUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com" || !u.pathname.startsWith("/spreadsheets/")) return null;
  const pub = u.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)\/pub(html)?/);
  if (pub) return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=xlsx`;
  const doc = u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/);
  if (doc) return `https://docs.google.com/spreadsheets/d/${doc[1]}/export?format=xlsx`;
  return null;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    return "";
  }
  return String(v);
}

function cellLink(v: ExcelJS.CellValue): string {
  return v && typeof v === "object" && "hyperlink" in v && typeof v.hyperlink === "string" && /^https?:\/\//.test(v.hyperlink)
    ? v.hyperlink
    : "";
}

/** Mes (1-12) del título de la sección: "(5 AL 9 oct)" → 10. */
function labelMonth(label: string): number | null {
  const m = norm(label).match(/\(\d{1,2}\s*(?:-|al|a)\s*\d{1,2}\s*(?:de\s*)?([a-z]{3})/);
  return m && MONTHS[m[1]] ? MONTHS[m[1]] : null;
}

/** "OCTUBRE SEMANA 1 (5 AL 9 oct)" o "SEMANA 1 (3-8 ago)" → lunes de esa semana. */
function weekFromLabel(label: string, year: number): string | null {
  const m = norm(label).match(/\((\d{1,2})\s*(?:-|al|a)\s*\d{1,2}\s*(?:de\s*)?([a-z]{3})/);
  if (!m || !MONTHS[m[2]]) return null;
  return weekStartISO(new Date(year, MONTHS[m[2]] - 1, Number(m[1])));
}

/** Descarga la hoja publicada y devuelve sus semanas con piezas. */
export async function readSheetWeeks(url: string): Promise<SheetWeek[]> {
  const exportUrl = sheetExportUrl(url);
  if (!exportUrl) throw new Error("Pega el enlace de Google Sheets (publicado en la Web o compartido como público).");
  const res = await fetch(exportUrl, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20000) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html")) {
    throw new Error("No se pudo descargar la hoja. Revisa que esté publicada en la Web (Archivo › Compartir › Publicar en la Web).");
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 15 * 1024 * 1024) throw new Error("La hoja es demasiado grande.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  // La pestaña del calendario: la que tiene la columna "Pieza / Tema".
  for (const ws of wb.worksheets) {
    let header = 0;
    const col: Record<string, number> = {};
    ws.eachRow((row, n) => {
      if (header) return;
      const cells = (row.values as ExcelJS.CellValue[]).map((v) => norm(cellText(v)));
      if (cells.some((c) => c.startsWith("pieza"))) {
        header = n;
        cells.forEach((c, i) => {
          if (!c) return;
          const key =
            c.startsWith("semana") ? "semana" :
            c.startsWith("fecha") ? "fecha" :
            c.startsWith("pieza") ? "title" :
            c.startsWith("pilar") ? "pilar" :
            c.startsWith("capa") ? "capa" :
            c.startsWith("asign") || c.startsWith("responsable") ? "assignee" :
            c.startsWith("frente") ? "frente" :
            c.startsWith("audiencia") ? "audiencia" :
            c.startsWith("facultad") ? "facultad" :
            c.startsWith("cta") ? "cta" :
            c.startsWith("estado") ? "status" :
            c.startsWith("nota") ? "note" :
            c.startsWith("link") || c.startsWith("enlace") ? "link" : "";
          if (key && !col[key]) col[key] = i;
        });
      }
    });
    if (!header || !col.title) continue;

    const weeks: SheetWeek[] = [];
    let current: SheetWeek | null = null;
    const days = new Map<string, number>();
    let buffer = false;
    const get = (row: ExcelJS.Row, key: string) => (col[key] ? row.getCell(col[key]).value : null);
    ws.eachRow((row, n) => {
      if (n <= header) return;
      const first = clean(cellText(row.getCell(1).value));
      const title = clean(cellText(get(row, "title")));
      // Las filas de sección son celdas combinadas: el texto se repite en todas las columnas.
      const sectionRow = !title || title === first;
      if (/semana/i.test(first) && sectionRow) {
        current = { key: `${weeks.length}`, label: first, weekStart: null, pieces: [] };
        weeks.push(current);
        buffer = false;
        return;
      }
      if (/buffer/i.test(first) && sectionRow) {
        buffer = true;
        return;
      }
      if (!current || !title) return;
      const dateValue = get(row, "fecha");
      // La fecha puede venir completa o solo como número de día (se completa con el mes de la sección).
      const pubDate = dateValue instanceof Date ? dateValue.toISOString().slice(0, 10) : null;
      const day = typeof dateValue === "number" && dateValue >= 1 && dateValue <= 31 ? Math.trunc(dateValue) : null;
      if (day) days.set((current as SheetWeek).pieces.length + ":" + (current as SheetWeek).key, day);
      const fac = clean(cellText(get(row, "facultad")));
      const slash = fac.indexOf("/");
      (current as SheetWeek).pieces.push({
        title,
        pub_date: pubDate,
        pilar: clean(cellText(get(row, "pilar"))),
        capa: clean(cellText(get(row, "capa"))),
        assignee: clean(cellText(get(row, "assignee"))),
        frente: clean(cellText(get(row, "frente"))),
        audiencia: clean(cellText(get(row, "audiencia"))),
        facultad: slash < 0 ? fac : fac.slice(0, slash).trim(),
        carrera: slash < 0 ? "" : fac.slice(slash + 1).trim(),
        cta: clean(cellText(get(row, "cta"))),
        status: clean(cellText(get(row, "status"))),
        note: clean(cellText(get(row, "note"))),
        link: cellLink(get(row, "title")) || clean(cellText(get(row, "link"))),
        is_buffer: buffer,
      });
    });

    // Lunes de cada semana: por las fechas de sus piezas o, si no tienen, por el título de la sección.
    let year = new Date().getFullYear();
    for (const w of weeks) {
      const month = labelMonth(w.label);
      w.pieces.forEach((p, i) => {
        const d = days.get(i + ":" + w.key);
        if (d && month && !p.pub_date) p.pub_date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      });
      const dates = w.pieces.map((p) => p.pub_date).filter((d): d is string => !!d).sort();
      if (dates.length) {
        w.weekStart = weekStartISO(new Date(`${dates[0]}T12:00:00`));
        year = Number(dates[0].slice(0, 4));
      } else {
        w.weekStart = weekFromLabel(w.label, year);
      }
    }
    const found = weeks.filter((w) => w.pieces.length > 0);
    if (found.length) return found;
  }
  throw new Error("No se encontró la pestaña del calendario: una con la columna “Pieza / Tema” y secciones “SEMANA …”.");
}

export type ImportRow = {
  title: string;
  pub_date: string | null;
  assignee: string;
  status: string;
  is_buffer: boolean;
  /** new = se agrega; update = cambia (lista de campos); same = sin cambios. */
  action: "new" | "update" | "same";
  changes: string[];
};

const FIELDS: [keyof PieceInput, string][] = [
  ["pub_date", "fecha"],
  ["pilar", "pilar"],
  ["capa", "capa"],
  ["assignee_id", "asignación"],
  ["frente", "frente"],
  ["audiencia", "audiencia"],
  ["facultad", "facultad"],
  ["carrera", "carrera"],
  ["cta", "CTA"],
  ["status", "estado"],
  ["note", "nota"],
  ["link", "link"],
  ["is_buffer", "buffer"],
];

async function plan(teamId: number, week: SheetWeek) {
  if (!week.weekStart) throw new Error("No se pudo saber las fechas de esa semana.");
  const members = await listTeamMembers(teamId);
  const who = (name: string) => {
    const n = norm(name);
    if (!n) return null;
    const m = members.find((x) => norm(x.name) === n) ?? members.find((x) => norm(x.name).split(" ")[0] === n.split(" ")[0]);
    return m?.id ?? null;
  };
  const existing = (await db().sql`
    SELECT * FROM editorial_pieces WHERE team_id = ${teamId} AND week_start = ${week.weekStart}
  `) as EditorialPiece[];
  const byTitle = new Map(existing.map((p) => [norm(p.title), p]));
  const used = new Set<number>();
  const items = week.pieces.map((s) => {
    const input: PieceInput = {
      week_start: week.weekStart,
      pub_date: s.pub_date,
      title: s.title,
      pilar: s.pilar,
      capa: s.capa,
      assignee_id: who(s.assignee),
      frente: s.frente,
      audiencia: s.audiencia,
      facultad: s.facultad,
      carrera: s.carrera,
      cta: s.cta,
      status: s.status || "Programado",
      note: s.note,
      link: s.link,
      is_buffer: s.is_buffer,
    };
    const match = byTitle.get(norm(s.title));
    if (match && !used.has(match.id)) {
      used.add(match.id);
      // Lo que la hoja deja vacío no borra lo que ya se capturó en la app (p. ej. el link).
      const merged: PieceInput = { ...input };
      for (const [k] of FIELDS) {
        const v = merged[k];
        if ((v === "" || v === null) && match[k] !== "" && match[k] !== null) (merged as Record<string, unknown>)[k] = match[k];
      }
      const changes = FIELDS.filter(([k]) => String(merged[k] ?? "") !== String(match[k] ?? "")).map(([, label]) => label);
      return { sheet: s, input: merged, id: match.id, action: (changes.length ? "update" : "same") as ImportRow["action"], changes };
    }
    return { sheet: s, input, id: null, action: "new" as const, changes: [] as string[] };
  });
  const appOnly = existing.filter((p) => !used.has(p.id));
  return { items, appOnly };
}

export async function previewSheetWeek(teamId: number, week: SheetWeek) {
  const { items, appOnly } = await plan(teamId, week);
  return {
    rows: items.map(
      (i): ImportRow => ({
        title: i.sheet.title,
        pub_date: i.sheet.pub_date,
        assignee: i.sheet.assignee,
        status: i.input.status,
        is_buffer: i.sheet.is_buffer,
        action: i.action,
        changes: i.changes,
      })
    ),
    appOnly: appOnly.map((p) => ({ id: p.id, title: p.title, status: p.status })),
  };
}

/** Agrega las piezas nuevas y actualiza las que cambiaron. Con `removeMissing`, quita las que ya no están en la hoja. */
export async function importSheetWeek(teamId: number, week: SheetWeek, removeMissing: boolean) {
  const { items, appOnly } = await plan(teamId, week);
  let created = 0;
  let updated = 0;
  for (const i of items) {
    if (i.action === "new") {
      await createPiece(teamId, i.input);
      created++;
    } else if (i.action === "update" && i.id) {
      await updatePiece(teamId, i.id, i.input);
      updated++;
    }
  }
  let removed = 0;
  if (removeMissing && appOnly.length) {
    await db().sql`DELETE FROM editorial_pieces WHERE team_id = ${teamId} AND id = ANY(${appOnly.map((p) => p.id)}::int[])`;
    removed = appOnly.length;
  }
  return { created, updated, removed, same: items.filter((i) => i.action === "same").length };
}
