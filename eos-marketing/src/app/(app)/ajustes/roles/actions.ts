"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { getAccess } from "@/lib/auth/access";
import { isAccessLevel, MODULES, type Permissions } from "@/lib/auth/modules";
import { createRole, deleteRole, updateRole } from "@/lib/domain/roles";

export type RoleResult = { ok: boolean; message: string };

async function adminTeam(): Promise<number | null> {
  const access = await getAccess();
  return access?.isAdmin ? access.session.teamId : null;
}

async function log(action: string, detail: string) {
  const access = await getAccess();
  if (access) await logActivity(access.session, "roles", action, detail);
}

function clean(input: Record<string, string>): Permissions {
  const out: Permissions = {};
  for (const m of MODULES) if (isAccessLevel(input[m.key])) out[m.key] = input[m.key] as Permissions[typeof m.key];
  return out;
}

function refresh() {
  // El menú lateral depende de los permisos.
  revalidatePath("/", "layout");
}

export async function createRoleAction(name: string, permissions: Record<string, string>): Promise<RoleResult> {
  const teamId = await adminTeam();
  if (!teamId) return { ok: false, message: "Solo un administrador puede crear roles." };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, message: "Escribe un nombre para el rol." };
  const id = await createRole(teamId, trimmed, clean(permissions));
  if (!id) return { ok: false, message: `Ya existe un rol llamado "${trimmed}".` };
  await log("Creó rol", trimmed);
  refresh();
  return { ok: true, message: `Rol "${trimmed}" creado.` };
}

export async function updateRoleAction(
  roleId: number,
  name: string,
  permissions: Record<string, string>
): Promise<RoleResult> {
  const teamId = await adminTeam();
  if (!teamId) return { ok: false, message: "Solo un administrador puede editar roles." };
  await updateRole(teamId, roleId, { name: name.trim() || undefined, permissions: clean(permissions) });
  await log("Cambió permisos de rol", name.trim());
  refresh();
  return { ok: true, message: "Permisos guardados." };
}

export async function deleteRoleAction(roleId: number): Promise<RoleResult> {
  const teamId = await adminTeam();
  if (!teamId) return { ok: false, message: "Solo un administrador puede eliminar roles." };
  await deleteRole(teamId, roleId);
  await log("Eliminó rol", `Rol #${roleId}`);
  refresh();
  return { ok: true, message: "Rol eliminado; sus personas pasaron a Usuario." };
}
