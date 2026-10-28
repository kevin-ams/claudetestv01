"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { acConfig } from "@/lib/activecampaign/client";
import { runSyncStep } from "@/lib/activecampaign/sync";
import { FIELD_KEYS, type FieldMap, type FieldRef, type SyncProgress } from "@/lib/activecampaign/types";
import { saveDashboardSettings, saveFieldMap } from "@/lib/domain/deals";

export async function syncStepAction(
  mode: "full" | "incremental" | "continue"
): Promise<SyncProgress> {
  await requireSession();
  if (!acConfig()) throw new Error("Configura AC_API_URL y AC_API_KEY para sincronizar.");
  const progress = await runSyncStep(mode);
  if (progress.phase === "done") revalidatePath("/tratos");
  return progress;
}

function parseRef(raw: FormDataEntryValue | null): FieldRef {
  const value = String(raw ?? "");
  const [source, id] = value.split(":");
  if ((source === "deal" || source === "contact") && id) return { source, id };
  return null;
}

export async function saveConfigAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Solo un administrador puede cambiar la configuración.");

  const map = Object.fromEntries(FIELD_KEYS.map((k) => [k, parseRef(formData.get(k))])) as FieldMap;
  const staleDays = Math.min(365, Math.max(1, Number(formData.get("staleDays")) || 7));
  await Promise.all([saveFieldMap(map), saveDashboardSettings({ staleDays })]);
  revalidatePath("/tratos");
  redirect("/tratos");
}
