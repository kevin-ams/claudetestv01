"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { CONTROL_STAGES, type StageKey } from "@/lib/domain/career-control";
import {
  createControlMilestone,
  deleteControlMilestone,
  moveControlMilestone,
  resetControlMilestones,
  updateControlMilestone,
} from "@/lib/domain/control-milestones";

export type SettingsResult = { ok: boolean; message: string };

async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Solo un administrador puede cambiar los ajustes.");
  return session;
}

function checkStage(stage: string): StageKey {
  if (!CONTROL_STAGES.some((s) => s.key === stage)) throw new Error("Etapa inválida");
  return stage as StageKey;
}

function refresh() {
  revalidatePath("/ajustes");
  revalidatePath("/control");
}

export async function createMilestoneAction(stage: string, label: string): Promise<SettingsResult> {
  const session = await requireAdmin();
  const name = label.trim().slice(0, 80);
  if (!name) return { ok: false, message: "Escribe el nombre del hito." };
  await createControlMilestone(session.teamId, checkStage(stage), name);
  refresh();
  return { ok: true, message: `Hito "${name}" agregado.` };
}

export async function updateMilestoneAction(
  id: number,
  input: {
    label: string;
    stage: string;
    actions: string;
    doneWhen: string;
    days: number;
    dependsOn: string[];
    isLaunch: boolean;
  }
): Promise<SettingsResult> {
  const session = await requireAdmin();
  const label = input.label.trim().slice(0, 80);
  if (!label) return { ok: false, message: "El hito necesita un nombre." };
  const days = Math.round(Number(input.days));
  if (!Number.isFinite(days) || days < 0 || days > 365) {
    return { ok: false, message: "La duración debe estar entre 0 y 365 días." };
  }
  await updateControlMilestone(session.teamId, id, {
    label,
    stage: checkStage(input.stage),
    actions: input.actions.trim().slice(0, 2000),
    doneWhen: input.doneWhen.trim().slice(0, 1000),
    days,
    dependsOn: input.dependsOn,
    isLaunch: input.isLaunch,
  });
  refresh();
  return { ok: true, message: "Hito guardado." };
}

export async function moveMilestoneAction(id: number, delta: -1 | 1) {
  const session = await requireAdmin();
  await moveControlMilestone(session.teamId, id, delta);
  refresh();
}

export async function deleteMilestoneAction(id: number) {
  const session = await requireAdmin();
  await deleteControlMilestone(session.teamId, id);
  refresh();
}

export async function resetMilestonesAction() {
  const session = await requireAdmin();
  await resetControlMilestones(session.teamId);
  refresh();
}
