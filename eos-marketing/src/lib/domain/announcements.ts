import "server-only";
import { db } from "@/lib/db";

export const ANNOUNCEMENT_SLOTS = [1, 2, 3, 4, 5] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type AnnouncementSettings = { enabled: boolean; interval_minutes: number };

export type AnnouncementSlot = {
  slot: number;
  has_image: boolean;
  title: string;
  link_url: string;
  active: boolean;
  /** Cambia cada vez que se reemplaza la imagen (para refrescar la caché). */
  version: string;
};

export async function getAnnouncementSettings(teamId: number): Promise<AnnouncementSettings> {
  const rows = (await db().sql`
    SELECT enabled, interval_minutes FROM announcement_settings WHERE team_id = ${teamId}
  `) as AnnouncementSettings[];
  return rows[0] ?? { enabled: true, interval_minutes: 5 };
}

export async function saveAnnouncementSettings(teamId: number, settings: AnnouncementSettings) {
  await db().sql`
    INSERT INTO announcement_settings (team_id, enabled, interval_minutes)
    VALUES (${teamId}, ${settings.enabled}, ${settings.interval_minutes})
    ON CONFLICT (team_id) DO UPDATE SET enabled = ${settings.enabled}, interval_minutes = ${settings.interval_minutes}
  `;
}

/** Los 5 espacios, existan o no en la base. */
export async function listAnnouncementSlots(teamId: number): Promise<AnnouncementSlot[]> {
  const rows = (await db().sql`
    SELECT slot, image IS NOT NULL AS has_image, title, link_url, active, updated_at
    FROM announcement_slots WHERE team_id = ${teamId}
  `) as (Omit<AnnouncementSlot, "version"> & { updated_at: string })[];
  const bySlot = new Map(rows.map((r) => [r.slot, r]));
  return ANNOUNCEMENT_SLOTS.map((slot) => {
    const r = bySlot.get(slot);
    return r
      ? { slot, has_image: r.has_image, title: r.title, link_url: r.link_url, active: r.active, version: String(Date.parse(r.updated_at)) }
      : { slot, has_image: false, title: "", link_url: "", active: true, version: "0" };
  });
}

export async function setSlotImage(teamId: number, slot: number, image: Uint8Array, mime: string) {
  await db().sql`
    INSERT INTO announcement_slots (team_id, slot, image, mime, updated_at)
    VALUES (${teamId}, ${slot}, ${image}, ${mime}, NOW())
    ON CONFLICT (team_id, slot) DO UPDATE SET image = ${image}, mime = ${mime}, updated_at = NOW()
  `;
}

export async function setSlotDetails(
  teamId: number,
  slot: number,
  input: { title: string; linkUrl: string; active: boolean }
) {
  await db().sql`
    INSERT INTO announcement_slots (team_id, slot, title, link_url, active)
    VALUES (${teamId}, ${slot}, ${input.title}, ${input.linkUrl}, ${input.active})
    ON CONFLICT (team_id, slot) DO UPDATE SET
      title = ${input.title}, link_url = ${input.linkUrl}, active = ${input.active}
  `;
}

export async function clearSlot(teamId: number, slot: number) {
  await db().sql`DELETE FROM announcement_slots WHERE team_id = ${teamId} AND slot = ${slot}`;
}

export async function getSlotImage(teamId: number, slot: number) {
  const rows = (await db().sql`
    SELECT image, mime FROM announcement_slots WHERE team_id = ${teamId} AND slot = ${slot} AND image IS NOT NULL
  `) as { image: Uint8Array; mime: string }[];
  return rows[0] ?? null;
}

/** Lo que necesita el popup: anuncios activos con imagen, si la función está encendida. */
export async function activeAnnouncements(teamId: number) {
  const [settings, slots] = await Promise.all([getAnnouncementSettings(teamId), listAnnouncementSlots(teamId)]);
  return {
    enabled: settings.enabled,
    intervalMinutes: settings.interval_minutes,
    ads: settings.enabled ? slots.filter((s) => s.has_image && s.active) : [],
  };
}
