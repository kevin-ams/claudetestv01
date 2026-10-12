import { getSession } from "@/lib/auth/session";
import { getTeam } from "@/lib/domain/teams";
import { buildWeeklyReport } from "@/lib/domain/weekly-report";
import { isReportKind, parseSavedSections, REPORT_KINDS, REPORT_SECTIONS } from "@/lib/domain/weekly-report-shared";
import { appUrl } from "@/lib/email";
import { shiftWeek, weekStartISO } from "@/lib/utils/dates";
import { sectionAvailability } from "./availability";
import { WeeklyReportBuilder } from "./report-builder";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportesSemanalesPage({ searchParams }: { searchParams: Promise<{ semana?: string; tipo?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;
  const kind = isReportKind(sp.tipo) ? sp.tipo : "planificacion";
  const week = sp.semana && DATE.test(sp.semana) ? shiftWeek(sp.semana, 0) : weekStartISO();

  const [availability, team] = await Promise.all([sectionAvailability(session.teamId), getTeam(session.teamId)]);
  const available = availability.filter((a) => a.available).map((a) => a.key);
  // Secciones de la última vez (o todas las disponibles).
  const saved = parseSavedSections(team?.weekly_report_sections ?? "", kind).filter((s) => available.includes(s));
  const initialSections = saved.length ? saved : available;
  const { html } = await buildWeeklyReport({
    teamId: session.teamId,
    kind,
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
          Elige el tipo de reporte, la semana y las secciones; revisa la vista previa y envíalo por correo.
        </p>
      </div>
      <WeeklyReportBuilder
        key={`${kind}-${week}`}
        kind={kind}
        kinds={REPORT_KINDS}
        initialWeek={week}
        currentWeek={weekStartISO()}
        sections={REPORT_SECTIONS.map((s) => {
          const a = availability.find((x) => x.key === s.key)!;
          return { key: s.key, label: s.label, hint: kind === "cierre" ? s.hintCierre : s.hint, available: a.available, reason: a.reason };
        })}
        initialSections={initialSections}
        initialHtml={html}
        defaultRecipients={team?.weekly_report_recipients ?? ""}
      />
    </div>
  );
}
