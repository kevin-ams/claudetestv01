import { handleMcp, mcpNotAllowed, mcpOptions } from "@/lib/mcp/handler";

// Conector con el token en la cabecera: Authorization: Bearer eos_… (p. ej. Claude Code).
export const dynamic = "force-dynamic";
export const maxDuration = 26;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return handleMcp(req, /^Bearer\s+(\S+)$/i.exec(auth)?.[1] ?? null);
}
export const GET = mcpNotAllowed;
export const DELETE = mcpNotAllowed;
export const OPTIONS = mcpOptions;
