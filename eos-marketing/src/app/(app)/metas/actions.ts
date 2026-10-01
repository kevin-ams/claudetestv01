"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { copyMonthlyGoals, getCareer, setMonthlyGoal } from "@/lib/domain/careers";

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
