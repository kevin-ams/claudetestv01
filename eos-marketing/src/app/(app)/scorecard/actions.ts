"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import {
  upsertEntry,
  createMetric,
  archiveMetric,
  createOwner,
  deleteOwner,
  setTarget,
  setMetricSharing,
} from "@/lib/domain/scorecard";
import type { Direction, MetricFormat, Aggregation } from "@/lib/domain/types";

export async function upsertEntryAction(
  metricId: number,
  ownerId: number,
  weekStart: string,
  value: number | null
) {
  const session = await requireModule("scorecard");
  await upsertEntry({ metricId, ownerId, weekStart, value, enteredBy: session.userId });
  revalidatePath("/scorecard");
  revalidatePath("/");
}

export async function createMetricAction(formData: FormData) {
  const session = await requireModule("scorecard");
  await createMetric({
    teamId: session.teamId,
    name: String(formData.get("name") ?? "").trim(),
    predicts: String(formData.get("predicts") ?? "").trim(),
    direction: formData.get("direction") as Direction,
    format: formData.get("format") as MetricFormat,
    aggregation: formData.get("aggregation") as Aggregation,
  });
  revalidatePath("/scorecard");
}

export async function archiveMetricAction(metricId: number) {
  await requireModule("scorecard");
  await archiveMetric(metricId);
  revalidatePath("/scorecard");
}

export async function createOwnerAction(formData: FormData) {
  const session = await requireModule("scorecard");
  await createOwner(
    session.teamId,
    String(formData.get("name") ?? "").trim(),
    formData.get("isRollup") === "on"
  );
  revalidatePath("/scorecard");
}

export async function deleteOwnerAction(ownerId: number) {
  await requireModule("scorecard");
  await deleteOwner(ownerId);
  revalidatePath("/scorecard");
}

export async function setTargetAction(metricId: number, ownerId: number, value: number) {
  await requireModule("scorecard");
  await setTarget(metricId, ownerId, value);
  revalidatePath("/scorecard");
}

export async function setMetricSharingAction(
  metricId: number,
  sharedAll: boolean,
  teamIds: number[]
): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("scorecard");
  const ok = await setMetricSharing(session.teamId, metricId, sharedAll, teamIds);
  revalidatePath("/scorecard");
  if (!ok) return { ok: false, message: "Ese indicador no es de este equipo." };
  return {
    ok: true,
    message: sharedAll
      ? "Visible para todos los equipos."
      : teamIds.length
        ? `Visible para ${teamIds.length} equipo(s).`
        : "Ya no se comparte con otros equipos.",
  };
}
