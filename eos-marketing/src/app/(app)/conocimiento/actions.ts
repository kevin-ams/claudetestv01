"use server";

import { revalidatePath } from "next/cache";
import { getAccess, requireModule } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { createApiToken, listApiTokens, revokeApiToken, type ApiToken, type TokenScope } from "@/lib/domain/api-tokens";
import { logActivity } from "@/lib/domain/activity";
import {
  backlinks,
  createNote,
  deleteNote,
  findNoteByKey,
  getNote,
  getVault,
  getVersionContent,
  listNotes,
  listVersions,
  saveNote,
  chunkPlan,
  embedStats,
  meaningSearch,
  pendingEmbeds,
  relatedByMeaning,
  resetEmbeddings,
  storeChunks,
  textSearch,
  semanticEdges,
  type ChunkPlan,
  type NoteVersion,
  type SaveResult,
} from "@/lib/domain/vault";
import { applyTemplate, cleanFolder, type MeaningHit, type Note, type NoteSummary, type TextHit } from "@/lib/domain/vault-shared";

const MAX_CONTENT = 400_000;
const fail = (e: unknown, fallback: string) => {
  console.error("[conocimiento]", e);
  return e instanceof Error && e.name === "AccessDeniedError" ? e.message : fallback;
};

function cleanTitle(t: unknown): string {
  return String(t ?? "")
    .replace(/[[\]|#\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export type OpenNote = { note: Note; backlinks: NoteSummary[] };

export async function openNoteAction(id: number): Promise<OpenNote | null> {
  const session = await requireModule("conocimiento", "view");
  const vault = await getVault(session.teamId);
  const note = await getNote(vault.id, Number(id));
  if (!note) return null;
  return { note, backlinks: await backlinks(vault.id, note) };
}

export async function listNotesAction(): Promise<NoteSummary[]> {
  const session = await requireModule("conocimiento", "view");
  return listNotes((await getVault(session.teamId)).id);
}

export async function findNoteAction(key: string): Promise<number | null> {
  const session = await requireModule("conocimiento", "view");
  return findNoteByKey((await getVault(session.teamId)).id, String(key ?? ""));
}

export async function createNoteAction(input: {
  title: string;
  folder: string;
  templateId?: number | null;
  content?: string;
}): Promise<{ ok: boolean; message: string; id?: number }> {
  try {
    const session = await requireModule("conocimiento");
    const vault = await getVault(session.teamId);
    const title = cleanTitle(input.title);
    if (!title) return { ok: false, message: "Escribe un título." };
    let content = typeof input.content === "string" ? input.content.slice(0, MAX_CONTENT) : `# ${title}\n\n`;
    if (input.templateId) {
      const tpl = await getNote(vault.id, Number(input.templateId));
      if (tpl) content = applyTemplate(tpl.content, title, new Date().toISOString().slice(0, 10));
    }
    const id = await createNote({ vaultId: vault.id, teamId: session.teamId, folder: cleanFolder(String(input.folder ?? "")), title, content, userId: session.userId });
    await logActivity(session, "conocimiento", "Creó nota", title);
    revalidatePath("/conocimiento");
    return { ok: true, message: "Nota creada.", id };
  } catch (e) {
    return { ok: false, message: fail(e, "No se pudo crear la nota.") };
  }
}

export async function saveNoteAction(input: {
  id: number;
  title: string;
  folder: string;
  content: string;
  baseVersion: number;
  force?: boolean;
}): Promise<SaveResult> {
  try {
    const session = await requireModule("conocimiento");
    const vault = await getVault(session.teamId);
    const title = cleanTitle(input.title);
    if (!title) return { ok: false, conflict: false, message: "La nota necesita un título." };
    const content = String(input.content ?? "");
    if (content.length > MAX_CONTENT) return { ok: false, conflict: false, message: "La nota es demasiado larga (máx. ~400 mil caracteres)." };
    const r = await saveNote({
      vaultId: vault.id,
      teamId: session.teamId,
      id: Number(input.id),
      title,
      folder: cleanFolder(String(input.folder ?? "")),
      content,
      baseVersion: Number(input.baseVersion),
      userId: session.userId,
      force: Boolean(input.force),
    });
    if (r.ok && r.renamed) revalidatePath("/conocimiento");
    return r;
  } catch (e) {
    return { ok: false, conflict: false, message: fail(e, "No se pudo guardar la nota.") };
  }
}

export async function deleteNoteAction(id: number): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireModule("conocimiento");
    const vault = await getVault(session.teamId);
    const note = await getNote(vault.id, Number(id));
    if (!note) return { ok: false, message: "La nota ya no existe." };
    await deleteNote(vault.id, note.id);
    await logActivity(session, "conocimiento", "Eliminó nota", note.title);
    revalidatePath("/conocimiento");
    return { ok: true, message: "Nota eliminada." };
  } catch (e) {
    return { ok: false, message: fail(e, "No se pudo eliminar la nota.") };
  }
}

export async function listVersionsAction(noteId: number): Promise<NoteVersion[]> {
  const session = await requireModule("conocimiento", "view");
  return listVersions((await getVault(session.teamId)).id, Number(noteId));
}

export async function versionContentAction(noteId: number, versionId: number): Promise<string | null> {
  const session = await requireModule("conocimiento", "view");
  return getVersionContent((await getVault(session.teamId)).id, Number(noteId), Number(versionId));
}

// --- Búsqueda ----------------------------------------------------------------------------

export async function textSearchAction(q: string): Promise<TextHit[]> {
  const session = await requireModule("conocimiento", "view");
  return textSearch((await getVault(session.teamId)).id, String(q ?? "").slice(0, 200));
}

/** El vector de la pregunta se calcula en el navegador; aquí solo se compara con los del vault. */
export async function meaningSearchAction(vector: number[]): Promise<MeaningHit[]> {
  const session = await requireModule("conocimiento", "view");
  return meaningSearch((await getVault(session.teamId)).id, vector);
}

export async function relatedByMeaningAction(noteId: number): Promise<{ id: number; title: string; score: number }[]> {
  const session = await requireModule("conocimiento", "view");
  return relatedByMeaning((await getVault(session.teamId)).id, Number(noteId));
}

export async function indexStatusAction(): Promise<{ pending: number[]; notes: number; indexed: number; chunks: number }> {
  const session = await requireModule("conocimiento", "view");
  const vault = await getVault(session.teamId);
  const [pending, stats] = await Promise.all([pendingEmbeds(vault.id), embedStats(vault.id)]);
  return { pending, ...stats };
}

export async function chunkPlanAction(noteId: number): Promise<ChunkPlan | null> {
  const session = await requireModule("conocimiento");
  return chunkPlan((await getVault(session.teamId)).id, Number(noteId));
}

export async function storeChunksAction(noteId: number, version: number, items: { index: number; embedding: number[] }[]): Promise<boolean> {
  const session = await requireModule("conocimiento");
  if (!Array.isArray(items) || items.length > 200) return false;
  const clean = items.map((i) => ({ index: Number(i?.index), embedding: Array.isArray(i?.embedding) ? i.embedding.map(Number) : [] }));
  return storeChunks((await getVault(session.teamId)).id, Number(noteId), Number(version), clean);
}

export async function resetEmbeddingsAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireModule("conocimiento");
    await resetEmbeddings((await getVault(session.teamId)).id);
    await logActivity(session, "conocimiento", "Reindexó el vault", "Búsqueda por significado");
    return { ok: true, message: "Se recalcularán los vectores de todas las notas." };
  } catch (e) {
    return { ok: false, message: fail(e, "No se pudo reindexar.") };
  }
}

