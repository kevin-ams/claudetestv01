"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
import { canReportTo, createSeat, updateSeat, deleteSeat } from "@/lib/domain/accountability";

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
  if (!(await canReportTo(session.teamId, null, parentId(formData)))) throw new Error("Puesto superior inválido");
  await createSeat({
    teamId: session.teamId,
    parentSeatId: parentId(formData),
    title: String(formData.get("title") ?? "").trim(),
    userId: userId(formData),
    roles: linesOf(formData, "roles"),
    sortOrder: 0,
  });
  await logActivity(session, "accountability", "Agregó asiento al organigrama", String(formData.get("title") ?? "").trim());
  revalidatePath("/accountability");
}

export async function updateSeatAction(seatId: number, formData: FormData) {
  const session = await requireModule("accountability");
  if (!(await canReportTo(session.teamId, seatId, parentId(formData)))) throw new Error("Un puesto no puede reportar a sí mismo ni a quien depende de él");
  await updateSeat(seatId, {
    title: String(formData.get("title") ?? "").trim(),
    userId: userId(formData),
    roles: linesOf(formData, "roles"),
    parentSeatId: parentId(formData),
  });
  await logActivity(session, "accountability", "Editó asiento del organigrama", String(formData.get("title") ?? "").trim());
  revalidatePath("/accountability");
}

export async function deleteSeatAction(seatId: number) {
  const session = await requireModule("accountability");
  const label = await labelOf("accountability_seats", seatId);
  await deleteSeat(session.teamId, seatId);
  await logActivity(session, "accountability", "Eliminó asiento del organigrama", label);
  revalidatePath("/accountability");
}
