"use client";

import { ArrowRight } from "@gravity-ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { Button, Card, Input, TextArea } from "@heroui/react";
import { useState, useTransition } from "react";
import type { MeetingHeadline, PublicUser, Todo } from "@/lib/domain/types";
import type { SessionPayload } from "@/lib/auth/token";
import { addHeadlineAction, rateMeetingAction, saveCascadeNotesAction, setAttendanceAction, setMeetingLeaderAction, rateAttendeeAction } from "../actions";
import type { AttendanceRow } from "@/lib/domain/meetings";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import type { L10Event } from "@/lib/domain/l10-events";
import { EventsPanel } from "../events-panel";

export function HeadlinesPanel({
  meetingId,
  headlines,
  events,
  onRaiseIssue,
}: {
  meetingId: number;
  headlines: MeetingHeadline[];
  events: { pending: L10Event[]; past: L10Event[]; teams: { id: number; name: string }[]; currentWeek: string };
  onRaiseIssue: (headline: { content: string; detail?: string }) => void;
}) {
  const [customer, setCustomer] = useState("");
  const [employee, setEmployee] = useState("");

  return (
    <div className="flex flex-col gap-6">
    <EventsPanel
      events={events.pending}
      pastEvents={events.past}
      currentWeek={events.currentWeek}
      teams={events.teams}
      editable
      activeMeetingId={meetingId}
      inMeeting
      onRaiseIssue={(e) => onRaiseIssue({ content: e.title, detail: e.detail })}
    />
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
                <ArrowRight width={12} height={12} aria-hidden /> Issue
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
                <ArrowRight width={12} height={12} aria-hidden /> Issue
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

export function ConclusionTodos({
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
        <Card.Content>{list(pending, "No quedan To-Dos pendientes de antes.")}</Card.Content>
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

export function CascadeNotes({ meetingId, initial }: { meetingId: number; initial: string }) {
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

export function AttendancePanel({
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
export function LeaderRatingPanel({
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

export function RatingPanel({
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
