"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
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

export async function moveStageAction(stageId: number, direction: "up" | "down") {
  return run(() => moveStage(stageId, direction));
}

export async function deleteStageAction(stageId: number) {
  return run(() => deleteStage(stageId));
}
