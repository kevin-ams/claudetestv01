"use client";

import { Segmented } from "@/components/ui/segmented";
import { Button, Card, Input, TextArea } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Meeting,
  MeetingHeadline,
  Rock,
  RockMilestone,
  PublicUser,
  Issue,
  Todo,
  ScorecardOwner,
  ScorecardMetric,
  ScorecardTarget,
} from "@/lib/domain/types";
import type { SessionPayload } from "@/lib/auth/token";
import { L10_AGENDA, segmentIndex, nextSegment } from "@/lib/domain/meeting-shared";
import { ScorecardTable } from "../../scorecard/scorecard-table";
import { RockCard } from "../../rocks/rock-card";
import { IssueList } from "../../issues/issue-list";
import { AddIssueForm } from "../../issues/add-issue-form";
import { TodoList } from "../../todos/todo-list";
import { CareerSummary } from "../../indicadores/career-summary";
import { careerLabel, num, type CareerRow } from "@/lib/domain/careers-shared";
import { QuickCreateBar, QuickCreateModal, type QuickDraft } from "./quick-create";
import { SendEmailInline } from "@/components/send-email-button";
import {
  advanceSegmentAction,
  sendMeetingSummaryAction,
  addHeadlineAction,
  rateMeetingAction,
  completeMeetingAction,
  saveCascadeNotesAction,
  setAttendanceAction,
  setMeetingLeaderAction,
  rateAttendeeAction,
} from "../actions";
import type { AttendanceRow } from "@/lib/domain/meetings";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import type { L10Event } from "@/lib/domain/l10-events";
import { formatEventDate } from "../events-panel";

function useElapsed(since: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!since) return 0;
  return Math.floor((now - new Date(since).getTime()) / 1000);
}

