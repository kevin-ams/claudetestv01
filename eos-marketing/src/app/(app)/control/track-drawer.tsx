"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Chip, CloseButton, Drawer, Input, TextArea } from "@heroui/react";
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
            <Button size="sm" variant="ghost" aria-label={`Quitar etiqueta ${l}`} onPress={() => save(track.labels.filter((x) => x !== l))}>
              ×
            </Button>
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
        <Input fullWidth
          className="text-sm"
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
        <Button variant="outline" size="sm" type="submit">
          Agregar
        </Button>
      </form>
      <div className="flex flex-wrap gap-1">
        {suggestions.slice(0, 6).map((l) => (
          <Button size="sm" variant="outline"
            key={l}
            type="button"
            className="text-[11px] text-muted h-6 px-2"
            onPress={() => save([...track.labels, l])}
          >
            + {l}
          </Button>
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
    <Drawer.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content placement="right" className="w-full max-w-xl">
      <Drawer.Dialog
        className="flex h-full flex-col gap-0 overflow-y-auto bg-background p-0"
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
          <CloseButton onPress={onClose} aria-label="Cerrar" />
        </div>

        <div className={`flex flex-col gap-5 p-4 ${pending ? "opacity-70" : ""}`}>
          <section className="card card--default grid gap-3 p-4 sm:grid-cols-2">
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
              <Input fullWidth
                type="date"
                className="text-sm normal-case"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted">
              …o calcular desde la fecha de lanzamiento
              <Input fullWidth
                type="date"
                className="text-sm normal-case"
                onChange={(e) => e.target.value && setStartDate(startForLaunch(plan, e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted sm:col-span-2">
              Notas
              <TextArea fullWidth
                className="min-h-16 text-sm normal-case"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Acuerdos, bloqueos, contactos…"
              />
            </label>
            <div className="sm:col-span-2">
              <Button variant="primary" size="sm"
                isDisabled={notes === track.notes && startDate === track.start_date}
                onPress={() => run(() => updateTrackDetailsAction(track.career_id, notes, startDate))}
              >
                Guardar cambios
              </Button>
            </div>
          </section>

          <section className="card card--default block gap-0 p-4">
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
                          <AppCheckbox
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
                              {isCurrent && <Chip size="sm" color="accent" variant="soft" className="ml-2">Actual</Chip>}
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
                                  <Input
                                    type="date"
                                    className="shadow-none rounded border border-transparent bg-transparent px-1 py-0 text-xs hover:border-border"
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

          <Button variant="danger-soft" size="sm"
            className="self-start"
            onPress={() => {
              if (confirm(`¿Quitar "${track.name}" del tablero? Se pierde su avance de hitos.`)) {
                run(async () => {
                  await removeTrackAction(track.career_id);
                  onClose();
                });
              }
            }}
          >
            Quitar del tablero
          </Button>
        </div>
      </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
