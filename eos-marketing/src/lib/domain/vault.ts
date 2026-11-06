import "server-only";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/auth/access";
import { orgAnchorTeam, orgTeamIds } from "./teams";
import {
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

export type Vault = { id: number; team_id: number; name: string };

/** Vault de la organización del equipo (se crea con sus plantillas la primera vez). */
export async function getVault(teamId: number): Promise<Vault> {
  const anchor = await orgAnchorTeam(teamId);
  const found = (await db().sql`SELECT id, team_id, name FROM vaults WHERE team_id = ${anchor}`) as Vault[];
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
    COALESCE((SELECT array_agg(DISTINCT l.target) FROM vault_links l WHERE l.from_note_id = n.id AND l.kind = 'note'), '{}') AS links
  FROM vault_notes n
  LEFT JOIN users uu ON uu.id = n.updated_by`;

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.replace(/^\{|\}$/g, "").split(",").filter(Boolean).map((s) => s.replace(/^"|"$/g, ""));
  return [];
}

function toSummary(r: Record<string, unknown>): NoteSummary {
  return {
    id: Number(r.id),
    path: String(r.path),
    title: String(r.title),
    tags: arr(r.tags),
    updated_at: String(r.updated_at),
    updated_by_name: (r.updated_by_name as string) ?? null,
    links: arr(r.links),
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
    frontmatter: (typeof r.frontmatter === "string" ? JSON.parse(r.frontmatter) : r.frontmatter) ?? {},
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

async function writeLinks(vaultId: number, noteId: number, content: string, entities: EosEntity[]) {
  await db().sql`DELETE FROM vault_links WHERE from_note_id = ${noteId}`;
  const seen = new Set<string>();
  for (const l of extractWikilinks(content)) {
    const target = l.kind === "note" ? normalizeKey(l.target) : `${l.kind}:${normalizeKey(l.ref)}`;
    if (seen.has(target)) continue;
    seen.add(target);
    const entity = l.kind === "note" ? null : resolveEntity(entities, l.kind, l.ref);
    await db().sql`
      INSERT INTO vault_links (from_note_id, vault_id, kind, target, entity_id)
      VALUES (${noteId}, ${vaultId}, ${l.kind}, ${target}, ${entity?.id ?? null})
    `;
  }
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
  await writeLinks(input.vaultId, id, input.content, await listEosEntities(input.teamId));
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
  const entities = await listEosEntities(input.teamId);
  await writeLinks(input.vaultId, input.id, input.content, entities);
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
        await db().sql`
          UPDATE vault_notes SET content = ${next}, version = version + 1, updated_at = NOW(), updated_by = ${input.userId}
          WHERE id = ${n.id}
        `;
        await writeLinks(input.vaultId, Number(n.id), next, entities);
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
