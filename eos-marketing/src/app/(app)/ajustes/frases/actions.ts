"use server";

import { revalidatePath } from "next/cache";
import { canEdit } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/domain/activity";
import { createQuote, deleteQuote, restoreCatalog, setQuoteActive } from "@/lib/domain/quotes";

export type QuoteResult = { ok: boolean; message: string };

async function editor() {
  const session = await requireSession();
  return (await canEdit("ajustes")) ? session : null;
}

function refresh() {
  revalidatePath("/ajustes/frases");
  revalidatePath("/");
}

export async function createQuoteAction(input: { text: string; author: string; category: string }): Promise<QuoteResult> {
  const session = await editor();
  if (!session) return { ok: false, message: "No tienes permiso para cambiar las frases." };
  const text = input.text.trim().slice(0, 400);
  if (text.length < 5) return { ok: false, message: "Escribe la frase." };
  await createQuote(session.teamId, {
    text,
    author: input.author.trim().slice(0, 80),
    category: input.category.trim().toLowerCase().slice(0, 40),
  });
  await logActivity(session, "ajustes", "Agregó frase", text.slice(0, 120));
  refresh();
  return { ok: true, message: "Frase agregada." };
}

export async function setQuoteActiveAction(id: number, active: boolean): Promise<QuoteResult> {
  const session = await editor();
  if (!session) return { ok: false, message: "No tienes permiso para cambiar las frases." };
  await setQuoteActive(session.teamId, id, active);
  refresh();
  return { ok: true, message: active ? "Frase activada." : "Frase desactivada." };
}

export async function deleteQuoteAction(id: number): Promise<QuoteResult> {
  const session = await editor();
  if (!session) return { ok: false, message: "No tienes permiso para cambiar las frases." };
  const text = await deleteQuote(session.teamId, id);
  if (text) await logActivity(session, "ajustes", "Eliminó frase", text.slice(0, 120));
  refresh();
  return { ok: true, message: "Frase eliminada." };
}

export async function restoreCatalogAction(): Promise<QuoteResult> {
  const session = await editor();
  if (!session) return { ok: false, message: "No tienes permiso para cambiar las frases." };
  const added = await restoreCatalog(session.teamId);
  if (added) await logActivity(session, "ajustes", "Restauró frases del banco inicial", `${added} frase(s)`);
  refresh();
  return { ok: true, message: added ? `Se agregaron ${added} frase(s) del banco inicial.` : "Ya están todas las frases del banco inicial." };
}
