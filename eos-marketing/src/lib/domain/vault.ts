import "server-only";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/auth/access";
import { orgAnchorTeam, orgTeamIds } from "./teams";
import { createHash } from "node:crypto";
import { asJson, asNumbers, asStrings } from "@/lib/db-values";
import {
  EMBED_DIM,
  EMBED_MODEL,
  chunkNote,
  foldText,
  searchTerms,
  snippetAround,
  type MeaningHit,
  type TextHit,
  DEFAULT_TEMPLATES,
  TEMPLATE_FOLDER,
  extractTags,
  extractWikilinks,
  noteKeys,
  normalizeKey,
  parseFrontmatter,
  pathFor,
  renameLinks,
  slugify,
  type EosEntity,
  type EosKind,
  type Note,
  type NoteSummary,
} from "./vault-shared";

// Conocimiento (Vault): un vault por organización, guardado en el equipo ancla.

export type Vault = { id: number; team_id: number; name: string; claude_consultant_url?: string | null };

/** Vault de la organización del equipo (se crea con sus plantillas la primera vez). */
export async function getVault(teamId: number): Promise<Vault> {
  const anchor = await orgAnchorTeam(teamId);
  const found = (await db().sql`SELECT id, team_id, name, claude_consultant_url FROM vaults WHERE team_id = ${anchor}`) as Vault[];
  if (found[0]) return found[0];
  const created = (await db().sql`
    INSERT INTO vaults (team_id) VALUES (${anchor})
    ON CONFLICT (team_id) DO UPDATE SET name = vaults.name
    RETURNING id, team_id, name
  `) as Vault[];
  const vault = created[0];
  for (const t of DEFAULT_TEMPLATES) {
    await db().sql`
      INSERT INTO vault_notes (vault_id, path, title, content, tags)
      VALUES (${vault.id}, ${pathFor(TEMPLATE_FOLDER, t.title)}, ${t.title}, ${t.content}, ${extractTags(t.content)}::text[])
      ON CONFLICT (vault_id, path) DO NOTHING
    `;
  }
  return vault;
}

const SUMMARY = `
  SELECT n.id, n.path, n.title, n.tags, n.updated_at, uu.name AS updated_by_name,
    COALESCE((SELECT array_agg(DISTINCT COALESCE(l.label, l.target)) FROM vault_links l WHERE l.from_note_id = n.id AND l.kind = 'note'), '{}') AS links,
    COALESCE((SELECT array_agg(DISTINCT l.kind || ':' || l.entity_id) FROM vault_links l
      WHERE l.from_note_id = n.id AND l.kind <> 'note' AND l.entity_id IS NOT NULL), '{}') AS eos
  FROM vault_notes n
  LEFT JOIN users uu ON uu.id = n.updated_by`;

const arr = asStrings;

function toSummary(r: Record<string, unknown>): NoteSummary {
  return {
    id: Number(r.id),
    path: String(r.path),
    title: String(r.title),
    tags: arr(r.tags),
    updated_at: String(r.updated_at),
    updated_by_name: (r.updated_by_name as string) ?? null,
    links: arr(r.links),
    eos: arr(r.eos),
  };
}

export async function listNotes(vaultId: number): Promise<NoteSummary[]> {
  const rows = (await db().query(`${SUMMARY} WHERE n.vault_id = $1 ORDER BY n.path`, [vaultId])) as Record<string, unknown>[];
  return rows.map(toSummary);
}

export async function getNote(vaultId: number, id: number): Promise<Note | null> {
  const rows = (await db().query(
    `SELECT s.*, n.content, n.frontmatter, n.version, n.created_at, cu.name AS created_by_name
     FROM (${SUMMARY} WHERE n.vault_id = $1 AND n.id = $2) s
     JOIN vault_notes n ON n.id = s.id
     LEFT JOIN users cu ON cu.id = n.created_by`,
    [vaultId, id],
  )) as Record<string, unknown>[];
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    content: String(r.content ?? ""),
    frontmatter: asJson<Record<string, unknown>>(r.frontmatter, {}),
    version: Number(r.version),
    created_at: String(r.created_at),
    created_by_name: (r.created_by_name as string) ?? null,
  };
}

