import { ArrowDownToLine, ArrowRight } from "@gravity-ui/icons";
import { buttonVariants } from "@heroui/styles";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listMeetings, getActiveMeeting } from "@/lib/domain/meetings";
import { StartMeetingButton } from "./start-meeting-button";
import { canEdit } from "@/lib/auth/access";
import { listPastEvents, listPendingEvents } from "@/lib/domain/l10-events";
import { weekStartISO } from "@/lib/utils/dates";
import { listShareableTeams } from "@/lib/domain/scorecard";
import { EventsPanel } from "./events-panel";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programada",
  in_progress: "En curso",
  completed: "Completada",
};

export default async function MeetingListPage() {
  const session = await getSession();
  if (!session) return null;

  const [meetings, active, events, pastEvents, teams, editable] = await Promise.all([
    listMeetings(session.teamId),
    getActiveMeeting(session.teamId),
    listPendingEvents(session.teamId, false),
    listPastEvents(session.teamId),
    listShareableTeams(session.teamId),
    canEdit("meeting"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reunión Level 10</h1>
          <p className="text-sm text-muted">
            La agenda semanal de 90 minutos: Buenas noticias, Scorecard, Rocks, Noticias,
            To-Dos, IDS y Conclusión.
          </p>
        </div>
        {active ? (
          <Link href={`/meeting/${active.id}`} className={buttonVariants({ variant: "primary" })}>
            Continuar reunión en curso <ArrowRight aria-hidden />
          </Link>
        ) : (
          <StartMeetingButton />
        )}
      </div>

      <EventsPanel events={events} pastEvents={pastEvents} currentWeek={weekStartISO()} teams={teams} editable={editable} activeMeetingId={active?.id ?? null} />

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
        Historial
      </h2>
      {meetings.length === 0 ? (
        <p className="text-sm text-muted">Todavía no has hecho ninguna reunión.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {meetings.map((m) => (
            <li key={m.id} className="card card--default flex flex-row items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">
                  Reunión #{m.id} · {new Date(m.created_at).toLocaleDateString("es-GT")}
                </p>
                <p className="text-xs text-muted">
                  {STATUS_LABEL[m.status]}
                  {m.avg_rating !== null && ` · Calificación: ${Number(m.avg_rating).toFixed(1)}/10`}
                </p>
              </div>
              <div className="flex gap-2">
                {m.status === "completed" && (
                  <a href={`/api/reuniones/${m.id}/resumen`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    <ArrowDownToLine aria-hidden /> Resumen PDF
                  </a>
                )}
                <Link href={`/meeting/${m.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Ver
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
