import "server-only";
import { parseISO } from "date-fns";
import { listCoverages, listKeyDates, listPieces } from "./editorial";
import { getTeam } from "./teams";
import { listTeamMembers } from "./users";
import { buildWeekPlanPdf } from "@/lib/pdf/week-plan";
import { DEFAULT_THEME_COLOR } from "@/lib/theme";
import { addDaysISO, weekStartISO } from "@/lib/utils/dates";

/** PDF de la planificación de la semana (lunes) que contiene `date`. */
export async function weekPlanPdf(teamId: number, date: string) {
  const week = weekStartISO(parseISO(date));
  const end = addDaysISO(week, 6);
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
  return { pdf, week, team, pieces };
}
