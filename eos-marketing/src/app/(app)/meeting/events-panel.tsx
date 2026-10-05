"use client";

import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import type { L10Event } from "@/lib/domain/l10-events";
import {
  createEventAction,
  deleteEventAction,
  sendEventAction,
  updateEventAction,
  type EventInput,
  type EventResult,
} from "./actions";

// Fechas sin hora: se formatean en UTC para que servidor y navegador muestren lo mismo.
const DAY = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const formatEventDate = (d: string) => DAY.format(new Date(`${d}T12:00:00Z`));

function EventForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: EventInput;
  submitLabel: string;
  onSubmit: (input: EventInput) => Promise<EventResult>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [result, setResult] = useState<EventResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await onSubmit({ title, detail, eventDate: eventDate || null });
          setResult(r);
          if (r.ok && !initial) {
            setTitle("");
            setEventDate("");
            setDetail("");
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Título del evento"
          placeholder="Evento (p. ej. Open House FISICC, feria vocacional…)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-60 flex-1"
          required
        />
        <Input
          aria-label="Fecha del evento"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="w-auto"
          title="Fecha del evento (opcional)"
        />
      </div>
      <TextArea
        fullWidth
        aria-label="Detalle del evento"
        placeholder="Detalle: lugar, hora, qué se necesita, a quién le interesa… (opcional)"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        className="min-h-16"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" isDisabled={pending || !title.trim()}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onPress={onCancel}>
            Cancelar
          </Button>
        )}
        {result && <span className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</span>}
      </div>
    </form>
  );
}

function SendForm({ event, teams, onDone }: { event: L10Event; teams: { id: number; name: string }[]; onDone: () => void }) {
  const already = new Set(event.sent_to.map((s) => s.team_id));
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<EventResult | null>(null);
  const [pending, start] = useTransition();
  const available = teams.filter((t) => !already.has(t.id));

  if (teams.length === 0) return <p className="text-sm text-muted">No hay otros equipos.</p>;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <p className="text-sm font-medium">Enviar a la próxima L10 de:</p>
      {available.length === 0 ? (
        <p className="text-sm text-muted">Ya se envió a todos los equipos.</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {available.map((t) => (
            <AppCheckbox
              key={t.id}
              checked={chosen.has(t.id)}
              onChange={(e) =>
                setChosen((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(t.id);
                  else next.delete(t.id);
                  return next;
                })
              }
            >
              {t.name}
            </AppCheckbox>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          isDisabled={pending || chosen.size === 0}
          onPress={() =>
            start(async () => {
              const r = await sendEventAction(event.id, [...chosen]);
              setResult(r);
              if (r.ok) onDone();
            })
          }
        >
          {pending ? "Enviando…" : `Enviar${chosen.size ? ` a ${chosen.size} equipo(s)` : ""}`}
        </Button>
        <Button size="sm" variant="outline" onPress={onDone}>
          Cancelar
        </Button>
        {result && !result.ok && <span className="text-sm text-red">{result.message}</span>}
      </div>
    </div>
  );
}

function EventItem({ event, teams, editable }: { event: L10Event; teams: { id: number; name: string }[]; editable: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "send">("view");
  const [pending, start] = useTransition();
  const received = event.from_team_id !== null;

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-border p-3">
        <EventForm
          initial={{ title: event.title, detail: event.detail, eventDate: event.event_date }}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            const r = await updateEventAction(event.id, input);
            if (r.ok) {
              setMode("view");
              router.refresh();
            }
            return r;
          }}
          onCancel={() => setMode("view")}
        />
      </li>
    );
  }

  return (
    <li className={`flex flex-col gap-2 rounded-lg border p-3 ${received ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <div className="flex flex-wrap items-start gap-3">
        {event.event_date && (
          <span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs font-semibold capitalize text-primary tabular-nums">
            {formatEventDate(event.event_date)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{event.title}</p>
          {event.detail && <p className="whitespace-pre-line text-sm text-muted">{event.detail}</p>}
          <p className="mt-1 text-xs text-muted">
            {received ? (
              <>
                <b className="text-primary">De: {event.from_team_name ?? "otro equipo"}</b>
                {event.author_name && ` · por ${event.author_name}`}
              </>
            ) : (
              event.author_name && `por ${event.author_name}`
            )}
          </p>
          {event.sent_to.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
              Enviado a:
              {event.sent_to.map((s) => (
                <Chip key={s.team_id} size="sm" variant="soft" color={s.read ? "success" : "default"}>
                  {s.team_name}
                  {s.read ? " · leído" : ""}
                </Chip>
              ))}
            </div>
          )}
        </div>
        {editable && (
          <div className="flex shrink-0 flex-wrap gap-1">
            {!received && (
              <>
                <Button size="sm" variant="outline" onPress={() => setMode(mode === "send" ? "view" : "send")}>
                  ↗ Enviar a otro equipo
                </Button>
                <Button size="sm" variant="ghost" onPress={() => setMode("edit")}>
                  Editar
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-red"
              isDisabled={pending}
              onPress={() => {
                const msg = received
                  ? "¿Quitar este evento de tu próxima L10?"
                  : event.sent_to.some((s) => !s.read)
                    ? "¿Quitar este evento? También se quitará de los equipos a los que lo enviaste y aún no lo leen."
                    : "¿Quitar este evento?";
                if (!confirm(msg)) return;
                start(async () => {
                  await deleteEventAction(event.id);
                  router.refresh();
                });
              }}
            >
              Quitar
            </Button>
          </div>
        )}
      </div>
      {mode === "send" && (
        <SendForm
          event={event}
          teams={teams}
          onDone={() => {
            setMode("view");
            router.refresh();
          }}
        />
      )}
    </li>
  );
}

/** Eventos que se leerán en la próxima L10: se agregan antes de la reunión y se pueden enviar a otros equipos. */
export function EventsPanel({
  events,
  teams,
  editable,
  activeMeetingId,
}: {
  events: L10Event[];
  teams: { id: number; name: string }[];
  editable: boolean;
  activeMeetingId: number | null;
}) {
  const router = useRouter();
  const own = events.filter((e) => e.from_team_id === null);
  const received = events.filter((e) => e.from_team_id !== null);

  return (
    <Card className="mb-8 flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-semibold">Eventos para la próxima L10</h2>
        <p className="text-sm text-muted">
          Agrégalos antes de la reunión: se leen en el segmento de Noticias
          {activeMeetingId ? " de la reunión en curso" : ""} y, al terminar la L10, quedan en su historial. Puedes
          enviarlos a la próxima L10 de otro equipo para que también los lean.
        </p>
      </div>
      {editable && (
        <EventForm
          submitLabel="+ Agregar evento"
          onSubmit={async (input) => {
            const r = await createEventAction(input);
            if (r.ok) router.refresh();
            return r;
          }}
        />
      )}
      {events.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay eventos para la próxima reunión.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {received.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Enviados por otros equipos ({received.length})</h3>
              <ul className="flex flex-col gap-2">
                {received.map((e) => (
                  <EventItem key={e.id} event={e} teams={teams} editable={editable} />
                ))}
              </ul>
            </section>
          )}
          {own.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted">De este equipo ({own.length})</h3>
              <ul className="flex flex-col gap-2">
                {own.map((e) => (
                  <EventItem key={e.id} event={e} teams={teams} editable={editable} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
