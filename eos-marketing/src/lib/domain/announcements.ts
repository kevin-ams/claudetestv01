import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

/**
 * Las imágenes se guardan como archivos junto a la base de datos local, no
 * dentro de ella: PGlite no soporta binarios grandes y una foto de varios MB
 * la dejaba inservible. En la base solo queda el tipo y la fecha.
 */
const UPLOADS_DIR =
  process.env.EOS_UPLOADS_DIR || path.join(path.dirname(process.env.EOS_DATA_DIR || path.join(process.cwd(), ".data", "pglite")), "uploads");

function imagePath(teamId: number, slot: number) {
  return path.join(UPLOADS_DIR, "anuncios", `${teamId}-${slot}`);
}

export const ANNOUNCEMENT_SLOTS = [1, 2, 3, 4, 5] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Tipo de imagen por el tipo que manda el navegador o, si viene vacío, por la extensión. */
export function imageMime(file: { type: string; name: string }): string | null {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  return byExt[ext] ?? null;
}

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
    SELECT slot, mime IS NOT NULL AS has_image, title, link_url, active, updated_at
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
  const file = imagePath(teamId, slot);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, image);
  await db().sql`
    INSERT INTO announcement_slots (team_id, slot, image, mime, updated_at)
    VALUES (${teamId}, ${slot}, NULL, ${mime}, NOW())
    ON CONFLICT (team_id, slot) DO UPDATE SET image = NULL, mime = ${mime}, updated_at = NOW()
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
  await rm(imagePath(teamId, slot), { force: true });
  await db().sql`DELETE FROM announcement_slots WHERE team_id = ${teamId} AND slot = ${slot}`;
}

/** Borra las imágenes de todos los espacios de un equipo (al eliminar la demo). */
export async function removeTeamImages(teamId: number) {
  for (const slot of ANNOUNCEMENT_SLOTS) await rm(imagePath(teamId, slot), { force: true });
}

export async function getSlotImage(teamId: number, slot: number) {
  const rows = (await db().sql`
    SELECT image, mime FROM announcement_slots WHERE team_id = ${teamId} AND slot = ${slot} AND mime IS NOT NULL
  `) as { image: Uint8Array | null; mime: string }[];
  const row = rows[0];
  if (!row) return null;
  try {
    return { image: new Uint8Array(await readFile(imagePath(teamId, slot))), mime: row.mime };
  } catch {
    // Imágenes pequeñas subidas con la versión anterior quedaron en la base.
    return row.image ? { image: row.image, mime: row.mime } : null;
  }
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
