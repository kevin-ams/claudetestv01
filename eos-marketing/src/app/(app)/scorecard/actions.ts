"use server";

import { requireAdmin, requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import {
  upsertEntry,
  createMetric,
  archiveMetric,
  createOwner,
  deleteOwner,
  setTarget,
  setMetricSharing,
  setMetricFormula,
  moveMetric,
  restoreMetric,
  getScorecardCell,
  getMetricName,
} from "@/lib/domain/scorecard";
import { NOT_FOUND, parse, zIsoDate, zId } from "@/lib/actions";
import { z } from "zod";
import { describeFormula, type MetricFormula } from "@/lib/domain/scorecard-formula";
import type { Direction, MetricFormat, Aggregation } from "@/lib/domain/types";

export async function upsertEntryAction(
  metricId: number,
  ownerId: number,
  weekStart: string,
  value: number | null
) {
  const session = await requireModule("scorecard");
  const input = parse(
    z.object({ metricId: zId, ownerId: zId, weekStart: zIsoDate, value: z.number().finite().nullable() }),
    { metricId, ownerId, weekStart, value }
  );
  const cell = await getScorecardCell(session.teamId, input.metricId, input.ownerId);
  if (!cell) throw new Error("Indicador no encontrado");
  await upsertEntry({ teamId: session.teamId, ...input, enteredBy: session.userId });
  await logActivity(session, "scorecard", "Registró valor del Scorecard", `${cell.metric} · ${cell.owner} · semana ${input.weekStart}: ${input.value ?? "vacío"}`);
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

export async function archiveMetricAction(metricId: number): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("scorecard");
  const label = await getMetricName(session.teamId, Number(metricId));
  if (label === null) return NOT_FOUND;
  const usedBy = await archiveMetric(session.teamId, metricId);
  if (usedBy.length) {
    return { ok: false, message: `No se puede archivar: lo usa la fórmula de ${usedBy.join(", ")}. Cambia esa fórmula primero.` };
  }
  await logActivity(session, "scorecard", "Archivó indicador", label);
  revalidatePath("/scorecard");
  revalidatePath("/ajustes/scorecard");
  return { ok: true, message: `“${label}” archivado. Puedes restaurarlo en Ajustes › Indicadores archivados.` };
}

export async function restoreMetricAction(metricId: number): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("scorecard");
  const label = await getMetricName(session.teamId, Number(metricId));
  if (label === null) return NOT_FOUND;
  await restoreMetric(session.teamId, Number(metricId));
  await logActivity(session, "scorecard", "Restauró indicador", label);
  revalidatePath("/scorecard");
  revalidatePath("/ajustes/scorecard");
  return { ok: true, message: `“${label}” vuelve al Scorecard (al final de la lista).` };
}

export async function moveMetricAction(metricId: number, direction: "up" | "down") {
  const session = await requireModule("scorecard");
  await moveMetric(session.teamId, metricId, direction === "up" ? "up" : "down");
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
  const label = await deleteOwner(session.teamId, Number(ownerId));
  if (label === null) return;
  await logActivity(session, "scorecard", "Eliminó dueño del Scorecard", label);
  revalidatePath("/scorecard");
}

/** Vuelve calculado (fórmula con variables) o manual (`formula` null) un indicador. */
export async function setMetricFormulaAction(metricId: number, formula: MetricFormula | null): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("scorecard");
  const clean: MetricFormula | null = formula
    ? {
        expr: String(formula.expr ?? ""),
        vars: Object.fromEntries(
          Object.entries(formula.vars ?? {})
            .filter(([k, v]) => /^[A-Z]$/.test(k) && Number(v) > 0)
            .map(([k, v]) => [k, Number(v)])
        ),
      }
    : null;
  const error = await setMetricFormula(session.teamId, metricId, clean);
  if (error) return { ok: false, message: error };
  const label = (await getMetricName(session.teamId, Number(metricId))) ?? "";
  let detail = "manual";
  if (clean) {
    const names: Record<number, string> = {};
    for (const id of Object.values(clean.vars)) names[id] = (await getMetricName(session.teamId, id)) ?? "?";
    detail = describeFormula(clean, (id) => names[id] ?? "?");
  }
  await logActivity(session, "scorecard", "Cambió cálculo de indicador", `${label}: ${detail}`);
  revalidatePath("/scorecard");
  return { ok: true, message: clean ? "Fórmula guardada." : "Ahora se captura a mano." };
}

/** Solo un administrador cambia metas. */
export async function setTargetAction(metricId: number, ownerId: number, value: number) {
  await requireModule("scorecard");
  const session = await requireAdmin("Solo un administrador puede cambiar las metas.");
  const input = parse(z.object({ metricId: zId, ownerId: zId, value: z.number().finite() }), { metricId, ownerId, value });
  const cell = await getScorecardCell(session.teamId, input.metricId, input.ownerId);
  if (!cell) throw new Error("Indicador no encontrado");
  await setTarget(session.teamId, input.metricId, input.ownerId, input.value);
  await logActivity(session, "scorecard", "Cambió meta del Scorecard", `${cell.metric} · ${cell.owner}: ${input.value}`);
  revalidatePath("/scorecard");
}

export async function setMetricSharingAction(
  metricId: number,
  sharedAll: boolean,
  teamIds: number[]
): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("scorecard");
  const ids = (Array.isArray(teamIds) ? teamIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const ok = await setMetricSharing(session.teamId, Number(metricId), Boolean(sharedAll), ids);
  if (!ok) return { ok: false, message: "Ese indicador no es de este equipo." };
  await logActivity(session, "scorecard", "Cambió visibilidad de indicador", `${await getMetricName(session.teamId, Number(metricId))}: ${sharedAll ? "todos los equipos" : `${ids.length} equipo(s)`}`);
  revalidatePath("/scorecard");
  return {
    ok: true,
    message: sharedAll
      ? "Visible para todos los equipos."
      : teamIds.length
        ? `Visible para ${teamIds.length} equipo(s).`
        : "Ya no se comparte con otros equipos.",
  };
}
