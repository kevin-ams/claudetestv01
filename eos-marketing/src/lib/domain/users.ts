import "server-only";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { User, PublicUser, Role } from "./types";
import { roleIdByName, USER_ROLE } from "./roles";

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
    SELECT u.id, u.name, u.email, u.role, tm.seat_title, tm.role_id, r.name AS role_name, COALESCE(r.is_admin, FALSE) AS is_admin
    FROM users u
    JOIN team_members tm ON tm.user_id = u.id
    LEFT JOIN team_roles r ON r.id = tm.role_id
    WHERE tm.team_id = ${teamId}
    ORDER BY u.name ASC
  `;
  return rows as {
    id: number;
    name: string;
    email: string;
    role: Role;
    seat_title: string | null;
    role_id: number | null;
    role_name: string | null;
    is_admin: boolean;
  }[];
}

export async function addTeamMember(
  teamId: number,
  userId: number,
  seatTitle?: string,
  roleName: string = USER_ROLE
) {
  const roleId = await roleIdByName(teamId, roleName);
  await db().sql`
    INSERT INTO team_members (team_id, user_id, seat_title, role_id)
    VALUES (${teamId}, ${userId}, ${seatTitle ?? null}, ${roleId})
    ON CONFLICT (team_id, user_id) DO NOTHING
  `;
}

/** Quita a una persona del equipo (su cuenta sigue existiendo). */
export async function removeTeamMember(teamId: number, userId: number) {
  await db().sql`DELETE FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`;
}

export async function getUserTeams(userId: number) {
  const rows = await db().sql`
    SELECT t.id, t.name, t.is_demo, r.name AS role_name,
      (SELECT COUNT(*)::int FROM team_members x WHERE x.team_id = t.id) AS members
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    LEFT JOIN team_roles r ON r.id = tm.role_id
    WHERE tm.user_id = ${userId}
    ORDER BY t.is_demo ASC, t.name ASC
  `;
  return rows as { id: number; name: string; is_demo: boolean; role_name: string | null; members: number }[];
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
