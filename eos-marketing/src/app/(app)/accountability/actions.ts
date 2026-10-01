"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { createSeat, updateSeat, deleteSeat } from "@/lib/domain/accountability";

function linesOf(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) ?? "");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function parentId(formData: FormData): number | null {
  const raw = formData.get("parentSeatId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

function userId(formData: FormData): number | null {
  const raw = formData.get("userId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

export async function createSeatAction(formData: FormData) {
  const session = await requireModule("accountability");
  await createSeat({
    teamId: session.teamId,
    parentSeatId: parentId(formData),
    title: String(formData.get("title") ?? "").trim(),
    userId: userId(formData),
    roles: linesOf(formData, "roles"),
    sortOrder: 0,
  });
  revalidatePath("/accountability");
}

export async function updateSeatAction(seatId: number, formData: FormData) {
  await requireModule("accountability");
  await updateSeat(seatId, {
    title: String(formData.get("title") ?? "").trim(),
    userId: userId(formData),
    roles: linesOf(formData, "roles"),
    parentSeatId: parentId(formData),
  });
  revalidatePath("/accountability");
}

export async function deleteSeatAction(seatId: number) {
  await requireModule("accountability");
  await deleteSeat(seatId);
  revalidatePath("/accountability");
}
