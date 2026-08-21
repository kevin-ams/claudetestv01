import "server-only";
import { db } from "@/lib/db";
import type { Seat } from "./types";

export async function listSeats(teamId: number): Promise<Seat[]> {
  const rows = await db().sql`
    SELECT * FROM accountability_seats WHERE team_id = ${teamId}
    ORDER BY parent_seat_id NULLS FIRST, sort_order ASC, id ASC
  `;
  return rows as Seat[];
}

export async function createSeat(input: {
  teamId: number;
  parentSeatId: number | null;
  title: string;
  userId: number | null;
  roles: string[];
  sortOrder: number;
}) {
  const rows = await db().sql`
    INSERT INTO accountability_seats (team_id, parent_seat_id, title, user_id, roles, sort_order)
    VALUES (${input.teamId}, ${input.parentSeatId}, ${input.title}, ${input.userId}, ${JSON.stringify(input.roles)}::jsonb, ${input.sortOrder})
    RETURNING *
  `;
  return rows[0] as Seat;
}

export async function updateSeat(
  seatId: number,
  input: {
    title: string;
    userId: number | null;
    roles: string[];
    parentSeatId: number | null;
  }
) {
  await db().sql`
    UPDATE accountability_seats
    SET title = ${input.title},
        user_id = ${input.userId},
        roles = ${JSON.stringify(input.roles)}::jsonb,
        parent_seat_id = ${input.parentSeatId}
    WHERE id = ${seatId}
  `;
}

export async function deleteSeat(seatId: number) {
  await db().sql`DELETE FROM accountability_seats WHERE id = ${seatId}`;
}
