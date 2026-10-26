"use client";

import { ArrowRight, ChevronLeft, ChevronRight, CloudArrowUpIn, Pencil, Xmark } from "@gravity-ui/icons";
import { Button, Chip, Input, TextArea } from "@heroui/react";
import Link from "next/link";
import { Fragment, useEffect, useState, useTransition } from "react";
import { clickUpOptionsAction } from "@/app/(app)/clickup-actions";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import type { AgendaItem, AgendaStatus, ClickUpWeekTask } from "@/lib/domain/team-agenda-shared";
import type { PublicUser } from "@/lib/domain/types";
import type { ClickUpOptions } from "@/lib/integrations/clickup";
import {
  addAgendaItemAction,
  agendaToIssueAction,
  clickUpAgendaTasksAction,
  deleteAgendaItemAction,
  importClickUpAgendaAction,
  setAgendaStatusAction,
  updateAgendaItemAction,
} from "./agenda-actions";

type Result = { ok: boolean; message: string };
const STALE = "No se pudo completar. Si se publicó una versión nueva, recarga la página.";
const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

const DAY = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortDate = (d: string) => DAY.format(new Date(`${d}T12:00:00Z`));
const NOTE_PLACEHOLDER = "¿En qué trabajarás esta semana? Escribe libremente, por ejemplo una línea por tema.";

/** Texto de la nota con los enlaces activos. */
function NoteText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="whitespace-pre-line break-words text-sm">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary underline">
            {part.includes("clickup.com") ? "ver en ClickUp" : part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </p>
  );
}

