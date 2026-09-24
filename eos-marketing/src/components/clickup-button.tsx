"use client";

import { useState, useTransition } from "react";

type SendResult = { ok: boolean; message: string; url?: string };

/** Botón "Enviar a ClickUp" para To-Dos e Issues. */
export function ClickUpButton({
  sentUrl,
  configured,
  onSend,
}: {
  sentUrl: string | null;
  configured: boolean;
  onSend: () => Promise<SendResult>;
}) {
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, startTransition] = useTransition();
  const url = sentUrl ?? result?.url ?? null;

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="eos-badge bg-green-bg text-green">
        ✓ En ClickUp
      </a>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-background"
        title={configured ? "Crear esta tarea en ClickUp" : "Integración pendiente de conectar"}
        onClick={() => startTransition(async () => setResult(await onSend()))}
      >
        {pending ? "Enviando..." : "Enviar a ClickUp"}
        {!configured && <span className="text-[10px] font-semibold text-yellow">(pendiente)</span>}
      </button>
      {result && !result.ok && <span className="text-xs text-yellow">{result.message}</span>}
    </span>
  );
}
