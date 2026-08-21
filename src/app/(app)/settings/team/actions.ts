"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createUser, getUserByEmail, addTeamMember } from "@/lib/domain/users";
import { renameTeam } from "@/lib/domain/teams";

export type FormState = { error: string | null; success?: string | null };

export async function addTeammateAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  if (session.role !== "admin") {
    return { error: "Solo un administrador puede agregar personas al equipo." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const seatTitle = String(formData.get("seatTitle") ?? "").trim();

  if (name.length < 2) return { error: "El nombre es muy corto" };
  if (!email.includes("@")) return { error: "Correo inválido" };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };

  let user = await getUserByEmail(email);
  if (!user) {
    const created = await createUser({ name, email, password, role: "member" });
    user = { ...created, password_hash: "" };
  }

  await addTeamMember(session.teamId, user.id, seatTitle || undefined);
  revalidatePath("/settings/team");
  return { error: null, success: `${name} fue agregado(a) al equipo.` };
}

export async function renameTeamAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "admin") return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await renameTeam(session.teamId, name);
  revalidatePath("/settings/team");
}
