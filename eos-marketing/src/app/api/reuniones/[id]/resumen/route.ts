import { getAccess } from "@/lib/auth/access";
import { meetingRecap } from "@/lib/domain/meeting-recap";
import { getTeam } from "@/lib/domain/teams";
import { buildMeetingSummaryPdf } from "@/lib/pdf/meeting-summary";
import { DEFAULT_THEME_COLOR } from "@/lib/theme";

/** GET /api/reuniones/:id/resumen → PDF con lo registrado en la reunión L10. */
export async function GET(_request: Request, ctx: RouteContext<"/api/reuniones/[id]/resumen">) {
  const access = await getAccess();
  if (!access) return new Response("No autenticado", { status: 401 });
  if (access.level("meeting") === "none") return new Response("Sin acceso", { status: 403 });

  const { id } = await ctx.params;
  const teamId = access.session.teamId;
  const recap = await meetingRecap(Number(id), teamId);
  if (!recap) return new Response("Reunión no encontrada", { status: 404 });

  const team = await getTeam(teamId);
  const pdf = await buildMeetingSummaryPdf(recap, team?.theme_color ?? DEFAULT_THEME_COLOR);
  const date = (recap.meeting.started_at ?? recap.meeting.created_at).slice(0, 10);
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resumen-reunion-L10-${recap.meeting.id}_${date}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
