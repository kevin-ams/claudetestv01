"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, createSessionCookie } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { createDemoTeam, deleteDemoFor, getDemoTeamFor, realTeamFor } from "@/lib/domain/demo";

/** Crea (o recrea) la demo y cambia la vista de esta persona a ella. */
export async function startDemoAction() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Solo un administrador puede activar la demo.");
  const real = await realTeamFor(session.userId);
  const team = real ?? (await getTeam(session.teamId));
  const demoId = await createDemoTeam(session.userId, team?.name ?? "Marketing");
  await createSessionCookie({ ...session, teamId: demoId });
  revalidatePath("/", "layout");
  redirect("/");
}

/** Vuelve a la demo ya creada (sin regenerarla). */
export async function enterDemoAction() {
  const session = await requireSession();
  const demo = await getDemoTeamFor(session.userId);
  if (!demo) redirect("/ajustes/demo");
  await createSessionCookie({ ...session, teamId: demo.id });
  revalidatePath("/", "layout");
  redirect("/");
}

/** Desactiva la demo: regresa al equipo real y borra todos los datos demo. */
export async function stopDemoAction() {
  const session = await requireSession();
  const real = await realTeamFor(session.userId);
  if (real) await createSessionCookie({ ...session, teamId: real.id });
  await deleteDemoFor(session.userId);
  revalidatePath("/", "layout");
  redirect("/ajustes/demo");
}