/** Notas que enlazan a esta (por título, ruta o nombre de archivo). */
export async function backlinks(vaultId: number, note: { id: number; title: string; path: string }): Promise<NoteSummary[]> {
  const keys = noteKeys(note);
  const rows = (await db().query(
    `${SUMMARY} WHERE n.vault_id = $1 AND n.id <> $2 AND EXISTS (
       SELECT 1 FROM vault_links l WHERE l.from_note_id = n.id AND l.kind = 'note' AND l.target = ANY($3::text[])
     ) ORDER BY n.title`,
    [vaultId, note.id, keys],
  )) as Record<string, unknown>[];
  return rows.map(toSummary);
}

// --- Entidades EOS (rocks, issues e indicadores de toda la organización) -------------

export async function listEosEntities(teamId: number): Promise<EosEntity[]> {
  const teams = await orgTeamIds(teamId);
  const rows = (await db().sql`
    SELECT 'rock' AS kind, r.id, r.title, t.name AS team FROM rocks r JOIN teams t ON t.id = r.team_id
      WHERE r.team_id = ANY(${teams}::int[]) AND r.year >= EXTRACT(YEAR FROM NOW())::int - 1
    UNION ALL
    SELECT 'issue', i.id, i.title, t.name FROM issues i JOIN teams t ON t.id = i.team_id
      WHERE i.team_id = ANY(${teams}::int[]) AND (i.status = 'open' OR i.solved_at > NOW() - INTERVAL '180 days')
    UNION ALL
    SELECT 'kpi', m.id, m.name, t.name FROM scorecard_metrics m JOIN teams t ON t.id = m.team_id
      WHERE m.team_id = ANY(${teams}::int[]) AND NOT m.archived
  `) as { kind: EosKind; id: number; title: string; team: string }[];
  const href: Record<EosKind, string> = { rock: "/rocks", issue: "/issues", kpi: "/scorecard" };
  return rows.map((r) => ({ ...r, id: Number(r.id), href: href[r.kind] }));
}

/** [[rock:12]] o [[rock:Nombre del rock]] → id de la entidad, si existe en la organización. */
export function resolveEntity(entities: EosEntity[], kind: EosKind, ref: string): EosEntity | null {
  const id = /^#?(\d+)$/.exec(ref.trim());
  if (id) return entities.find((e) => e.kind === kind && e.id === Number(id[1])) ?? null;
  const key = normalizeKey(ref);
  return entities.find((e) => e.kind === kind && normalizeKey(e.title) === key) ?? null;
}

/** Notas del vault que mencionan cada entidad (para "Notas relacionadas" en Rocks, Issues y Scorecard). */
export async function notesForEntities(teamId: number, kind: EosKind, ids: number[]): Promise<Record<number, { id: number; title: string }[]>> {
  if (ids.length === 0) return {};
  const vault = await getVault(teamId);
  const rows = (await db().sql`
    SELECT DISTINCT l.entity_id, n.id, n.title FROM vault_links l JOIN vault_notes n ON n.id = l.from_note_id
    WHERE l.vault_id = ${vault.id} AND l.kind = ${kind} AND l.entity_id = ANY(${ids}::int[])
    ORDER BY n.title
  `) as { entity_id: number; id: number; title: string }[];
  const out: Record<number, { id: number; title: string }[]> = {};
  for (const r of rows) (out[Number(r.entity_id)] ??= []).push({ id: Number(r.id), title: r.title });
  return out;
}

/** Igual que notesForEntities, pero solo si la persona tiene acceso a Conocimiento (si no, vacío). */
export async function relatedNotesFor(kind: EosKind, ids: number[]): Promise<Record<number, { id: number; title: string }[]>> {
  const access = await getAccess();
  if (!access || access.level("conocimiento") === "none" || ids.length === 0) return {};
  return notesForEntities(access.session.teamId, kind, ids).catch(() => ({}));
}

// --- Escritura ------------------------------------------------------------------------

type Statement = { text: string; params?: unknown[] };

