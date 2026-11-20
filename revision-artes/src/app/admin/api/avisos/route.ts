import { getAdminSession } from "@/lib/auth/session";
import { avisosConConteo } from "@/lib/domain/avisos";

/** Avisos del administrador (para la campanita del encabezado). */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "No autenticado" }, { status: 401 });
  return Response.json(await avisosConConteo(admin.adminId), { headers: { "Cache-Control": "no-store" } });
}
