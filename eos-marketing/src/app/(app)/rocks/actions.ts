"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
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
  revalidatePath("/rocks");
}

export async function updateRockStatusAction(rockId: number, status: RockStatus) {
  await requireModule("rocks");
  await updateRockStatus(rockId, status);
  revalidatePath("/rocks");
}

export async function updateRockAction(rockId: number, formData: FormData) {
  await requireModule("rocks");
  await updateRock(rockId, {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    ownerId: ownerId(formData),
    dueDate: (formData.get("dueDate") as string) || null,
    isCompanyRock: formData.get("isCompanyRock") === "on",
  });
  revalidatePath("/rocks");
}

export async function deleteRockAction(rockId: number) {
  await requireModule("rocks");
  await deleteRock(rockId);
  revalidatePath("/rocks");
}

export async function addMilestoneAction(rockId: number, title: string, dueDate: string | null) {
  await requireModule("rocks");
  await addMilestone({ rockId, title, dueDate: dueDate || null, sortOrder: 0 });
  revalidatePath("/rocks");
}

export async function toggleMilestoneAction(milestoneId: number, done: boolean) {
  await requireModule("rocks");
  await toggleMilestone(milestoneId, done);
  revalidatePath("/rocks");
}

export async function setMilestoneDueDateAction(milestoneId: number, dueDate: string | null) {
  await requireModule("rocks");
  await setMilestoneDueDate(milestoneId, dueDate || null);
  revalidatePath("/rocks");
}

export async function deleteMilestoneAction(milestoneId: number) {
  await requireModule("rocks");
  await deleteMilestone(milestoneId);
  revalidatePath("/rocks");
}
