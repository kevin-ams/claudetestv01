"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/domain/types";
import { createMeetingIssueAction, createMeetingTodoAction } from "../actions";

export type QuickKind = "todo" | "issue";

export type QuickDraft = {
  kind: QuickKind;
  title?: string;
  description?: string;
  ownerId?: number | null;
  /** Texto corto que explica de dónde viene (p. ej. "Scorecard"). */
  source?: string;
};

/** Barra fija con "+ To-Do" y "+ Issue", disponible en todos los pasos de la reunión. */
export function QuickCreateBar({ onCreate }: { onCreate: (draft: QuickDraft) => void }) {
  return (
    <div className="sticky top-2 z-20 mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
      <span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Capturar</span>
      <button className="eos-btn eos-btn-secondary py-1.5 text-xs" onClick={() => onCreate({ kind: "todo" })}>
        ✅ + To-Do
      </button>
      <button className="eos-btn eos-btn-secondary py-1.5 text-xs" onClick={() => onCreate({ kind: "issue" })}>
        ⚠️ + Issue
      </button>
      <span className="ml-auto hidden text-[11px] text-muted sm:inline">
        También puedes usar los botones → Issue y + To-Do dentro de cada paso.
      </span>
    </div>
  );
}

export function QuickCreateModal({
  meetingId,
  draft,
  members,
  onClose,
  onCreated,
}: {
  meetingId: number;
  draft: QuickDraft;
  members: PublicUser[];
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<QuickKind>(draft.kind);
  const [title, setTitle] = useState(draft.title ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [ownerId, setOwnerId] = useState<string>(draft.ownerId ? String(draft.ownerId) : "none");
  const [dueDate, setDueDate] = useState("");
  const [term, setTerm] = useState<"short_term" | "long_term">("short_term");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) {
      setError("Escribe un título.");
      return;
    }
    startTransition(async () => {
      const input = {
        title,
        description,
        ownerId: ownerId === "none" ? null : Number(ownerId),
        dueDate: dueDate || null,
        term,
      };
      try {
        if (kind === "todo") await createMeetingTodoAction(meetingId, input);
        else await createMeetingIssueAction(meetingId, input);
        router.refresh();
        onCreated(kind === "todo" ? `To-Do creado: ${title.trim()}` : `Issue agregado a IDS: ${title.trim()}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        className="eos-card flex w-full max-w-lg flex-col gap-3 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-label="Crear To-Do o Issue"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg bg-background p-1">
            {(
              [
                ["todo", "To-Do"],
                ["issue", "Issue"],
              ] as [QuickKind, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-md px-3 py-1 text-sm font-semibold ${kind === k ? "bg-card shadow-sm" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="text-muted" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {draft.source && <p className="text-xs text-muted">Desde: {draft.source}</p>}
        <input
          className="eos-input"
          autoFocus
          placeholder={kind === "todo" ? "¿Qué hay que hacer?" : "¿Cuál es el issue?"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Título"
        />
        <textarea
          className="eos-input min-h-20"
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Descripción"
        />
        <div className="flex flex-wrap gap-2">
          <select className="eos-input !w-auto" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} aria-label="Dueño">
            <option value="none">Sin dueño</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="eos-input !w-auto"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Fecha"
            title={kind === "todo" ? "Fecha límite" : "Fecha específica"}
          />
          {kind === "issue" && (
            <select className="eos-input !w-auto" value={term} onChange={(e) => setTerm(e.target.value as typeof term)} aria-label="Plazo">
              <option value="short_term">Corto plazo</option>
              <option value="long_term">Largo plazo</option>
            </select>
          )}
        </div>
        {error && <p className="text-sm text-red">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="eos-btn eos-btn-primary" disabled={pending}>
            {pending ? "Guardando..." : kind === "todo" ? "Crear To-Do" : "Agregar Issue"}
          </button>
          <button type="button" className="eos-btn eos-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
