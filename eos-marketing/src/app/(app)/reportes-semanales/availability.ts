import "server-only";
import { getAccess } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { REPORT_SECTIONS, type ReportSection } from "@/lib/domain/weekly-report-shared";

export type SectionAvailability = { key: ReportSection; available: boolean; reason: string | null };

/**
 * Qué secciones puede incluir la persona: necesita acceso al módulo y, para calendario,
 * coberturas e indicadores, que el equipo use ese módulo (tenga datos).
 */
export async function sectionAvailability(teamId: number): Promise<SectionAvailability[]> {
  const access = await getAccess();
  const rows = (await db().sql`
    SELECT
      EXISTS (SELECT 1 FROM editorial_pieces WHERE team_id = ${teamId}) AS calendario,
      EXISTS (SELECT 1 FROM coverages WHERE team_id = ${teamId}) AS coberturas,
      EXISTS (SELECT 1 FROM careers WHERE team_id = ${teamId} AND NOT archived) AS indicadores
  `) as { calendario: boolean; coberturas: boolean; indicadores: boolean }[];
  const used = rows[0] ?? { calendario: false, coberturas: false, indicadores: false };
  return REPORT_SECTIONS.map((s) => {
    if (!access || access.level(s.module) === "none") return { key: s.key, available: false, reason: "Tu rol no tiene acceso a este módulo." };
    if ((s.key === "calendario" || s.key === "coberturas" || s.key === "indicadores") && !used[s.key]) {
      return { key: s.key, available: false, reason: "El equipo no usa este módulo." };
    }
    return { key: s.key, available: true, reason: null };
  });
}
