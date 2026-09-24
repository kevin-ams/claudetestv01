"use client";

import { useState, useTransition } from "react";
import { Button, Chip, Tooltip } from "@heroui/react";

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
      <a href={url} target="_blank" rel="noreferrer">
        <Chip size="sm" variant="soft" color="success">
          ✓ En ClickUp
        </Chip>
      </a>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Tooltip delay={300}>
        <Button
          size="sm"
          variant="outline"
          isPending={pending}
          onPress={() => startTransition(async () => setResult(await onSend()))}
        >
          {pending ? "Enviando..." : "Enviar a ClickUp"}
          {!configured && <span className="text-[10px] font-semibold text-yellow">(pendiente)</span>}
        </Button>
        <Tooltip.Content>
          <p>{configured ? "Crear esta tarea en ClickUp" : "Integración pendiente de conectar"}</p>
        </Tooltip.Content>
      </Tooltip>
      {result && !result.ok && <span className="text-xs text-yellow">{result.message}</span>}
    </span>
  );
}
