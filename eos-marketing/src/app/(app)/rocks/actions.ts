"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
import {
  createRock,
  updateRockStatus,
  updateRock,
  deleteRock,
  addMilestone,
  toggleMilestone,
  deleteMilestone,
  setMilestoneDueDate,
} from "@/lib/domain/rocks";
import type { RockStatus } from "@/lib/domain/types";

function ownerId(formData: FormData): number | null {
  const raw = formData.get("ownerId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

export async function createRockAction(formData: FormData) {
  const session = await requireModule("rocks");
  await createRock({
    teamId: session.teamId,
    ownerId: ownerId(formData),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    isCompanyRock: formData.get("isCompanyRock") === "on",
    quarter: Number(formData.get("quarter")),
    year: Number(formData.get("year")),
    dueDate: (formData.get("dueDate") as string) || null,
  });
  await logActivity(session, "rocks", "Creó Rock", String(formData.get("title") ?? "").trim());
  revalidatePath("/rocks");
}

export async function updateRockStatusAction(rockId: number, status: RockStatus) {
  const session = await requireModule("rocks");
  await updateRockStatus(rockId, status);
  await logActivity(session, "rocks", "Cambió estado de Rock", `${await labelOf("rocks", rockId)}: ${status === "on_track" ? "On track" : status === "off_track" ? "Off track" : "Completado"}`);
  revalidatePath("/rocks");
}

export async function updateRockAction(rockId: number, formData: FormData) {
  const session = await requireModule("rocks");
  await updateRock(rockId, {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    ownerId: ownerId(formData),
    dueDate: (formData.get("dueDate") as string) || null,
    isCompanyRock: formData.get("isCompanyRock") === "on",
  });
  await logActivity(session, "rocks", "Editó Rock", String(formData.get("title") ?? "").trim());
  revalidatePath("/rocks");
}

export async function deleteRockAction(rockId: number) {
  const session = await requireModule("rocks");
  const label = await labelOf("rocks", rockId);
  await deleteRock(rockId);
  await logActivity(session, "rocks", "Eliminó Rock", label);
  revalidatePath("/rocks");
}

export async function addMilestoneAction(rockId: number, title: string, dueDate: string | null) {
  const session = await requireModule("rocks");
  await addMilestone({ rockId, title, dueDate: dueDate || null, sortOrder: 0 });
  await logActivity(session, "rocks", "Agregó hito de Rock", `${title} (Rock: ${await labelOf("rocks", rockId)})`);
  revalidatePath("/rocks");
}

export async function toggleMilestoneAction(milestoneId: number, done: boolean) {
  const session = await requireModule("rocks");
  await toggleMilestone(milestoneId, done);
  await logActivity(session, "rocks", "Marcó hito de Rock", `${await labelOf("rock_milestones", milestoneId)}: ${done ? "hecho" : "pendiente"}`);
  revalidatePath("/rocks");
}

export async function setMilestoneDueDateAction(milestoneId: number, dueDate: string | null) {
  const session = await requireModule("rocks");
  await setMilestoneDueDate(milestoneId, dueDate || null);
  await logActivity(session, "rocks", "Cambió fecha de hito de Rock", `${await labelOf("rock_milestones", milestoneId)}: ${dueDate ?? "sin fecha"}`);
  revalidatePath("/rocks");
}

export async function deleteMilestoneAction(milestoneId: number) {
  const session = await requireModule("rocks");
  const label = await labelOf("rock_milestones", milestoneId);
  await deleteMilestone(milestoneId);
  await logActivity(session, "rocks", "Eliminó hito de Rock", label);
  revalidatePath("/rocks");
}
