"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/access";
import { isPlatformOwner } from "@/lib/auth/platform";
import { logActivity } from "@/lib/domain/activity";
import { AI_MODELS, getAiSettings, isAiModel, setAiSettings } from "@/lib/domain/ai-usage";
import { parse, safeAction, type ActionResult } from "@/lib/actions";
import { recordSecurityEvent } from "@/lib/security/events";

const settingsForm = z.object({
  monthlyCapUsd: z.coerce.number().min(0, "El tope no puede ser negativo.").max(500, "El tope máximo es $500 al mes."),
  userDailyLimit: z.coerce.number().int().min(0).max(500, "El límite máximo es 500 preguntas al día."),
  model: z.string().refine(isAiModel, "Modelo no válido."),
});

/** Tope, límite por persona y modelo: solo el dueño de la plataforma (es dinero de su cuenta de Anthropic). */
export async function saveAiSettingsAction(input: { monthlyCapUsd: number; userDailyLimit: number; model: string }): Promise<ActionResult> {
  return safeAction("asistente", "No se pudo guardar.", async () => {
    const session = await requireAdmin();
    if (!(await isPlatformOwner(session.userId))) {
      return { ok: false, message: "Solo el dueño de la plataforma puede cambiar el tope y el modelo del asistente." };
    }
    const form = parse(settingsForm, input);
    const current = await getAiSettings(session.teamId);
    if (!current) return { ok: false, message: "Este equipo no pertenece a una organización." };
    const model = form.model as keyof typeof AI_MODELS;
    await setAiSettings(current.organizationId, { monthlyCapUsd: form.monthlyCapUsd, userDailyLimit: form.userDailyLimit, model });
    await logActivity(
      session,
      "ajustes",
      "Cambió los topes del asistente IA",
      `Tope $${form.monthlyCapUsd}/mes · ${form.userDailyLimit} preguntas por persona en 24 h · ${AI_MODELS[model].label}`,
    );
    await recordSecurityEvent({
      type: "ai_settings_changed",
      userId: session.userId,
      teamId: session.teamId,
      email: session.email,
      detail: `USD ${form.monthlyCapUsd}/mes · ${form.userDailyLimit}/24 h · ${model}`,
    });
    revalidatePath("/ajustes/asistente");
    revalidatePath("/asistente");
    return { ok: true, message: "Guardado." };
  });
}
