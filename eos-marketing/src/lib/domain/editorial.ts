import "server-only";
import { db } from "@/lib/db";
import {
  DEFAULT_OPTIONS,
  type Coverage,
  type EditorialDate,
  type EditorialOption,
  type EditorialOptions,
  type EditorialPiece,
  type OptionKind,
} from "./editorial-shared";

// ---------------- Listas editables ----------------

const KINDS = Object.keys(DEFAULT_OPTIONS) as OptionKind[];

export function isOptionKind(v: unknown): v is OptionKind {
  return typeof v === "string" && (KINDS as string[]).includes(v);
}

/** Copia las listas iniciales de cada tipo que el equipo todavía no tenga (aunque luego las vacíen, no se repite). */
export async function ensureOptions(teamId: number) {
  const rows = (await db().sql`
    SELECT DISTINCT kind FROM editorial_options WHERE team_id = ${teamId}
  `) as { kind: string }[];
  const seeded = await db().sql`SELECT COALESCE(editorial_seeded, '') AS s FROM teams WHERE id = ${teamId}`;
  const done = new Set([...rows.map((r) => r.kind), ...String((seeded[0] as { s: string } | undefined)?.s ?? "").split(",").filter(Boolean)]);
  const missing = KINDS.filter((k) => !done.has(k));
  if (missing.length === 0) return;
  await db().sql`UPDATE teams SET editorial_seeded = ${KINDS.join(",")} WHERE id = ${teamId}`;
  const items = missing.flatMap((kind) =>
    DEFAULT_OPTIONS[kind].map((o, i) => ({ kind, value: o.value, hint: o.hint ?? "", sort_order: i }))
  );
  await db().query(
    `INSERT INTO editorial_options (team_id, kind, value, hint, sort_order)
     SELECT $1, x.kind, x.value, x.hint, x.sort_order FROM json_populate_recordset(NULL::editorial_options, $2::json) AS x
     ON CONFLICT (team_id, kind, value) DO NOTHING`,
    [teamId, JSON.stringify(items)]
  );
}

export async function listOptions(teamId: number): Promise<EditorialOptions> {
  await ensureOptions(teamId);
  const rows = (await db().sql`
    SELECT id, kind, value, hint, sort_order FROM editorial_options
    WHERE team_id = ${teamId} ORDER BY sort_order ASC, id ASC
  `) as EditorialOption[];
  const out = Object.fromEntries(KINDS.map((k) => [k, [] as EditorialOption[]])) as EditorialOptions;
  for (const r of rows) if (isOptionKind(r.kind)) out[r.kind].push(r);
  return out;
}

export async function addOption(teamId: number, kind: OptionKind, value: string, hint = "") {
  await db().sql`
    INSERT INTO editorial_options (team_id, kind, value, hint, sort_order)
    VALUES (${teamId}, ${kind}, ${value}, ${hint},
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM editorial_options WHERE team_id = ${teamId} AND kind = ${kind}))
    ON CONFLICT (team_id, kind, value) DO UPDATE SET hint = EXCLUDED.hint
  `;
}

export async function deleteOption(teamId: number, id: number) {
  await db().sql`DELETE FROM editorial_options WHERE id = ${id} AND team_id = ${teamId}`;
}

// ---------------- Piezas del calendario ----------------

export type PieceInput = Omit<EditorialPiece, "id" | "team_id">;

export async function listPieces(teamId: number, from: string, to: string): Promise<EditorialPiece[]> {
  const rows = await db().sql`
    SELECT * FROM editorial_pieces
    WHERE team_id = ${teamId} AND week_start BETWEEN ${from} AND ${to}
    ORDER BY week_start ASC, is_buffer ASC, pub_date ASC NULLS LAST, id ASC
  `;
  return rows as EditorialPiece[];
}

/** Banco de ideas: piezas sin semana asignada (p. ej. Banco Hygiene). */
export async function listBank(teamId: number): Promise<EditorialPiece[]> {
  const rows = await db().sql`
    SELECT * FROM editorial_pieces WHERE team_id = ${teamId} AND week_start IS NULL ORDER BY id ASC
  `;
  return rows as EditorialPiece[];
}

/** Primera y última semana con piezas (para navegar el calendario). */
export async function pieceWeekRange(teamId: number): Promise<{ min: string | null; max: string | null }> {
  const rows = await db().sql`
    SELECT MIN(week_start) AS min, MAX(week_start) AS max FROM editorial_pieces WHERE team_id = ${teamId}
  `;
  return rows[0] as { min: string | null; max: string | null };
}

export async function getPiece(teamId: number, id: number): Promise<EditorialPiece | null> {
  const rows = await db().sql`SELECT * FROM editorial_pieces WHERE id = ${id} AND team_id = ${teamId}`;
  return (rows[0] as EditorialPiece) ?? null;
}

export async function createPiece(teamId: number, p: PieceInput): Promise<EditorialPiece> {
  const rows = await db().sql`
    INSERT INTO editorial_pieces (team_id, week_start, pub_date, title, pilar, capa, assignee_id, frente, audiencia, facultad, carrera, cta, status, note, link, is_buffer)
    VALUES (${teamId}, ${p.week_start}, ${p.pub_date}, ${p.title}, ${p.pilar}, ${p.capa}, ${p.assignee_id}, ${p.frente},
      ${p.audiencia}, ${p.facultad}, ${p.carrera}, ${p.cta}, ${p.status}, ${p.note}, ${p.link}, ${p.is_buffer})
    RETURNING *
  `;
  return rows[0] as EditorialPiece;
}

