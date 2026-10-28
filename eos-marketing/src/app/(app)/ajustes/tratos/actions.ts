"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { saveDashSettings } from "@/lib/domain/deals";
import { FIELD_KEYS, type DashSettings, type FieldMap, type FieldRef } from "@/lib/domain/deals-shared";

function cleanRef(ref: unknown): FieldRef {
  const r = ref as { source?: unknown; id?: unknown } | null;
  return r && (r.source === "deal" || r.source === "contact") && typeof r.id === "string" && r.id ? { source: r.source, id: r.id } : null;
}

export async function saveDealsSettingsAction(input: DashSettings): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const settings: DashSettings = {
    staleDays: Math.min(365, Math.max(1, Math.round(Number(input.staleDays) || 7))),
    historyMonths: Math.min(36, Math.max(1, Math.round(Number(input.historyMonths) || 6))),
    conversionStageKeys: Array.isArray(input.conversionStageKeys)
      ? input.conversionStageKeys.filter((k): k is string => typeof k === "string").slice(0, 200)
      : null,
    fieldMap: input.fieldMap
      ? (Object.fromEntries(FIELD_KEYS.map((k) => [k, cleanRef(input.fieldMap?.[k])])) as FieldMap)
      : null,
    facultyByCareer: Object.fromEntries(
      Object.entries(input.facultyByCareer ?? {})
        .filter(([k, v]) => typeof k === "string" && typeof v === "string" && v.trim())
        .map(([k, v]) => [k, v.trim().slice(0, 120)])
    ),
  };
  await saveDashSettings(settings);
  revalidatePath("/tratos");
  revalidatePath("/ajustes/tratos");
  return { ok: true, message: "Guardado. El dashboard ya usa esta configuración." };
}
