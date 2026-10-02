"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
import {
  getCareer,
  listCareers,
  createCareer,
  updateCareer,
  archiveCareer,
  setCareerOwner,
  setWeeklyLeads,
  setWeeklyBudget,
  addWeeklyBudget,
  saveAlias,
  logImport,
} from "@/lib/domain/careers";
import { aliasKey, CAREER_LEVELS } from "@/lib/domain/careers-shared";
import { isUserInTeam } from "@/lib/domain/users";
import { seedMarketingTeam } from "@/lib/domain/marketing-seed";
import {
  isActiveCampaignConfigured,
  ActiveCampaignNotConfiguredError,
} from "@/lib/integrations/activecampaign";
import { finishSync, syncChunk } from "@/lib/domain/ac-sync";
import { shiftWeek } from "@/lib/utils/dates";
import type { CareerLevel } from "@/lib/domain/types";

export type ActionResult = { ok: boolean; message: string };

function refresh() {
  revalidatePath("/indicadores");
  revalidatePath("/metas");
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
  const session = await requireModule("indicadores");
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
  await logActivity(session, "indicadores", "Cambió leads de la semana", `${await labelOf("careers", careerId)} · semana ${week}: ${value ?? "vacío"}`);
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
  await logActivity(session, "indicadores", "Cambió consumo de la semana", `${await labelOf("careers", careerId)} · semana ${week}: ${value ?? "vacío"}`);
  refresh();
}

export async function setOwnerAction(careerId: number, ownerId: number | null) {
  const { session } = await requireTeamCareer(careerId);
  if (ownerId !== null && !(await isUserInTeam(ownerId, session.teamId))) return;
  await setCareerOwner(careerId, ownerId);
  await logActivity(session, "indicadores", "Cambió responsable de carrera", await labelOf("careers", careerId));
  refresh();
}

// --- Catálogo de carreras ---------------------------------------------------

export async function createCareerAction(formData: FormData) {
  const session = await requireModule("indicadores");
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
  });
  await logActivity(session, "indicadores", "Agregó carrera", name);
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
  await logActivity(session, "indicadores", "Editó carrera", name);
  refresh();
}

export async function archiveCareerAction(careerId: number) {
  const { session } = await requireTeamCareer(careerId);
  await archiveCareer(careerId);
  await logActivity(session, "indicadores", "Archivó carrera", await labelOf("careers", careerId));
  refresh();
}

export async function loadCareerCatalogAction(): Promise<ActionResult> {
  const session = await requireModule("indicadores");
  const { careers } = await seedMarketingTeam(session.teamId);
  refresh();
  revalidatePath("/rocks");
  revalidatePath("/ajustes/equipo");
  return careers > 0
    ? { ok: true, message: `Se cargaron ${careers} carreras con su responsable.` }
    : { ok: false, message: "El equipo ya tenía carreras; no se cargó nada." };
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
  const session = await requireModule("indicadores");
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
  await logActivity(session, "indicadores", "Importó consumo (CSV de Meta)", `Semana ${payload.week} · ${payload.rows.length} fila(s) · ${payload.fileName}`);
  refresh();
  return {
    ok: true,
    message: `Consumo actualizado en ${totals.size} carrera(s) para la semana del ${weekStart}.`,
  };
}

// --- ActiveCampaign -----------------------------------------------------------

export type SyncStep = { ok: boolean; done: boolean; next: number; total: number; message: string };

/**
 * Sincroniza los leads de la semana desde ActiveCampaign en tandas de etapas
 * (la pantalla llama de nuevo con `offset = next` hasta que `done`). Solo escribe la
 * semana indicada; las semanas anteriores no cambian.
 */
export async function syncLeadsStepAction(week: string, offset: number): Promise<SyncStep> {
  const session = await requireModule("indicadores");
  const weekStart = normalizeWeek(week);
  if (!isActiveCampaignConfigured()) {
    return { ok: false, done: true, next: 0, total: 0, message: new ActiveCampaignNotConfiguredError().message };
  }
  try {
    const r = await syncChunk({ teamId: session.teamId, weekStart, offset, size: 4, userId: session.userId });
    if (r.totalStages === 0) {
      return { ok: false, done: true, next: 0, total: 0, message: "Ninguna carrera está vinculada a ActiveCampaign. Vincúlalas en Ajustes › Leads desde ActiveCampaign." };
    }
    if (!r.done) return { ok: true, done: false, next: r.next, total: r.totalStages, message: r.errors.join(" · ") };
    const [team] = await finishSync({ teamId: session.teamId, weekStart, userId: session.userId, auto: false });
    await logActivity(session, "indicadores", "Sincronizó leads desde ActiveCampaign", team ? `${team.ok} carrera(s) · ${team.total} lead(s) · semana ${weekStart}` : weekStart);
    refresh();
    revalidatePath("/ajustes/activecampaign");
    return {
      ok: !team?.failed,
      done: true,
      next: r.next,
      total: r.totalStages,
      message: team
        ? `Leads actualizados desde ActiveCampaign: ${team.ok} carrera(s), ${team.total} lead(s) en la semana del ${weekStart}.` +
          (team.failed ? ` ${team.failed} carrera(s) con error: revisa Ajustes › Leads desde ActiveCampaign.` : "")
        : "Sin cambios.",
    };
  } catch (err) {
    return { ok: false, done: true, next: offset, total: 0, message: err instanceof Error ? err.message : "No se pudo actualizar desde ActiveCampaign." };
  }
}
