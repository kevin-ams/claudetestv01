import { getSession } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { buildWeeklyReport } from "@/lib/domain/weekly-report";
import { parseSections, REPORT_SECTIONS } from "@/lib/domain/weekly-report-shared";
import { appUrl } from "@/lib/email";
import { shiftWeek, weekStartISO } from "@/lib/utils/dates";
import { sectionAvailability } from "./availability";
import { WeeklyReportBuilder } from "./report-builder";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportesSemanalesPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;
  const week = sp.semana && DATE.test(sp.semana) ? shiftWeek(sp.semana, 0) : weekStartISO();

  const [availability, team] = await Promise.all([sectionAvailability(session.teamId), getTeam(session.teamId)]);
  const available = availability.filter((a) => a.available).map((a) => a.key);
  // Secciones de la última vez (o todas las disponibles).
  const saved = parseSections(team?.weekly_report_sections ?? "").filter((s) => available.includes(s));
  const initialSections = saved.length ? saved : available;
  const { html } = await buildWeeklyReport({
    teamId: session.teamId,
    week,
    sections: initialSections,
    author: session.name,
    appUrl: await appUrl(),
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Reportes semanales</h1>
        <p className="text-sm text-muted">
          Elige la semana y las secciones, revisa la vista previa y envía el resumen por correo.
        </p>
      </div>
      <WeeklyReportBuilder
        key={week}
        initialWeek={week}
        currentWeek={weekStartISO()}
        sections={REPORT_SECTIONS.map((s) => ({ ...s, ...availability.find((a) => a.key === s.key)! }))}
        initialSections={initialSections}
        initialHtml={html}
        defaultRecipients={team?.weekly_report_recipients ?? ""}
      />
    </div>
  );
}
