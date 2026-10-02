import { getAccess } from "@/lib/auth/access";
import { listCoverages, listKeyDates, listPieces } from "@/lib/domain/editorial";
import { getTeam } from "@/lib/domain/teams";
import { listTeamMembers } from "@/lib/domain/users";
import { buildWeekPlanPdf } from "@/lib/pdf/week-plan";
import { DEFAULT_THEME_COLOR } from "@/lib/theme";
import { addDaysISO, weekStartISO } from "@/lib/utils/dates";
import { parseISO } from "date-fns";

/** GET /api/calendario/planificacion?semana=AAAA-MM-DD → PDF de la planificación de esa semana. */
export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("No autenticado", { status: 401 });
  if (access.level("calendario") === "none") return new Response("Sin acceso", { status: 403 });

  const raw = new URL(request.url).searchParams.get("semana") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Response("Semana inválida", { status: 400 });
  const week = weekStartISO(parseISO(raw));
  const end = addDaysISO(week, 6);
  const teamId = access.session.teamId;

  const [team, pieces, dates, coverages, members] = await Promise.all([
    getTeam(teamId),
    listPieces(teamId, week, week),
    listKeyDates(teamId, week, end),
    listCoverages(teamId, week, end),
    listTeamMembers(teamId),
  ]);
  const pdf = await buildWeekPlanPdf(
    {
      teamName: team?.name ?? "Equipo",
      week,
      pieces,
      dates,
      coverages: coverages.filter((c) => c.status !== "Cancelada").reverse(),
      memberName: (id) => members.find((m) => m.id === id)?.name ?? "Sin asignar",
    },
    team?.theme_color ?? DEFAULT_THEME_COLOR
  );
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="planificacion-contenido_${week}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
