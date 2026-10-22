"use client";

import { useActionState, useState, useTransition } from "react";
import type { StageKind, StageWithCount } from "@/lib/domain/types";
import {
  addStageAction,
  deleteStageAction,
  moveStageAction,
  updateStageAction,
  type ActionResult,
} from "./actions";

const KIND_OPTIONS: { value: StageKind; label: string }[] = [
  { value: "open", label: "Abierta" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
];

const KIND_BADGE: Record<StageKind, string> = {
  open: "bg-brand-tint text-brand",
  won: "bg-green-bg text-green",
  lost: "bg-red-bg text-red",
};

function StageFields({ stage }: { stage?: StageWithCount }) {
  return (
    <>
      <input
        name="name"
        defaultValue={stage?.name}
        placeholder="Nombre de la etapa"
        className="input flex-1"
        required
      />
      <div className="flex items-center gap-1">
        <input
          name="probability"
          type="number"
          min={0}
          max={100}
          defaultValue={stage?.probability ?? 50}
          className="input w-20"
          aria-label="Probabilidad"
        />
        <span className="text-sm text-muted">%</span>
      </div>
      <select name="kind" defaultValue={stage?.kind ?? "open"} className="input w-28">
        {KIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}

function StageRow({
  stage,
  isFirst,
  isLast,
  canEdit,
  onError,
}: {
  stage: StageWithCount;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onError: (msg: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, formAction, saving] = useActionState(
    async (prev: ActionResult, form: FormData) => {
      const result = await updateStageAction(prev, form);
      if (!result.error) setEditing(false);
      return result;
    },
    {}
  );

  function act(fn: () => Promise<ActionResult>) {
    startTransition(async () => onError((await fn()).error));
  }

  if (editing) {
    return (
      <li className="py-3">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="stageId" value={stage.id} />
          <StageFields stage={stage} />
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Guardar
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </form>
        {state.error && <p className="mt-2 text-sm text-red">{state.error}</p>}
      </li>
    );
  }

  return (
    <li className={`flex items-center gap-3 py-3 ${pending ? "opacity-50" : ""}`}>
      {canEdit && (
        <div className="flex flex-col">
          <button
            className="btn-ghost rounded px-1 text-xs leading-none"
            disabled={isFirst || pending}
            onClick={() => act(() => moveStageAction(stage.id, "up"))}
            aria-label="Subir"
          >
            ▲
          </button>
          <button
            className="btn-ghost rounded px-1 text-xs leading-none"
            disabled={isLast || pending}
            onClick={() => act(() => moveStageAction(stage.id, "down"))}
            aria-label="Bajar"
          >
            ▼
          </button>
        </div>
      )}
      <span className="flex-1 font-medium">{stage.name}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_BADGE[stage.kind]}`}>
        {KIND_OPTIONS.find((o) => o.value === stage.kind)?.label}
      </span>
      <span className="w-12 text-right text-sm tabular-nums text-muted">{stage.probability}%</span>
      <span className="w-24 text-right text-xs text-muted">
        {stage.deal_count} {stage.deal_count === 1 ? "negocio" : "negocios"}
      </span>
      {canEdit && (
        <>
          <button className="btn btn-ghost text-xs" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            className="btn btn-ghost text-xs hover:!text-red"
            disabled={pending}
            onClick={() => {
              if (confirm(`¿Eliminar la etapa "${stage.name}"?`)) {
                act(() => deleteStageAction(stage.id));
              }
            }}
          >
            Quitar
          </button>
        </>
      )}
    </li>
  );
}

export function StageEditor({ stages, canEdit }: { stages: StageWithCount[]; canEdit: boolean }) {
  const [rowError, setRowError] = useState<string>();
  const [addState, addAction, adding] = useActionState(addStageAction, {});

  return (
    <div className="mt-4">
      <ul className="divide-y divide-border">
        {stages.map((stage, i) => (
          <StageRow
            key={stage.id}
            stage={stage}
            isFirst={i === 0}
            isLast={i === stages.length - 1}
            canEdit={canEdit}
            onError={setRowError}
          />
        ))}
      </ul>
      {rowError && <p className="mt-2 text-sm text-red">{rowError}</p>}

      {canEdit ? (
        <form action={addAction} className="mt-4 border-t border-border pt-4">
          <p className="label">Nueva etapa</p>
          <div className="flex flex-wrap items-center gap-2">
            <StageFields />
            <button type="submit" className="btn btn-primary" disabled={adding}>
              Agregar
            </button>
          </div>
          {addState.error && <p className="mt-2 text-sm text-red">{addState.error}</p>}
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">Solo un administrador puede editar las etapas.</p>
      )}
    </div>
  );
}
