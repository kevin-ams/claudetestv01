"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireModule } from "@/lib/auth/access";
import { labelOf, logActivity } from "@/lib/domain/activity";
import { applyBackfill, backfillPreview, deleteLink, saveLink, type BackfillRow } from "@/lib/domain/ac-sync";
import { getCareer } from "@/lib/domain/careers";
import { careerValuesInPipeline, isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { formatWeekRange, shiftWeek, weekStartISO } from "@/lib/utils/dates";

export type LinkResult = { ok: boolean; message: string };

function refresh() {
  revalidatePath("/ajustes/activecampaign");
  revalidatePath("/indicadores");
}

export async function careerValuesAction(pipelineId: string): Promise<{ value: string; count: number }[]> {
  await requireModule("indicadores", "view");
  if (!/^\d+$/.test(pipelineId)) return [];
  try {
    return await careerValuesInPipeline(pipelineId);
  } catch {
    return [];
  }
}

export async function saveLinkAction(input: {
  careerId: number;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  careerValue: string;
}): Promise<LinkResult> {
  const session = await requireModule("indicadores");
  const career = await getCareer(input.careerId);
  if (!career || career.team_id !== session.teamId) return { ok: false, message: "Carrera no encontrada." };
  if (!/^\d+$/.test(input.pipelineId)) return { ok: false, message: "Elige el embudo." };
  await saveLink(session.teamId, {
    career_id: input.careerId,
    pipeline_id: input.pipelineId,
    pipeline_name: input.pipelineName.slice(0, 200),
    stage_id: input.stageId,
    stage_name: input.stageName.slice(0, 200),
    career_value: input.careerValue.trim().slice(0, 200),
  });
  await logActivity(
    session,
    "indicadores",
    "Vinculó carrera a ActiveCampaign",
    `${await labelOf("careers", input.careerId)} → ${input.pipelineName}${input.careerValue.trim() ? ` · ${input.careerValue.trim()}` : ""}`
  );
  refresh();
  return { ok: true, message: "Vínculo guardado." };
}

export async function deleteLinkAction(careerId: number): Promise<LinkResult> {
  const session = await requireModule("indicadores");
  await deleteLink(session.teamId, careerId);
  await logActivity(session, "indicadores", "Quitó vínculo con ActiveCampaign", await labelOf("careers", careerId));
  refresh();
  return { ok: true, message: "Vínculo quitado." };
}

// --- Semanas anteriores (solo administradores) ------------------------------------

/** Lunes de una semana ya cerrada (la semana en curso se actualiza con la sincronización normal). */
function pastWeek(week: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error("Semana inválida.");
  const monday = shiftWeek(week, 0);
  if (monday >= weekStartISO()) throw new Error("Elige una semana anterior a la semana en curso.");
  return monday;
}

export type BackfillPreview = { ok: boolean; rows: BackfillRow[]; message: string };

/** Comparativa de la semana (la pantalla primero pone al día el historial con la barra de avance). */
export async function backfillPreviewAction(week: string): Promise<BackfillPreview> {
  const session = await requireAdmin("Solo un administrador puede actualizar semanas anteriores.");
  if (!isActiveCampaignConfigured()) return { ok: false, rows: [], message: "ActiveCampaign no está configurado." };
  try {
    const rows = await backfillPreview(session.teamId, pastWeek(week));
    if (rows.length === 0) return { ok: false, rows, message: "Ninguna carrera está vinculada a ActiveCampaign." };
    return { ok: true, rows, message: "" };
  } catch (err) {
    return { ok: false, rows: [], message: err instanceof Error ? err.message : "No se pudo calcular la comparativa." };
  }
}

export async function backfillApplyAction(week: string, rows: { careerId: number; leads: number }[]): Promise<LinkResult> {
  const session = await requireAdmin("Solo un administrador puede actualizar semanas anteriores.");
  let weekStart: string;
  try {
    weekStart = pastWeek(week);
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: "No elegiste ninguna carrera." };
  const r = await applyBackfill({ teamId: session.teamId, weekStart, rows: rows.slice(0, 1000), userId: session.userId });
  await logActivity(
    session,
    "indicadores",
    "Sobrescribió leads de una semana anterior desde ActiveCampaign",
    `Semana ${formatWeekRange(weekStart)} · ${r.updated} carrera(s) · ${r.total} lead(s)`
  );
  refresh();
  return { ok: true, message: `Se actualizaron ${r.updated} carrera(s) en la semana ${formatWeekRange(weekStart)} (${r.total} leads).` };
}
