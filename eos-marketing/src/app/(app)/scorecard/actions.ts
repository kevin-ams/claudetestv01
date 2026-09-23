"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  upsertEntry,
  createMetric,
  archiveMetric,
  createOwner,
  deleteOwner,
  setTarget,
} from "@/lib/domain/scorecard";
import type { Direction, MetricFormat, Aggregation } from "@/lib/domain/types";

export async function upsertEntryAction(
  metricId: number,
  ownerId: number,
  weekStart: string,
  value: number | null
) {
  const session = await requireSession();
  await upsertEntry({ metricId, ownerId, weekStart, value, enteredBy: session.userId });
  revalidatePath("/scorecard");
  revalidatePath("/");
}

export async function createMetricAction(formData: FormData) {
  const session = await requireSession();
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
  await requireSession();
  await archiveMetric(metricId);
  revalidatePath("/scorecard");
}

export async function createOwnerAction(formData: FormData) {
  const session = await requireSession();
  await createOwner(
    session.teamId,
    String(formData.get("name") ?? "").trim(),
    formData.get("isRollup") === "on"
  );
  revalidatePath("/scorecard");
}

export async function deleteOwnerAction(ownerId: number) {
  await requireSession();
  await deleteOwner(ownerId);
  revalidatePath("/scorecard");
}

export async function setTargetAction(metricId: number, ownerId: number, value: number) {
  await requireSession();
  await setTarget(metricId, ownerId, value);
  revalidatePath("/scorecard");
}
