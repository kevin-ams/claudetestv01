"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/domain/types";
import type { TrackRow } from "@/lib/domain/career-tracks";
import {
  buildPlan,
  CONTROL_STAGES,
  DONE_COLUMN,
  summarizeTrack,
  type ColumnKey,
  type MilestoneDef,
} from "@/lib/domain/career-control";
import { normalizeText } from "@/lib/domain/careers-shared";
import { addTracksAction, moveTrackAction, setTrackStatusAction } from "./actions";
import { MilestoneTimeline } from "./milestone-timeline";
import { TrackCard } from "./track-card";
import { TrackDrawer } from "./track-drawer";

type Available = { id: number; code: string; name: string; program: string; owner_id: number | null };

function AddTracksPanel({
  launchOffset,
  available,
  members,
  onClose,
}: {
  launchOffset: number;
  available: Available[];
  members: PublicUser[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [owner, setOwner] = useState("");
  const [program, setProgram] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();

  const programs = [...new Set(available.map((c) => c.program))].sort((a, b) => a.localeCompare(b, "es"));
  const list = available.filter(
    (c) =>
      (!owner || String(c.owner_id) === owner) &&
      (!program || c.program === program) &&
      (!query || normalizeText(`${c.code} ${c.name}`).includes(normalizeText(query)))
  );
  const allSelected = list.length > 0 && list.every((c) => selected.has(c.id));

  return (
    <div className="eos-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">Agregar carreras al tablero</h2>
          <p className="text-sm text-muted">
            Entran en el hito 1. Con la fecha de inicio se calcula el plan de cada hito (el
            lanzamiento queda a {launchOffset} días según la ruta crítica).
          </p>
        </div>
        <button className="text-muted" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="eos-input !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select className="eos-input !w-auto" value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Programa">
          <option value="">Todos los programas</option>
          {programs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input
          className="eos-input !w-auto"
          type="search"
          placeholder="Buscar carrera"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          Inicio del plan
          <input type="date" className="eos-input !w-auto" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        <label className="flex items-center gap-2 border-b border-border bg-background px-3 py-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => {
              const next = new Set(selected);
              for (const c of list) {
                if (e.target.checked) next.add(c.id);
                else next.delete(c.id);
              }
              setSelected(next);
            }}
          />
          Seleccionar todas ({list.length})
        </label>
        {list.map((c) => (
          <label key={c.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-0">
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(c.id);
                else next.delete(c.id);
                setSelected(next);
              }}
            />
            {c.code && <span className="font-mono text-xs text-primary">{c.code}</span>}
            <span className="flex-1">{c.name}</span>
            <span className="text-xs text-muted">
              {c.program} · {members.find((m) => m.id === c.owner_id)?.name ?? "—"}
            </span>
          </label>
        ))}
        {list.length === 0 && <p className="p-3 text-sm text-muted">No hay carreras disponibles con esos filtros.</p>}
      </div>
      <button
        className="eos-btn eos-btn-primary self-start"
        disabled={pending || selected.size === 0}
        onClick={() =>
          startTransition(async () => {
            await addTracksAction([...selected], startDate);
            setSelected(new Set());
            router.refresh();
            onClose();
          })
        }
      >
        {pending ? "Agregando..." : `Agregar ${selected.size} carrera(s)`}
      </button>
    </div>
  );
}