/** Semáforo: On track (verde) u Off track (rojo). */
function StatusToggle({ value, disabled, onChange }: { value: AgendaStatus; disabled?: boolean; onChange: (v: AgendaStatus) => void }) {
  const opt = (v: AgendaStatus, label: string, on: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={value === v}
      onClick={() => value !== v && onChange(v)}
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${
        value === v ? on : "text-muted hover:bg-default"
      }`}
    >
      <span className={`size-2 rounded-full ${v === "on_track" ? "bg-green" : "bg-red"}`} aria-hidden />
      {label}
    </button>
  );
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border p-0.5" role="group" aria-label="Semáforo">
      {opt("on_track", "On track", "bg-green-bg text-green")}
      {opt("off_track", "Off track", "bg-red-bg text-red")}
    </span>
  );
}

function MemberSelect({ members, value, onChange, label }: { members: PublicUser[]; value: number; onChange: (id: number) => void; label: string }) {
  return (
    <AppSelect aria-label={label} className="w-44" value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
      {members.map((m) => (
        <option key={m.id} value={String(m.id)}>
          {m.name}
        </option>
      ))}
    </AppSelect>
  );
}

/** Nota de una persona: texto libre, responsable, fecha y semáforo. */
function AgendaNote({
  item,
  members,
  editable,
  canRaiseIssues,
  onMessage,
}: {
  item: AgendaItem;
  members: PublicUser[];
  editable: boolean;
  canRaiseIssues: boolean;
  onMessage: (r: Result) => void;
}) {
  const [status, setStatus] = useState(item.status);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note);
  const [owner, setOwner] = useState(item.user_id);
  const [due, setDue] = useState(item.due_date ?? "");
  const [pending, start] = useTransition();

  const changeStatus = (v: AgendaStatus) => {
    setStatus(v);
    start(async () => {
      const r = await safe(setAgendaStatusAction(item.id, v), { ok: false, message: STALE });
      if (!r.ok) {
        setStatus(item.status);
        onMessage(r);
      }
    });
  };

  return (
    <li className={`card card--default flex flex-col gap-2 p-3 ${status === "off_track" ? "border-l-4 border-l-red" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{item.user_name}</span>
        <StatusToggle value={status} disabled={!editable} onChange={changeStatus} />
        {item.due_date && !editing && <span className="text-xs text-muted">Fecha: {shortDate(item.due_date)}</span>}
        {item.issue_id && (
          <Chip size="sm" variant="soft" color="warning">
            En Issues
          </Chip>
        )}
        {editable && !editing && (
          <span className="ml-auto flex items-center gap-1">
            {canRaiseIssues && !item.issue_id && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] text-red"
                isDisabled={pending}
                onPress={() => start(async () => onMessage(await safe(agendaToIssueAction(item.id), { ok: false, message: STALE })))}
              >
                <ArrowRight width={12} height={12} aria-hidden /> Issue
              </Button>
            )}
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Editar la agenda de ${item.user_name}`} onPress={() => setEditing(true)}>
              <Pencil aria-hidden />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="text-red"
              aria-label={`Quitar la agenda de ${item.user_name}`}
              isDisabled={pending}
              onPress={() => {
                if (!confirm(`¿Quitar la agenda de ${item.user_name} de esta semana?`)) return;
                start(async () => {
                  const r = await safe(deleteAgendaItemAction(item.id), { ok: false, message: STALE });
                  if (!r.ok) onMessage(r);
                });
              }}
            >
              <Xmark aria-hidden />
            </Button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <TextArea aria-label="Agenda" placeholder={NOTE_PLACEHOLDER} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-40" fullWidth autoFocus />
          <div className="flex flex-wrap items-center gap-2">
            <MemberSelect members={members} value={owner} onChange={setOwner} label="Persona" />
            <Input aria-label="Fecha" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" />
            <Button
              size="sm"
              variant="primary"
              isPending={pending}
              isDisabled={!note.trim()}
              onPress={() =>
                start(async () => {
                  const r = await safe(updateAgendaItemAction(item.id, { note, userId: owner, dueDate: due || null }), { ok: false, message: STALE });
                  if (r.ok) setEditing(false);
                  else onMessage(r);
                })
              }
            >
              Guardar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setNote(item.note);
                setOwner(item.user_id);
                setDue(item.due_date ?? "");
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <NoteText text={item.note} />
      )}
    </li>
  );
}

// Las opciones de ClickUp se piden una vez por visita a la página.
let optionsPromise: ReturnType<typeof clickUpOptionsAction> | null = null;
const LISTS_KEY = "eos.agenda.clickup.lists";

function ClickUpImport({
  week,
  members,
  currentUserId,
  onClose,
  onMessage,
}: {
  week: string;
  members: PublicUser[];
  currentUserId: number;
  onClose: () => void;
  onMessage: (r: Result) => void;
}) {
  const [options, setOptions] = useState<ClickUpOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState(currentUserId);
  const [assignee, setAssignee] = useState("-");
  const [wholeSpace, setWholeSpace] = useState(true);
  const [lists, setLists] = useState<Set<string>>(new Set());
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [tasks, setTasks] = useState<ClickUpWeekTask[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searching, startSearch] = useTransition();
  const [importing, startImport] = useTransition();

  const matchAssignee = (opts: ClickUpOptions, id: number) => {
    const email = members.find((m) => m.id === id)?.email.toLowerCase();
    const hit = email ? opts.members.find((m) => m.email.toLowerCase() === email) : undefined;
    return hit ? String(hit.id) : "-";
  };

  // Carga las listas y personas de ClickUp una vez, al abrir (con la persona de ese momento).
  const [opening] = useState(() => ({ email: members.find((m) => m.id === currentUserId)?.email.toLowerCase() ?? "" }));
  useEffect(() => {
    let cancelled = false;
    optionsPromise ??= clickUpOptionsAction();
    safe(optionsPromise, { ok: false as const, message: STALE }).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        optionsPromise = null;
        setError(r.message);
        return;
      }
      setOptions(r.options);
      const hit = opening.email ? r.options.members.find((m) => m.email.toLowerCase() === opening.email) : undefined;
      setAssignee(hit ? String(hit.id) : "-");
      try {
        const saved = JSON.parse(localStorage.getItem(LISTS_KEY) ?? "null") as string[] | null;
        const valid = (saved ?? []).filter((id) => r.options.lists.some((l) => l.id === id));
        if (valid.length) {
          setLists(new Set(valid));
          setWholeSpace(false);
        }
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, [opening]);

  const search = () =>
    startSearch(async () => {
      setTasks(null);
      try {
        localStorage.setItem(LISTS_KEY, JSON.stringify(wholeSpace ? [] : [...lists]));
      } catch {}
      const r = await safe(
        clickUpAgendaTasksAction({ week, userId, assigneeId: Number(assignee), listIds: wholeSpace ? [] : [...lists], includeOverdue }),
        { ok: false, message: STALE, tasks: [] }
      );
      if (!r.ok) {
        onMessage(r);
        return;
      }
      setTasks(r.tasks);
      setChosen(new Set(r.tasks.filter((t) => !t.imported).map((t) => t.id)));
      if (r.message) onMessage({ ok: true, message: r.message });
    });

  const toggle = <T,>(set: Set<T>, v: T, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(v);
    else next.delete(v);
    return next;
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Agregar tareas de ClickUp a la agenda</h4>
        <Button size="sm" variant="ghost" onPress={onClose}>
          Cerrar
        </Button>
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      {loading && !options && <p className="text-xs text-muted">Leyendo listas y personas de ClickUp…</p>}
      {options && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Agenda de
              <MemberSelect
                members={members}
                value={userId}
                label="Agenda de"
                onChange={(id) => {
                  setUserId(id);
                  setAssignee(matchAssignee(options, id));
                  setTasks(null);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Tareas asignadas en ClickUp a
              <AppSelect aria-label="Persona en ClickUp" className="w-48" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="-">Elegir persona…</option>
                {options.members.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}
                  </option>
                ))}
              </AppSelect>
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <AppCheckbox checked={wholeSpace} onChange={(e) => setWholeSpace(e.target.checked)}>
              <span className="text-sm">Todo el espacio {options.space}</span>
            </AppCheckbox>
            {!wholeSpace && (
              <div className="ml-6 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                {options.lists.map((l) => (
                  <AppCheckbox key={l.id} checked={lists.has(l.id)} onChange={(e) => setLists(toggle(lists, l.id, e.target.checked))}>
                    <span className="text-xs">{l.folder ? `${l.folder} › ${l.name}` : l.name}</span>
                  </AppCheckbox>
                ))}
              </div>
            )}
            <AppCheckbox checked={includeOverdue} onChange={(e) => setIncludeOverdue(e.target.checked)}>
              <span className="text-sm">Incluir tareas vencidas sin cerrar (la agenda queda en Off track)</span>
            </AppCheckbox>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            isPending={searching}
            isDisabled={assignee === "-" || (!wholeSpace && lists.size === 0)}
            onPress={search}
          >
            Buscar tareas de la semana
          </Button>

          {tasks && tasks.length > 0 && (
            <>
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <AppCheckbox
                      checked={chosen.has(t.id)}
                      disabled={t.imported}
                      onChange={(e) => setChosen(toggle(chosen, t.id, e.target.checked))}
                      aria-label={t.name}
                    />
                    <span className="min-w-0 flex-1">
                      <a href={t.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {t.name}
                      </a>
                      <span className="block text-[11px] text-muted">
                        {[t.dueDate ? shortDate(t.dueDate) : "Sin fecha", t.list, t.status].filter(Boolean).join(" · ")}
                        {t.overdue && <span className="ml-1 font-semibold text-red">Vencida</span>}
                        {t.imported && <span className="ml-1">· ya está en la agenda</span>}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="primary"
                className="self-start"
                isPending={importing}
                isDisabled={chosen.size === 0}
                onPress={() =>
                  startImport(async () => {
                    const r = await safe(
                      importClickUpAgendaAction({
                        week,
                        userId,
                        tasks: tasks.filter((t) => chosen.has(t.id)).map(({ id, name, url, list, dueDate, overdue }) => ({ id, name, url, list, dueDate, overdue })),
                      }),
                      { ok: false, message: STALE }
                    );
                    onMessage(r);
                    if (r.ok) onClose();
                  })
                }
              >
                Agregar {chosen.size} tarea(s) a la agenda
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Agenda del equipo: una nota por persona y semana (en qué trabajará), con fecha y semáforo On/Off track.
 * Lo que haya que hablar pasa a Issues. Se pueden agregar tareas de ClickUp a la nota.
 */
export function TeamAgendaPanel({
  week,
  weekLabel,
  items,
  members,
  currentUserId,
  editable,
  canRaiseIssues = true,
  clickupConfigured,
  nav,
}: {
  week: string;
  weekLabel: string;
  items: AgendaItem[];
  members: PublicUser[];
  currentUserId: number;
  editable: boolean;
  canRaiseIssues?: boolean;
  clickupConfigured: boolean;
  /** Antes de la L10: cambiar de semana (p. ej. llenar el viernes la agenda de la próxima). */
  nav?: { prevHref: string; nextHref: string; defaultHref: string | null; isDefault: boolean };
}) {
  // Mi agenda primero; luego el resto por nombre.
  const people = [...members].sort((a, b) => Number(b.id === currentUserId) - Number(a.id === currentUserId) || a.name.localeCompare(b.name, "es"));
  const has = new Set(items.map((i) => i.user_id));
  const without = people.filter((m) => !has.has(m.id));
  const notes = people.flatMap((m) => items.filter((i) => i.user_id === m.id));
  const off = items.filter((i) => i.status === "off_track").length;

  const [owner, setOwner] = useState(without[0]?.id ?? currentUserId);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<Result | null>(null);
  const [adding, startAdd] = useTransition();
  // Si la persona elegida ya tiene su agenda (p. ej. después de guardar), se pasa a la siguiente sin agenda.
  const ownerFree = without.some((m) => m.id === owner) ? owner : (without[0]?.id ?? null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Agenda del equipo</h3>
          <p className="text-xs text-muted">
            Semana {weekLabel}
            {nav?.isDefault ? " (la de la próxima L10)" : ""}: una nota por persona con lo que trabajará en la semana. Llénala
            antes de la reunión; si hay algo que hablar, pásala a Issue.
          </p>
          {nav && (
            <span className="mt-1 flex flex-wrap items-center gap-1 text-xs">
              <Link href={nav.prevHref} scroll={false} className="inline-flex items-center rounded-md px-1.5 py-0.5 text-muted hover:bg-default" aria-label="Semana anterior">
                <ChevronLeft width={14} height={14} aria-hidden /> Anterior
              </Link>
              <Link href={nav.nextHref} scroll={false} className="inline-flex items-center rounded-md px-1.5 py-0.5 text-muted hover:bg-default" aria-label="Semana siguiente">
                Siguiente <ChevronRight width={14} height={14} aria-hidden />
              </Link>
              {nav.defaultHref && (
                <Link href={nav.defaultHref} scroll={false} className="rounded-md px-1.5 py-0.5 text-primary hover:bg-default">
                  Ir a la semana de la próxima L10
                </Link>
              )}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1">
          <Chip size="sm" variant="soft" color="success">
            {items.length - off} on track
          </Chip>
          <Chip size="sm" variant="soft" color={off ? "danger" : "default"}>
            {off} off track
          </Chip>
        </span>
      </div>

      {editable && ownerFree !== null && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            startAdd(async () => {
              const r = await safe(addAgendaItemAction(week, { note, userId: ownerFree, dueDate: due || null }), { ok: false, message: STALE });
              if (r.ok) {
                setNote("");
                setDue("");
              } else setMessage(r);
            });
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Agenda de</span>
            <MemberSelect members={without} value={ownerFree} onChange={setOwner} label="Persona" />
            <Input aria-label="Fecha (opcional)" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" />
          </div>
          <TextArea aria-label="Agenda de la semana" placeholder={NOTE_PLACEHOLDER} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-28" fullWidth />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" isPending={adding} isDisabled={!note.trim()}>
              Guardar agenda
            </Button>
            {clickupConfigured && !importing && (
              <Button variant="outline" onPress={() => setImporting(true)}>
                <CloudArrowUpIn aria-hidden /> Agregar tareas de ClickUp
              </Button>
            )}
          </div>
        </form>
      )}
      {editable && ownerFree === null && clickupConfigured && !importing && (
        <Button variant="outline" size="sm" className="self-start" onPress={() => setImporting(true)}>
          <CloudArrowUpIn aria-hidden /> Agregar tareas de ClickUp
        </Button>
      )}

      {importing && (
        <ClickUpImport week={week} members={people} currentUserId={ownerFree ?? currentUserId} onClose={() => setImporting(false)} onMessage={setMessage} />
      )}

      {message && (
        <p className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`} role="status">
          {message.message}
          <Button size="sm" variant="ghost" onPress={() => setMessage(null)}>
            Cerrar
          </Button>
        </p>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted">Todavía nadie agregó su agenda de esta semana.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((i) => (
            <AgendaNote
              key={`${i.id}-${i.updated_at}-${i.status}`}
              item={i}
              members={people}
              editable={editable}
              canRaiseIssues={canRaiseIssues}
              onMessage={setMessage}
            />
          ))}
        </ul>
      )}
      {without.length > 0 && notes.length > 0 && <p className="text-xs text-muted">Sin agenda todavía: {without.map((m) => m.name).join(", ")}.</p>}
    </section>
  );
}