/** Sentencias para reemplazar los enlaces salientes de una nota (van juntas en un lote atómico). */
function linkStatements(vaultId: number, noteId: number, content: string, entities: EosEntity[]): Statement[] {
  const seen = new Set<string>();
  const kinds: string[] = [];
  const targets: string[] = [];
  const labels: string[] = [];
  const entityIds: (number | null)[] = [];
  for (const l of extractWikilinks(content)) {
    const target = l.kind === "note" ? normalizeKey(l.target) : `${l.kind}:${normalizeKey(l.ref)}`;
    if (seen.has(target)) continue;
    seen.add(target);
    kinds.push(l.kind);
    targets.push(target);
    labels.push(l.target);
    entityIds.push(l.kind === "note" ? null : (resolveEntity(entities, l.kind, l.ref)?.id ?? null));
  }
  const out: Statement[] = [{ text: "DELETE FROM vault_links WHERE from_note_id = $1", params: [noteId] }];
  if (targets.length) {
    out.push({
      text: `INSERT INTO vault_links (from_note_id, vault_id, kind, target, label, entity_id)
             SELECT $1, $2, k, t, l, e FROM unnest($3::text[], $4::text[], $5::text[], $6::int[]) AS x(k, t, l, e)`,
      params: [noteId, vaultId, kinds, targets, labels, entityIds],
    });
  }
  return out;
}

/** Entidades EOS para resolver [[rock:…]], etc.; solo se cargan si la nota las enlaza. */
async function entitiesFor(teamId: number, ...contents: string[]): Promise<EosEntity[]> {
  const needs = contents.some((c) => extractWikilinks(c).some((l) => l.kind !== "note"));
  return needs ? listEosEntities(teamId) : [];
}

async function writeLinks(vaultId: number, noteId: number, content: string, entities: EosEntity[]) {
  await db().batch(linkStatements(vaultId, noteId, content, entities));
}

/** Ruta libre: "carpeta/titulo.md", "carpeta/titulo-2.md"… */
async function freePath(vaultId: number, folder: string, title: string, exceptId: number | null = null): Promise<string> {
  const base = pathFor(folder, title).replace(/\.md$/, "");
  for (let i = 1; i < 200; i++) {
    const path = i === 1 ? `${base}.md` : `${base}-${i}.md`;
    const taken = await db().sql`SELECT 1 FROM vault_notes WHERE vault_id = ${vaultId} AND path = ${path} AND id <> ${exceptId ?? 0}`;
    if (taken.length === 0) return path;
  }
  return `${base}-${Date.now()}.md`;
}

export async function createNote(input: { vaultId: number; teamId: number; folder: string; title: string; content: string; userId: number }): Promise<number> {
  const path = await freePath(input.vaultId, input.folder, input.title);
  const { data } = parseFrontmatter(input.content);
  const rows = (await db().sql`
    INSERT INTO vault_notes (vault_id, path, title, content, frontmatter, tags, created_by, updated_by)
    VALUES (${input.vaultId}, ${path}, ${input.title}, ${input.content}, ${JSON.stringify(data)}::jsonb,
      ${extractTags(input.content)}::text[], ${input.userId}, ${input.userId})
    RETURNING id
  `) as { id: number }[];
  const id = Number(rows[0].id);
  await writeLinks(input.vaultId, id, input.content, await entitiesFor(input.teamId, input.content));
  await indexText(id);
  await snapshot(id, input.userId, true);
  return id;
}

/** Guarda una versión en el historial: una por sesión de edición (10 min) o al cambiar de autor. */
async function snapshot(noteId: number, userId: number, force = false) {
  const last = (await db().sql`
    SELECT id, updated_by, updated_at > NOW() - INTERVAL '10 minutes' AS recent FROM vault_note_versions
    WHERE note_id = ${noteId} ORDER BY id DESC LIMIT 1
  `) as { id: number; updated_by: number | null; recent: boolean }[];
  if (!force && last[0] && last[0].recent && last[0].updated_by === userId) {
    await db().sql`
      UPDATE vault_note_versions v SET title = n.title, path = n.path, content = n.content, version = n.version, updated_at = NOW()
      FROM vault_notes n WHERE v.id = ${last[0].id} AND n.id = ${noteId}
    `;
    return;
  }
  await db().sql`
    INSERT INTO vault_note_versions (note_id, version, title, path, content, updated_by)
    SELECT id, version, title, path, content, ${userId} FROM vault_notes WHERE id = ${noteId}
  `;
}

export type SaveResult =
  | { ok: true; version: number; path: string; renamed: number }
  | { ok: false; conflict: true; server: { version: number; content: string; title: string; updated_by_name: string | null } }
  | { ok: false; conflict: false; message: string };