export async function updatePiece(teamId: number, id: number, p: PieceInput) {
  await db().sql`
    UPDATE editorial_pieces SET
      week_start = ${p.week_start}, pub_date = ${p.pub_date}, title = ${p.title}, pilar = ${p.pilar}, capa = ${p.capa},
      assignee_id = ${p.assignee_id}, frente = ${p.frente}, audiencia = ${p.audiencia}, facultad = ${p.facultad},
      cta = ${p.cta}, carrera = ${p.carrera}, link = ${p.link}, status = ${p.status}, note = ${p.note}, is_buffer = ${p.is_buffer}, updated_at = NOW()
    WHERE id = ${id} AND team_id = ${teamId}
  `;
}

export async function setPieceStatus(teamId: number, id: number, status: string) {
  await db().sql`
    UPDATE editorial_pieces SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND team_id = ${teamId}
  `;
}

export async function deletePiece(teamId: number, id: number) {
  await db().sql`DELETE FROM editorial_pieces WHERE id = ${id} AND team_id = ${teamId}`;
}

// ---------------- Fechas clave ----------------

export async function listKeyDates(teamId: number, from: string, to: string): Promise<EditorialDate[]> {
  const rows = await db().sql`
    SELECT id, date, title, facultad, carrera, pilar, capa, angle, priority, note FROM editorial_dates
    WHERE team_id = ${teamId} AND date BETWEEN ${from} AND ${to} ORDER BY date ASC, id ASC
  `;
  return rows as EditorialDate[];
}

export async function createKeyDate(teamId: number, d: Omit<EditorialDate, "id">) {
  await db().sql`
    INSERT INTO editorial_dates (team_id, date, title, facultad, carrera, pilar, capa, angle, priority, note)
    VALUES (${teamId}, ${d.date}, ${d.title}, ${d.facultad}, ${d.carrera}, ${d.pilar}, ${d.capa}, ${d.angle}, ${d.priority}, ${d.note})
  `;
}

export async function deleteKeyDate(teamId: number, id: number) {
  await db().sql`DELETE FROM editorial_dates WHERE id = ${id} AND team_id = ${teamId}`;
}

// ---------------- Coberturas ----------------

export type CoverageInput = Omit<Coverage, "id" | "team_id">;

export async function listCoverages(teamId: number, from: string | null, to: string | null): Promise<Coverage[]> {
  const rows = await db().sql`
    SELECT * FROM coverages
    WHERE team_id = ${teamId}
      AND (${from}::date IS NULL OR date >= ${from}::date)
      AND (${to}::date IS NULL OR date <= ${to}::date)
    ORDER BY date DESC NULLS FIRST, start_time DESC, id DESC
  `;
  return rows as Coverage[];
}

/** Saldo histórico de horas por persona (todas las fechas). */
export async function coverageBalances(teamId: number) {
  const rows = await db().sql`
    SELECT assignee_id,
      COUNT(*) FILTER (WHERE status = 'Realizada')::int AS done,
      COALESCE(SUM(overtime_hours), 0) AS overtime,
      COALESCE(SUM(replaced_hours), 0) AS replaced
    FROM coverages WHERE team_id = ${teamId}
    GROUP BY assignee_id
  `;
  return rows as { assignee_id: number | null; done: number; overtime: number; replaced: number }[];
}

export async function getCoverage(teamId: number, id: number): Promise<Coverage | null> {
  const rows = await db().sql`SELECT * FROM coverages WHERE id = ${id} AND team_id = ${teamId}`;
  return (rows[0] as Coverage) ?? null;
}

export async function createCoverage(teamId: number, c: CoverageInput) {
  await db().sql`
    INSERT INTO coverages (team_id, date, title, facultad, start_time, end_time, assignee_id, tipo, status, paquete,
      est_hours, real_hours, overtime_hours, replaced_hours, notes)
    VALUES (${teamId}, ${c.date}, ${c.title}, ${c.facultad}, ${c.start_time}, ${c.end_time}, ${c.assignee_id}, ${c.tipo},
      ${c.status}, ${c.paquete}, ${c.est_hours}, ${c.real_hours}, ${c.overtime_hours}, ${c.replaced_hours}, ${c.notes})
  `;
}

export async function updateCoverage(teamId: number, id: number, c: CoverageInput) {
  await db().sql`
    UPDATE coverages SET
      date = ${c.date}, title = ${c.title}, facultad = ${c.facultad}, start_time = ${c.start_time}, end_time = ${c.end_time},
      assignee_id = ${c.assignee_id}, tipo = ${c.tipo}, status = ${c.status}, paquete = ${c.paquete}, est_hours = ${c.est_hours},
      real_hours = ${c.real_hours}, overtime_hours = ${c.overtime_hours}, replaced_hours = ${c.replaced_hours}, notes = ${c.notes}
    WHERE id = ${id} AND team_id = ${teamId}
  `;
}

export async function deleteCoverage(teamId: number, id: number) {
  await db().sql`DELETE FROM coverages WHERE id = ${id} AND team_id = ${teamId}`;
}
