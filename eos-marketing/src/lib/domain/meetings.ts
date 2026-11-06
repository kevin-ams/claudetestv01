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
    INSERT INTO meetings (team_id, created_by, leader_id, scheduled_at)
    VALUES (${teamId}, ${createdBy}, ${createdBy}, ${scheduledAt})
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

export async function setSegment(id: number, segmentKey: string, furthest?: string) {
  await db().sql`
    UPDATE meetings SET current_segment = ${segmentKey}, segment_started_at = NOW(),
      furthest_segment = COALESCE(${furthest ?? null}, furthest_segment, ${segmentKey})
    WHERE id = ${id}
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

/** Últimas noticias de las reuniones del equipo, para el Dashboard. */
/**
 * Noticias del inicio (Dashboard): las de los últimos 7 días, sin las que la persona quitó con la X.
 * Las más nuevas primero.
 */
export async function listDashboardNews(teamId: number, userId: number, limit = 20) {
  const rows = await db().sql`
    SELECT h.*, u.name AS author_name
    FROM meeting_headlines h
    JOIN meetings m ON m.id = h.meeting_id
    LEFT JOIN users u ON u.id = h.created_by
    WHERE m.team_id = ${teamId}
      AND h.created_at > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM news_dismissed d WHERE d.user_id = ${userId} AND d.headline_id = h.id)
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT ${limit}
  `;
  return rows as (MeetingHeadline & { author_name: string | null })[];
}

/** Quita una noticia del inicio de la persona (solo noticias de su equipo). */
export async function dismissNews(teamId: number, userId: number, headlineId: number) {
  await db().sql`
    INSERT INTO news_dismissed (user_id, headline_id)
    SELECT ${userId}, h.id FROM meeting_headlines h JOIN meetings m ON m.id = h.meeting_id
    WHERE h.id = ${headlineId} AND m.team_id = ${teamId}
    ON CONFLICT DO NOTHING
  `;
}

export async function setCascadeNotes(meetingId: number, teamId: number, notes: string) {
  await db().sql`UPDATE meetings SET cascade_notes = ${notes} WHERE id = ${meetingId} AND team_id = ${teamId}`;
}

export type AttendanceRow = { user_id: number; name: string; present: boolean };

/** Lista de asistencia: todas las personas del equipo con su marca. */
export async function listAttendance(meetingId: number, teamId: number): Promise<AttendanceRow[]> {
  const rows = await db().sql`
    SELECT u.id AS user_id, u.name, COALESCE(a.present, FALSE) AS present
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    LEFT JOIN meeting_attendees a ON a.meeting_id = ${meetingId} AND a.user_id = u.id
    WHERE tm.team_id = ${teamId}
    ORDER BY u.name ASC
  `;
  return rows as AttendanceRow[];
}

export async function setAttendance(meetingId: number, userId: number, present: boolean) {
  await db().sql`
    INSERT INTO meeting_attendees (meeting_id, user_id, present)
    VALUES (${meetingId}, ${userId}, ${present})
    ON CONFLICT (meeting_id, user_id) DO UPDATE SET present = ${present}
  `;
}

export async function setMeetingLeader(meetingId: number, teamId: number, userId: number) {
  await db().sql`UPDATE meetings SET leader_id = ${userId} WHERE id = ${meetingId} AND team_id = ${teamId}`;
}

export async function clearRating(meetingId: number, userId: number) {
  await db().sql`DELETE FROM meeting_ratings WHERE meeting_id = ${meetingId} AND user_id = ${userId}`;
}

/** Borra una reunión no terminada (iniciada por error). Asistencia, calificaciones y noticias se borran con ella. */
export async function discardMeeting(id: number, teamId: number) {
  await db().sql`DELETE FROM meetings WHERE id = ${id} AND team_id = ${teamId} AND status <> 'completed'`;
}
