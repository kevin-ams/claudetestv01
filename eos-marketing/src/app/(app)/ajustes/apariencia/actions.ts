"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { setTeamThemeColor } from "@/lib/domain/teams";
import { isHexColor } from "@/lib/theme";

export type ThemeResult = { ok: boolean; message: string };

export async function saveThemeColorAction(color: string): Promise<ThemeResult> {
  const session = await requireSession();
  if (session.role !== "admin") {
    return { ok: false, message: "Solo un administrador puede cambiar el color del template." };
  }
  if (!isHexColor(color)) return { ok: false, message: "El color debe tener el formato #RRGGBB." };
  await setTeamThemeColor(session.teamId, color.toLowerCase());
  // El color se aplica en el layout de toda la app.
  revalidatePath("/", "layout");
  return { ok: true, message: "Color del template guardado para todo el equipo." };
}
