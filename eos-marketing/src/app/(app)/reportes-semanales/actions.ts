"use server";

import { requireModule } from "@/lib/auth/access";
import { logActivity } from "@/lib/domain/activity";
import { listTeamMembers } from "@/lib/domain/users";
import { buildWeeklyReport, setWeeklyReportPrefs } from "@/lib/domain/weekly-report";
import { parseSections, type ReportSection } from "@/lib/domain/weekly-report-shared";
import { appUrl, parseRecipients, sendEmail } from "@/lib/email";
import { sectionAvailability } from "./availability";

type Result = { ok: boolean; message: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function allowedSections(teamId: number, requested: string[]): Promise<ReportSection[]> {
  const available = new Set((await sectionAvailability(teamId)).filter((s) => s.available).map((s) => s.key));
  return parseSections(requested).filter((s) => available.has(s));
}

/** Vista previa: el mismo HTML que se envía por correo. */
export async function previewWeeklyReportAction(week: string, sections: string[], message: string): Promise<Result & { html: string }> {
  try {
    const session = await requireModule("reportes_semanales", "view");
    if (!ISO.test(week)) return { ok: false, message: "Semana inválida.", html: "" };
    const chosen = await allowedSections(session.teamId, sections);
    const { html } = await buildWeeklyReport({
      teamId: session.teamId,
      week,
      sections: chosen,
      author: session.name,
      appUrl: await appUrl(),
      message: String(message ?? "").slice(0, 2000),
    });
    return { ok: true, message: "", html };
  } catch (e) {
    console.error("[reporte semanal] vista previa", e);
    return { ok: false, message: e instanceof Error && e.name === "AccessDeniedError" ? e.message : "No se pudo armar la vista previa.", html: "" };
  }
}

export async function sendWeeklyReportAction(input: {
  week: string;
  sections: string[];
  recipients: string;
  includeTeam: boolean;
  message: string;
}): Promise<Result> {
  try {
    const session = await requireModule("reportes_semanales", "view");
    if (!ISO.test(input.week)) return { ok: false, message: "Semana inválida." };
    const chosen = await allowedSections(session.teamId, input.sections);
    if (chosen.length === 0) return { ok: false, message: "Elige al menos una sección." };
    const extra = parseRecipients(String(input.recipients ?? ""));
    if (extra.invalid) return { ok: false, message: `Correo inválido: ${extra.invalid}` };
    const team = input.includeTeam ? (await listTeamMembers(session.teamId)).map((m) => m.email.toLowerCase()) : [];
    // Los correos provisionales (*.local) no existen: se omiten.
    const to = [...new Set([...extra.emails, ...team])].filter((e) => !e.endsWith(".local"));
    if (to.length === 0) return { ok: false, message: "Escribe al menos un correo o incluye al equipo." };

    const { html, subject } = await buildWeeklyReport({
      teamId: session.teamId,
      week: input.week,
      sections: chosen,
      author: session.name,
      appUrl: await appUrl(),
      message: String(input.message ?? "").slice(0, 2000),
    });
    await setWeeklyReportPrefs(session.teamId, extra.emails.join(", "), chosen);
    const result = await sendEmail({ to, replyTo: session.email, subject, html });
    if (result.ok) {
      await logActivity(session, "reportes_semanales", "Envió reporte semanal", `Semana ${input.week} (${chosen.join(", ")}) → ${to.join(", ")}`);
    }
    return result;
  } catch (e) {
    console.error("[reporte semanal] envío", e);
    return { ok: false, message: e instanceof Error && e.name === "AccessDeniedError" ? e.message : "No se pudo enviar el reporte." };
  }
}