/**
 * Guarda una nota si nadie la cambió desde `baseVersion`. Si cambió el título o la carpeta,
 * actualiza la ruta y los [[enlaces]] que apuntaban a ella en las demás notas.
 */
export async function saveNote(input: {
  vaultId: number;
  teamId: number;
  id: number;
  title: string;
  folder: string;
  content: string;
  baseVersion: number;
  userId: number;
  force?: boolean;
}): Promise<SaveResult> {
  const before = await getNote(input.vaultId, input.id);
  if (!before) return { ok: false, conflict: false, message: "La nota ya no existe." };
  if (!input.force && before.version !== input.baseVersion) {
    return { ok: false, conflict: true, server: { version: before.version, content: before.content, title: before.title, updated_by_name: before.updated_by_name } };
  }
  const titleChanged = before.title !== input.title;
  const folderNow = before.path.includes("/") ? before.path.slice(0, before.path.lastIndexOf("/")) : "";
  const moved = titleChanged || folderNow !== input.folder;
  const path = moved ? await freePath(input.vaultId, input.folder, input.title, input.id) : before.path;
  const { data } = parseFrontmatter(input.content);
  const rows = (await db().sql`
    UPDATE vault_notes SET title = ${input.title}, path = ${path}, content = ${input.content},
      frontmatter = ${JSON.stringify(data)}::jsonb, tags = ${extractTags(input.content)}::text[],
      updated_by = ${input.userId}, updated_at = NOW(), version = version + 1
    WHERE id = ${input.id} AND vault_id = ${input.vaultId} AND (${input.force ?? false} OR version = ${before.version})
    RETURNING version
  `) as { version: number }[];
  if (!rows[0]) {
    const now = await getNote(input.vaultId, input.id);
    return now
      ? { ok: false, conflict: true, server: { version: now.version, content: now.content, title: now.title, updated_by_name: now.updated_by_name } }
      : { ok: false, conflict: false, message: "La nota ya no existe." };
  }
  let entities = await entitiesFor(input.teamId, input.content);
  await writeLinks(input.vaultId, input.id, input.content, entities);
  await indexText(input.id);
  await snapshot(input.id, input.userId);

  // Renombrar: actualizar los enlaces de las notas que apuntaban al título o ruta anterior.
  let renamed = 0;
  if (moved) {
    const oldKeys = noteKeys(before);
    const newKeys = new Set(noteKeys({ title: input.title, path }));
    const stale = oldKeys.filter((k) => !newKeys.has(k));
    if (stale.length) {
      const linking = (await db().query(
        `SELECT DISTINCT n.id, n.content FROM vault_notes n JOIN vault_links l ON l.from_note_id = n.id
         WHERE n.vault_id = $1 AND n.id <> $2 AND l.kind = 'note' AND l.target = ANY($3::text[])`,
        [input.vaultId, input.id, stale],
      )) as { id: number; content: string }[];
      for (const n of linking) {
        const next = renameLinks(n.content, stale, input.title);
        if (next === n.content) continue;
        if (!entities.length) entities = await entitiesFor(input.teamId, next);
        // Contenido y enlaces de la otra nota en un solo lote: o cambian ambos o ninguno.
        await db().batch([
          {
            text: "UPDATE vault_notes SET content = $1, version = version + 1, updated_at = NOW(), updated_by = $2 WHERE id = $3 AND vault_id = $4",
            params: [next, input.userId, n.id, input.vaultId],
          },
          ...linkStatements(input.vaultId, Number(n.id), next, entities),
        ]);
        await indexText(Number(n.id));
        renamed++;
      }
    }
  }
  return { ok: true, version: Number(rows[0].version), path, renamed };
}

export async function deleteNote(vaultId: number, id: number) {
  await db().sql`DELETE FROM vault_notes WHERE id = ${id} AND vault_id = ${vaultId}`;
}

export type NoteVersion = { id: number; version: number; title: string; updated_at: string; updated_by_name: string | null; size: number };

export async function listVersions(vaultId: number, noteId: number): Promise<NoteVersion[]> {
  const rows = (await db().sql`
    SELECT v.id, v.version, v.title, v.updated_at, u.name AS updated_by_name, length(v.content) AS size
    FROM vault_note_versions v JOIN vault_notes n ON n.id = v.note_id LEFT JOIN users u ON u.id = v.updated_by
    WHERE v.note_id = ${noteId} AND n.vault_id = ${vaultId}
    ORDER BY v.id DESC LIMIT 50
  `) as NoteVersion[];
  return rows.map((r) => ({ ...r, id: Number(r.id), version: Number(r.version), size: Number(r.size) }));
}

