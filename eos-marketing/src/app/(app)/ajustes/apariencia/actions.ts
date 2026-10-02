"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { canEdit } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import { removeTeamLogo, setTeamLogo, setTeamThemeColor } from "@/lib/domain/teams";
import { imageMime, MAX_IMAGE_BYTES } from "@/lib/domain/announcements";
import { isHexColor } from "@/lib/theme";

export type ThemeResult = { ok: boolean; message: string };

export async function saveThemeColorAction(color: string): Promise<ThemeResult> {
  const session = await requireSession();
  if (!(await canEdit("ajustes"))) {
    return { ok: false, message: "Solo un administrador puede cambiar el color del template." };
  }
  if (!isHexColor(color)) return { ok: false, message: "El color debe tener el formato #RRGGBB." };
  await setTeamThemeColor(session.teamId, color.toLowerCase());
  await logActivity(session, "ajustes", "Cambió color del template", color.toLowerCase());
  // El color se aplica en el layout de toda la app.
  revalidatePath("/", "layout");
  return { ok: true, message: "Color del template guardado para todo el equipo." };
}

/** Logo de la organización: se muestra en la esquina superior izquierda para todo el equipo. */
export async function uploadLogoAction(formData: FormData): Promise<ThemeResult> {
  const session = await requireSession();
  if (!(await canEdit("ajustes"))) return { ok: false, message: "Solo un administrador puede cambiar el logo." };
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige una imagen." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "La imagen pesa más de 5 MB." };
  const mime = imageMime(file);
  if (!mime) return { ok: false, message: "Usa una imagen PNG, JPG, WEBP o GIF." };
  await setTeamLogo(session.teamId, new Uint8Array(await file.arrayBuffer()), mime);
  await logActivity(session, "ajustes", "Cambió el logo de la organización", file.name);
  revalidatePath("/", "layout");
  return { ok: true, message: "Logo actualizado." };
}

export async function removeLogoAction(): Promise<ThemeResult> {
  const session = await requireSession();
  if (!(await canEdit("ajustes"))) return { ok: false, message: "Solo un administrador puede quitar el logo." };
  await removeTeamLogo(session.teamId);
  await logActivity(session, "ajustes", "Quitó el logo de la organización");
  revalidatePath("/", "layout");
  return { ok: true, message: "Logo quitado." };
}
