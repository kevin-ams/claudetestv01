/** Etapa 8: asistente IA con un cliente de Anthropic simulado (no gasta dinero ni usa red). */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { accessFor } from "@/lib/auth/access";
import { ask, type AskEvent } from "@/lib/ai/ask";
import type { AnthropicLike } from "@/lib/ai/assistant";
import { checkBudget, costUsd, getAiSettings, monthSpend, setAiSettings } from "@/lib/domain/ai-usage";
import { createNote, getVault } from "@/lib/domain/vault";
import { person, realTeam, demoOrg, ADMIN_ROLE } from "./helpers";

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type Script = { content: Block[]; stop_reason: "end_turn" | "tool_use" | "refusal" };

/** Cliente falso: responde según el guion y guarda lo que recibió en cada ronda. */
function fakeClient(script: Script[]) {
  const calls: { tools: { name: string }[]; messages: unknown[]; tool_choice: unknown; model: string }[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: { tools: { name: string }[]; messages: unknown[]; tool_choice: unknown; model: string }) {
          calls.push(JSON.parse(JSON.stringify(params)));
          const step = script[calls.length - 1] ?? { content: [{ type: "text", text: "fin" }], stop_reason: "end_turn" };
          const handlers: ((d: string) => void)[] = [];
          return {
            on(ev: string, fn: (d: string) => void) {
              if (ev === "text") handlers.push(fn);
              return this;
            },
            async finalMessage() {
              for (const b of step.content) if (b.type === "text") handlers.forEach((h) => h(b.text));
              return {
                model: params.model,
                content: step.content,
                stop_reason: step.stop_reason,
                usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500, cache_creation_input_tokens: 0 },
              };
            },
          };
        },
      },
    },
  } as unknown as AnthropicLike;
  return { client, calls };
}

async function run(access: NonNullable<Awaited<ReturnType<typeof accessFor>>>, question: string, client: AnthropicLike) {
  const events: AskEvent[] = [];
  await ask({ access, history: [{ role: "user", content: question }], emit: (e) => events.push(e), client });
  return events;
}
const text = (events: AskEvent[]) => events.flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("");

let team: number, premium: number, admin: number;

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-prueba";
  team = (await realTeam("Equipo IA")).id;
  premium = (await person(team)).id;
  admin = (await person(team, ADMIN_ROLE)).id;
  await createNote({ vaultId: (await getVault(team)).id, teamId: team, folder: "procesos", title: "Inscripción", content: "Pago de matrícula en caja.", userId: premium });
});

afterEach(async () => {
  await db().sql`DELETE FROM ai_answer_cache`;
});

describe("asistente", () => {
  it("consulta EOS con las herramientas, responde y registra el costo", async () => {
    const access = (await accessFor(premium, team))!;
    const { client, calls } = fakeClient([
      { content: [{ type: "tool_use", id: "t1", name: "search_notes", input: { query: "inscripcion" } }], stop_reason: "tool_use" },
      { content: [{ type: "text", text: "Según [[Inscripción]], el pago es en caja." }], stop_reason: "end_turn" },
    ]);
    const events = await run(access, "¿Cómo se paga la inscripción?", client);

    expect(events.find((e) => e.type === "step")).toMatchObject({ label: "Buscó «inscripcion» en el vault" });
    expect(text(events)).toContain("pago es en caja");
    expect(events.at(-1)).toMatchObject({ type: "done", cached: false });
    // Solo herramientas de lectura; el resultado de la búsqueda volvió a Claude.
    expect(calls[0].tools.map((t) => t.name)).not.toContain("create_issue");
    expect(JSON.stringify(calls[1].messages)).toContain("procesos/inscripcion.md");

    const settings = (await getAiSettings(team))!;
    const expected = costUsd(settings.model, { input: 2000, output: 400, cacheRead: 1000, cacheWrite: 0 });
    expect(await monthSpend(settings.organizationId)).toBeCloseTo(expected, 6);
  });

  it("la misma primera pregunta se responde desde la caché sin llamar a Claude", async () => {
    const access = (await accessFor(premium, team))!;
    const first = fakeClient([{ content: [{ type: "text", text: "Hay 3 Rocks." }], stop_reason: "end_turn" }]);
    await run(access, "¿Cuántos Rocks hay?", first.client);
    const second = fakeClient([]);
    const events = await run(access, "  ¿cuántos rocks hay? ", second.client);
    expect(second.calls).toHaveLength(0);
    expect(text(events)).toBe("Hay 3 Rocks.");
    expect(events.at(-1)).toMatchObject({ type: "done", cached: true, costUsd: 0 });
  });

  it("un rol sin Conocimiento no lee el vault aunque use el asistente", async () => {
    const access = (await accessFor(admin, team))!; // Administrador: sin módulos premium
    const { client, calls } = fakeClient([
      { content: [{ type: "tool_use", id: "t1", name: "read_note", input: { note: "Inscripción" } }], stop_reason: "tool_use" },
      { content: [{ type: "text", text: "No tengo acceso." }], stop_reason: "end_turn" },
    ]);
    await run(access, "Lee la nota de inscripción", client);
    const toolResult = JSON.stringify(calls[1].messages);
    expect(toolResult).not.toContain("matrícula");
  });

  it("los datos son del equipo de quien pregunta", async () => {
    const other = await demoOrg("Otra organización");
    const access = (await accessFor(other.owner.id, other.team.id))!;
    const { client, calls } = fakeClient([
      { content: [{ type: "tool_use", id: "t1", name: "search_notes", input: { query: "matricula" } }], stop_reason: "tool_use" },
      { content: [{ type: "text", text: "Nada." }], stop_reason: "end_turn" },
    ]);
    await run(access, "¿Qué dice el vault de matrícula?", client);
    expect(JSON.stringify(calls[1].messages)).not.toContain("procesos/inscripcion.md");
  });
});

describe("topes", () => {
  it("se detiene al llegar al tope mensual o al límite diario", async () => {
    const settings = (await getAiSettings(team))!;
    const access = (await accessFor(premium, team))!;

    await setAiSettings(settings.organizationId, { ...settings, userDailyLimit: 1 });
    expect(await checkBudget(team, premium)).toMatchObject({ ok: false, reason: "user_limit" });

    await setAiSettings(settings.organizationId, { ...settings, userDailyLimit: 100, monthlyCapUsd: 0 });
    const { client, calls } = fakeClient([]);
    const events = await run(access, "Otra pregunta distinta", client);
    expect(events).toEqual([expect.objectContaining({ type: "error", code: "org_cap" })]);
    expect(calls).toHaveLength(0);

    await setAiSettings(settings.organizationId, settings);
  });

  it("sin clave de Anthropic el asistente está apagado", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(await checkBudget(team, premium)).toMatchObject({ ok: false, reason: "not_configured" });
    process.env.ANTHROPIC_API_KEY = key;
  });

  it("calcula el costo con el precio de cada modelo", () => {
    const u = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000 };
    expect(costUsd("claude-opus-5-5", u)).toBeCloseTo(4 + 20 + 0.2 + 5, 6);
    expect(costUsd("claude-haiku-5-5", u)).toBeCloseTo(0.1 + 0.5 + 0.01 + 0.125, 6);
  });
});
