"use server";

import { requireSession } from "@/lib/auth/session";
import { clickUpOptions, isClickUpConfigured, ClickUpNotConfiguredError, type ClickUpOptions } from "@/lib/integrations/clickup";

/** Listas del espacio de ClickUp y personas del workspace, para elegir al enviar un To-Do o Issue. */
export async function clickUpOptionsAction(): Promise<{ ok: true; options: ClickUpOptions } | { ok: false; message: string }> {
  await requireSession();
  if (!isClickUpConfigured()) return { ok: false, message: new ClickUpNotConfiguredError().message };
  try {
    return { ok: true, options: await clickUpOptions() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo leer ClickUp." };
  }
}
