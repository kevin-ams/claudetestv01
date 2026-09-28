import "server-only";
import { db } from "@/lib/db";
import { parseWorkbook, type RawSheet } from "./parse";
import type { CallsDataset } from "./types";

/** Cuántas cargas anteriores se conservan por equipo. */
const KEEP_UPLOADS = 10;

export async function saveUpload(input: {
  teamId: number;
  userId: number;
  fileName: string;
  sheets: RawSheet[];
}) {
  await db().sql`
    INSERT INTO call_uploads (team_id, file_name, sheets, uploaded_by)
    VALUES (${input.teamId}, ${input.fileName}, ${JSON.stringify(input.sheets)}::jsonb, ${input.userId})
  `;
  await db().sql`
    DELETE FROM call_uploads
    WHERE team_id = ${input.teamId}
      AND id NOT IN (
        SELECT id FROM call_uploads WHERE team_id = ${input.teamId}
        ORDER BY uploaded_at DESC LIMIT ${KEEP_UPLOADS}
      )
  `;
}

/** Datos de la última carga del equipo, o null si nunca se ha subido un archivo. */
export async function loadCalls(teamId: number): Promise<CallsDataset | null> {
  const rows = await db().sql`
    SELECT u.file_name, u.sheets, u.uploaded_at, us.name AS uploaded_by_name
    FROM call_uploads u
    LEFT JOIN users us ON us.id = u.uploaded_by
    WHERE u.team_id = ${teamId}
    ORDER BY u.uploaded_at DESC
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const sheets: RawSheet[] =
    typeof rows[0].sheets === "string" ? JSON.parse(rows[0].sheets) : rows[0].sheets;
  const { records, warnings } = parseWorkbook(sheets);
  return {
    records,
    warnings,
    fileName: rows[0].file_name,
    uploadedAt: new Date(rows[0].uploaded_at).toISOString(),
    uploadedBy: rows[0].uploaded_by_name ?? null,
  };
}
