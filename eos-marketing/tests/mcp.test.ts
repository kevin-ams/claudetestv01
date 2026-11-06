import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createApiToken, RATE_LIMIT_PER_MINUTE, revokeApiToken, verifyApiToken } from "@/lib/domain/api-tokens";
import { createNote, getVault } from "@/lib/domain/vault";
import { handleMcp } from "@/lib/mcp/handler";
import { ADMIN_ROLE, demoOrg, person, realTeam } from "./helpers";

async function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
  const res = await handleMcp(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
    token,
  );
  return { status: res.status, body: (await res.json().catch(() => null)) as { result?: { tools?: { name: string }[]; content?: { text: string }[] }; error?: { message: string } } };
}
const toolText = (r: Awaited<ReturnType<typeof rpc>>) => r.body.result?.content?.map((c) => c.text).join("") ?? "";

let teamA: number, userA: number, teamB: number, userB: number;

beforeAll(async () => {
  teamA = (await realTeam("Org A")).id;
  userA = (await person(teamA)).id;
  const b = await demoOrg("Org B");
  teamB = b.team.id;
  userB = b.owner.id;
  await createNote({ vaultId: (await getVault(teamA)).id, teamId: teamA, folder: "procesos", title: "Secreto de A", content: "matrícula confidencial", userId: userA });
});

describe("tokens", () => {
  it("solo guarda el hash y valida formato, revocación y límite por minuto", async () => {
    const { id, token } = await createApiToken({ teamId: teamA, userId: userA, label: "t", scope: "vault", canWrite: false });
    const stored = (await db().sql`SELECT token_hash FROM api_tokens WHERE id = ${id}`) as { token_hash: string }[];
    expect(stored[0].token_hash).not.toContain(token);
    expect(stored[0].token_hash).toHaveLength(64);
    expect((await verifyApiToken(token)).ok).toBe(true);
    expect(await verifyApiToken("eos_nope")).toMatchObject({ ok: false, status: 401 });
    expect(await verifyApiToken("no-es-token")).toMatchObject({ ok: false, status: 401 });
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i++) await verifyApiToken(token);
    expect(await verifyApiToken(token)).toMatchObject({ ok: false, status: 429 });
    expect(await revokeApiToken(teamA, id, userA, false)).toBe(true);
    expect(await verifyApiToken(token)).toMatchObject({ ok: false, status: 401 });
  });
  it("una persona no puede revocar tokens ajenos (salvo administradores)", async () => {
    const other = await person(teamA, ADMIN_ROLE);
    const { id } = await createApiToken({ teamId: teamA, userId: userA, label: "t2", scope: "vault", canWrite: false });
    expect(await revokeApiToken(teamA, id, other.id, false)).toBe(false);
    expect(await revokeApiToken(teamB, id, userB, true)).toBe(false);
    expect(await revokeApiToken(teamA, id, other.id, true)).toBe(true);
  });
});

describe("servidor MCP", () => {
  it("las herramientas dependen del alcance y del permiso de escritura", async () => {
    const v = await createApiToken({ teamId: teamA, userId: userA, label: "v", scope: "vault", canWrite: false });
    const e = await createApiToken({ teamId: teamA, userId: userA, label: "e", scope: "eos", canWrite: true });
    const tv = (await rpc(v.token, "tools/list")).body.result!.tools!.map((t) => t.name);
    const te = (await rpc(e.token, "tools/list")).body.result!.tools!.map((t) => t.name);
    expect(tv).toEqual(["search_notes", "read_note", "list_notes", "get_backlinks", "list_tags"]);
    expect(te).toEqual(expect.arrayContaining(["create_note", "get_scorecard", "get_career_indicators", "create_issue", "set_scorecard_value"]));
  });
  it("exige el plan Premium (acceso a Conocimiento) y un token válido", async () => {
    const admin = await person(teamA, ADMIN_ROLE);
    const t = await createApiToken({ teamId: teamA, userId: admin.id, label: "sin premium", scope: "vault", canWrite: false });
    expect((await rpc(t.token, "tools/list")).status).toBe(403);
    expect((await rpc("eos_tokeninvalidotokeninvalido", "tools/list")).status).toBe(401);
  });
  it("con el token de otra organización no se ve el vault de A", async () => {
    const t = await createApiToken({ teamId: teamB, userId: userB, label: "B", scope: "eos", canWrite: true });
    expect(toolText(await rpc(t.token, "tools/call", { name: "search_notes", arguments: { query: "matricula" } }))).toContain("Sin resultados");
    expect(toolText(await rpc(t.token, "tools/call", { name: "read_note", arguments: { note: "Secreto de A" } }))).toContain("No existe");
    expect(toolText(await rpc(t.token, "tools/call", { name: "list_notes", arguments: {} }))).not.toContain("Secreto de A");
  });
  it("crea en su propio equipo y deja rastro en la bitácora", async () => {
    const t = await createApiToken({ teamId: teamB, userId: userB, label: "B2", scope: "eos", canWrite: true });
    expect(toolText(await rpc(t.token, "tools/call", { name: "create_issue", arguments: { title: "Desde Claude" } }))).toContain('"created": true');
    const issues = (await db().sql`SELECT team_id FROM issues WHERE title = 'Desde Claude'`) as { team_id: number }[];
    expect(issues.map((i) => i.team_id)).toEqual([teamB]);
    const log = (await db().sql`SELECT action FROM activity_log WHERE team_id = ${teamB} ORDER BY id DESC LIMIT 1`) as { action: string }[];
    expect(log[0]?.action).toContain("vía Claude");
  });
});
