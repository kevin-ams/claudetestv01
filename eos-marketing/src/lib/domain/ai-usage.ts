import "server-only";
import { db } from "@/lib/db";
import { getOrganization } from "./teams";

/** Modelos que se pueden elegir y su precio (USD por millón de tokens, tarifa de la API de Anthropic). */
export const AI_MODELS = {
  "claude-opus-5-5": { label: "Claude Opus 5.5 (el más capaz)", input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { label: "Claude Sonnet 5.5 (equilibrado)", input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { label: "Claude Haiku 5.5 (el más económico)", input: 0.1, output: 0.5, cacheRead: 0.01 },
} as const;
export type AiModel = keyof typeof AI_MODELS;
export const DEFAULT_AI_MODEL: AiModel = "claude-opus-5-5";
export const isAiModel = (m: unknown): m is AiModel => typeof m === "string" && m in AI_MODELS;

export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** Costo en USD de un consumo (escribir en la caché de prompts cuesta 1.25 × la entrada). */
export function costUsd(model: string, u: TokenUsage): number {
  const p = isAiModel(model) ? AI_MODELS[model] : AI_MODELS[DEFAULT_AI_MODEL];
  const usd = (u.input * p.input + u.cacheWrite * p.input * 1.25 + u.cacheRead * p.cacheRead + u.output * p.output) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Tope mensual de toda la plataforma (todas las organizaciones), en USD. Variable AI_GLOBAL_MONTHLY_CAP_USD (por omisión 20). */
export function globalMonthlyCap(): number {
  const v = Number(process.env.AI_GLOBAL_MONTHLY_CAP_USD);
  return Number.isFinite(v) && v > 0 ? v : 20;
}

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

export type AiSettings = { organizationId: number; monthlyCapUsd: number; userDailyLimit: number; model: AiModel };

export async function getAiSettings(teamId: number): Promise<AiSettings | null> {
  const org = await getOrganization(teamId);
  if (!org) return null;
  const rows = (await db().sql`
    SELECT ai_monthly_cap_usd, ai_user_daily_limit, ai_model FROM organizations WHERE id = ${org.id}
  `) as { ai_monthly_cap_usd: number; ai_user_daily_limit: number; ai_model: string }[];
  const r = rows[0];
  return {
    organizationId: org.id,
    monthlyCapUsd: Number(r?.ai_monthly_cap_usd ?? 5),
    userDailyLimit: Number(r?.ai_user_daily_limit ?? 20),
    model: isAiModel(r?.ai_model) ? r.ai_model : DEFAULT_AI_MODEL,
  };
}

export async function setAiSettings(organizationId: number, s: { monthlyCapUsd: number; userDailyLimit: number; model: AiModel }) {
  await db().sql`
    UPDATE organizations SET ai_monthly_cap_usd = ${s.monthlyCapUsd}, ai_user_daily_limit = ${s.userDailyLimit}, ai_model = ${s.model}
    WHERE id = ${organizationId}
  `;
}

const total = (rows: Record<string, unknown>[]) => Number(rows[0]?.usd ?? 0);

/** Gasto del mes en curso (UTC) de una organización. */
export async function monthSpend(organizationId: number): Promise<number> {
  return total(await db().sql`
    SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_usage
    WHERE organization_id = ${organizationId} AND created_at >= date_trunc('month', NOW())
  `);
}

export async function globalMonthSpend(): Promise<number> {
  return total(await db().sql`SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_usage WHERE created_at >= date_trunc('month', NOW())`);
}

/** Preguntas de la persona en las últimas 24 h (las respondidas desde la caché no cuentan). */
export async function userQuestionsLast24h(userId: number): Promise<number> {
  const rows = (await db().sql`
    SELECT count(*)::int AS n FROM ai_usage WHERE user_id = ${userId} AND NOT cached AND created_at > NOW() - INTERVAL '24 hours'
  `) as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}

export type BudgetCheck =
  | { ok: true; settings: AiSettings; spent: number }
  | { ok: false; reason: "not_configured" | "org_cap" | "global_cap" | "user_limit" | "no_org"; message: string };

/** ¿Puede esta persona hacer otra pregunta? Revisa la clave, el tope de la organización, el tope global y el límite diario. */
export async function checkBudget(teamId: number, userId: number): Promise<BudgetCheck> {
  if (!aiConfigured()) {
    return { ok: false, reason: "not_configured", message: "El asistente aún no está activado: falta la clave de la API de Anthropic en Netlify." };
  }
  const settings = await getAiSettings(teamId);
  if (!settings) return { ok: false, reason: "no_org", message: "Este equipo no pertenece a una organización." };
  const [spent, global, today] = await Promise.all([monthSpend(settings.organizationId), globalMonthSpend(), userQuestionsLast24h(userId)]);
  if (spent >= settings.monthlyCapUsd) {
    return { ok: false, reason: "org_cap", message: `Se alcanzó el tope mensual del asistente (${usd(settings.monthlyCapUsd)}). Se renueva el día 1.` };
  }
  if (global >= globalMonthlyCap()) {
    return { ok: false, reason: "global_cap", message: "El asistente llegó al tope mensual de la plataforma. Se renueva el día 1." };
  }
  if (today >= settings.userDailyLimit) {
    return { ok: false, reason: "user_limit", message: `Llegaste a tu límite de ${settings.userDailyLimit} preguntas en 24 horas. Intenta más tarde.` };
  }
  return { ok: true, settings, spent };
}

export async function recordUsage(input: {
  organizationId: number;
  teamId: number;
  userId: number;
  model: string;
  usage: TokenUsage;
  toolCalls: number;
  cached?: boolean;
  ok?: boolean;
}): Promise<number> {
  const cost = input.cached ? 0 : costUsd(input.model, input.usage);
  await db().sql`
    INSERT INTO ai_usage (organization_id, team_id, user_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, tool_calls, cost_usd, cached, ok)
    VALUES (${input.organizationId}, ${input.teamId}, ${input.userId}, ${input.model}, ${input.usage.input}, ${input.usage.output},
      ${input.usage.cacheRead}, ${input.usage.cacheWrite}, ${input.toolCalls}, ${cost}, ${input.cached ?? false}, ${input.ok ?? true})
  `;
  return cost;
}

// --- Caché de respuestas (primera pregunta de una conversación) ------------------------------

const CACHE_MINUTES = 30;

export async function cachedAnswer(key: string, teamId: number): Promise<{ answer: string; steps: string[] } | null> {
  const rows = (await db().sql`
    SELECT answer, steps FROM ai_answer_cache
    WHERE key = ${key} AND team_id = ${teamId} AND created_at > NOW() - make_interval(mins => ${CACHE_MINUTES})
  `) as { answer: string; steps: unknown }[];
  if (!rows[0]) return null;
  const steps = Array.isArray(rows[0].steps) ? rows[0].steps.map(String) : [];
  return { answer: rows[0].answer, steps };
}

export async function storeAnswer(key: string, teamId: number, answer: string, steps: string[]) {
  await db().sql`
    INSERT INTO ai_answer_cache (key, team_id, answer, steps) VALUES (${key}, ${teamId}, ${answer}, ${JSON.stringify(steps)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET answer = EXCLUDED.answer, steps = EXCLUDED.steps, created_at = NOW()
  `;
  // Limpieza de entradas viejas (solo caché).
  await db().sql`DELETE FROM ai_answer_cache WHERE created_at < NOW() - INTERVAL '1 day'`;
}

// --- Panel de uso -------------------------------------------------------------------------------

export type UsageSummary = {
  spent: number;
  cap: number;
  questions: number;
  cachedAnswers: number;
  byUser: { userId: number | null; name: string; questions: number; cost: number }[];
  byDay: { day: string; questions: number; cost: number }[];
};

export async function usageSummary(organizationId: number, cap: number): Promise<UsageSummary> {
  const [totals, byUser, byDay] = await Promise.all([
    db().sql`
      SELECT COALESCE(SUM(cost_usd), 0) AS usd, (count(*) FILTER (WHERE NOT cached))::int AS q, (count(*) FILTER (WHERE cached))::int AS c
      FROM ai_usage WHERE organization_id = ${organizationId} AND created_at >= date_trunc('month', NOW())
    `,
    db().sql`
      SELECT a.user_id, COALESCE(u.name, 'Persona eliminada') AS name, count(*)::int AS q, COALESCE(SUM(a.cost_usd), 0) AS usd
      FROM ai_usage a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.organization_id = ${organizationId} AND a.created_at >= date_trunc('month', NOW())
      GROUP BY a.user_id, u.name ORDER BY usd DESC
    `,
    db().sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS q, COALESCE(SUM(cost_usd), 0) AS usd
      FROM ai_usage WHERE organization_id = ${organizationId} AND created_at >= date_trunc('month', NOW())
      GROUP BY 1 ORDER BY 1
    `,
  ]);
  const t = totals[0] as { usd: number; q: number; c: number } | undefined;
  return {
    spent: Number(t?.usd ?? 0),
    cap,
    questions: Number(t?.q ?? 0),
    cachedAnswers: Number(t?.c ?? 0),
    byUser: (byUser as { user_id: number | null; name: string; q: number; usd: number }[]).map((r) => ({
      userId: r.user_id,
      name: r.name,
      questions: Number(r.q),
      cost: Number(r.usd),
    })),
    byDay: (byDay as { day: string; q: number; usd: number }[]).map((r) => ({ day: r.day, questions: Number(r.q), cost: Number(r.usd) })),
  };
}

export const usd = (n: number) => (n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
