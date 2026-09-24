"use server";

import { revalidatePath } from "next/cache";
import { requireSession, createSessionCookie } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import {
  createDemoTeam,
  deleteDemoFor,
  DEMO_STEPS,
  getDemoTeamFor,
  realTeamFor,
  runDemoStep,
} from "@/lib/domain/demo";

export type DemoResult = { ok: boolean; message: string };

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Ejecuta un paso de la demo. El cliente los llama en orden (0…n-1) para
 * mostrar el avance real; si uno falla, la demo a medias se borra.
 */
export async function demoStepAction(step: number): Promise<DemoResult> {
  const session = await requireSession();
  if (session.role !== "admin") {
    return { ok: false, message: "Solo un administrador puede activar la información demo." };
  }
  const label = DEMO_STEPS[step]?.label ?? `Paso ${step}`;
  try {
    if (step === 0) {
      const real = await realTeamFor(session.userId);
      const team = real ?? (await getTeam(session.teamId));
      await createDemoTeam(session.userId, team?.name ?? "Marketing");
    } else {
      const demo = await getDemoTeamFor(session.userId);
      if (!demo) return { ok: false, message: "La demo no existe (se borró a medio proceso). Inténtalo de nuevo." };
      await runDemoStep(demo.id, step);
    }
    return { ok: true, message: label };
  } catch (err) {
    console.error(`[demo] Falló el paso "${label}":`, err);
    await deleteDemoFor(session.userId).catch((e) => console.error("[demo] No se pudo limpiar:", e));
    return { ok: false, message: `Falló "${label}": ${errorText(err)}` };
  }
}

/** Último paso: cambia la vista de la persona al equipo demo. */
export async function enterDemoAction(): Promise<DemoResult> {
  const session = await requireSession();
  try {
    const demo = await getDemoTeamFor(session.userId);
    if (!demo) return { ok: false, message: "No hay una demo creada." };
    await createSessionCookie({ ...session, teamId: demo.id });
    revalidatePath("/", "layout");
    return { ok: true, message: "Demo lista." };
  } catch (err) {
    console.error("[demo] No se pudo entrar a la demo:", err);
    return { ok: false, message: `No se pudo abrir la demo: ${errorText(err)}` };
  }
}

/** Desactiva la demo: regresa al equipo real y borra todos los datos demo. */
export async function stopDemoAction(): Promise<DemoResult> {
  const session = await requireSession();
  try {
    const real = await realTeamFor(session.userId);
    if (real) await createSessionCookie({ ...session, teamId: real.id });
    await deleteDemoFor(session.userId);
    revalidatePath("/", "layout");
    return { ok: true, message: "Información demo desactivada. Volviste a tus datos reales." };
  } catch (err) {
    console.error("[demo] No se pudo desactivar:", err);
    return { ok: false, message: `No se pudo desactivar la demo: ${errorText(err)}` };
  }
}