export async function getVersionContent(vaultId: number, noteId: number, versionId: number): Promise<string | null> {
  const rows = (await db().sql`
    SELECT v.content FROM vault_note_versions v JOIN vault_notes n ON n.id = v.note_id
    WHERE v.id = ${versionId} AND v.note_id = ${noteId} AND n.vault_id = ${vaultId}
  `) as { content: string }[];
  return rows[0]?.content ?? null;
}

/** Busca una nota por título o ruta (para abrir [[enlaces]]). */
export async function findNoteByKey(vaultId: number, key: string): Promise<number | null> {
  const k = normalizeKey(key);
  for (const n of await listNotes(vaultId)) if (noteKeys(n).includes(k)) return n.id;
  return null;
}

export { slugify };

// --- Búsqueda de texto completo --------------------------------------------------------

/** Actualiza el texto plegado (sin acentos) que usa el índice de búsqueda. */
export async function indexText(noteId: number) {
  const rows = (await db().sql`SELECT title, path, tags, content FROM vault_notes WHERE id = ${noteId}`) as { title: string; path: string; tags: unknown; content: string }[];
  const n = rows[0];
  if (!n) return;
  const tags = (Array.isArray(n.tags) ? n.tags : String(n.tags ?? "").replace(/[{}"]/g, "").split(",")).join(" ");
  await db().sql`
    UPDATE vault_notes SET search_title = ${foldText(`${n.title} ${n.path.replace(/[/.-]/g, " ")}`)},
      search_tags = ${foldText(tags)}, search_body = ${foldText(n.content)}
    WHERE id = ${noteId}
  `;
}

/** Notas sin texto indexado (creadas antes de la búsqueda): se indexan la primera vez. */
async function ensureSearchIndex(vaultId: number) {
  const missing = (await db().sql`SELECT id FROM vault_notes WHERE vault_id = ${vaultId} AND search_title IS NULL LIMIT 500`) as { id: number }[];
  for (const m of missing) await indexText(Number(m.id));
}

/** Búsqueda por palabras (sin acentos, por prefijo); si no hay resultados con todas, con cualquiera. */
export async function textSearch(vaultId: number, q: string, limit = 20): Promise<TextHit[]> {
  const terms = searchTerms(q);
  if (terms.length === 0) return [];
  await ensureSearchIndex(vaultId);
  const run = async (op: "&" | "|") => {
    const tsq = terms.map((t) => `${t}:*`).join(` ${op} `);
    return (await db().sql`
      SELECT id, title, path, content, search_body, ts_rank(search_vec, to_tsquery('simple', ${tsq})) AS rank
      FROM vault_notes
      WHERE vault_id = ${vaultId} AND search_vec @@ to_tsquery('simple', ${tsq})
      ORDER BY rank DESC, updated_at DESC
      LIMIT ${limit}
    `) as { id: number; title: string; path: string; content: string; search_body: string | null; rank: number }[];
  };
  let rows = await run("&");
  if (rows.length === 0 && terms.length > 1) rows = await run("|");
  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    path: r.path,
    rank: Number(r.rank),
    snippet: snippetAround(r.content, r.search_body ?? foldText(r.content), terms),
  }));
}

// --- Búsqueda por significado (vectores calculados en el navegador) ----------------------

const hashChunk = (text: string) => createHash("sha1").update(`${EMBED_MODEL}\n${text}`).digest("hex");

export type ChunkPlan = { version: number; chunks: { index: number; text: string; hash: string; need: boolean }[] };

/** Fragmentos de la nota y cuáles necesitan vector (los que cambiaron). */
export async function chunkPlan(vaultId: number, noteId: number): Promise<ChunkPlan | null> {
  const rows = (await db().sql`SELECT title, content, version FROM vault_notes WHERE id = ${noteId} AND vault_id = ${vaultId}`) as {
    title: string;
    content: string;
    version: number;
  }[];
  const n = rows[0];
  if (!n) return null;
  const have = (await db().sql`SELECT chunk_index, content_hash FROM vault_chunks WHERE note_id = ${noteId}`) as { chunk_index: number; content_hash: string }[];
  const byIndex = new Map(have.map((h) => [Number(h.chunk_index), h.content_hash]));
  return {
    version: Number(n.version),
    chunks: chunkNote(n.title, n.content).map((text, index) => {
      const hash = hashChunk(text);
      return { index, text, hash, need: byIndex.get(index) !== hash };
    }),
  };
}

