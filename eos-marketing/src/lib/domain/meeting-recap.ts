import "server-only";
import { db } from "@/lib/db";
import type { Issue, Meeting, MeetingHeadline, Rock, Todo } from "./types";
import { getMeeting, listHeadlines, listRatings } from "./meetings";
import { getTeam } from "./teams";
import { listTeamMembers } from "./users";
import { listRocks } from "./rocks";
import { listEntries, listMetrics, listOwners, listTargets } from "./scorecard";
import { buildScorecardGrid, formatValue, getCell, statusFor, targetFor } from "./scorecard-shared";
import { listCareers, listWeekly, weeklyGoals } from "./careers";
import { mergeWeekly, totalsFor, type Totals } from "./careers-shared";
import { currentQuarter, formatWeekRange, lastNWeeks, shiftWeek, weekStartISO } from "@/lib/utils/dates";

export type MeetingRecap = {
  meeting: Meeting & { cascade_notes: string };
  teamName: string;
  members: { id: number; name: string }[];
  ownerName: (id: number | null) => string;
  ratings: { user_name: string; rating: number }[];
  average: number | null;
  durationMinutes: number | null;
  headlines: MeetingHeadline[];
  todos: { pending: Todo[]; created: Todo[]; completed: Todo[] };
  issues: { created: Issue[]; solved: Issue[]; stillOpen: number };
  rocks: Rock[];
  scorecard: { week: string | null; offTrack: { metric: string; owner: string; value: string; target: string }[] };
  careers: { weekLabel: string; totals: Totals };
};

const ts = (v: string | null) => (v ? new Date(v).getTime() : null);

/** Todo lo registrado en una reunión L10 (para la Conclusión y el resumen PDF). */
export async function meetingRecap(meetingId: number, teamId: number): Promise<MeetingRecap | null> {
  const meeting = (await getMeeting(meetingId)) as (Meeting & { cascade_notes?: string }) | null;
  if (!meeting || meeting.team_id !== teamId) return null;

  const from = ts(meeting.started_at) ?? ts(meeting.created_at)!;
  const to = ts(meeting.ended_at) ?? Date.now();
  const inWindow = (v: string | null) => {
    const t = ts(v);
    return t !== null && t >= from && t <= to;
  };

  // Lo que se revisó en esa reunión: la última semana cerrada antes de la fecha de la reunión.
  const careerWeek = shiftWeek(weekStartISO(new Date(from)), -1);
  const weeks = lastNWeeks(4, careerWeek);
  const { quarter, year } = currentQuarter(new Date(from));
  const [team, members, ratings, headlines, todoRows, issueRows, rocks, metrics, owners, targets, entries, careers, weekly, goals] =
    await Promise.all([
      getTeam(teamId),
      listTeamMembers(teamId),
      listRatings(meetingId),
      listHeadlines(meetingId),
      db().sql`SELECT * FROM todos WHERE team_id = ${teamId} ORDER BY due_date ASC NULLS LAST, id ASC`,
      db().sql`SELECT * FROM issues WHERE team_id = ${teamId} ORDER BY sort_order ASC, id ASC`,
      listRocks(teamId, quarter, year),
      listMetrics(teamId),
      listOwners(teamId),
      listTargets(teamId),
      listEntries(teamId, weeks),
      listCareers(teamId),
      listWeekly(teamId, careerWeek),
      weeklyGoals(teamId, careerWeek),
    ]);

  const todos = todoRows as Todo[];
  const issues = issueRows as Issue[];
  const name = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin dueño";

  // Scorecard: la semana más reciente con datos y los números fuera de meta.
  const grid = buildScorecardGrid(metrics, owners, targets, entries, weeks);
  const week = [...weeks].reverse().find((w) => metrics.some((m) => owners.some((o) => getCell(grid, m.id, o.id, w) !== null))) ?? null;
  const offTrack = week
    ? metrics.flatMap((m) =>
        owners.flatMap((o) => {
          const v = getCell(grid, m.id, o.id, week);
          const t = targetFor(targets, m.id, o.id);
          return statusFor(v, t, m.direction) === "red"
            ? [{ metric: m.name, owner: o.name, value: formatValue(v, m.format), target: formatValue(t, m.format) }]
            : [];
        })
      )
    : [];

  const average = ratings.length ? ratings.reduce((a, r) => a + r.rating, 0) / ratings.length : null;

  return {
    meeting: { ...meeting, cascade_notes: meeting.cascade_notes ?? "" },
    teamName: team?.name ?? "Equipo",
    members: members.map((m) => ({ id: m.id, name: m.name })),
    ownerName: name,
    ratings: ratings.map((r) => ({ user_name: r.user_name, rating: r.rating })),
    average,
    durationMinutes: meeting.started_at ? Math.round((to - from) / 60000) : null,
    headlines,
    todos: {
      // Pendientes que traía el equipo al empezar la reunión.
      pending: todos.filter((t) => (ts(t.created_at) ?? 0) < from && (t.status === "open" || inWindow(t.done_at))),
      created: todos.filter((t) => inWindow(t.created_at)),
      completed: todos.filter((t) => (ts(t.created_at) ?? 0) < from && inWindow(t.done_at)),
    },
    issues: {
      created: issues.filter((i) => inWindow(i.created_at)),
      solved: issues.filter((i) => inWindow(i.solved_at)),
      stillOpen: issues.filter((i) => i.status === "open").length,
    },
    rocks,
    scorecard: { week, offTrack },
    careers: { weekLabel: formatWeekRange(careerWeek), totals: totalsFor(mergeWeekly(careers, weekly, goals)) },
  };
}
