"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  createRock,
  updateRockStatus,
  updateRock,
  deleteRock,
  addMilestone,
  toggleMilestone,
  deleteMilestone,
} from "@/lib/domain/rocks";
import type { RockStatus } from "@/lib/domain/types";

function ownerId(formData: FormData): number | null {
  const raw = formData.get("ownerId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

export async function createRockAction(formData: FormData) {
  const session = await requireSession();
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
  await requireSession();
  await updateRockStatus(rockId, status);
  revalidatePath("/rocks");
}

export async function updateRockAction(rockId: number, formData: FormData) {
  await requireSession();
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
  await requireSession();
  await deleteRock(rockId);
  revalidatePath("/rocks");
}

export async function addMilestoneAction(rockId: number, title: string) {
  await requireSession();
  await addMilestone({ rockId, title, dueDate: null, sortOrder: 0 });
  revalidatePath("/rocks");
}

export async function toggleMilestoneAction(milestoneId: number, done: boolean) {
  await requireSession();
  await toggleMilestone(milestoneId, done);
  revalidatePath("/rocks");
}

export async function deleteMilestoneAction(milestoneId: number) {
  await requireSession();
  await deleteMilestone(milestoneId);
  revalidatePath("/rocks");
}
