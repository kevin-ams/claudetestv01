import { getSession } from "@/lib/auth/session";
import { getTeamLogo } from "@/lib/domain/teams";

/** GET /api/logo/:teamId → logo de la organización (solo con sesión iniciada). */
export async function GET(_request: Request, ctx: RouteContext<"/api/logo/[teamId]">) {
  if (!(await getSession())) return new Response("No autenticado", { status: 401 });
  const { teamId } = await ctx.params;
  const logo = await getTeamLogo(Number(teamId));
  if (!logo) return new Response("Sin logo", { status: 404 });
  return new Response(new Blob([logo.image as BlobPart], { type: logo.mime }), {
    headers: { "Content-Type": logo.mime, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
