"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { labelOf, logActivity } from "@/lib/domain/activity";
import { deleteLink, saveLink } from "@/lib/domain/ac-sync";
import { getCareer } from "@/lib/domain/careers";
import { careerValuesInPipeline } from "@/lib/integrations/activecampaign";

export type LinkResult = { ok: boolean; message: string };

function refresh() {
  revalidatePath("/ajustes/activecampaign");
  revalidatePath("/indicadores");
}

export async function careerValuesAction(pipelineId: string): Promise<{ value: string; count: number }[]> {
  await requireModule("indicadores", "view");
  if (!/^\d+$/.test(pipelineId)) return [];
  try {
    return await careerValuesInPipeline(pipelineId);
  } catch {
    return [];
  }
}

export async function saveLinkAction(input: {
  careerId: number;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  careerValue: string;
}): Promise<LinkResult> {
  const session = await requireModule("indicadores");
  const career = await getCareer(input.careerId);
  if (!career || career.team_id !== session.teamId) return { ok: false, message: "Carrera no encontrada." };
  if (!/^\d+$/.test(input.pipelineId) || !/^\d+$/.test(input.stageId)) return { ok: false, message: "Elige el embudo y la etapa." };
  await saveLink(session.teamId, {
    career_id: input.careerId,
    pipeline_id: input.pipelineId,
    pipeline_name: input.pipelineName.slice(0, 200),
    stage_id: input.stageId,
    stage_name: input.stageName.slice(0, 200),
    career_value: input.careerValue.trim().slice(0, 200),
  });
  await logActivity(
    session,
    "indicadores",
    "Vinculó carrera a ActiveCampaign",
    `${await labelOf("careers", input.careerId)} → ${input.pipelineName} › ${input.stageName}${input.careerValue.trim() ? ` · ${input.careerValue.trim()}` : ""}`
  );
  refresh();
  return { ok: true, message: "Vínculo guardado." };
}

export async function deleteLinkAction(careerId: number): Promise<LinkResult> {
  const session = await requireModule("indicadores");
  await deleteLink(session.teamId, careerId);
  await logActivity(session, "indicadores", "Quitó vínculo con ActiveCampaign", await labelOf("careers", careerId));
  refresh();
  return { ok: true, message: "Vínculo quitado." };
}
