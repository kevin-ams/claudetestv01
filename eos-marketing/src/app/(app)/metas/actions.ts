"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { copyMonthlyGoals, getCareer, setMonthlyGoal } from "@/lib/domain/careers";
import { applyGoalsImport, previewGoalsImport, setGoalHistory } from "@/lib/domain/goals-sheet";
import type { GoalImportPreview } from "@/lib/domain/goals-shared";

export type GoalField = "leads" | "budget";

function checkMonth(month: string): string {
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error("Mes inválido");
  return month;
}

function refresh() {
  revalidatePath("/metas");
  revalidatePath("/indicadores");
  revalidatePath("/meeting", "layout");
}

export async function setMonthlyGoalAction(
  careerId: number,
  month: string,
  field: GoalField,
  value: number | null
) {
  const session = await requireModule("metas");
  const career = await getCareer(careerId);
  if (!career || career.team_id !== session.teamId) throw new Error("Carrera no encontrada");
  const clean = value === null ? 0 : value;
  if (!Number.isFinite(clean) || clean < 0) throw new Error("Valor inválido");
  await setMonthlyGoal({
    careerId,
    month: checkMonth(month),
    field,
    value: field === "leads" ? Math.round(clean) : Math.round(clean * 100) / 100,
    userId: session.userId,
  });
  await logActivity(session, "metas", "Cambió meta mensual", `${career.code ? career.code + " · " : ""}${career.name} · ${month.slice(0, 7)} · ${field === "leads" ? "leads" : "presupuesto"}: ${value ?? 0}`);
  refresh();
}

export async function copyMonthAction(
  from: string,
  to: string,
  field: GoalField | "both"
): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("metas");
  if (from === to) return { ok: false, message: "Elige dos meses distintos." };
  const copied = await copyMonthlyGoals({
    teamId: session.teamId,
    from: checkMonth(from),
    to: checkMonth(to),
    field,
    userId: session.userId,
  });
  await logActivity(session, "metas", "Copió metas de un mes", `${from.slice(0, 7)} → ${to.slice(0, 7)} (${field === "both" ? "leads y presupuesto" : field === "leads" ? "leads" : "presupuesto"}) · ${copied} carrera(s)`);
  refresh();
  return copied === 0
    ? { ok: false, message: "El mes de origen no tiene metas cargadas." }
    : { ok: true, message: `Metas copiadas para ${copied} carrera(s).` };
}

// --- Importar desde Google Sheets (manual) e histórico -------------------------------

export async function goalsImportPreviewAction(
  url: string,
  mapping: Record<string, number>
): Promise<{ ok: boolean; message: string; preview: GoalImportPreview | null }> {
  try {
    const session = await requireModule("metas");
    const preview = await previewGoalsImport(session.teamId, String(url ?? "").slice(0, 500), cleanMapping(mapping));
    return { ok: true, message: "", preview };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo leer la hoja.", preview: null };
  }
}

export async function goalsImportApplyAction(input: {
  url: string;
  mapping: Record<string, number>;
  leads: boolean;
  budget: boolean;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireModule("metas");
    if (!input.leads && !input.budget) return { ok: false, message: "Elige metas, presupuesto o ambos." };
    const r = await applyGoalsImport({
      teamId: session.teamId,
      userId: session.userId,
      url: String(input.url ?? "").slice(0, 500),
      mapping: cleanMapping(input.mapping),
      leads: Boolean(input.leads),
      budget: Boolean(input.budget),
    });
    await logActivity(
      session,
      "metas",
      "Importó metas desde Google Sheets",
      `${r.careers} carrera(s) · ${input.leads ? "metas" : ""}${input.leads && input.budget ? " y " : ""}${input.budget ? "presupuesto" : ""}${r.skipped.length ? ` · sin asignar: ${r.skipped.join(", ")}` : ""}`
    );
    refresh();
    return {
      ok: true,
      message: `Listo: ${r.careers} carrera(s) actualizadas (meses e histórico).${r.skipped.length ? ` Sin asignar (no se cargaron): ${r.skipped.join(", ")}.` : ""}`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error && e.message ? e.message : "No se pudo importar." };
  }
}

function cleanMapping(mapping: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(mapping ?? {}).slice(0, 500)) {
    const id = Number(v);
    if (k && Number.isInteger(id) && id > 0) out[String(k).toUpperCase().slice(0, 50)] = id;
  }
  return out;
}

/** Edita a mano el histórico de una carrera (vacío = sin histórico para ese campo). */
export async function setGoalHistoryAction(careerId: number, year: number, fromMonth: string, field: GoalField, value: number | null) {
  const session = await requireModule("metas");
  const career = await getCareer(careerId);
  if (!career || career.team_id !== session.teamId) throw new Error("Carrera no encontrada");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Año inválido");
  const clean = value === null || value === 0 ? null : value;
  if (clean !== null && (!Number.isFinite(clean) || clean < 0)) throw new Error("Valor inválido");
  await setGoalHistory({
    careerId,
    year,
    fromMonth: checkMonth(fromMonth),
    field,
    value: clean === null ? null : field === "leads" ? Math.round(clean * 10) / 10 : Math.round(clean * 100) / 100,
    userId: session.userId,
  });
  await logActivity(session, "metas", "Cambió histórico", `${career.code ? career.code + " · " : ""}${career.name} · ${year} · ${field === "leads" ? "leads" : "presupuesto"}: ${clean ?? "—"}`);
  refresh();
}