export function ControlBoard({
  milestones,
  tracks,
  members,
  available,
}: {
  milestones: MilestoneDef[];
  tracks: TrackRow[];
  members: PublicUser[];
  available: Available[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [owner, setOwner] = useState("");
  const [program, setProgram] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<ColumnKey | null>(null);
  // Movimiento optimista: la tarjeta cambia de columna antes de que responda el servidor.
  const [overrides, setOverrides] = useState<Record<number, ColumnKey>>({});
  const [seenTracks, setSeenTracks] = useState(tracks);
  if (seenTracks !== tracks) {
    setSeenTracks(tracks);
    setOverrides({});
  }

  const plan = useMemo(() => buildPlan(milestones), [milestones]);
  const summaries = useMemo(
    () => new Map(tracks.map((t) => [t.career_id, summarizeTrack(plan, t.start_date, t.done)])),
    [plan, tracks]
  );
  const columnOf = (t: TrackRow): ColumnKey => overrides[t.career_id] ?? summaries.get(t.career_id)!.column;

  const programs = [...new Set(tracks.map((t) => t.program))].sort((a, b) => a.localeCompare(b, "es"));
  const allLabels = [...new Set(tracks.flatMap((t) => t.labels))].sort((a, b) => a.localeCompare(b, "es"));

  const filtered = tracks.filter(
    (t) =>
      (!owner || (owner === "none" ? t.owner_id === null : String(t.owner_id) === owner)) &&
      (!program || t.program === program) &&
      (!label || t.labels.includes(label)) &&
      (!status || t.status === status) &&
      (!query || normalizeText(`${t.code} ${t.name}`).includes(normalizeText(query)))
  );

  const counts = Object.fromEntries(
    [...plan.keys, DONE_COLUMN].map((k) => [k, filtered.filter((t) => columnOf(t) === k).length])
  ) as Record<ColumnKey, number>;
  const offTrack = filtered.filter((t) => t.status === "off_track").length;
  const late = filtered.filter((t) => summaries.get(t.career_id)!.current?.late).length;

  function move(careerId: number, column: ColumnKey) {
    setOverrides((o) => ({ ...o, [careerId]: column }));
    startTransition(async () => {
      await moveTrackAction(careerId, column);
      router.refresh();
    });
  }

  function step(t: TrackRow, delta: -1 | 1) {
    const cols: ColumnKey[] = [...plan.keys, DONE_COLUMN];
    const idx = cols.indexOf(columnOf(t));
    const next = cols[Math.min(cols.length - 1, Math.max(0, idx + delta))];
    if (next !== columnOf(t)) move(t.career_id, next);
  }

  function scrollTo(key: ColumnKey) {
    document.getElementById(`col-${key}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const openTrack = tracks.find((t) => t.career_id === openId) ?? null;

  const columnView = (key: ColumnKey, title: string, n: number | null, color: string, soft: string) => {
    const items = filtered.filter((t) => columnOf(t) === key);
    const critical = key !== DONE_COLUMN && plan.critical.has(key);
    return (
      <div
        key={key}
        id={`col-${key}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropTarget(key);
        }}
        onDragLeave={() => setDropTarget((d) => (d === key ? null : d))}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(null);
          const id = Number(e.dataTransfer.getData("text/plain"));
          const t = tracks.find((x) => x.career_id === id);
          if (t && columnOf(t) !== key) move(id, key);
        }}
        className={`flex w-64 shrink-0 flex-col rounded-lg p-2 transition ${
          dropTarget === key ? "ring-2 ring-primary" : ""
        }`}
        style={{ background: soft }}
      >
        <div className="mb-2 flex items-center gap-2 px-1">
          {n !== null ? (
            <span className="flex h-6 w-6 rotate-45 items-center justify-center rounded-[2px]" style={{ background: color }}>
              <span className="-rotate-45 text-[11px] font-bold text-white">{n}</span>
            </span>
          ) : (
            <span className="text-green">✓</span>
          )}
          <span className="flex-1 text-sm font-semibold leading-tight">
            {title}
            {critical && (
              <span className="ml-1 text-[10px] font-bold" style={{ color }} title="Ruta crítica">
                ◆ RC
              </span>
            )}
          </span>
          <span className="rounded-full bg-card px-2 text-xs font-semibold text-muted">{items.length}</span>
        </div>
        <div className="flex max-h-[75vh] min-h-24 flex-col gap-2 overflow-y-auto pr-0.5">
          {items.map((t) => (
            <TrackCard
              key={t.career_id}
              plan={plan}
              track={t}
              summary={summaries.get(t.career_id)!}
              owner={members.find((m) => m.id === t.owner_id)}
              onOpen={() => setOpenId(t.career_id)}
              onStatus={(s) =>
                startTransition(async () => {
                  await setTrackStatusAction(t.career_id, s);
                  router.refresh();
                })
              }
              onStep={(d) => step(t, d)}
              dragging={draggingId === t.career_id}
              onDragStart={() => setDraggingId(t.career_id)}
              onDragEnd={() => setDraggingId(null)}
            />
          ))}
          {items.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted">
              Suelta aquí
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <MilestoneTimeline plan={plan} counts={counts} onSelect={scrollTo} />

      <div className="eos-card flex flex-wrap items-center gap-2 p-3">
        <select className="eos-input !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value="none">Sin responsable</option>
        </select>
        <select className="eos-input !w-auto" value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Programa">
          <option value="">Todos los programas</option>
          {programs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="eos-input !w-auto" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Etiqueta">
          <option value="">Todas las etiquetas</option>
          {allLabels.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className="eos-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">On y off track</option>
          <option value="on_track">Solo on track</option>
          <option value="off_track">Solo off track</option>
        </select>
        <input
          className="eos-input !w-auto"
          type="search"
          placeholder="Buscar carrera"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar carrera"
        />
        <span className="text-sm text-muted">
          {filtered.length} carreras · <span className={offTrack ? "font-semibold text-red" : ""}>{offTrack} off track</span> ·{" "}
          <span className={late ? "font-semibold text-red" : ""}>{late} con hito atrasado</span>
        </span>
        <button className="eos-btn eos-btn-primary ml-auto" onClick={() => setAdding((v) => !v)}>
          + Agregar carreras
        </button>
      </div>

      {adding && <AddTracksPanel launchOffset={plan.launchOffset} available={available} members={members} onClose={() => setAdding(false)} />}

      {tracks.length === 0 ? (
        <div className="eos-card p-6 text-sm text-muted">
          El tablero está vacío. Usa &quot;+ Agregar carreras&quot; para empezar a darles seguimiento.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4">
            {CONTROL_STAGES.filter((stage) => plan.milestones.some((m) => m.stage === stage.key)).map((stage) => (
              <div key={stage.key} className="flex flex-col gap-2">
                <div className="rounded-md px-3 py-1.5 text-sm font-bold text-white" style={{ background: stage.color }}>
                  {stage.label}
                </div>
                <div className="flex gap-2">
                  {plan.milestones.filter((m) => m.stage === stage.key).map((m) =>
                    columnView(m.key, m.label, plan.milestones.indexOf(m) + 1, stage.color, stage.soft)
                  )}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <div className="rounded-md bg-green px-3 py-1.5 text-sm font-bold text-white">Completado</div>
              {columnView(DONE_COLUMN, "Todos los hitos", null, "var(--green)", "var(--green-bg)")}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Arrastra las tarjetas entre columnas o usa las flechas ◀ ▶. Ruta crítica (PMI/CPM): cada hito tiene una duración estimada y depende de los anteriores; los
        marcados con ◆ no tienen holgura, así que un atraso en ellos mueve la fecha de lanzamiento. El
        plan completo dura {plan.totalDays} días desde la fecha de inicio (duraciones y dependencias en Ajustes). Al mover una tarjeta, los
        hitos anteriores quedan completados con la fecha de hoy.
      </p>

      {openTrack && (
        <TrackDrawer
          plan={plan}
          track={openTrack}
          summary={summaries.get(openTrack.career_id)!}
          owner={members.find((m) => m.id === openTrack.owner_id)}
          allLabels={allLabels}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
