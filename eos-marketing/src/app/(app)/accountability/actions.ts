"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
import { canReportTo, createSeat, deleteSeat, moveSeat, orgPeople, updateSeat } from "@/lib/domain/accountability";

export type SeatInput = { title: string; people: number[]; roles: string[]; parentSeatId: number | null };
type Result = { ok: boolean; message: string };

function clean(input: SeatInput) {
  return {
    title: String(input.title ?? "").trim().slice(0, 120),
    roles: (Array.isArray(input.roles) ? input.roles : []).map((r) => String(r).trim().slice(0, 200)).filter(Boolean).slice(0, 15),
    parentSeatId: Number(input.parentSeatId) > 0 ? Number(input.parentSeatId) : null,
  };
}

const fail = (e: unknown, fallback: string): Result => {
  console.error("[organigrama]", e);
  return { ok: false, message: e instanceof Error && e.name === "AccessDeniedError" ? e.message : fallback };
};

export async function createSeatAction(input: SeatInput): Promise<Result> {
  try {
    const session = await requireModule("accountability");
    const c = clean(input);
    if (!c.title) return { ok: false, message: "Escribe el nombre del puesto (la función)." };
    if (!(await canReportTo(session.teamId, null, c.parentSeatId))) return { ok: false, message: "Puesto superior inválido." };
    await createSeat({ teamId: session.teamId, ...c, people: await orgPeople(session.teamId, input.people ?? []) });
    await logActivity(session, "accountability", "Agregó puesto al organigrama", c.title);
    revalidatePath("/accountability");
    return { ok: true, message: "Puesto agregado." };
  } catch (e) {
    return fail(e, "No se pudo agregar el puesto.");
  }
}

export async function updateSeatAction(seatId: number, input: SeatInput): Promise<Result> {
  try {
    const session = await requireModule("accountability");
    const c = clean(input);
    if (!c.title) return { ok: false, message: "Escribe el nombre del puesto (la función)." };
    if (!(await canReportTo(session.teamId, seatId, c.parentSeatId))) {
      return { ok: false, message: "Un puesto no puede reportar a sí mismo ni a un puesto que depende de él." };
    }
    const ok = await updateSeat(session.teamId, seatId, { ...c, people: await orgPeople(session.teamId, input.people ?? []) });
    if (!ok) return { ok: false, message: "Puesto no encontrado." };
    await logActivity(session, "accountability", "Editó puesto del organigrama", c.title);
    revalidatePath("/accountability");
    return { ok: true, message: "Guardado." };
  } catch (e) {
    return fail(e, "No se pudo guardar el puesto.");
  }
}

export async function moveSeatAction(seatId: number, direction: "left" | "right"): Promise<Result> {
  try {
    const session = await requireModule("accountability");
    await moveSeat(session.teamId, seatId, direction === "left" ? "left" : "right");
    revalidatePath("/accountability");
    return { ok: true, message: "" };
  } catch (e) {
    return fail(e, "No se pudo mover el puesto.");
  }
}

export async function deleteSeatAction(seatId: number): Promise<Result> {
  try {
    const session = await requireModule("accountability");
    const label = await labelOf("accountability_seats", seatId);
    await deleteSeat(session.teamId, seatId);
    await logActivity(session, "accountability", "Eliminó puesto del organigrama", label);
    revalidatePath("/accountability");
    return { ok: true, message: "Puesto eliminado." };
  } catch (e) {
    return fail(e, "No se pudo eliminar el puesto.");
  }
}
