import "server-only";
import { db } from "@/lib/db";
import type { PipelineStage, StageKind, StageWithCount } from "./types";

export async function defaultPipelineId(): Promise<number> {
  const rows = await db().sql`
    SELECT id FROM pipelines ORDER BY is_default DESC, id ASC LIMIT 1
  `;
  if (!rows[0]) throw new Error("No hay pipeline configurado");
  return (rows[0] as { id: number }).id;
}

export async function listStages(pipelineId: number): Promise<StageWithCount[]> {
  const rows = await db().sql`
    SELECT s.*, COUNT(d.id)::int AS deal_count
    FROM pipeline_stages s
    LEFT JOIN deals d ON d.stage_id = s.id
    WHERE s.pipeline_id = ${pipelineId}
    GROUP BY s.id
    ORDER BY s.position ASC
  `;
  return rows as StageWithCount[];
}

async function getStage(stageId: number): Promise<PipelineStage> {
  const rows = await db().sql`SELECT * FROM pipeline_stages WHERE id = ${stageId}`;
  if (!rows[0]) throw new Error("La etapa no existe");
  return rows[0] as PipelineStage;
}

async function countKind(pipelineId: number, kind: StageKind, excludeId: number) {
  const rows = await db().sql`
    SELECT COUNT(*)::int AS n FROM pipeline_stages
    WHERE pipeline_id = ${pipelineId} AND kind = ${kind} AND id <> ${excludeId}
  `;
  return (rows[0] as { n: number }).n;
}

const KIND_LABEL: Record<StageKind, string> = {
  open: "abierta",
  won: "de ganado",
  lost: "de perdido",
};

export async function addStage(input: {
  pipelineId: number;
  name: string;
  probability: number;
  kind: StageKind;
}) {
  await db().sql`
    INSERT INTO pipeline_stages (pipeline_id, name, position, probability, kind)
    VALUES (
      ${input.pipelineId},
      ${input.name},
      (SELECT COALESCE(MAX(position), 0) + 1 FROM pipeline_stages WHERE pipeline_id = ${input.pipelineId}),
      ${input.probability},
      ${input.kind}
    )
  `;
}

export async function updateStage(input: {
  stageId: number;
  name: string;
  probability: number;
  kind: StageKind;
}) {
  const stage = await getStage(input.stageId);
  if (stage.kind !== input.kind && (await countKind(stage.pipeline_id, stage.kind, stage.id)) === 0) {
    throw new Error(`Debe quedar al menos una etapa ${KIND_LABEL[stage.kind]}`);
  }
  await db().sql`
    UPDATE pipeline_stages
    SET name = ${input.name}, probability = ${input.probability}, kind = ${input.kind}
    WHERE id = ${input.stageId}
  `;
}

export async function moveStage(stageId: number, direction: "up" | "down") {
  const stage = await getStage(stageId);
  const rows = direction === "up"
    ? await db().sql`
        SELECT * FROM pipeline_stages
        WHERE pipeline_id = ${stage.pipeline_id} AND position < ${stage.position}
        ORDER BY position DESC LIMIT 1
      `
    : await db().sql`
        SELECT * FROM pipeline_stages
        WHERE pipeline_id = ${stage.pipeline_id} AND position > ${stage.position}
        ORDER BY position ASC LIMIT 1
      `;
  const neighbor = rows[0] as PipelineStage | undefined;
  if (!neighbor) return;
  await db().sql`
    UPDATE pipeline_stages SET position = CASE
      WHEN id = ${stage.id} THEN ${neighbor.position}::int
      WHEN id = ${neighbor.id} THEN ${stage.position}::int
    END
    WHERE id IN (${stage.id}, ${neighbor.id})
  `;
}

export async function deleteStage(stageId: number) {
  const stage = await getStage(stageId);
  const deals = await db().sql`SELECT 1 FROM deals WHERE stage_id = ${stageId} LIMIT 1`;
  if (deals.length > 0) {
    throw new Error("La etapa tiene negocios; muévelos a otra etapa antes de eliminarla");
  }
  if ((await countKind(stage.pipeline_id, stage.kind, stage.id)) === 0) {
    throw new Error(`Debe quedar al menos una etapa ${KIND_LABEL[stage.kind]}`);
  }
  await db().sql`DELETE FROM pipeline_stages WHERE id = ${stageId}`;
}
