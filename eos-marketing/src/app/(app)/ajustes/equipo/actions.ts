"use server";

import { revalidatePath } from "next/cache";
import { isTeamAdmin } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import {
  createUser,
  getUserByEmail,
  addTeamMember,
  isUserInTeam,
  listTeamMembersDetailed,
  removeTeamMember,
  updateUserAccess,
} from "@/lib/domain/users";
import { countAdmins, listRoles, setMemberRole } from "@/lib/domain/roles";
import { renameTeam } from "@/lib/domain/teams";

export type FormState = { error: string | null; success?: string | null };

export async function addTeammateAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  if (!(await isTeamAdmin())) {
    return { error: "Solo un administrador puede agregar personas al equipo." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const seatTitle = String(formData.get("seatTitle") ?? "").trim();

  const roleId = Number(formData.get("roleId"));

  if (!email.includes("@")) return { error: "Correo inválido" };
  const roles = await listRoles(session.teamId);
  const role = roles.find((r) => r.id === roleId) ?? roles.find((r) => r.name === "Usuario");

  let user = await getUserByEmail(email);
  if (!user) {
    if (name.length < 2) return { error: "El nombre es muy corto" };
    if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
    const created = await createUser({ name, email, password, role: "member" });
    user = { ...created, password_hash: "" };
  } else if (await isUserInTeam(user.id, session.teamId)) {
    return { error: `${user.name} ya está en este equipo.` };
  }

  await addTeamMember(session.teamId, user.id, seatTitle || undefined, role?.name);
  revalidatePath("/ajustes/equipo");
  return { error: null, success: `${user.name} fue agregado(a) al equipo como ${role?.name ?? "Usuario"}.` };
}

export async function renameTeamAction(formData: FormData) {
  const session = await requireSession();
  if (!(await isTeamAdmin())) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await renameTeam(session.teamId, name);
  revalidatePath("/ajustes/equipo");
}

export async function updateAccessAction(
  userId: number,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  if (!(await isTeamAdmin())) {
    return { error: "Solo un administrador puede editar el acceso." };
  }
  if (!(await isUserInTeam(userId, session.teamId))) {
    return { error: "Esa persona no pertenece a este equipo." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "El nombre es muy corto" };
  if (!email.includes("@")) return { error: "Correo inválido" };
  if (password && password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }
  const other = await getUserByEmail(email);
  if (other && other.id !== userId) return { error: "Ya existe una cuenta con ese correo" };

  await updateUserAccess(userId, { name, email, password: password || null });
  revalidatePath("/ajustes/equipo");
  return { error: null, success: "Acceso actualizado." };
}

export type MemberResult = { ok: boolean; message: string };

export async function setMemberRoleAction(userId: number, roleId: number): Promise<MemberResult> {
  const session = await requireSession();
  if (!(await isTeamAdmin())) return { ok: false, message: "Solo un administrador puede asignar roles." };
  const roles = await listRoles(session.teamId);
  const target = roles.find((r) => r.id === roleId);
  if (!target) return { ok: false, message: "Ese rol no existe en este equipo." };
  const members = await listTeamMembersDetailed(session.teamId);
  const member = members.find((m) => m.id === userId);
  if (!member) return { ok: false, message: "Esa persona no pertenece a este equipo." };
  if (member.is_admin && !target.is_admin && (await countAdmins(session.teamId)) <= 1) {
    return { ok: false, message: "El equipo necesita al menos un administrador." };
  }
  await setMemberRole(session.teamId, userId, roleId);
  revalidatePath("/", "layout");
  return { ok: true, message: `${member.name} ahora es ${target.name}.` };
}

export async function removeMemberAction(userId: number): Promise<MemberResult> {
  const session = await requireSession();
  if (!(await isTeamAdmin())) return { ok: false, message: "Solo un administrador puede quitar personas." };
  if (userId === session.userId) return { ok: false, message: "No puedes quitarte a ti mismo del equipo." };
  await removeTeamMember(session.teamId, userId);
  revalidatePath("/ajustes/equipo");
  return { ok: true, message: "Persona quitada del equipo." };
}
