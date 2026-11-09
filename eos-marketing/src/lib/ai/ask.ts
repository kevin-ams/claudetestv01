import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Access } from "@/lib/auth/access";
import { cachedAnswer, checkBudget, recordUsage, storeAnswer } from "@/lib/domain/ai-usage";
import { getTeam } from "@/lib/domain/teams";
import { runAssistant, type AnthropicLike, type AssistantEvent, type ChatTurn } from "./assistant";

/** Eventos que recibe la pantalla (una línea JSON cada uno). */
export type AskEvent =
  | AssistantEvent
  | { type: "done"; cached: boolean; costUsd: number }
  | { type: "error"; code: string; message: string };

export const askInput = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(12)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", "La conversación debe empezar y terminar con una pregunta."),
});

/** Misma primera pregunta, mismo equipo, mismo rol y mismo modelo → misma respuesta (por 30 min). */
function cacheKey(teamId: number, roleId: number | null, model: string, question: string) {
  const q = question.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${teamId}|${roleId ?? "-"}|${model}|${q}`).digest("hex");
}

let sharedClient: Anthropic | null = null;
const defaultClient = (): AnthropicLike => (sharedClient ??= new Anthropic({ timeout: 55_000, maxRetries: 1 }));

/**
 * Una pregunta al asistente: revisa topes, usa la caché si aplica, consulta a Claude con las herramientas de EOS y
 * registra el consumo. Nunca lanza: los problemas llegan como evento `error`.
 */
export async function ask(opts: {
  access: Access;
  history: ChatTurn[];
  emit: (e: AskEvent) => void;
  signal?: AbortSignal;
  client?: AnthropicLike;
}): Promise<void> {
  const { access, history, emit } = opts;
  const { teamId, userId } = access.session;
  const budget = await checkBudget(teamId, userId);
  if (!budget.ok) {
    emit({ type: "error", code: budget.reason, message: budget.message });
    return;
  }
  const { settings } = budget;
  const base = { organizationId: settings.organizationId, teamId, userId };

  const key = history.length === 1 ? cacheKey(teamId, access.roleId, settings.model, history[0].content) : null;
  if (key) {
    const hit = await cachedAnswer(key, teamId);
    if (hit) {
      for (const label of hit.steps) emit({ type: "step", label });
      emit({ type: "text", delta: hit.answer });
      await recordUsage({ ...base, model: settings.model, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, toolCalls: 0, cached: true });
      emit({ type: "done", cached: true, costUsd: 0 });
      return;
    }
  }

  const team = await getTeam(teamId);
  try {
    const r = await runAssistant({
      client: opts.client ?? defaultClient(),
      model: settings.model,
      access,
      teamName: team?.name ?? "—",
      history,
      onEvent: emit,
      signal: opts.signal,
    });
    const cost = await recordUsage({ ...base, model: settings.model, usage: r.usage, toolCalls: r.toolCalls, ok: !r.refused });
    if (key && !r.refused) await storeAnswer(key, teamId, r.answer, r.steps);
    emit({ type: "done", cached: false, costUsd: cost });
  } catch (e) {
    emit({ type: "error", ...describe(e) });
  }
}

function describe(e: unknown): { code: string; message: string } {
  if (e instanceof Anthropic.APIUserAbortError) return { code: "cancelled", message: "Se detuvo la respuesta." };
  if (e instanceof Anthropic.AuthenticationError) return { code: "auth", message: "La clave de la API de Anthropic no es válida. Revisa ANTHROPIC_API_KEY en Netlify." };
  if (e instanceof Anthropic.RateLimitError) return { code: "rate_limited", message: "Hay muchas preguntas a la vez. Intenta en un minuto." };
  if (e instanceof Anthropic.APIConnectionTimeoutError) return { code: "timeout", message: "La respuesta tardó demasiado. Prueba con una pregunta más concreta." };
  if (e instanceof Anthropic.APIError) {
    console.error("[asistente] API", e.status, e.message);
    return { code: "api", message: "El servicio de IA no respondió. Intenta de nuevo en unos minutos." };
  }
  console.error("[asistente]", e);
  return { code: "internal", message: "No se pudo completar la respuesta. Intenta de nuevo." };
}