function normalize(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / len);
}

/**
 * Guarda los vectores de los fragmentos que cambiaron y el vector promedio de la nota. Si la nota cambió
 * mientras tanto (otra versión), no se guarda nada: se volverá a indexar.
 */
export async function storeChunks(vaultId: number, noteId: number, version: number, items: { index: number; embedding: number[] }[]): Promise<boolean> {
  const plan = await chunkPlan(vaultId, noteId);
  if (!plan || plan.version !== version) return false;
  // Todos los fragmentos en un solo lote (una ida a la base, todo o nada).
  const statements: Statement[] = [];
  for (const it of items) {
    const c = plan.chunks[it.index];
    if (!c || it.embedding.length !== EMBED_DIM || !it.embedding.every(Number.isFinite)) continue;
    statements.push({
      text: `INSERT INTO vault_chunks (note_id, vault_id, chunk_index, text, content_hash, embedding)
             VALUES ($1, $2, $3, $4, $5, $6::real[])
             ON CONFLICT (note_id, chunk_index) DO UPDATE SET text = EXCLUDED.text, content_hash = EXCLUDED.content_hash,
               embedding = EXCLUDED.embedding, updated_at = NOW()`,
      params: [noteId, vaultId, c.index, c.text, c.hash, it.embedding],
    });
  }
  statements.push({ text: "DELETE FROM vault_chunks WHERE note_id = $1 AND chunk_index >= $2", params: [noteId, plan.chunks.length] });
  await db().batch(statements);
  const all = (await db().sql`SELECT content_hash, embedding FROM vault_chunks WHERE note_id = ${noteId}`) as { content_hash: string; embedding: unknown }[];
  const valid = all.filter((r) => plan.chunks.some((c) => c.hash === r.content_hash));
  if (valid.length < plan.chunks.length) return false; // faltan fragmentos
  const vecs = valid.map((r) => asNumbers(r.embedding));
  const mean = normalize(Array.from({ length: EMBED_DIM }, (_, i) => vecs.reduce((s, v) => s + (v[i] ?? 0), 0) / vecs.length));
  await db().sql`UPDATE vault_notes SET embedding = ${mean}::real[], embedded_version = ${version} WHERE id = ${noteId} AND version = ${version}`;
  return true;
}

/** Notas cuyo vector no corresponde a su versión actual (nuevas o editadas). */
export async function pendingEmbeds(vaultId: number): Promise<number[]> {
  const rows = (await db().sql`
    SELECT id FROM vault_notes WHERE vault_id = ${vaultId} AND (embedded_version IS NULL OR embedded_version <> version)
      AND path NOT LIKE ${`${TEMPLATE_FOLDER}/%`}
    ORDER BY updated_at DESC
  `) as { id: number }[];
  return rows.map((r) => Number(r.id));
}

export async function embedStats(vaultId: number): Promise<{ notes: number; indexed: number; chunks: number }> {
  const rows = (await db().sql`
    SELECT COUNT(*)::int AS notes, COUNT(*) FILTER (WHERE embedded_version = version)::int AS indexed,
      (SELECT COUNT(*)::int FROM vault_chunks WHERE vault_id = ${vaultId}) AS chunks
    FROM vault_notes WHERE vault_id = ${vaultId} AND path NOT LIKE ${`${TEMPLATE_FOLDER}/%`}
  `) as { notes: number; indexed: number; chunks: number }[];
  return rows[0] ?? { notes: 0, indexed: 0, chunks: 0 };
}

/** "Reindexar vault": borra todos los vectores para recalcularlos (p. ej. al cambiar de modelo). */
export async function resetEmbeddings(vaultId: number) {
  await db().sql`DELETE FROM vault_chunks WHERE vault_id = ${vaultId}`;
  await db().sql`UPDATE vault_notes SET embedding = NULL, embedded_version = NULL WHERE vault_id = ${vaultId}`;
}

