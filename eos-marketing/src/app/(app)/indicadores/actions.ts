"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getCareer,
  listCareers,
  createCareer,
  updateCareer,
  archiveCareer,
  setCareerGoal,
  setCareerOwner,
  setWeeklyLeads,
  setWeeklyBudget,
  addWeeklyBudget,
  saveAlias,
  logImport,
} from "@/lib/domain/careers";
import { aliasKey, CAREER_LEVELS } from "@/lib/domain/careers-shared";
import { isUserInTeam } from "@/lib/domain/users";
import {
  fetchWeeklyLeadsByCareer,
  ActiveCampaignNotConfiguredError,
} from "@/lib/integrations/activecampaign";
import { shiftWeek } from "@/lib/utils/dates";
import type { CareerLevel } from "@/lib/domain/types";

export type ActionResult = { ok: boolean; message: string };

function refresh() {
  revalidatePath("/indicadores");
  revalidatePath("/meeting", "layout");
}

function normalizeWeek(week: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error("Semana inválida");
  return shiftWeek(week, 0);
}

function cleanNumber(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error("Valor inválido");
  return value;
}

async function requireTeamCareer(careerId: number) {
  const session = await requireSession();
  const career = await getCareer(careerId);
  if (!career || career.team_id !== session.teamId) {
    throw new Error("Carrera no encontrada");
  }
  return { session, career };
}

async function ownerFrom(raw: FormDataEntryValue | null, teamId: number): Promise<number | null> {
  if (!raw || raw === "none") return null;
  const id = Number(raw);
  return (await isUserInTeam(id, teamId)) ? id : null;
}

function levelFrom(raw: FormDataEntryValue | null): CareerLevel {
  const level = String(raw ?? "") as CareerLevel;
  return CAREER_LEVELS.includes(level) ? level : "Pregrado";
}

// --- Datos semanales (edición manual) --------------------------------------

export async function setLeadsAction(careerId: number, week: string, value: number | null) {
  const { session } = await requireTeamCareer(careerId);
  await setWeeklyLeads({
    careerId,
    weekStart: normalizeWeek(week),
    leads: value === null ? null : Math.round(cleanNumber(value)!),
    source: "manual",
    userId: session.userId,
  });
  refresh();
}

export async function setBudgetAction(careerId: number, week: string, value: number | null) {
  const { session } = await requireTeamCareer(careerId);
  await setWeeklyBudget({
    careerId,
    weekStart: normalizeWeek(week),
    spent: cleanNumber(value),
    source: "manual",
    userId: session.userId,
  });
  refresh();
}

export async function setGoalAction(careerId: number, field: "leads" | "budget", value: number) {
  await requireTeamCareer(careerId);
  await setCareerGoal(careerId, field, cleanNumber(value) ?? 0);
  refresh();
}

export async function setOwnerAction(careerId: number, ownerId: number | null) {
  const { session } = await requireTeamCareer(careerId);
  if (ownerId !== null && !(await isUserInTeam(ownerId, session.teamId))) return;
  await setCareerOwner(careerId, ownerId);
  refresh();
}

// --- Catálogo de carreras ---------------------------------------------------

export async function createCareerAction(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const program = String(formData.get("program") ?? "").trim().toUpperCase();
  if (!name || !program) return;
  await createCareer({
    teamId: session.teamId,
    program,
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name,
    level: levelFrom(formData.get("level")),
    ownerId: await ownerFrom(formData.get("ownerId"), session.teamId),
    leadsGoal: Math.max(0, Number(formData.get("leadsGoal")) || 0),
    budgetGoal: Math.max(0, Number(formData.get("budgetGoal")) || 0),
  });
  refresh();
}

export async function updateCareerAction(careerId: number, formData: FormData) {
  const { session } = await requireTeamCareer(careerId);
  const name = String(formData.get("name") ?? "").trim();
  const program = String(formData.get("program") ?? "").trim().toUpperCase();
  if (!name || !program) return;
  await updateCareer(careerId, {
    program,
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name,
    level: levelFrom(formData.get("level")),
    ownerId: await ownerFrom(formData.get("ownerId"), session.teamId),
  });
  refresh();
}

export async function archiveCareerAction(careerId: number) {
  await requireTeamCareer(careerId);
  await archiveCareer(careerId);
  refresh();
}

// --- Importador de consumo (CSV de Meta) -----------------------------------

export type BudgetImportPayload = {
  week: string;
  mode: "replace" | "add";
  fileName: string;
  rows: { careerId: number; amount: number }[];
  /** Asignaciones hechas a mano en la vista previa, para recordarlas. */
  aliases: { text: string; careerId: number }[];
};

export async function importBudgetAction(payload: BudgetImportPayload): Promise<ActionResult> {
  const session = await requireSession();
  const weekStart = normalizeWeek(payload.week);
  const teamCareers = new Set((await listCareers(session.teamId)).map((c) => c.id));

  const totals = new Map<number, number>();
  for (const row of payload.rows) {
    if (!teamCareers.has(row.careerId)) continue;
    if (!Number.isFinite(row.amount)) continue;
    totals.set(row.careerId, (totals.get(row.careerId) ?? 0) + row.amount);
  }
  if (totals.size === 0) {
    return { ok: false, message: "No hay filas asignadas a una carrera para importar." };
  }

  let total = 0;
  for (const [careerId, amount] of totals) {
    const rounded = Math.round(amount * 100) / 100;
    total += rounded;
    if (payload.mode === "add") {
      await addWeeklyBudget({ careerId, weekStart, amount: rounded, userId: session.userId });
    } else {
      await setWeeklyBudget({ careerId, weekStart, spent: rounded, source: "csv", userId: session.userId });
    }
  }

  for (const a of payload.aliases) {
    const key = aliasKey(a.text);
    if (key && teamCareers.has(a.careerId)) await saveAlias(session.teamId, key, a.careerId);
  }

  await logImport({
    teamId: session.teamId,
    kind: "budget_csv",
    weekStart,
    fileName: payload.fileName.slice(0, 200) || null,
    careersUpdated: totals.size,
    total,
    userId: session.userId,
  });
  refresh();
  return {
    ok: true,
    message: `Consumo actualizado en ${totals.size} carrera(s) para la semana del ${weekStart}.`,
  };
}

// --- ActiveCampaign (preparado, sin conectar) -------------------------------

export async function syncActiveCampaignAction(week: string): Promise<ActionResult> {
  const session = await requireSession();
  const weekStart = normalizeWeek(week);
  const weekEnd = shiftWeek(weekStart, 1);

  try {
    const { leadsByCode } = await fetchWeeklyLeadsByCareer(weekStart, weekEnd);
    const careers = await listCareers(session.teamId);
    const byCode = new Map(careers.filter((c) => c.code).map((c) => [c.code.toUpperCase(), c.id]));

    let updated = 0;
    let total = 0;
    for (const [code, leads] of Object.entries(leadsByCode)) {
      const careerId = byCode.get(code.toUpperCase());
      if (!careerId) continue;
      await setWeeklyLeads({ careerId, weekStart, leads, source: "activecampaign", userId: session.userId });
      updated++;
      total += leads;
    }
    await logImport({
      teamId: session.teamId,
      kind: "activecampaign",
      weekStart,
      fileName: null,
      careersUpdated: updated,
      total,
      userId: session.userId,
    });
    refresh();
    return { ok: true, message: `Leads actualizados desde ActiveCampaign en ${updated} carrera(s).` };
  } catch (err) {
    if (err instanceof ActiveCampaignNotConfiguredError) {
      return { ok: false, message: err.message };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo actualizar desde ActiveCampaign.",
    };
  }
}
