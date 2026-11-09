"use server";

import { z } from "zod";
import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { formObject, parse, zCheckbox, zId, zOptDate, zOwner, zText, zTitle } from "@/lib/actions";
import {
  addMilestone,
  createRock,
  deleteMilestone,
  deleteRock,
  getMilestone,
  getRock,
  setMilestoneDueDate,
  toggleMilestone,
  updateRock,
  updateRockStatus,
} from "@/lib/domain/rocks";
import type { RockStatus } from "@/lib/domain/types";

// Cada acción: permiso → validar → dominio con el equipo de la sesión (los ids de otro equipo no hacen nada).

const rockForm = z.object({
  title: zTitle(200),
  description: zText(5000),
  ownerId: zOwner,
  isCompanyRock: zCheckbox,
  dueDate: zOptDate,
});
const STATUS_LABEL: Record<RockStatus, string> = { on_track: "On track", off_track: "Off track", done: "Completado" };

export async function createRockAction(formData: FormData) {
  const session = await requireModule("rocks");
  const input = parse(rockForm.extend({ quarter: z.coerce.number().int().min(1).max(4), year: z.coerce.number().int().min(2000).max(2100) }), formObject(formData));
  await createRock({ teamId: session.teamId, ...input });
  await logActivity(session, "rocks", "Creó Rock", input.title);
  revalidatePath("/rocks");
}

export async function updateRockStatusAction(rockId: number, status: RockStatus) {
  const session = await requireModule("rocks");
  const st = parse(z.enum(["on_track", "off_track", "done"]), status);
  const rock = await getRock(session.teamId, parse(zId, rockId));
  if (!rock) return;
  await updateRockStatus(session.teamId, rock.id, st);
  await logActivity(session, "rocks", "Cambió estado de Rock", `${rock.title}: ${STATUS_LABEL[st]}`);
  revalidatePath("/rocks");
}

export async function updateRockAction(rockId: number, formData: FormData) {
  const session = await requireModule("rocks");
  const rock = await getRock(session.teamId, parse(zId, rockId));
  if (!rock) return;
  const input = parse(rockForm, formObject(formData));
  await updateRock(session.teamId, rock.id, input);
  await logActivity(session, "rocks", "Editó Rock", input.title);
  revalidatePath("/rocks");
}

export async function deleteRockAction(rockId: number) {
  const session = await requireModule("rocks");
  const rock = await getRock(session.teamId, parse(zId, rockId));
  if (!rock) return;
  await deleteRock(session.teamId, rock.id);
  await logActivity(session, "rocks", "Eliminó Rock", rock.title);
  revalidatePath("/rocks");
}

export async function addMilestoneAction(rockId: number, title: string, dueDate: string | null) {
  const session = await requireModule("rocks");
  const rock = await getRock(session.teamId, parse(zId, rockId));
  if (!rock) return;
  const t = parse(zTitle(200), title);
  await addMilestone({ rockId: rock.id, title: t, dueDate: parse(zOptDate, dueDate), sortOrder: 0 });
  await logActivity(session, "rocks", "Agregó hito de Rock", `${t} (Rock: ${rock.title})`);
  revalidatePath("/rocks");
}

export async function toggleMilestoneAction(milestoneId: number, done: boolean) {
  const session = await requireModule("rocks");
  const m = await getMilestone(session.teamId, parse(zId, milestoneId));
  if (!m) return;
  await toggleMilestone(session.teamId, m.id, Boolean(done));
  await logActivity(session, "rocks", "Marcó hito de Rock", `${m.title}: ${done ? "hecho" : "pendiente"}`);
  revalidatePath("/rocks");
}

export async function setMilestoneDueDateAction(milestoneId: number, dueDate: string | null) {
  const session = await requireModule("rocks");
  const m = await getMilestone(session.teamId, parse(zId, milestoneId));
  if (!m) return;
  const d = parse(zOptDate, dueDate);
  await setMilestoneDueDate(session.teamId, m.id, d);
  await logActivity(session, "rocks", "Cambió fecha de hito de Rock", `${m.title}: ${d ?? "sin fecha"}`);
  revalidatePath("/rocks");
}

export async function deleteMilestoneAction(milestoneId: number) {
  const session = await requireModule("rocks");
  const m = await getMilestone(session.teamId, parse(zId, milestoneId));
  if (!m) return;
  await deleteMilestone(session.teamId, m.id);
  await logActivity(session, "rocks", "Eliminó hito de Rock", m.title);
  revalidatePath("/rocks");
}
