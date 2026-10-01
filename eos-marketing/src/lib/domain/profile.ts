import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export const PRONOUNS = [
  { key: "", label: "Prefiero no decir" },
  { key: "el", label: "Él" },
  { key: "ella", label: "Ella" },
  { key: "elle", label: "Elle" },
] as const;

export type Profile = {
  id: number;
  name: string;
  email: string;
  pronoun: string;
  color: string;
  use_color_theme: boolean;
  /** Versión de la foto para refrescar la caché; null si no tiene. */
  avatar: string | null;
};

const avatarKey = (userId: number) => `avatars/${userId}`;

export function avatarUrl(p: Pick<Profile, "id" | "avatar">): string | null {
  return p.avatar ? `/api/avatar/${p.id}?v=${p.avatar}` : null;
}

export async function getProfile(userId: number): Promise<Profile | null> {
  const rows = (await db().sql`
    SELECT id, name, email, pronoun, color, use_color_theme, avatar_mime, avatar_updated_at FROM users WHERE id = ${userId}
  `) as (Omit<Profile, "avatar"> & { avatar_mime: string | null; avatar_updated_at: string | null })[];
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    pronoun: r.pronoun,
    color: r.color,
    use_color_theme: r.use_color_theme,
    avatar: r.avatar_mime ? String(Date.parse(r.avatar_updated_at ?? "") || 1) : null,
  };
}

/** Perfiles (foto, color, pronombre) de las personas de un equipo. */
export async function teamProfiles(teamId: number): Promise<Record<number, Profile>> {
  const rows = (await db().sql`
    SELECT u.id, u.name, u.email, u.pronoun, u.color, u.use_color_theme, u.avatar_mime, u.avatar_updated_at
    FROM users u JOIN team_members tm ON tm.user_id = u.id WHERE tm.team_id = ${teamId}
  `) as (Omit<Profile, "avatar"> & { avatar_mime: string | null; avatar_updated_at: string | null })[];
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      { ...r, avatar: r.avatar_mime ? String(Date.parse(r.avatar_updated_at ?? "") || 1) : null } as Profile,
    ])
  );
}

export async function updateProfile(
  userId: number,
  input: { name: string; pronoun: string; color: string; useColorTheme: boolean }
) {
  await db().sql`
    UPDATE users SET name = ${input.name}, pronoun = ${input.pronoun}, color = ${input.color},
      use_color_theme = ${input.useColorTheme}
    WHERE id = ${userId}
  `;
}

export async function setAvatar(userId: number, image: Uint8Array, mime: string) {
  await (await storage()).put(avatarKey(userId), image);
  await db().sql`UPDATE users SET avatar_mime = ${mime}, avatar_updated_at = NOW() WHERE id = ${userId}`;
}

export async function removeAvatar(userId: number) {
  await (await storage()).remove(avatarKey(userId));
  await db().sql`UPDATE users SET avatar_mime = NULL, avatar_updated_at = NULL WHERE id = ${userId}`;
}

export async function getAvatar(userId: number): Promise<{ image: Uint8Array; mime: string } | null> {
  const rows = (await db().sql`SELECT avatar_mime FROM users WHERE id = ${userId}`) as { avatar_mime: string | null }[];
  const mime = rows[0]?.avatar_mime;
  if (!mime) return null;
  const image = await (await storage()).get(avatarKey(userId));
  return image ? { image, mime } : null;
}
