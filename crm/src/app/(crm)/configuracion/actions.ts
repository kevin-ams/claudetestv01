"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";
import {
  createPasswordUser,
  getUserByEmail,
  setPassword,
  updateUserAccess,
} from "@/lib/domain/users";
import {
  addStage,
  defaultPipelineId,
  deleteStage,
  moveStage,
  updateStage,
} from "@/lib/domain/pipeline";

export type ActionResult = { error?: string };

const stageSchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(60),
  probability: z.coerce.number().int().min(0).max(100),
  kind: z.enum(["open", "won", "lost"]),
});

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await requireAdmin();
    await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Algo salió mal" };
  }
  revalidatePath("/configuracion");
  revalidatePath("/");
  return {};
}

export async function addStageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = stageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return run(async () => addStage({ pipelineId: await defaultPipelineId(), ...parsed.data }));
}

export async function updateStageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = stageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const stageId = Number(form.get("stageId"));
  return run(() => updateStage({ stageId, ...parsed.data }));
}

const newUserSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre"),
  email: z.string().trim().email("Correo inválido"),
  role: z.enum(["admin", "member"]),
  password: z.string().min(MIN_PASSWORD_LENGTH, `La contraseña temporal debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`),
});

export async function createUserAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = newUserSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return run(async () => {
    if (await getUserByEmail(parsed.data.email)) {
      throw new Error("Ya existe un usuario con ese correo");
    }
    await createPasswordUser(parsed.data);
  });
}

export async function updateUserAccessAction(userId: number, role: "admin" | "member", active: boolean) {
  return run(async () => {
    const session = await requireAdmin();
    if (session.userId === userId && !active) {
      throw new Error("No puedes desactivar tu propio acceso");
    }
    await updateUserAccess({ userId, role, active });
  });
}

export async function resetPasswordAction(userId: number, password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` };
  }
  return run(() => setPassword(userId, password));
}

export async function moveStageAction(stageId: number, direction: "up" | "down") {
  return run(() => moveStage(stageId, direction));
}

export async function deleteStageAction(stageId: number) {
  return run(() => deleteStage(stageId));
}