export async function semanticEdgesAction(threshold: number): Promise<{ a: number; b: number; score: number }[]> {
  const session = await requireModule("conocimiento", "view");
  const t = Math.min(0.99, Math.max(0.5, Number(threshold) || 0.8));
  return semanticEdges((await getVault(session.teamId)).id, t);
}

// --- Conectar con Claude (servidor MCP) --------------------------------------------------

export type ConnectInfo = {
  tokens: ApiToken[];
  base: string;
  consultantUrl: string | null;
  canWrite: boolean;
  isAdmin: boolean;
  userId: number;
};

export async function connectInfoAction(): Promise<ConnectInfo> {
  const session = await requireModule("conocimiento", "view");
  const [access, vault, base] = await Promise.all([getAccess(), getVault(session.teamId), appUrl()]);
  const rows = (await db().sql`SELECT claude_consultant_url FROM vaults WHERE id = ${vault.id}`) as { claude_consultant_url: string | null }[];
  return {
    tokens: await listApiTokens(session.teamId),
    base,
    consultantUrl: rows[0]?.claude_consultant_url ?? null,
    canWrite: access?.level("conocimiento") === "edit",
    isAdmin: Boolean(access?.isAdmin),
    userId: session.userId,
  };
}

export async function createTokenAction(input: { label: string; scope: TokenScope; canWrite: boolean }): Promise<{ ok: boolean; message: string; token?: string }> {
  try {
    const session = await requireModule("conocimiento", "view");
    const access = await getAccess();
    const label = String(input.label ?? "").trim().slice(0, 80) || "Claude";
    const canWrite = Boolean(input.canWrite) && access?.level("conocimiento") === "edit";
    const scope: TokenScope = input.scope === "eos" ? "eos" : "vault";
    const { token } = await createApiToken({ teamId: session.teamId, userId: session.userId, label, scope, canWrite });
    await logActivity(session, "conocimiento", "Creó token de Claude (MCP)", `${label} · ${scope === "eos" ? "EOS completo" : "solo vault"} · ${canWrite ? "lectura y escritura" : "solo lectura"}`);
    return { ok: true, message: "Token creado. Cópialo ahora: no se vuelve a mostrar.", token };
  } catch (e) {
    return { ok: false, message: fail(e, "No se pudo crear el token.") };
  }
}

export async function revokeTokenAction(id: number): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireModule("conocimiento", "view");
    const access = await getAccess();
    const done = await revokeApiToken(session.teamId, Number(id), session.userId, Boolean(access?.isAdmin));
    if (!done) return { ok: false, message: "No se pudo revocar (ya estaba revocado o no es tuyo)." };
    await logActivity(session, "conocimiento", "Revocó token de Claude (MCP)", `#${id}`);
    return { ok: true, message: "Token revocado: deja de funcionar de inmediato." };
  } catch (e) {
    return { ok: false, message: fail(e, "No se pudo revocar el token.") };
  }
}

export async function setConsultantUrlAction(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireModule("conocimiento");
    const value = String(url ?? "").trim();
    if (value && !/^https:\/\/[^\s]+$/i.test(value)) return { ok: false, message: "Escribe un enlace que empiece con https://" };
    const vault = await getVault(session.teamId);
    await db().sql`UPDATE vaults SET claude_consultant_url = ${value || null} WHERE id = ${vault.id}`;
    revalidatePath("/conocimiento");
    return { ok: true, message: value ? "Enlace del consultor guardado." : "Se quitó el enlace del consultor." };
  } catch (e) {
    return { ok: false, message: fail(e, "No se pudo guardar el enlace.") };
  }
}
