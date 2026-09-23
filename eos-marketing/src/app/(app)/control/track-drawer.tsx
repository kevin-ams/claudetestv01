"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/domain/types";
import type { TrackRow } from "@/lib/domain/career-tracks";
import {
  CONTROL_STAGES,
  shortDate,
  startForLaunch,
  SUGGESTED_LABELS,
  type ControlPlan,
  type TrackSummary,
} from "@/lib/domain/career-control";
import {
  removeTrackAction,
  setMilestoneDoneAction,
  setTrackLabelsAction,
  setTrackStatusAction,
  updateTrackDetailsAction,
} from "./actions";
import { StatusToggle } from "./track-card";

function LabelEditor({ track, allLabels }: { track: TrackRow; allLabels: string[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [, startTransition] = useTransition();
  const save = (labels: string[]) =>
    startTransition(async () => {
      await setTrackLabelsAction(track.career_id, labels);
      router.refresh();
    });
  const suggestions = [...new Set([...SUGGESTED_LABELS, ...allLabels])].filter((l) => !track.labels.includes(l));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {track.labels.length === 0 && <span className="text-xs text-muted">Sin etiquetas</span>}
        {track.labels.map((l) => (
          <span key={l} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {l}
            <button aria-label={`Quitar etiqueta ${l}`} onClick={() => save(track.labels.filter((x) => x !== l))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          save([...track.labels, input.trim()]);
          setInput("");
        }}
      >
        <input
          className="input text-sm"
          list="track-label-suggestions"
          placeholder="Nueva etiqueta"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <datalist id="track-label-suggestions">
          {suggestions.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <button type="submit" className="btn btn-secondary text-xs">
          Agregar
        </button>
      </form>
      <div className="flex flex-wrap gap-1">
        {suggestions.slice(0, 6).map((l) => (
          <button
            key={l}
            type="button"
            className="rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-primary hover:text-primary"
            onClick={() => save([...track.labels, l])}
          >
            + {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrackDrawer({
  plan,
  track,
  summary,
  owner,
  allLabels,
  onClose,
}: {
  plan: ControlPlan;
  track: TrackRow;
  summary: TrackSummary;
  owner: PublicUser | undefined;
  allLabels: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(track.notes);
  const [startDate, setStartDate] = useState(track.start_date);
  const today = new Date().toISOString().slice(0, 10);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Detalle de ${track.name}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card p-4">
          <div>
            <p className="text-xs text-muted">
              {track.program} · {track.level}
            </p>
            <h2 className="text-lg font-bold leading-snug">
              {track.code && <span className="mr-1 font-mono text-primary">{track.code}</span>}
              {track.name}
            </h2>
            <p className="text-sm text-muted">Responsable: {owner?.name ?? "Sin responsable"}</p>
          </div>
          <button className="text-xl text-muted" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className={`flex flex-col gap-5 p-4 ${pending ? "opacity-70" : ""}`}>
          <section className="card grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Estado</p>
              <div className="mt-1">
                <StatusToggle
                  status={track.status}
                  onChange={(s) => run(() => setTrackStatusAction(track.career_id, s))}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Lanzamiento</p>
              <p className="text-sm">
                Plan: <b>{shortDate(summary.plannedLaunch)}</b> · Previsto:{" "}
                <b className={summary.launchDelay > 0 ? "text-red" : "text-green"}>
                  {shortDate(summary.forecastLaunch)}
                </b>
                {summary.launchDelay > 0 && <span className="text-red"> (+{summary.launchDelay} d)</span>}
              </p>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted">
              Inicio del plan
              <input
                type="date"
                className="input text-sm normal-case"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted">
              …o calcular desde la fecha de lanzamiento
              <input
                type="date"
                className="input text-sm normal-case"
                onChange={(e) => e.target.value && setStartDate(startForLaunch(plan, e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted sm:col-span-2">
              Notas
              <textarea
                className="input min-h-16 text-sm normal-case"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Acuerdos, bloqueos, contactos…"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                className="btn btn-primary text-xs"
                disabled={notes === track.notes && startDate === track.start_date}
                onClick={() => run(() => updateTrackDetailsAction(track.career_id, notes, startDate))}
              >
                Guardar cambios
              </button>
            </div>
          </section>

          <section className="card p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Etiquetas</p>
            <LabelEditor track={track} allLabels={allLabels} />
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase text-muted">
              Hitos ({summary.doneCount}/{plan.milestones.length}) · ◆ = ruta crítica
            </p>
            {CONTROL_STAGES.filter((stage) => plan.milestones.some((m) => m.stage === stage.key)).map((stage) => (
              <div key={stage.key} className="overflow-hidden rounded-lg border border-border bg-card">
                <p className="px-3 py-1.5 text-xs font-bold text-white" style={{ background: stage.color }}>
                  {stage.label}
                </p>
                <ul className="divide-y divide-border">
                  {plan.milestones.filter((m) => m.stage === stage.key).map((m) => {
                    const mp = summary.plans[m.key];
                    const n = plan.milestones.indexOf(m) + 1;
                    const isCurrent = summary.current?.key === m.key;
                    return (
                      <li key={m.key} className={`p-3 ${isCurrent ? "bg-primary/5" : ""}`}>
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={Boolean(mp.doneOn)}
                            aria-label={`Completar ${m.label}`}
                            onChange={(e) =>
                              run(() =>
                                setMilestoneDoneAction(track.career_id, m.key, e.target.checked ? today : null)
                              )
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${mp.doneOn ? "text-muted line-through" : ""}`}>
                              {n}. {m.label}
                              {mp.critical && (
                                <span className="ml-1 text-xs" title="Ruta crítica: sin holgura" style={{ color: stage.color }}>
                                  ◆
                                </span>
                              )}
                              {isCurrent && <span className="ml-2 badge bg-primary/10 text-primary">Actual</span>}
                            </p>
                            <p className="mt-0.5 text-xs text-muted">{m.actions}</p>
                            <p className="mt-1 text-xs">
                              <span className="font-semibold">Completo cuando: </span>
                              {m.doneWhen}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                              <span>
                                Plan: {shortDate(mp.plannedStart)} → {shortDate(mp.plannedEnd)} ({m.days} d
                                {mp.float > 0 ? `, holgura ${mp.float} d` : ""})
                              </span>
                              {mp.doneOn ? (
                                <label className="inline-flex items-center gap-1 text-green">
                                  Completado
                                  <input
                                    type="date"
                                    className="rounded border border-transparent bg-transparent hover:border-border"
                                    value={mp.doneOn}
                                    onChange={(e) =>
                                      e.target.value &&
                                      run(() => setMilestoneDoneAction(track.career_id, m.key, e.target.value))
                                    }
                                  />
                                </label>
                              ) : mp.late ? (
                                <span className="font-semibold text-red">Atrasado</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          <button
            className="btn btn-danger self-start text-xs"
            onClick={() => {
              if (confirm(`¿Quitar "${track.name}" del tablero? Se pierde su avance de hitos.`)) {
                run(async () => {
                  await removeTrackAction(track.career_id);
                  onClose();
                });
              }
            }}
          >
            Quitar del tablero
          </button>
        </div>
      </aside>
    </div>
  );
}
