import { getAdminSession } from "@/lib/auth/session";
import { contarNoLeidos, listAvisos } from "@/lib/domain/avisos";

/** Avisos del administrador (para la campanita del encabezado). */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "No autenticado" }, { status: 401 });
  const [avisos, noLeidos] = await Promise.all([listAvisos(admin.adminId), contarNoLeidos(admin.adminId)]);
  return Response.json({ avisos, noLeidos }, { headers: { "Cache-Control": "no-store" } });
}
