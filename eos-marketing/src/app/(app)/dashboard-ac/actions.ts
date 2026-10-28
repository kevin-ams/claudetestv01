"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { isActiveCampaignConfigured } from "@/lib/integrations/activecampaign";
import { runSyncStep } from "@/lib/domain/deals-sync";
import type { SyncProgress } from "@/lib/domain/deals-shared";

/** Un paso de la sincronización; el botón lo llama en bucle hasta que termina. */
export async function syncDealsStepAction(mode: "full" | "incremental" | "continue"): Promise<SyncProgress> {
  await requireModule("dashboard_ac", "edit");
  if (!isActiveCampaignConfigured()) throw new Error("ActiveCampaign no está configurado (faltan ACTIVECAMPAIGN_API_URL y ACTIVECAMPAIGN_API_KEY).");
  const progress = await runSyncStep(mode);
  if (progress.phase === "done") revalidatePath("/dashboard-ac");
  return progress;
}
