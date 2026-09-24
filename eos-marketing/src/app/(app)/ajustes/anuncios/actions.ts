"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  clearSlot,
  imageMime,
  MAX_IMAGE_BYTES,
  saveAnnouncementSettings,
  setSlotDetails,
  setSlotImage,
} from "@/lib/domain/announcements";

export type AdResult = { ok: boolean; message: string };

async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Solo un administrador puede cambiar los anuncios.");
  return session;
}

function checkSlot(slot: number) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) throw new Error("Espacio inválido");
  return slot;
}

function refresh() {
  // El popup vive en el layout de toda la app.
  revalidatePath("/", "layout");
}

export async function saveAdSettingsAction(enabled: boolean, intervalMinutes: number): Promise<AdResult> {
  const session = await requireAdmin();
  const minutes = Math.round(intervalMinutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    return { ok: false, message: "El intervalo debe estar entre 1 y 240 minutos." };
  }
  await saveAnnouncementSettings(session.teamId, { enabled, interval_minutes: minutes });
  refresh();
  return { ok: true, message: enabled ? `Anuncios activos cada ${minutes} min.` : "Anuncios desactivados." };
}

export async function uploadAdImageAction(slot: number, formData: FormData): Promise<AdResult> {
  try {
    const session = await requireAdmin();
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige una imagen." };
    const mime = imageMime(file);
    if (!mime) {
      return {
        ok: false,
        message: /\.hei[cf]$/i.test(file.name)
          ? "Las fotos HEIC de iPhone no se pueden mostrar en el navegador. Guárdala como JPG o PNG."
          : `Formato no permitido (${file.type || file.name}). Usa PNG, JPG, WEBP o GIF.`,
      };
    }
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "La imagen pesa más de 5 MB." };
    await setSlotImage(session.teamId, checkSlot(slot), new Uint8Array(await file.arrayBuffer()), mime);
    refresh();
    return { ok: true, message: "Imagen guardada." };
  } catch (err) {
    console.error("[anuncios] No se pudo guardar la imagen:", err);
    return { ok: false, message: `No se pudo guardar la imagen: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function saveAdDetailsAction(
  slot: number,
  input: { title: string; linkUrl: string; active: boolean }
): Promise<AdResult> {
  const session = await requireAdmin();
  const linkUrl = input.linkUrl.trim();
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
    return { ok: false, message: "El enlace debe empezar con http:// o https://" };
  }
  await setSlotDetails(session.teamId, checkSlot(slot), {
    title: input.title.trim().slice(0, 120),
    linkUrl: linkUrl.slice(0, 500),
    active: input.active,
  });
  refresh();
  return { ok: true, message: "Cambios guardados." };
}

export async function clearAdSlotAction(slot: number) {
  const session = await requireAdmin();
  await clearSlot(session.teamId, checkSlot(slot));
  refresh();
}
