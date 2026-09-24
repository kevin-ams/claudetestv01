"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildPlan, CONTROL_STAGES, type ControlPlan, type StageKey } from "@/lib/domain/career-control";
import type { ControlMilestone } from "@/lib/domain/control-milestones";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  moveMilestoneAction,
  resetMilestonesAction,
  updateMilestoneAction,
  type SettingsResult,
} from "./actions";

function MilestoneEditor({
  milestone,
  plan,
  onClose,
}: {
  milestone: ControlMilestone;
  plan: ControlPlan;
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(milestone.label);
  const [stage, setStage] = useState<StageKey>(milestone.stage);
  const [days, setDays] = useState(String(milestone.days));
  const [actions, setActions] = useState(milestone.actions);
  const [doneWhen, setDoneWhen] = useState(milestone.doneWhen);
  const [deps, setDeps] = useState<Set<string>>(new Set(milestone.dependsOn));
  const [isLaunch, setIsLaunch] = useState(plan.launchKey === milestone.key);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Solo puede depender de hitos que van antes (según su etapa).
  const stageIdx = (k: StageKey) => CONTROL_STAGES.findIndex((s) => s.key === k);
  const myIdx = plan.milestones.findIndex((m) => m.key === milestone.key);
  const candidates = plan.milestones.filter(
    (m, i) => m.key !== milestone.key && (stageIdx(m.stage) < stageIdx(stage) || (m.stage === stage && i < myIdx))
  );

  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateMilestoneAction(milestone.id, {
            label,
            stage,
            actions,
            doneWhen,
            days: Number(days),
            dependsOn: [...deps].filter((d) => candidates.some((c) => c.key === d)),
            isLaunch,
          });
          setResult(res);
          if (res.ok) {
            router.refresh();
            onClose();
          }
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_110px]">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Nombre
          <Input fullWidth required value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Etapa
          <AppSelect fullWidth value={stage} onChange={(e) => setStage(e.target.value as StageKey)}>
            {CONTROL_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </AppSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Duración (días)
          <Input fullWidth
            type="number"
            min={0}
            max={365}
            required
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Subacciones principales
        <TextArea fullWidth className="min-h-16" value={actions} onChange={(e) => setActions(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Se considera completo cuando…
        <TextArea fullWidth className="min-h-12" value={doneWhen} onChange={(e) => setDoneWhen(e.target.value)} />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-semibold text-muted">
          Depende de (debe terminar antes de empezar este hito)
        </legend>
        {candidates.length === 0 ? (
          <p className="text-xs text-muted">Es el primer hito: no depende de ninguno.</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {candidates.map((c) => (
              <AppCheckbox
                key={c.key}
                checked={deps.has(c.key)}
                onChange={(e) => {
                  const next = new Set(deps);
                  if (e.target.checked) next.add(c.key);
                  else next.delete(c.key);
                  setDeps(next);
                }}
                className="flex items-center gap-1.5 text-sm"
              >
                {plan.milestones.indexOf(c) + 1}. {c.label}
              </AppCheckbox>
            ))}
          </div>
        )}
      </fieldset>
      <AppCheckbox checked={isLaunch} onChange={(e) => setIsLaunch(e.target.checked)} className="flex items-center gap-2 text-sm">
        Este hito marca la fecha de <b>lanzamiento</b>
      </AppCheckbox>
      {result && !result.ok && <p className="text-sm text-red">{result.message}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" type="submit" isDisabled={pending}>
          {pending ? "Guardando..." : "Guardar hito"}
        </Button>
        <Button variant="outline" size="sm" type="button" onPress={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function AddMilestoneForm({ stage }: { stage: StageKey }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex gap-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        startTransition(async () => {
          await createMilestoneAction(stage, label);
          setLabel("");
          router.refresh();
        });
      }}
    >
      <Input fullWidth
        className="text-sm"
        placeholder="+ Nuevo hito en esta etapa"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label={`Nuevo hito en ${stage}`}
      />
      <Button variant="outline" size="sm" type="submit" isDisabled={pending}>
        Agregar
      </Button>
    </form>
  );
}

export function MilestoneSettings({
  milestones,
  completions,
  canEdit,
}: {
  milestones: ControlMilestone[];
  completions: Record<string, number>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const plan = useMemo(() => buildPlan(milestones), [milestones]);
  const byKey = new Map(milestones.map((m) => [m.key, m]));

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className={`flex flex-col gap-4 ${pending ? "opacity-70" : ""}`}>
      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Hitos</p>
          <p className="text-2xl font-bold">{milestones.length}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Duración del plan</p>
          <p className="text-2xl font-bold">{plan.totalDays} días</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Lanzamiento</p>
          <p className="text-2xl font-bold">
            {plan.launchKey ? `Día ${plan.launchOffset}` : "—"}
          </p>
          <p className="text-xs text-muted">{plan.launchKey ? byKey.get(plan.launchKey)?.label : "Marca un hito como lanzamiento"}</p>
        </div>
        <p className="text-sm sm:col-span-3">
          <span className="font-semibold">Ruta crítica: </span>
          {plan.milestones
            .filter((m) => plan.critical.has(m.key))
            .map((m) => m.label)
            .join(" → ") || "—"}
        </p>
      </Card>

      {!canEdit && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Solo un administrador puede modificar los hitos.
        </p>
      )}

      {CONTROL_STAGES.map((stage) => {
        const items = plan.milestones.filter((m) => m.stage === stage.key);
        return (
          <div key={stage.key} className="overflow-hidden rounded-lg border border-border bg-card">
            <p className="px-4 py-2 text-sm font-bold text-white" style={{ background: stage.color }}>
              {stage.label}
            </p>
            <ul className="divide-y divide-border">
              {items.length === 0 && <li className="px-4 py-3 text-sm text-muted">Sin hitos en esta etapa.</li>}
              {items.map((m, i) => {
                const original = byKey.get(m.key)!;
                const node = plan.nodes[m.key];
                const n = plan.milestones.indexOf(m) + 1;
                return (
                  <li key={m.key} className="px-4 py-3">
                    {editing === original.id ? (
                      <MilestoneEditor milestone={original} plan={plan} onClose={() => setEditing(null)} />
                    ) : (
                      <div className="flex flex-wrap items-start gap-3">
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 rotate-45 items-center justify-center rounded-[3px]"
                          style={{ background: stage.color }}
                        >
                          <span className="-rotate-45 text-xs font-bold text-white">{n}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {m.label}
                            {plan.critical.has(m.key) && (
                              <Chip size="sm" color="danger" variant="soft" className="ml-2">Ruta crítica</Chip>
                            )}
                            {plan.launchKey === m.key && (
                              <Chip size="sm" color="accent" variant="soft" className="ml-2">Lanzamiento</Chip>
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {m.days} días · días {node.es}–{node.ef}
                            {node.float > 0 ? ` · holgura ${node.float} d` : ""}
                            {" · "}
                            {m.dependsOn.length
                              ? `depende de: ${m.dependsOn.map((d) => byKey.get(d)?.label ?? d).join(", ")}`
                              : "sin dependencias"}
                          </p>
                          {m.actions && <p className="mt-1 line-clamp-2 text-xs text-muted">{m.actions}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1 text-sm">
                            <Button size="sm" variant="ghost"
                              className="text-muted"
                              aria-label={`Subir ${m.label}`}
                              isDisabled={i === 0}
                              onPress={() => run(() => moveMilestoneAction(original.id, -1))}
                            >
                              ↑
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="text-muted"
                              aria-label={`Bajar ${m.label}`}
                              isDisabled={i === items.length - 1}
                              onPress={() => run(() => moveMilestoneAction(original.id, 1))}
                            >
                              ↓
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="text-xs text-primary"
                              onPress={() => setEditing(original.id)}
                            >
                              Editar
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="text-xs text-red"
                              onPress={() => {
                                const done = completions[m.key] ?? 0;
                                const warning = done
                                  ? `\n\n${done} carrera(s) lo tienen completado; ese avance se borra.`
                                  : "";
                                if (confirm(`¿Eliminar el hito "${m.label}"?${warning}`)) {
                                  run(() => deleteMilestoneAction(original.id));
                                }
                              }}
                            >
                              Eliminar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {canEdit && <AddMilestoneForm stage={stage.key} />}
          </div>
        );
      })}

      {canEdit && (
        <Button variant="outline" size="sm"
          className="self-start"
          onPress={() => {
            if (
              confirm(
                "¿Restaurar los 12 hitos predeterminados? Se pierden los cambios y el avance de los hitos agregados."
              )
            ) {
              run(() => resetMilestonesAction());
            }
          }}
        >
          Restaurar hitos predeterminados
        </Button>
      )}
    </div>
  );
}