function validVector(v: unknown): number[] | null {
  return Array.isArray(v) && v.length === EMBED_DIM && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v as number[]) : null;
}

/** Fragmentos más parecidos a la pregunta (similitud coseno; los vectores vienen normalizados). */
export async function meaningSearch(vaultId: number, query: unknown, limit = 15): Promise<MeaningHit[]> {
  const q = validVector(query);
  if (!q) return [];
  const rows = (await db().sql`
    SELECT c.note_id, c.text, n.title, n.path,
      (SELECT SUM(a * b) FROM unnest(c.embedding, ${q}::real[]) AS t(a, b)) AS score
    FROM vault_chunks c JOIN vault_notes n ON n.id = c.note_id
    WHERE c.vault_id = ${vaultId} AND n.path NOT LIKE ${`${TEMPLATE_FOLDER}/%`}
    ORDER BY score DESC
    LIMIT ${limit * 4}
  `) as { note_id: number; text: string; title: string; path: string; score: number }[];
  // e5 da similitudes altas a casi todo (~0,75–0,9): se dejan solo las cercanas a la mejor.
  const top = rows.length ? Number(rows[0].score) : 0;
  const best = new Map<number, MeaningHit>();
  for (const r of rows) {
    const id = Number(r.note_id);
    if (best.has(id) || Number(r.score) < Math.max(0.78, top - 0.06)) continue;
    const body = r.text.includes("\n") ? r.text.slice(r.text.indexOf("\n") + 1) : r.text;
    best.set(id, { id, title: r.title, path: r.path, score: Number(r.score), snippet: body.length > 220 ? `${body.slice(0, 220)}…` : body });
  }
  return [...best.values()].slice(0, limit);
}

/** Las notas más parecidas a esta (por el vector promedio de cada nota). */
export async function relatedByMeaning(vaultId: number, noteId: number, limit = 5): Promise<{ id: number; title: string; score: number }[]> {
  const rows = (await db().sql`
    SELECT n.id, n.title, (SELECT SUM(a * b) FROM unnest(n.embedding, me.embedding) AS t(a, b)) AS score
    FROM vault_notes n, (SELECT embedding FROM vault_notes WHERE id = ${noteId} AND vault_id = ${vaultId}) me
    WHERE n.vault_id = ${vaultId} AND n.id <> ${noteId} AND n.embedding IS NOT NULL AND me.embedding IS NOT NULL
      AND n.path NOT LIKE ${`${TEMPLATE_FOLDER}/%`}
    ORDER BY score DESC
    LIMIT ${limit}
  `) as { id: number; title: string; score: number }[];
  return rows.map((r) => ({ id: Number(r.id), title: r.title, score: Number(r.score) }));
}

/**
 * Relaciones por significado para el grafo: pares de notas con similitud >= umbral, como máximo
 * `perNote` por nota (las más fuertes). Se calcula en el servidor con los vectores promedio.
 */
export async function semanticEdges(vaultId: number, threshold = 0.8, perNote = 3): Promise<{ a: number; b: number; score: number }[]> {
  const rows = (await db().sql`
    SELECT id, embedding FROM vault_notes
    WHERE vault_id = ${vaultId} AND embedding IS NOT NULL AND path NOT LIKE ${`${TEMPLATE_FOLDER}/%`}
    LIMIT 3000
  `) as { id: number; embedding: unknown }[];
  const ids = rows.map((r) => Number(r.id));
  const vecs = rows.map((r) => Float32Array.from(asNumbers(r.embedding)));
  const best: { j: number; s: number }[][] = ids.map(() => []);
  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) {
      let s = 0;
      const a = vecs[i], b = vecs[j];
      for (let k = 0; k < a.length; k++) s += a[k] * b[k];
      if (s < threshold) continue;
      best[i].push({ j, s });
      best[j].push({ j: i, s });
    }
  }
  const out = new Map<string, { a: number; b: number; score: number }>();
  best.forEach((list, i) => {
    list.sort((x, y) => y.s - x.s);
    for (const { j, s } of list.slice(0, perNote)) {
      const [a, b] = i < j ? [ids[i], ids[j]] : [ids[j], ids[i]];
      out.set(`${a}-${b}`, { a, b, score: Math.round(s * 1000) / 1000 });
    }
  });
  return [...out.values()];
}
