import "server-only";
import { db } from "@/lib/db";
import type { Meeting, MeetingHeadline } from "./types";
import { L10_AGENDA } from "./meeting-shared";

export async function listMeetings(teamId: number): Promise<Meeting[]> {
  const rows = await db().sql`
    SELECT * FROM meetings WHERE team_id = ${teamId} ORDER BY id DESC LIMIT 50
  `;
  return rows as Meeting[];
}

export async function getMeeting(id: number): Promise<Meeting | null> {
  const rows = await db().sql`SELECT * FROM meetings WHERE id = ${id}`;
  return (rows[0] as Meeting) ?? null;
}

export async function getActiveMeeting(teamId: number): Promise<Meeting | null> {
  const rows = await db().sql`
    SELECT * FROM meetings WHERE team_id = ${teamId} AND status = 'in_progress'
    ORDER BY id DESC LIMIT 1
  `;
  return (rows[0] as Meeting) ?? null;
}

export async function createMeeting(
  teamId: number,
  createdBy: number,
  scheduledAt: string | null
): Promise<Meeting> {
  const rows = await db().sql`
    INSERT INTO meetings (team_id, created_by, scheduled_at)
    VALUES (${teamId}, ${createdBy}, ${scheduledAt})
    RETURNING *
  `;
  return rows[0] as Meeting;
}

export async function startMeeting(id: number) {
  await db().sql`
    UPDATE meetings
    SET status = 'in_progress', started_at = NOW(),
        current_segment = ${L10_AGENDA[0].key}, segment_started_at = NOW()
    WHERE id = ${id}
  `;
}

export async function setSegment(id: number, segmentKey: string) {
  await db().sql`
    UPDATE meetings SET current_segment = ${segmentKey}, segment_started_at = NOW() WHERE id = ${id}
  `;
}

export async function completeMeeting(id: number) {
  await db().sql`
    UPDATE meetings SET
      status = 'completed',
      ended_at = NOW(),
      avg_rating = (SELECT AVG(rating) FROM meeting_ratings WHERE meeting_id = ${id})
    WHERE id = ${id}
  `;
}

export async function addHeadline(input: {
  meetingId: number;
  type: "customer" | "employee";
  content: string;
  createdBy: number;
}) {
  await db().sql`
    INSERT INTO meeting_headlines (meeting_id, type, content, created_by)
    VALUES (${input.meetingId}, ${input.type}, ${input.content}, ${input.createdBy})
  `;
}

export async function listHeadlines(meetingId: number): Promise<MeetingHeadline[]> {
  const rows = await db().sql`
    SELECT * FROM meeting_headlines WHERE meeting_id = ${meetingId} ORDER BY id ASC
  `;
  return rows as MeetingHeadline[];
}

export async function rateMeeting(
  meetingId: number,
  userId: number,
  rating: number
) {
  await db().sql`
    INSERT INTO meeting_ratings (meeting_id, user_id, rating)
    VALUES (${meetingId}, ${userId}, ${rating})
    ON CONFLICT (meeting_id, user_id) DO UPDATE SET rating = ${rating}
  `;
}

export async function listRatings(meetingId: number) {
  const rows = await db().sql`
    SELECT mr.*, u.name AS user_name FROM meeting_ratings mr
    JOIN users u ON u.id = mr.user_id
    WHERE mr.meeting_id = ${meetingId}
  `;
  return rows as { meeting_id: number; user_id: number; rating: number; user_name: string }[];
}

export async function linkIssueToMeeting(meetingId: number, issueId: number) {
  await db().sql`
    INSERT INTO meeting_issues (meeting_id, issue_id)
    VALUES (${meetingId}, ${issueId})
    ON CONFLICT DO NOTHING
  `;
}

export async function markIssueDiscussed(meetingId: number, issueId: number) {
  await db().sql`
    UPDATE meeting_issues SET discussed = TRUE WHERE meeting_id = ${meetingId} AND issue_id = ${issueId}
  `;
}
