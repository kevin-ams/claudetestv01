import { ArrowDownToLine, ArrowRight } from "@gravity-ui/icons";
import { buttonVariants } from "@heroui/styles";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listMeetings, getActiveMeeting } from "@/lib/domain/meetings";
import { StartMeetingButton } from "./start-meeting-button";
import { canEdit } from "@/lib/auth/access";
import { listPastEvents, listPendingEvents } from "@/lib/domain/l10-events";
import { formatWeekRange, shiftWeek, weekStartISO } from "@/lib/utils/dates";
import { listShareableTeams } from "@/lib/domain/scorecard";
import { EventsPanel } from "./events-panel";
import { Card } from "@heroui/react";
import { listAgenda } from "@/lib/domain/team-agenda";
import { listTeamMembers } from "@/lib/domain/users";
import { isClickUpConfigured } from "@/lib/integrations/clickup";
import { TeamAgendaPanel } from "./team-agenda";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programada",
  in_progress: "En curso",
  completed: "Completada",
};

/**
 * Semana de la agenda que se llena antes de la L10: la de la reunión en curso; si la L10 de esta
 * semana ya terminó, la próxima semana; si no, esta semana.
 */
function nextL10Week(meetings: { status: string; started_at: string | null; created_at: string }[], activeWeek: string | null) {
  if (activeWeek) return activeWeek;
  const thisWeek = weekStartISO();
  const doneThisWeek = meetings.some((m) => m.status === "completed" && weekStartISO(new Date(m.started_at ?? m.created_at)) === thisWeek);
  return doneThisWeek ? shiftWeek(thisWeek, 1) : thisWeek;
}

export default async function MeetingListPage({ searchParams }: { searchParams: Promise<{ agenda?: string }> }) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const [meetings, active] = await Promise.all([listMeetings(session.teamId), getActiveMeeting(session.teamId)]);
  const defaultWeek = nextL10Week(meetings, active ? weekStartISO(new Date(active.started_at ?? active.created_at)) : null);
  const week = sp.agenda && /^\d{4}-\d{2}-\d{2}$/.test(sp.agenda) ? shiftWeek(sp.agenda, 0) : defaultWeek;
  const [events, pastEvents, teams, editable, agenda, members, issuesEditable] = await Promise.all([
    listPendingEvents(session.teamId, false),
    listPastEvents(session.teamId),
    listShareableTeams(session.teamId),
    canEdit("meeting"),
    listAgenda(session.teamId, week),
    listTeamMembers(session.teamId),
    canEdit("issues"),
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

      <Card className="mb-8 p-4">
        <TeamAgendaPanel
          week={week}
          weekLabel={formatWeekRange(week)}
          items={agenda}
          members={members}
          currentUserId={session.userId}
          editable={editable}
          canRaiseIssues={issuesEditable}
          clickupConfigured={isClickUpConfigured()}
          nav={{
            prevHref: `/meeting?agenda=${shiftWeek(week, -1)}`,
            nextHref: `/meeting?agenda=${shiftWeek(week, 1)}`,
            defaultHref: week === defaultWeek ? null : "/meeting",
            isDefault: week === defaultWeek,
          }}
        />
      </Card>

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
