"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { logActivity } from "@/lib/domain/activity";
import { createTool, deleteTool, moveTool, setToolActive, updateTool, type ToolInput } from "@/lib/domain/tools";
import { defaultToolIcon, isToolIcon, validToolUrl } from "@/lib/domain/tools-shared";

export type ToolResult = { ok: boolean; message: string };

const MESSAGE = "Solo un administrador puede administrar la caja de herramientas.";

function clean(input: ToolInput): ToolInput | string {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return "Escribe el nombre de la herramienta.";
  const kind = input.kind === "embed" ? "embed" : "link";
  const url = String(input.url ?? "").trim().slice(0, 2000);
  if (!validToolUrl(url, kind)) {
    return kind === "embed"
      ? "Escribe una dirección completa que empiece con https:// (los sitios insertados deben ser https)."
      : "Escribe una dirección completa que empiece con https://";
  }
  const access = input.access === "restricted" ? "restricted" : "all";
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500) : []);
  const roleIds = ids(input.roleIds);
  const userIds = ids(input.userIds);
  if (access === "restricted" && roleIds.length === 0 && userIds.length === 0) {
    return "Elige al menos un rol o una persona, o deja la herramienta para todo el equipo.";
  }
  return {
    name,
    description: String(input.description ?? "").trim().slice(0, 300),
    kind,
    url,
    icon: isToolIcon(input.icon) ? input.icon : defaultToolIcon(kind),
    access,
    roleIds,
    userIds,
  };
}

function refresh() {
  revalidatePath("/ajustes/herramientas");
  revalidatePath("/herramientas", "layout");
}

export async function saveToolAction(id: number | null, input: ToolInput): Promise<ToolResult> {
  const session = await requireAdmin(MESSAGE);
  const t = clean(input);
  if (typeof t === "string") return { ok: false, message: t };
  if (id) {
    if (!(await updateTool(session.teamId, id, t))) return { ok: false, message: "No se encontró la herramienta." };
    await logActivity(session, "ajustes", "Editó herramienta", t.name);
  } else {
    await createTool(session.teamId, t, session.userId);
    await logActivity(session, "ajustes", "Agregó herramienta", t.name);
  }
  refresh();
  return { ok: true, message: id ? "Herramienta actualizada." : "Herramienta agregada." };
}

export async function toggleToolAction(id: number, active: boolean) {
  const session = await requireAdmin(MESSAGE);
  await setToolActive(session.teamId, id, active);
  refresh();
}

export async function moveToolAction(id: number, dir: -1 | 1) {
  const session = await requireAdmin(MESSAGE);
  await moveTool(session.teamId, id, dir === -1 ? -1 : 1);
  refresh();
}

export async function deleteToolAction(id: number, name: string) {
  const session = await requireAdmin(MESSAGE);
  await deleteTool(session.teamId, id);
  await logActivity(session, "ajustes", "Quitó herramienta", name.slice(0, 80));
  refresh();
}
