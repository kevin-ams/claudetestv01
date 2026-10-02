"use client";

import { Button, buttonVariants, Card, Input, TextArea } from "@heroui/react";
import { useMemo, useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { AppCheckbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { StatusSelect } from "@/components/editorial/status-select";
import {
  BUFFER_SLOTS,
  CAPA_TARGET,
  CAPAS,
  HYGIENE_FLOOR,
  isActivePiece,
  summarizePieces,
  type EditorialDate,
  type EditorialOptions,
  type EditorialPiece,
} from "@/lib/domain/editorial-shared";
import { addDaysISO, formatShortDate, formatWeekRange } from "@/lib/utils/dates";
import {
  addKeyDateAction,
  deleteKeyDateAction,
  deletePieceAction,
  savePieceAction,
  setPieceStatusAction,
  sendWeekPlanAction,
} from "./actions";
import { SendEmailInline } from "@/components/send-email-button";

type Member = { id: number; name: string };

const CAPA_COLOR: Record<string, string> = {
  Hero: "var(--capa-hero)",
  Hub: "var(--capa-hub)",
  Hygiene: "var(--capa-hygiene)",
};

function CapaTag({ capa }: { capa: string }) {
  if (!capa) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="size-2.5 rounded-sm" style={{ background: CAPA_COLOR[capa] }} aria-hidden />
      {capa}
    </span>
  );
}

export function CalendarBoard({
  weeks,
  pieces,
  bank,
  keyDates,
  members,
  options,
  currentUserId,
  editable,
  planningRecipients,
}: {
  planningRecipients: string;
  weeks: string[];
  pieces: EditorialPiece[];
  bank: EditorialPiece[];
  keyDates: EditorialDate[];
  members: Member[];
  options: EditorialOptions;
  currentUserId: number;
  editable: boolean;
}) {
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");
  const [capa, setCapa] = useState("");
  const [query, setQuery] = useState("");
  const [facultad, setFacultad] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pieces.filter(
      (p) =>
        (!person || (person === "me" ? p.assignee_id === currentUserId : person === "none" ? p.assignee_id === null : p.assignee_id === Number(person))) &&
        (!status || p.status === status) &&
        (!capa || p.capa === capa) &&
        (!facultad || p.facultad === facultad) &&
        (!q || `${p.title} ${p.facultad} ${p.carrera} ${p.note} ${p.pilar} ${p.frente}`.toLowerCase().includes(q))
    );
  }, [pieces, person, status, capa, facultad, query, currentUserId]);

  const statuses = options.estado.map((o) => o.value);
  const filtering = Boolean(person || status || capa || facultad || query.trim());

  return (
    <div className="flex flex-col gap-6">
      <MonthSummary pieces={filtered} members={members} options={options} />

      <div className="flex flex-wrap items-center gap-2">
        <AppSelect aria-label="Asignación" className="w-44" variant="secondary" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Todas las personas</option>
          <option value="me">Solo mías</option>
          {members.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.name}
            </option>
          ))}
          <option value="none">Sin asignar</option>
        </AppSelect>
        <AppSelect aria-label="Estado" className="w-52" variant="secondary" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </AppSelect>
        <AppSelect aria-label="Capa" className="w-36" variant="secondary" value={capa} onChange={(e) => setCapa(e.target.value)}>
          <option value="">Todas las capas</option>
          {CAPAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </AppSelect>
        <AppSelect aria-label="Facultad" className="w-48" variant="secondary" value={facultad} onChange={(e) => setFacultad(e.target.value)}>
          <option value="">Todas las facultades</option>
          {options.facultad.map((o) => (
            <option key={o.id} value={o.value}>
              {o.value}
            </option>
          ))}
        </AppSelect>
        <Input aria-label="Buscar pieza" placeholder="Buscar tema, facultad…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-56" />
        {filtering && (
          <Button size="sm" variant="ghost" onPress={() => { setPerson(""); setStatus(""); setCapa(""); setFacultad(""); setQuery(""); }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      <KeyDates dates={keyDates} editable={editable} options={options} />

      {weeks.map((week, i) => (
        <WeekSection
          key={week}
          index={i + 1}
          week={week}
          pieces={filtered.filter((p) => p.week_start === week)}
          allWeekPieces={pieces.filter((p) => p.week_start === week)}
          dates={keyDates.filter((d) => d.date >= week && d.date <= addDaysISO(week, 6))}
          members={members}
          options={options}
          editable={editable}
          planningRecipients={planningRecipients}
        />
      ))}

      <Bank pieces={bank} members={members} options={options} editable={editable} weeks={weeks} />

      {editable && (
        <p className="text-xs text-muted">
          Las listas de facultades, pilares, estados y frentes se editan en{" "}
          <Link href="/ajustes/listas" className="text-primary underline">
            Ajustes › Listas de contenido
          </Link>
          .
        </p>
      )}
    </div>
  );
}

// ---------------- Resumen del mes ----------------

function MonthSummary({ pieces, members, options }: { pieces: EditorialPiece[]; members: Member[]; options: EditorialOptions }) {
  const s = summarizePieces(pieces);
  const tagged = s.byCapa.Hero + s.byCapa.Hub + s.byCapa.Hygiene;
  const pilares = new Map<string, number>();
  for (const p of pieces.filter(isActivePiece)) pilares.set(p.pilar || "Sin pilar", (pilares.get(p.pilar || "Sin pilar") ?? 0) + 1);
  const pilarRows = [...pilares.entries()].sort((a, b) => b[1] - a[1]);
  const hint = (v: string) => options.pilar.find((o) => o.value === v)?.hint;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Piezas del mes</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {s.published}
          <span className="text-lg font-medium text-muted"> / {s.total} publicadas</span>
        </p>
        <p className="text-xs text-muted">
          {s.planned} planificadas · {s.buffer} de buffer · sin contar canceladas ni reprogramadas
        </p>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {[...s.byAssignee.entries()].map(([id, v]) => (
            <li key={id ?? "none"} className="flex justify-between gap-2">
              <span>{members.find((m) => m.id === id)?.name ?? "Sin asignar"}</span>
              <span className="tabular-nums text-muted">
                {v.published}/{v.total}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Mezcla Hero · Hub · Hygiene</p>
        <div className="mt-2 flex flex-col gap-2">
          {CAPAS.map((c) => {
            const pct = tagged ? Math.round((s.byCapa[c] / tagged) * 100) : 0;
            return (
              <div key={c}>
                <div className="flex justify-between text-sm">
                  <CapaTag capa={c} />
                  <span className="tabular-nums">
                    {s.byCapa[c]} · {pct}% <span className="text-muted">(obj. {CAPA_TARGET[c]}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-border/60">
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: CAPA_COLOR[c] }} />
                </div>
              </div>
            );
          })}
        </div>
        {s.hygienePct !== null && (
          <p className={`mt-3 text-xs ${s.hygienePct >= HYGIENE_FLOOR ? "text-green" : "text-red"}`}>
            Hygiene {s.hygienePct}% · piso SEO ≥ {HYGIENE_FLOOR}% {s.hygienePct >= HYGIENE_FLOOR ? "✓" : "— por debajo"}
          </p>
        )}
      </Card>
      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Mezcla por pilar</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {pilarRows.length === 0 && <li className="text-muted">Sin piezas.</li>}
          {pilarRows.map(([p, n]) => (
            <li key={p} className="flex justify-between gap-2">
              <span className="truncate" title={hint(p) ?? undefined}>
                {p}
                {hint(p) && <span className="text-xs text-muted"> · {hint(p)?.split("·")[0].trim()}</span>}
              </span>
              <span className="tabular-nums text-muted">
                {n} · {s.total ? Math.round((n / s.total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------- Fechas clave ----------------

function KeyDates({ dates, editable, options }: { dates: EditorialDate[]; editable: boolean; options: EditorialOptions }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  if (dates.length === 0 && !editable) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Fechas clave del mes</h2>
          <p className="text-xs text-muted">Días internacionales y mundiales que sirven de gancho (sobre todo para piezas Hygiene).</p>
        </div>
        {editable && (
          <Button size="sm" variant="outline" onPress={() => setAdding((v) => !v)}>
            {adding ? "Cancelar" : "+ Fecha clave"}
          </Button>
        )}
      </div>
      {adding && (
        <form
          className="mt-3 grid gap-2 md:grid-cols-4"
          action={async (fd) => {
            const r = await addKeyDateAction(fd);
            setError(r.ok ? null : r.message);
            if (r.ok) setAdding(false);
          }}
        >
          <Input type="date" name="date" aria-label="Fecha" required />
          <Input name="title" placeholder="Día internacional / mundial" aria-label="Nombre" required className="md:col-span-3" />
          <FacultadSelect options={options} />
          <Input name="carrera" placeholder="Carrera" aria-label="Carrera" />
          <AppSelect name="pilar" aria-label="Pilar sugerido" defaultValue="-">
            <option value="-">Pilar sugerido…</option>
            {options.pilar.map((o) => (
              <option key={o.id} value={o.value}>
                {o.value}
              </option>
            ))}
          </AppSelect>
          <AppSelect name="priority" aria-label="Prioridad" defaultValue="Media">
            <option value="Alta">Prioridad alta</option>
            <option value="Media">Prioridad media</option>
            <option value="Baja">Prioridad baja</option>
          </AppSelect>
          <Input name="angle" placeholder="Ángulo: por qué Galileo" aria-label="Ángulo" className="md:col-span-3" />
          <Button type="submit" variant="primary">
            Agregar
          </Button>
          <input type="hidden" name="capa" value="Hygiene" />
          {error && <p className="text-xs text-red md:col-span-4">{error}</p>}
        </form>
      )}
      {dates.length > 0 ? (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {dates.map((d) => (
            <li key={d.id} className="flex items-start gap-3 rounded-lg border border-border p-2 text-sm">
              <span className="w-20 shrink-0 font-medium capitalize">{formatShortDate(d.date)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {d.title}{" "}
                  {d.priority && (
                    <span className={`text-xs ${d.priority === "Alta" ? "text-red" : "text-muted"}`}>· {d.priority}</span>
                  )}
                </p>
                <p className="text-xs text-muted">{[d.facultad, d.carrera, d.pilar].filter(Boolean).join(" · ")}</p>
                {d.angle && <p className="text-xs">{d.angle}</p>}
                {d.note && <p className="text-xs text-muted">{d.note}</p>}
              </div>
              {editable && (
                <button type="button" aria-label={`Quitar ${d.title}`} className="text-xs text-muted hover:text-red" onClick={() => start(() => deleteKeyDateAction(d.id))}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Sin fechas clave este mes.</p>
      )}
    </Card>
  );
}

// ---------------- Semana ----------------

function WeekSection({
  planningRecipients,
  index,
  week,
  pieces,
  allWeekPieces,
  dates,
  members,
  options,
  editable,
}: {
  index: number;
  week: string;
  pieces: EditorialPiece[];
  allWeekPieces: EditorialPiece[];
  dates: EditorialDate[];
  members: Member[];
  options: EditorialOptions;
  editable: boolean;
  planningRecipients: string;
}) {
  const [adding, setAdding] = useState<null | "plan" | "buffer">(null);
  const s = summarizePieces(allWeekPieces);
  const planned = pieces.filter((p) => !p.is_buffer);
  const buffer = pieces.filter((p) => p.is_buffer);
  const bufferUsed = allWeekPieces.filter((p) => p.is_buffer && isActivePiece(p)).length;

  return (
    <section aria-label={`Semana ${index}`} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            Semana {index} <span className="text-sm font-normal text-muted">· {formatWeekRange(week)}</span>
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              {s.published}/{s.total} publicadas
            </span>
            <span>
              Hero {s.byCapa.Hero} · Hub {s.byCapa.Hub} · Hygiene {s.byCapa.Hygiene}
            </span>
            {s.hygienePct !== null && (
              <span className={s.hygienePct >= HYGIENE_FLOOR ? "text-green" : "text-red"}>Hygiene {s.hygienePct}%</span>
            )}
            <span className={bufferUsed > BUFFER_SLOTS ? "text-red" : ""}>
              Buffer {bufferUsed}/{BUFFER_SLOTS}
            </span>
            {dates.map((d) => (
              <span key={d.id} className="text-primary">
                📅 {formatShortDate(d.date)}: {d.title}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <SendEmailInline
            label="✉ Enviar planificación"
            variant="secondary"
            size="sm"
            requireRecipients
            defaultRecipients={planningRecipients}
            placeholder="Correos de jefatura, separados por coma"
            hint="Se envía el PDF de esta semana. Los correos quedan guardados para la próxima vez."
            send={(to) => sendWeekPlanAction(week, to)}
          />
          <a
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`/api/calendario/planificacion?semana=${week}`}
            target="_blank"
            rel="noopener"
          >
            Ver PDF
          </a>
        {editable && (
          <>
            <Button size="sm" variant="outline" onPress={() => setAdding(adding === "plan" ? null : "plan")}>
              + Pieza
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setAdding(adding === "buffer" ? null : "buffer")}>
              + Esporádica
            </Button>
          </>
        )}
        </div>
      </div>
      {adding && (
        <PieceForm
          piece={null}
          defaults={{ week_start: week, is_buffer: adding === "buffer" }}
          members={members}
          options={options}
          onDone={() => setAdding(null)}
        />
      )}
      <PieceTable pieces={planned} members={members} options={options} editable={editable} empty="Sin piezas planificadas." />
      {(buffer.length > 0 || bufferUsed > 0) && (
        <>
          <h3 className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Buffer esporádico / reactivo ({bufferUsed}/{BUFFER_SLOTS} slots)
          </h3>
          <PieceTable pieces={buffer} members={members} options={options} editable={editable} empty="" />
        </>
      )}
    </section>
  );
}

function PieceTable({
  pieces,
  members,
  options,
  editable,
  empty,
}: {
  pieces: EditorialPiece[];
  members: Member[];
  options: EditorialOptions;
  editable: boolean;
  empty: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [, start] = useTransition();
  if (pieces.length === 0) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  const statuses = options.estado.map((o) => o.value);
  return (
    <Card className="block gap-0 overflow-x-auto p-0">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="w-24 px-3 py-2">Fecha</th>
            <th className="px-2">Pieza / Tema</th>
            <th className="w-36 px-2">Pilar</th>
            <th className="w-20 px-2">Capa</th>
            <th className="w-24 px-2">Asignación</th>
            <th className="w-28 px-2">Frente</th>
            <th className="w-40 px-2">Estado</th>
            {editable && <th className="w-20 px-2" />}
          </tr>
        </thead>
        <tbody>
          {pieces.map((p) =>
            editing === p.id ? (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td colSpan={editable ? 8 : 7} className="p-2">
                  <PieceForm piece={p} members={members} options={options} onDone={() => setEditing(null)} />
                </td>
              </tr>
            ) : (
              <tr key={p.id} className={`border-b border-border align-top last:border-0 ${p.status === "Cancelado" ? "opacity-60" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2 capitalize text-muted">{p.pub_date ? formatShortDate(p.pub_date) : "—"}</td>
                <td className="px-2 py-2">
                  <p className={`font-medium ${p.status === "Cancelado" ? "line-through" : ""}`}>
                    {p.title}
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1.5 text-xs font-normal text-primary underline"
                        aria-label={`Ver publicación: ${p.title}`}
                      >
                        Ver publicación ↗
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {[[p.facultad, p.carrera].filter(Boolean).join(" / "), p.audiencia, p.cta && `CTA: ${p.cta}`].filter(Boolean).join(" · ")}
                  </p>
                  {p.note && <p className="text-xs italic text-muted">{p.note}</p>}
                </td>
                <td className="px-2 py-2 text-xs">{p.pilar || "—"}</td>
                <td className="px-2 py-2">
                  <CapaTag capa={p.capa} />
                </td>
                <td className="px-2 py-2 text-xs">{members.find((m) => m.id === p.assignee_id)?.name ?? "—"}</td>
                <td className="px-2 py-2 text-xs">{p.frente || "—"}</td>
                <td className="px-2 py-2">
                  <StatusSelect
                    label={`Estado de ${p.title}`}
                    status={p.status}
                    options={statuses}
                    disabled={!editable}
                    onChange={(s) => setPieceStatusAction(p.id, s)}
                  />
                </td>
                {editable && (
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-label={`Editar ${p.title}`} onPress={() => setEditing(p.id)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-red"
                      aria-label={`Eliminar ${p.title}`}
                      onPress={() => {
                        if (confirm(`¿Eliminar "${p.title}"?`)) start(() => deletePieceAction(p.id));
                      }}
                    >
                      ✕
                    </Button>
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------- Banco de ideas ----------------

function Bank({
  pieces,
  members,
  options,
  editable,
  weeks,
}: {
  pieces: EditorialPiece[];
  members: Member[];
  options: EditorialOptions;
  editable: boolean;
  weeks: string[];
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Banco de ideas ({pieces.length})</h2>
          <p className="text-xs text-muted">
            Colchón perenne (Banco Hygiene): temas listos para cubrir un slot cuando falte contenido. Edita una idea y asígnale
            semana para programarla.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onPress={() => setOpen((v) => !v)}>
            {open ? "Ocultar" : "Ver banco"}
          </Button>
          {editable && (
            <Button size="sm" variant="ghost" onPress={() => { setOpen(true); setAdding((v) => !v); }}>
              + Idea
            </Button>
          )}
        </div>
      </div>
      {adding && (
        <PieceForm
          piece={null}
          defaults={{ week_start: null, status: "Por producir", capa: "Hygiene" }}
          members={members}
          options={options}
          onDone={() => setAdding(false)}
          weekHint={weeks[0]}
        />
      )}
      {open && <PieceTable pieces={pieces} members={members} options={options} editable={editable} empty="El banco está vacío." />}
    </section>
  );
}

// ---------------- Formulario de pieza ----------------

function PieceForm({
  piece,
  defaults,
  members,
  options,
  onDone,
  weekHint,
}: {
  piece: EditorialPiece | null;
  defaults?: Partial<EditorialPiece>;
  members: Member[];
  options: EditorialOptions;
  onDone: () => void;
  weekHint?: string;
}) {
  const v = { ...defaults, ...piece } as Partial<EditorialPiece>;
  const [inBank, setInBank] = useState(v.week_start === null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listId = `frentes-${piece?.id ?? "new"}`;
  const withCurrent = (list: string[], cur?: string) => (cur && !list.includes(cur) ? [cur, ...list] : list);

  return (
    <form
      className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (inBank) fd.set("week_start", "banco");
        start(async () => {
          const r = await savePieceAction(piece?.id ?? null, fd);
          setError(r.ok ? null : r.message);
          if (r.ok) onDone();
        });
      }}
    >
      <Input name="title" aria-label="Pieza / Tema" placeholder="Pieza / Tema" defaultValue={v.title ?? ""} required className="md:col-span-4" autoFocus />
      <label className="flex flex-col text-xs text-muted">
        Fecha de publicación
        <Input type="date" name="pub_date" aria-label="Fecha de publicación" defaultValue={v.pub_date ?? ""} />
      </label>
      <label className="flex flex-col text-xs text-muted">
        Semana (cualquier día)
        <Input
          type="date"
          name="week_start"
          aria-label="Semana"
          defaultValue={v.week_start ?? weekHint ?? ""}
          disabled={inBank}
        />
      </label>
      <AppSelect name="pilar" aria-label="Pilar" defaultValue={v?.pilar || "-"} className="md:col-span-2">
        <option value="-">Pilar…</option>
        {withCurrent(options.pilar.map((o) => o.value), v.pilar).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </AppSelect>
      <AppSelect name="capa" aria-label="Capa" defaultValue={v?.capa || "-"}>
        <option value="-">Capa…</option>
        {CAPAS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </AppSelect>
      <AppSelect name="assignee_id" aria-label="Asignación" defaultValue={v.assignee_id ? String(v.assignee_id) : "-"}>
        <option value="-">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={String(m.id)}>
            {m.name}
          </option>
        ))}
      </AppSelect>
      <AppSelect name="status" aria-label="Estado" defaultValue={v.status ?? "Programado"} className="md:col-span-2">
        {withCurrent(options.estado.map((o) => o.value), v.status).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </AppSelect>
      <Input name="frente" aria-label="Frente" placeholder="Frente (Eventos, Carreras…)" defaultValue={v.frente ?? ""} list={listId} className="md:col-span-2" />
      <datalist id={listId}>
        {options.frente.map((o) => (
          <option key={o.id} value={o.value} />
        ))}
      </datalist>
      <FacultadSelect options={options} value={v.facultad} />
      <Input name="carrera" aria-label="Carrera" placeholder="Carrera / programa" defaultValue={v.carrera ?? ""} />
      <Input name="cta" aria-label="CTA sugerido" placeholder="CTA sugerido" defaultValue={v.cta ?? ""} className="md:col-span-2" />
      <Input name="audiencia" aria-label="Audiencia" placeholder="Audiencia" defaultValue={v.audiencia ?? ""} className="md:col-span-3" />
      <Input name="link" type="url" aria-label="Link de la publicación" placeholder="Link de la publicación (https://…)" defaultValue={v.link ?? ""} className="md:col-span-3" />
      <TextArea name="note" aria-label="Nota" placeholder="Nota" defaultValue={v.note ?? ""} className="min-h-10 md:col-span-6" />
      <div className="flex flex-wrap items-center gap-4 md:col-span-6">
        <AppCheckbox name="is_buffer" defaultChecked={Boolean(v.is_buffer)}>
          Esporádica (usa slot de buffer)
        </AppCheckbox>
        <AppCheckbox checked={inBank} onChange={(e) => setInBank(e.target.checked)}>
          Banco de ideas (sin semana)
        </AppCheckbox>
        <div className="ml-auto flex gap-2">
          <Button type="submit" variant="primary" size="sm" isDisabled={pending}>
            {piece ? "Guardar" : "Agregar"}
          </Button>
          <Button type="button" variant="outline" size="sm" onPress={onDone}>
            Cancelar
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-red md:col-span-6">{error}</p>}
    </form>
  );
}

/** Facultad / instituto de la lista de Ajustes (conserva un valor antiguo que ya no esté en la lista). */
function FacultadSelect({ options, value }: { options: EditorialOptions; value?: string }) {
  const list = options.facultad.map((o) => o.value);
  const all = value && !list.includes(value) ? [value, ...list] : list;
  return (
    <AppSelect name="facultad" aria-label="Facultad / instituto" defaultValue={value || "-"}>
      <option value="-">Facultad / instituto…</option>
      {all.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </AppSelect>
  );
}
