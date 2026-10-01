import { getSession } from "@/lib/auth/session";
import { getAvatar } from "@/lib/domain/profile";

/** GET /api/avatar/:userId → foto de perfil (solo con sesión iniciada). */
export async function GET(_request: Request, ctx: RouteContext<"/api/avatar/[userId]">) {
  if (!(await getSession())) return new Response("No autenticado", { status: 401 });
  const { userId } = await ctx.params;
  const avatar = await getAvatar(Number(userId));
  if (!avatar) return new Response("Sin foto", { status: 404 });
  return new Response(new Blob([avatar.image as BlobPart], { type: avatar.mime }), {
    headers: { "Content-Type": avatar.mime, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
