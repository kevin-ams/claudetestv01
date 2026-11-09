import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSlotImage } from "@/lib/domain/announcements";

/** Imagen de un anuncio del equipo de la sesión. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ slot: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("No autenticado", { status: 401 });
  const slot = Number((await ctx.params).slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) return new NextResponse("No encontrado", { status: 404 });

  const image = await getSlotImage(session.teamId, slot);
  if (!image) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(Buffer.from(image.image), {
    headers: {
      "Content-Type": image.mime,
      // La URL lleva ?v=<versión>, así que se puede guardar en caché del navegador.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
