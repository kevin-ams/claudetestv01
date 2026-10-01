"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { logActivity } from "@/lib/domain/activity";
import {
  createCoverage,
  deleteCoverage,
  getCoverage,
  updateCoverage,
  type CoverageInput,
} from "@/lib/domain/editorial";
import { isUserInTeam } from "@/lib/domain/users";

export type ActionResult = { ok: boolean; message: string };

// "-" es el valor de "ninguno" en los desplegables.
const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "-" ? "" : v;
};
const TIME = /^\d{2}:\d{2}$/;

function hours(fd: FormData, k: string): number | null | "error" {
  const raw = str(fd, k).replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 200 ? n : "error";
}

async function readCoverage(fd: FormData, teamId: number): Promise<CoverageInput | string> {
  const title = str(fd, "title");
  if (!title) return "Escribe el evento o cobertura.";
  const date = str(fd, "date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Fecha inválida.";
  const start = str(fd, "start_time");
  const end = str(fd, "end_time");
  if ((start && !TIME.test(start)) || (end && !TIME.test(end))) return "Hora inválida.";
  const real = hours(fd, "real_hours");
  const over = hours(fd, "overtime_hours");
  const replaced = hours(fd, "replaced_hours");
  if (real === "error" || over === "error" || replaced === "error") return "Las horas deben ser un número (p. ej. 2.5).";
  const assignee = Number(str(fd, "assignee_id")) || null;
  if (assignee && !(await isUserInTeam(assignee, teamId))) return "Esa persona no pertenece al equipo.";
  return {
    date: date || null,
    title,
    facultad: str(fd, "facultad"),
    start_time: start,
    end_time: end,
    assignee_id: assignee,
    tipo: str(fd, "tipo"),
    status: str(fd, "status") || "Agendada",
    paquete: str(fd, "paquete"),
    est_hours: str(fd, "est_hours"),
    real_hours: real,
    overtime_hours: over ?? 0,
    replaced_hours: replaced ?? 0,
    notes: str(fd, "notes"),
  };
}

export async function saveCoverageAction(id: number | null, fd: FormData): Promise<ActionResult> {
  const session = await requireModule("coberturas");
  const input = await readCoverage(fd, session.teamId);
  if (typeof input === "string") return { ok: false, message: input };
  if (id) {
    if (!(await getCoverage(session.teamId, id))) return { ok: false, message: "Cobertura no encontrada." };
    await updateCoverage(session.teamId, id, input);
    await logActivity(session, "coberturas", "Editó cobertura", `${input.date ?? "sin fecha"} · ${input.title}`);
  } else {
    await createCoverage(session.teamId, input);
    await logActivity(session, "coberturas", "Agregó cobertura", `${input.date ?? "sin fecha"} · ${input.title}`);
  }
  revalidatePath("/coberturas");
  return { ok: true, message: "Guardado." };
}

export async function setCoverageStatusAction(id: number, status: string) {
  const session = await requireModule("coberturas");
  const c = await getCoverage(session.teamId, id);
  if (!c || !status) return;
  await updateCoverage(session.teamId, id, { ...c, status });
  await logActivity(session, "coberturas", "Cambió estado de cobertura", `${c.title}: ${status}`);
  revalidatePath("/coberturas");
}

export async function deleteCoverageAction(id: number) {
  const session = await requireModule("coberturas");
  const c = await getCoverage(session.teamId, id);
  if (!c) return;
  await deleteCoverage(session.teamId, id);
  await logActivity(session, "coberturas", "Eliminó cobertura", `${c.date ?? "sin fecha"} · ${c.title}`);
  revalidatePath("/coberturas");
}
