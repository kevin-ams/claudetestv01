"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
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
  await logActivity(session, "scorecard", "Registró valor del Scorecard", `${await labelOf("scorecard_metrics", metricId)} · ${await labelOf("scorecard_owners", ownerId)} · semana ${weekStart}: ${value ?? "vacío"}`);
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
  await logActivity(session, "scorecard", "Agregó indicador", String(formData.get("name") ?? "").trim());
  revalidatePath("/scorecard");
}

export async function archiveMetricAction(metricId: number) {
  const session = await requireModule("scorecard");
  const label = await labelOf("scorecard_metrics", metricId);
  await archiveMetric(metricId);
  await logActivity(session, "scorecard", "Archivó indicador", label);
  revalidatePath("/scorecard");
}

export async function createOwnerAction(formData: FormData) {
  const session = await requireModule("scorecard");
  await createOwner(
    session.teamId,
    String(formData.get("name") ?? "").trim(),
    formData.get("isRollup") === "on"
  );
  await logActivity(session, "scorecard", "Agregó dueño del Scorecard", String(formData.get("name") ?? "").trim());
  revalidatePath("/scorecard");
}

export async function deleteOwnerAction(ownerId: number) {
  const session = await requireModule("scorecard");
  const label = await labelOf("scorecard_owners", ownerId);
  await deleteOwner(ownerId);
  await logActivity(session, "scorecard", "Eliminó dueño del Scorecard", label);
  revalidatePath("/scorecard");
}

export async function setTargetAction(metricId: number, ownerId: number, value: number) {
  const session = await requireModule("scorecard");
  await setTarget(metricId, ownerId, value);
  await logActivity(session, "scorecard", "Cambió meta del Scorecard", `${await labelOf("scorecard_metrics", metricId)} · ${await labelOf("scorecard_owners", ownerId)}: ${value}`);
  revalidatePath("/scorecard");
}

export async function setMetricSharingAction(
  metricId: number,
  sharedAll: boolean,
  teamIds: number[]
): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("scorecard");
  const ok = await setMetricSharing(session.teamId, metricId, sharedAll, teamIds);
  await logActivity(session, "scorecard", "Cambió visibilidad de indicador", `${await labelOf("scorecard_metrics", metricId)}: ${sharedAll ? "todos los equipos" : `${teamIds.length} equipo(s)`}`);
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
