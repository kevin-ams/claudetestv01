import "server-only";
import { db } from "@/lib/db";
import { QUOTES_CATALOG } from "./quotes-catalog";

export type Quote = {
  id: number;
  text: string;
  author: string;
  category: string;
  active: boolean;
};

/** Copia el banco inicial al equipo la primera vez. */
export async function ensureQuotes(teamId: number) {
  const rows = await db().sql`
    UPDATE teams SET quotes_seeded = TRUE WHERE id = ${teamId} AND quotes_seeded = FALSE RETURNING id
  `;
  if (rows.length) await insertCatalog(teamId);
}

async function insertCatalog(teamId: number) {
  await db().query(
    `INSERT INTO quotes (team_id, text, author, category)
     SELECT $1, x.text, x.author, x.category FROM json_populate_recordset(NULL::quotes, $2::json) AS x`,
    [teamId, JSON.stringify(QUOTES_CATALOG)]
  );
}

/** Vuelve a agregar las frases del banco inicial que no estén (sin duplicar). */
export async function restoreCatalog(teamId: number): Promise<number> {
  const existing = new Set(
    ((await db().sql`SELECT text FROM quotes WHERE team_id = ${teamId}`) as { text: string }[]).map((r) => r.text)
  );
  const missing = QUOTES_CATALOG.filter((q) => !existing.has(q.text));
  if (missing.length) {
    await db().query(
      `INSERT INTO quotes (team_id, text, author, category)
       SELECT $1, x.text, x.author, x.category FROM json_populate_recordset(NULL::quotes, $2::json) AS x`,
      [teamId, JSON.stringify(missing)]
    );
  }
  return missing.length;
}

export async function listQuotes(teamId: number): Promise<Quote[]> {
  await ensureQuotes(teamId);
  const rows = await db().sql`
    SELECT id, text, author, category, active FROM quotes WHERE team_id = ${teamId} ORDER BY id ASC
  `;
  return rows as Quote[];
}

export async function createQuote(teamId: number, input: { text: string; author: string; category: string }) {
  await db().sql`
    INSERT INTO quotes (team_id, text, author, category)
    VALUES (${teamId}, ${input.text}, ${input.author}, ${input.category})
  `;
}

export async function setQuoteActive(teamId: number, id: number, active: boolean) {
  await db().sql`UPDATE quotes SET active = ${active} WHERE id = ${id} AND team_id = ${teamId}`;
}

export async function deleteQuote(teamId: number, id: number) {
  const rows = await db().sql`DELETE FROM quotes WHERE id = ${id} AND team_id = ${teamId} RETURNING text`;
  return (rows[0] as { text: string } | undefined)?.text ?? null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Días transcurridos (en la zona del equipo) desde 1970-01-01. */
export function dayNumber(date = new Date()): number {
  const local = new Date(date.toLocaleString("en-US", { timeZone: process.env.EOS_TIMEZONE || "America/Guatemala" }));
  return Math.floor(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) / 86400000);
}

/**
 * Frase del día: recorre todas las frases activas sin repetir hasta agotarlas,
 * saltando de una a otra (paso coprimo) para que cambien de tema día a día.
 */
export async function quoteOfTheDay(teamId: number): Promise<Quote | null> {
  const quotes = (await listQuotes(teamId)).filter((q) => q.active);
  const n = quotes.length;
  if (n === 0) return null;
  let step = 37;
  while (n > 1 && gcd(step, n) !== 1) step++;
  return quotes[(dayNumber() * step) % n];
}
