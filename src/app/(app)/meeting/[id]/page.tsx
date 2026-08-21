import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getMeeting, listHeadlines, listRatings } from "@/lib/domain/meetings";
import { listOwners, listMetrics, listTargets, listEntries } from "@/lib/domain/scorecard";
import { buildScorecardGrid } from "@/lib/domain/scorecard-shared";
import { listRocks, listMilestonesForRocks } from "@/lib/domain/rocks";
import { listIssues } from "@/lib/domain/issues";
import { listTodos } from "@/lib/domain/todos";
import { listTeamMembers } from "@/lib/domain/users";
import { lastNWeeks, currentQuarter } from "@/lib/utils/dates";
import { MeetingRunner } from "./meeting-runner";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const meetingId = Number(id);
  const meeting = await getMeeting(meetingId);
  if (!meeting || meeting.team_id !== session.teamId) notFound();

  const weeks = lastNWeeks(4);
  const { quarter, year } = currentQuarter();

  const [
    owners,
    metrics,
    targets,
    entries,
    rocks,
    members,
    openIssues,
    todos,
    headlines,
    ratings,
  ] = await Promise.all([
    listOwners(session.teamId),
    listMetrics(session.teamId),
    listTargets(session.teamId),
    listEntries(session.teamId, weeks),
    listRocks(session.teamId, quarter, year),
    listTeamMembers(session.teamId),
    listIssues(session.teamId, "open"),
    listTodos(session.teamId),
    listHeadlines(meetingId),
    listRatings(meetingId),
  ]);
  const milestones = await listMilestonesForRocks(rocks.map((r) => r.id));
  const milestonesByRock: Record<number, typeof milestones> = {};
  for (const m of milestones) {
    milestonesByRock[m.rock_id] = [...(milestonesByRock[m.rock_id] ?? []), m];
  }

  const grid = Object.fromEntries(buildScorecardGrid(metrics, owners, targets, entries, weeks));

  return (
    <MeetingRunner
      meeting={meeting}
      session={session}
      scorecard={{ owners, metrics, targets, grid, weeks }}
      rocks={rocks}
      milestonesByRock={milestonesByRock}
      members={members}
      openIssues={openIssues}
      todos={todos}
      headlines={headlines}
      ratings={ratings}
    />
  );
}
