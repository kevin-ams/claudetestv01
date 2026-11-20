import "server-only";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { accessFor } from "@/lib/auth/access";
import { verifyApiToken } from "@/lib/domain/api-tokens";
import { buildMcpServer } from "./eos-mcp";
import { getTeam } from "@/lib/domain/teams";

// Servidor MCP sin estado (Streamable HTTP): cada petición se atiende sola, como pide una función serverless.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const rpcError = (status: number, message: string) =>
  withCors(Response.json({ jsonrpc: "2.0", error: { code: status === 429 ? -32029 : -32001, message }, id: null }, { status }));

export const mcpOptions = () => new Response(null, { status: 204, headers: CORS });

/** GET/DELETE: este servidor no abre sesiones ni flujos SSE (modo sin estado). */
export const mcpNotAllowed = () => rpcError(405, "Método no permitido: usa POST (servidor MCP sin estado).");

type RpcMessage = { jsonrpc?: unknown; id?: unknown; method?: unknown };

/** Solo avisos JSON-RPC (sin id): el cliente no espera respuesta, se contestan sin tocar la base. */
export function onlyNotifications(body: unknown): boolean {
  const list = Array.isArray(body) ? body : [body];
  return (
    list.length > 0 &&
    list.every((m) => !!m && typeof m === "object" && typeof (m as RpcMessage).method === "string" && !("id" in (m as object)))
  );
}

/** Métodos de la petición, para el log (nunca el contenido ni el token). */
function methodsOf(body: unknown): string {
  const list = Array.isArray(body) ? body : [body];
  return list.map((m) => (m && typeof m === "object" ? String((m as RpcMessage).method ?? "respuesta") : "?")).join(",");
}

export async function handleMcp(req: Request, token: string | null): Promise<Response> {
  if (!token) return rpcError(401, "Falta el token. Crea uno en Conocimiento › Conectar con Claude.");
  // El cuerpo se lee una sola vez: sirve para el log y para no despertar la base con un simple aviso.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn("[mcp] 400: cuerpo que no es JSON");
    return withCors(Response.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error: Invalid JSON" }, id: null }, { status: 400 }));
  }
  if (onlyNotifications(body)) return withCors(new Response(null, { status: 202 }));

  const check = await verifyApiToken(token);
  if (!check.ok) return rpcError(check.status, check.message);
  const access = await accessFor(check.token.userId, check.token.teamId);
  // El acceso se revisa en cada petición: si cambia el rol de la persona, el token cambia con él.
  if (!access) return rpcError(403, "La persona dueña de este token ya no pertenece al equipo.");
  if (access.level("conocimiento") === "none") return rpcError(403, "El acceso por Claude es parte del plan Premium (módulo Conocimiento).");

  const team = await getTeam(check.token.teamId);
  const server = buildMcpServer({ access, scope: check.token.scope, canWrite: check.token.canWrite, teamName: team?.name ?? "—" });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  // Motivo de cada rechazo del protocolo (400/406/415…) en los logs de Netlify, sin datos de la persona.
  transport.onerror = (e) =>
    console.warn(
      `[mcp] ${e.message} · métodos=${methodsOf(body)} · versión=${req.headers.get("mcp-protocol-version") ?? "—"} · accept=${req.headers.get("accept") ?? "—"}`
    );
  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(req, { parsedBody: body }));
  } catch (e) {
    console.error("[mcp]", e);
    return rpcError(500, "Error interno del servidor MCP.");
  } finally {
    // Sin estado: se cierra al terminar de responder.
    void transport.close().catch(() => {});
    void server.close().catch(() => {});
  }
}
