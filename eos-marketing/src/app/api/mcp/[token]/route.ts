import { handleMcp, mcpNotAllowed, mcpOptions } from "@/lib/mcp/handler";

// Conector para Claude.ai / Claude Desktop: la URL incluye el token (Conocimiento › Conectar con Claude).
export const dynamic = "force-dynamic";
export const maxDuration = 26;

export async function POST(req: Request, ctx: RouteContext<"/api/mcp/[token]">) {
  return handleMcp(req, (await ctx.params).token);
}
export const GET = mcpNotAllowed;
export const DELETE = mcpNotAllowed;
export const OPTIONS = mcpOptions;
