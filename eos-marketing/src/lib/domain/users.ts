import "server-only";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { User, PublicUser, Role } from "./types";

export async function countUsers(): Promise<number> {
  const rows = await db().sql`SELECT COUNT(*)::int AS count FROM users`;
  return (rows[0] as { count: number }).count;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db().sql`
    SELECT * FROM users WHERE email = ${email.toLowerCase().trim()}
  `;
  return (rows[0] as User) ?? null;
}

export async function getUserById(id: number): Promise<PublicUser | null> {
  const rows = await db().sql`
    SELECT id, name, email, role, created_at FROM users WHERE id = ${id}
  `;
  return (rows[0] as PublicUser) ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);
  const rows = await db().sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${input.name}, ${input.email.toLowerCase().trim()}, ${passwordHash}, ${input.role})
    RETURNING id, name, email, role, created_at
  `;
  return rows[0] as PublicUser;
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await db().sql`
    SELECT id, name, email, role, created_at FROM users ORDER BY name ASC
  `;
  return rows as PublicUser[];
}

export async function listTeamMembers(teamId: number): Promise<PublicUser[]> {
  const rows = await db().sql`
    SELECT u.id, u.name, u.email, u.role, u.created_at
    FROM users u
    JOIN team_members tm ON tm.user_id = u.id
    WHERE tm.team_id = ${teamId}
    ORDER BY u.name ASC
  `;
  return rows as PublicUser[];
}

export async function listTeamMembersDetailed(teamId: number) {
  const rows = await db().sql`
    SELECT u.id, u.name, u.email, u.role, tm.seat_title
    FROM users u
    JOIN team_members tm ON tm.user_id = u.id
    WHERE tm.team_id = ${teamId}
    ORDER BY u.name ASC
  `;
  return rows as {
    id: number;
    name: string;
    email: string;
    role: Role;
    seat_title: string | null;
  }[];
}

export async function addTeamMember(
  teamId: number,
  userId: number,
  seatTitle?: string
) {
  await db().sql`
    INSERT INTO team_members (team_id, user_id, seat_title)
    VALUES (${teamId}, ${userId}, ${seatTitle ?? null})
    ON CONFLICT (team_id, user_id) DO NOTHING
  `;
}

export async function getUserTeams(userId: number) {
  const rows = await db().sql`
    SELECT t.id, t.name
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ${userId}
    ORDER BY t.name ASC
  `;
  return rows as { id: number; name: string }[];
}

export async function isUserInTeam(userId: number, teamId: number) {
  const rows = await db().sql`
    SELECT 1 FROM team_members WHERE user_id = ${userId} AND team_id = ${teamId}
  `;
  return rows.length > 0;
}

export async function updateUserAccess(
  userId: number,
  input: { name: string; email: string; password: string | null }
) {
  await db().sql`
    UPDATE users SET name = ${input.name}, email = ${input.email.toLowerCase().trim()}
    WHERE id = ${userId}
  `;
  if (input.password) {
    const passwordHash = await hashPassword(input.password);
    await db().sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
  }
}