function formatClock(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const s = Math.abs(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${sign}${m}:${String(sec).padStart(2, "0")}`;
}

/** Eventos cargados antes de la reunión (propios y enviados por otros equipos). */
function EventsList({ events, onRaiseIssue }: { events: L10Event[]; onRaiseIssue?: (e: L10Event) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">
        Eventos de la semana <span className="font-normal text-muted">· {events.length}</span>
      </h4>
      {events.length === 0 ? (
        <p className="text-sm text-muted">
          No se cargaron eventos. Se agregan antes de la reunión en{" "}
          <Link href="/meeting" className="text-primary underline">
            Reunión L10
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {events.map((e) => (
            <li
              key={e.id}
              className={`card card--default flex flex-row items-start gap-3 p-3 ${e.from_team_id !== null ? "border border-primary/40" : ""}`}
            >
              {e.event_date && (
                <span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs font-semibold capitalize text-primary">
                  {formatEventDate(e.event_date)}
                </span>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{e.title}</p>
                {e.detail && <p className="whitespace-pre-line text-muted">{e.detail}</p>}
                <p className="mt-1 text-xs text-muted">
                  {e.from_team_id !== null && <b className="text-primary">De: {e.from_team_name ?? "otro equipo"} · </b>}
                  {e.author_name ?? ""}
                </p>
              </div>
              {onRaiseIssue && (
                <Button size="sm" variant="outline" type="button" className="h-6 shrink-0 px-2 text-[11px] text-red" onPress={() => onRaiseIssue(e)}>
                  → Issue
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeadlinesPanel({
  meetingId,
  headlines,
  events,
  onRaiseIssue,
}: {
  meetingId: number;
  headlines: MeetingHeadline[];
  events: L10Event[];
  onRaiseIssue: (headline: { content: string }) => void;
}) {
  const [customer, setCustomer] = useState("");
  const [employee, setEmployee] = useState("");

  return (
    <div className="flex flex-col gap-6">
    <EventsList events={events} onRaiseIssue={(e) => onRaiseIssue({ content: e.title })} />
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Noticias externas</h4>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {headlines.filter((h) => h.type === "customer").map((h) => (
            <li key={h.id} className="card card--default flex flex-row items-start justify-between gap-2 p-2">
              <span>{h.content}</span>
              <Button size="sm" variant="outline"
                type="button"
                className="shrink-0 text-[11px] text-red h-6 px-2"
                onPress={() => onRaiseIssue(h)}
              >
                → Issue
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          action={async () => {
            await addHeadlineAction(meetingId, "customer", customer);
            setCustomer("");
          }}
        >
          <Input fullWidth
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Nueva noticia externa (estudiantes, mercado, universidad)"
          />
          <Button variant="outline" type="submit">
            +
          </Button>
        </form>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Noticias del equipo</h4>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {headlines.filter((h) => h.type === "employee").map((h) => (
            <li key={h.id} className="card card--default flex flex-row items-start justify-between gap-2 p-2">
              <span>{h.content}</span>
              <Button size="sm" variant="outline"
                type="button"
                className="shrink-0 text-[11px] text-red h-6 px-2"
                onPress={() => onRaiseIssue(h)}
              >
                → Issue
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          action={async () => {
            await addHeadlineAction(meetingId, "employee", employee);
            setEmployee("");
          }}
        >
          <Input fullWidth
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            placeholder="Nueva noticia del equipo"
          />
          <Button variant="outline" type="submit">
            +
          </Button>
        </form>
      </div>
    </div>
    </div>
  );
}

function ConclusionTodos({
  todos,
  members,
  startedAt,
}: {
  todos: Todo[];
  members: PublicUser[];
  startedAt: string | null;
}) {
  const from = startedAt ? new Date(startedAt).getTime() : 0;
  const created = (t: Todo) => new Date(t.created_at).getTime() >= from;
  const pending = todos.filter((t) => !created(t) && t.status === "open");
  const fresh = todos.filter(created);
  const name = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin dueño";
  const due = (d: string | null) => (d ? d.slice(5).split("-").reverse().join("/") : "sin fecha");

  const list = (items: Todo[], empty: string) =>
    items.length === 0 ? (
      <p className="text-sm text-muted">{empty}</p>
    ) : (
      <ul className="flex flex-col divide-y divide-border text-sm">
        {items.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 py-2">
            <span className={t.status === "done" ? "text-muted line-through" : ""}>{t.title}</span>
            <span className="shrink-0 text-xs text-muted">
              {name(t.owner_id)} · {due(t.due_date)}
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <Card.Header>
          <Card.Title>To-Dos que estaban pendientes ({pending.length})</Card.Title>
          <Card.Description>Venían de antes de esta reunión y siguen abiertos.</Card.Description>
        </Card.Header>
        <Card.Content>{list(pending, "No quedan To-Dos pendientes de antes. 🎉")}</Card.Content>
      </Card>
      <Card>
        <Card.Header>
          <Card.Title>To-Dos nuevos de esta reunión ({fresh.length})</Card.Title>
          <Card.Description>Confirmen dueño y fecha de cada uno.</Card.Description>
        </Card.Header>
        <Card.Content>{list(fresh, "Todavía no se crearon To-Dos en esta reunión.")}</Card.Content>
      </Card>
    </div>
  );
}

function CascadeNotes({ meetingId, initial }: { meetingId: number; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <Card.Header>
        <Card.Title>Mensajes a cascadear</Card.Title>
        <Card.Description>Qué se comunica al resto de la organización. Sale en el resumen PDF.</Card.Description>
      </Card.Header>
      <Card.Content className="gap-2">
        <TextArea
          aria-label="Mensajes a cascadear"
          fullWidth
          className="min-h-24"
          placeholder="Ej. Se aprobó el presupuesto de IRE; la campaña de FACTI arranca el lunes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            isDisabled={notes === saved}
            isPending={pending}
            onPress={() =>
              startTransition(async () => {
                await saveCascadeNotesAction(meetingId, notes);
                setSaved(notes);
              })
            }
          >
            Guardar mensajes
          </Button>
          {notes === saved && saved && <span className="text-xs text-green">Guardado</span>}
        </div>
      </Card.Content>
    </Card>
  );
}

function AttendancePanel({
  meetingId,
  attendance,
  leaderId,
  canLead,
}: {
  meetingId: number;
  attendance: AttendanceRow[];
  leaderId: number | null;
  canLead: boolean;
}) {
  const [, startTransition] = useTransition();
  const present = attendance.filter((a) => a.present).length;
  return (
    <Card>
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <Card.Title>Lista de asistencia ({present} de {attendance.length})</Card.Title>
          <Card.Description>Marca a las personas presentes. Al final, quien dirige captura la calificación de cada una.</Card.Description>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Dirige:</span>
          {canLead ? (
            <AppSelect
              aria-label="Quién dirige la reunión"
              className="w-44"
              value={leaderId ?? ""}
              onChange={(e) => e.target.value && startTransition(() => setMeetingLeaderAction(meetingId, Number(e.target.value)))}
            >
              {leaderId === null && <option value="">Sin asignar</option>}
              {attendance.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.name}
                </option>
              ))}
            </AppSelect>
          ) : (
            <span className="font-medium">{attendance.find((a) => a.user_id === leaderId)?.name ?? "Sin asignar"}</span>
          )}
        </div>
      </Card.Header>
      <Card.Content>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
          {attendance.map((a) => (
            <AppCheckbox
              key={a.user_id}
              checked={a.present}
              className="text-sm"
              onChange={(e) => startTransition(() => setAttendanceAction(meetingId, a.user_id, e.target.checked))}
            >
              {a.name}
              {a.user_id === leaderId && <span className="ml-1 text-xs text-muted">(dirige)</span>}
            </AppCheckbox>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

/** Quien dirige captura la calificación de cada asistente. */
function LeaderRatingPanel({
  meetingId,
  attendance,
  ratings,
}: {
  meetingId: number;
  attendance: AttendanceRow[];
  ratings: { user_id: number; rating: number; user_name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const present = attendance.filter((a) => a.present);
  const rated = ratings.filter((r) => present.some((a) => a.user_id === r.user_id));
  const avg = ratings.length ? (ratings.reduce((x, r) => x + r.rating, 0) / ratings.length).toFixed(1) : null;
  return (
    <Card className={pending ? "opacity-80" : ""}>
      <Card.Header>
        <Card.Title>Calificación de los asistentes (1-10)</Card.Title>
        <Card.Description>
          {rated.length} de {present.length} asistente(s) calificaron{avg && ` · Promedio: ${avg}`}. Toca el número de cada persona; usa &quot;Borrar&quot; para quitarlo.
        </Card.Description>
      </Card.Header>
      <Card.Content className="gap-3">
        {present.length === 0 && (
          <p className="text-sm text-muted">Marca primero a los asistentes en la lista de asistencia.</p>
        )}
        {present.map((a) => {
          const current = ratings.find((r) => r.user_id === a.user_id)?.rating ?? null;
          return (
            <div key={a.user_id} className="flex flex-wrap items-center gap-3 border-b border-border pb-2 last:border-0">
              <span className="w-32 shrink-0 text-sm font-medium">{a.name}</span>
              <Segmented
                aria-label={`Calificación de ${a.name}`}
                detached
                className="flex-wrap"
                options={Array.from({ length: 10 }, (_, i) => ({ id: i + 1, label: String(i + 1) }))}
                value={current}
                onChange={(n) => startTransition(() => rateAttendeeAction(meetingId, a.user_id, n))}
              />
              {current !== null && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted"
                  onPress={() => startTransition(() => rateAttendeeAction(meetingId, a.user_id, null))}
                >
                  Borrar
                </Button>
              )}
            </div>
          );
        })}
      </Card.Content>
    </Card>
  );
}

function RatingPanel({
  meetingId,
  session,
  ratings,
}: {
  meetingId: number;
  session: SessionPayload;
  ratings: { user_id: number; rating: number; user_name: string }[];
}) {
  const myRating = ratings.find((r) => r.user_id === session.userId)?.rating ?? null;
  const avg =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b.rating, 0) / ratings.length).toFixed(1)
      : null;

  return (
    <Card className="block gap-0 p-5">
      <h4 className="mb-2 font-semibold">Califica esta reunión (1-10)</h4>
      <Segmented
        aria-label="Calificación"
        detached
        size="md"
        className="flex-wrap"
        options={Array.from({ length: 10 }, (_, i) => ({ id: i + 1, label: String(i + 1) }))}
        value={myRating}
        onChange={(n) => rateMeetingAction(meetingId, n)}
      />
      <p className="mt-3 text-sm text-muted">
        {ratings.length} calificación(es){avg && ` · Promedio: ${avg}`}
      </p>
    </Card>
  );
}

export function MeetingRunner({
  meeting,
  session,
  scorecard,
  careerIndicators,
  rocks,
  milestonesByRock,
  members,
  openIssues,
  todos,
  headlines,
  events,
  ratings,
  clickupConfigured,
  attendance,
  canLead,
}: {
  meeting: Meeting;
  session: SessionPayload;
  scorecard: {
    owners: ScorecardOwner[];
    metrics: ScorecardMetric[];
    targets: ScorecardTarget[];
    grid: Record<string, number | null>;
    weeks: string[];
  };
  careerIndicators: { rows: CareerRow[]; week: string; weekLabel: string };
  rocks: Rock[];
  milestonesByRock: Record<number, RockMilestone[]>;
  members: PublicUser[];
  openIssues: Issue[];
  todos: Todo[];
  headlines: MeetingHeadline[];
  events: L10Event[];
  ratings: { user_id: number; rating: number; user_name: string }[];
  clickupConfigured: boolean;
  attendance: AttendanceRow[];
  canLead: boolean;
}) {
  const router = useRouter();
  const idx = segmentIndex(meeting.current_segment);
  const segment = idx >= 0 ? L10_AGENDA[idx] : L10_AGENDA[0];
  const upcoming = nextSegment(meeting.current_segment);
  const elapsed = useElapsed(meeting.segment_started_at);
  const totalElapsed = useElapsed(meeting.started_at);
  const remaining = segment.minutes * 60 - elapsed;
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const memberName = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin dueño";

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);

  const totalMinutes = useMemo(
    () => L10_AGENDA.reduce((a, s) => a + s.minutes, 0),
    []
  );

  if (meeting.status === "completed") {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Reunión #{meeting.id} completada</h1>
        <p className="mt-2 text-sm text-muted">
          Duró {formatClock(totalElapsed)} · Calificación promedio:{" "}
          {meeting.avg_rating ? Number(meeting.avg_rating).toFixed(1) : "-"}/10
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <a href={`/api/reuniones/${meeting.id}/resumen`} className={buttonVariants({ variant: "primary" })}>
            ⬇ Generar resumen (PDF)
          </a>
          <Link href="/meeting" className={buttonVariants({ variant: "outline" })}>
            Volver al historial
          </Link>
        </div>
        <div className="mt-4 flex justify-center">
          <SendEmailInline
            send={(extra) => sendMeetingSummaryAction(meeting.id, extra)}
            hint="Se envía con el PDF adjunto a quienes asistieron (o a todo el equipo si no se pasó lista). Puedes agregar otros correos, p. ej. jefatura."
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Incluye calificación, Scorecard, indicadores, Rocks, noticias, To-Dos pendientes y nuevos, IDS y mensajes a cascadear.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reunión Level 10 · en curso</h1>
        <p className="text-sm text-muted">
          Agenda de {totalMinutes} minutos · Tiempo total: {formatClock(totalElapsed)}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto">
        {L10_AGENDA.map((s, i) => (
          <div
            key={s.key}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              i === idx
                ? "bg-primary text-primary-foreground"
                : i < idx
                ? "bg-green-bg text-green"
                : "bg-card border border-border text-muted"
            }`}
          >
            {i < idx ? "✓ " : ""}
            {s.label} · {s.minutes}m
          </div>
        ))}
      </div>

      <Card className="mb-6 flex flex-row flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-bold">{segment.label}</h2>
          <p className="text-sm text-muted">{segment.description}</p>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`text-2xl font-bold tabular-nums ${
              remaining < 0 ? "text-red" : "text-foreground"
            }`}
          >
            {formatClock(remaining)}
          </span>
          {upcoming ? (
            <Button variant="primary"
              onPress={() => advanceSegmentAction(meeting.id, upcoming.key)}
            >
              Siguiente: {upcoming.label} →
            </Button>
          ) : (
            <Button variant="primary"
              onPress={() => completeMeetingAction(meeting.id)}
            >
              Finalizar reunión ✓
            </Button>
          )}
        </div>
      </Card>

      <QuickCreateBar onCreate={setDraft} />
      {toast && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-green-bg px-3 py-2 text-sm text-green">
          <span>✓ {toast}</span>
          <Button size="sm" variant="ghost" onPress={() => setToast(null)}>
            Cerrar
          </Button>
        </div>
      )}
      {draft && (
        <QuickCreateModal
          key={JSON.stringify(draft)}
          meetingId={meeting.id}
          draft={draft}
          members={members}
          onClose={() => setDraft(null)}
          onCreated={(message) => {
            setDraft(null);
            setToast(message);
          }}
        />
      )}

      <div className="mb-10">
        {segment.key === "segue" && (
          <div className="flex flex-col gap-4">
          <AttendancePanel meetingId={meeting.id} attendance={attendance} leaderId={meeting.leader_id} canLead={canLead} />
          <Card className="block gap-0 p-6 text-sm text-muted">
            Cada persona comparte una buena noticia personal y una del negocio.
            No hay datos que revisar en este segmento. Cuando terminen, avancen
            al Scorecard.
          </Card>
          </div>
        )}

        {segment.key === "scorecard" && (
          <div className="flex flex-col gap-8">
            {scorecard.metrics.length > 0 && scorecard.owners.length > 0 && (
              <ScorecardTable
                owners={scorecard.owners}
                metrics={scorecard.metrics}
                targets={scorecard.targets}
                grid={scorecard.grid}
                weeks={scorecard.weeks}
                onRaiseIssue={(metric, ownerName) =>
                  setDraft({
                    kind: "issue",
                    title: `Indicador fuera de meta: ${metric.name} (${ownerName})`,
                    description: metric.predicts ? `Predice: ${metric.predicts}` : "",
                    source: "Scorecard",
                  })
                }
              />
            )}
            <CareerSummary
              rows={careerIndicators.rows}
              members={members}
              week={careerIndicators.week}
              weekLabel={careerIndicators.weekLabel}
              onRaiseIssue={(r) =>
                setDraft({
                  kind: "issue",
                  title: `Leads bajo meta: ${careerLabel(r)}`,
                  description: `Semana ${careerIndicators.weekLabel}: ${num(r.leads ?? 0)} leads de una meta de ${num(r.leads_goal)}.`,
                  ownerId: r.owner_id,
                  source: "Indicadores de carrera",
                })
              }
            />
          </div>
        )}

        {segment.key === "rocks" && (
          <div className="grid gap-3 md:grid-cols-2">
            {rocks.length === 0 && (
              <p className="text-sm text-muted">No hay Rocks este trimestre.</p>
            )}
            {rocks.map((r) => (
              <RockCard
                key={r.id}
                rock={r}
                milestones={milestonesByRock[r.id] ?? []}
                members={members}
                onRaiseIssue={() =>
                  setDraft({
                    kind: "issue",
                    title: `Rock ${r.status === "off_track" ? "off track" : "a revisar"}: ${r.title}`,
                    description: r.description,
                    ownerId: r.owner_id,
                    source: "Rocks",
                  })
                }
              />
            ))}
          </div>
        )}

        {segment.key === "headlines" && (
          <HeadlinesPanel
            meetingId={meeting.id}
            headlines={headlines}
            events={events}
            onRaiseIssue={(h) => setDraft({ kind: "issue", title: h.content, source: "Noticias" })}
          />
        )}

        {segment.key === "todos" && (
          <TodoList
            todos={todos}
            members={members}
            clickupConfigured={clickupConfigured}
            onRaiseIssue={(t) =>
              setDraft({
                kind: "issue",
                title: `To-Do no cumplido: ${t.title}`,
                description: t.description,
                ownerId: t.owner_id,
                source: "To-Do List",
              })
            }
          />
        )}

        {segment.key === "ids" && (
          <div className="flex flex-col gap-4">
            <div>
              <AddIssueForm members={members} />
            </div>
            <IssueList
              openIssues={openIssues}
              solvedIssues={[]}
              members={members}
              clickupConfigured={clickupConfigured}
              onCreateTodo={(issue) =>
                setDraft({
                  kind: "todo",
                  title: issue.title,
                  description: issue.description
                    ? `${issue.description}\n\nSale del Issue: ${issue.title}`
                    : `Sale del Issue: ${issue.title}`,
                  ownerId: issue.owner_id,
                  source: `IDS · dueño del issue: ${memberName(issue.owner_id)}`,
                })
              }
            />
          </div>
        )}

        {segment.key === "conclude" && (
          <div className="flex flex-col gap-4">
            <ConclusionTodos todos={todos} members={members} startedAt={meeting.started_at} />
            <CascadeNotes meetingId={meeting.id} initial={meeting.cascade_notes ?? ""} />
            <AttendancePanel meetingId={meeting.id} attendance={attendance} leaderId={meeting.leader_id} canLead={canLead} />
            {canLead ? (
              <LeaderRatingPanel meetingId={meeting.id} attendance={attendance} ratings={ratings} />
            ) : (
              <RatingPanel meetingId={meeting.id} session={session} ratings={ratings} />
            )}
            <Card className="block gap-0 p-4 text-sm text-muted">
              Al finalizar la reunión podrás descargar el <b>resumen en PDF</b> con todo lo registrado. También puedes
              generar uno ahora:{" "}
              <a href={`/api/reuniones/${meeting.id}/resumen`} className="font-medium text-primary underline">
                vista previa del resumen (PDF)
              </a>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
