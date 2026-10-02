import { getAccess } from "@/lib/auth/access";
import { weekPlanPdf } from "@/lib/domain/week-plan";

/** GET /api/calendario/planificacion?semana=AAAA-MM-DD → PDF de la planificación de esa semana. */
export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("No autenticado", { status: 401 });
  if (access.level("calendario") === "none") return new Response("Sin acceso", { status: 403 });

  const raw = new URL(request.url).searchParams.get("semana") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Response("Semana inválida", { status: 400 });
  const { pdf, week } = await weekPlanPdf(access.session.teamId, raw);
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="planificacion-contenido_${week}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
