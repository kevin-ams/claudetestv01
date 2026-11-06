"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
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
  type NoteVersion,
  type SaveResult,
} from "@/lib/domain/vault";
import { applyTemplate, cleanFolder, type Note, type NoteSummary } from "@/lib/domain/vault-shared";

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
