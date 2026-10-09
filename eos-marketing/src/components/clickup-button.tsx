"use client";

import { CircleCheck, PaperPlane } from "@gravity-ui/icons";
import { useState, useTransition } from "react";
import { Button, Chip } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { clickUpOptionsAction } from "@/app/(app)/clickup-actions";
import type { ClickUpOptions } from "@/lib/integrations/clickup";

type SendResult = { ok: boolean; message: string; url?: string };
type Target = { listId: string; assigneeId: number | null };

const LIST_KEY = "eos.clickup.list";
// Las opciones se piden una vez por visita a la página.
let optionsPromise: ReturnType<typeof clickUpOptionsAction> | null = null;

/** "Enviar a ClickUp" para To-Dos e Issues: se elige la lista y a quién se asigna. */
export function ClickUpButton({
  sentUrl,
  configured,
  ownerEmail,
  onSend,
}: {
  sentUrl: string | null;
  configured: boolean;
  ownerEmail?: string | null;
  onSend: (target: Target) => Promise<SendResult>;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ClickUpOptions | null>(null);
  const [listId, setListId] = useState("-");
  const [assignee, setAssignee] = useState("-");
  const [result, setResult] = useState<SendResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [pending, startSend] = useTransition();
  const url = sentUrl ?? result?.url ?? null;

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <Chip size="sm" variant="soft" color="success">
          <CircleCheck aria-hidden className="mr-1 inline-block align-[-2px]" />
          En ClickUp
        </Chip>
      </a>
    );
  }

  if (!configured) {
    return (
      <span className="text-[11px] text-muted" title="Falta CLICKUP_API_TOKEN en Netlify">
        ClickUp sin conectar
      </span>
    );
  }

  const openPanel = () =>
    startLoad(async () => {
      setOpen(true);
      setResult(null);
      optionsPromise ??= clickUpOptionsAction();
      const r = await optionsPromise;
      if (!r.ok) {
        optionsPromise = null;
        setResult({ ok: false, message: r.message });
        return;
      }
      setOptions(r.options);
      let last = "";
      try {
        last = localStorage.getItem(LIST_KEY) ?? "";
      } catch {}
      setListId(r.options.lists.some((l) => l.id === last) ? last : "-");
      const match = ownerEmail ? r.options.members.find((m) => m.email.toLowerCase() === ownerEmail.toLowerCase()) : undefined;
      setAssignee(match ? String(match.id) : "-");
    });

  if (!open) {
    return (
      <Button size="sm" variant="outline" onPress={openPanel}>
        <PaperPlane aria-hidden /> Enviar a ClickUp
      </Button>
    );
  }

  return (
    <span className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
      {loading && !options ? (
        <span className="text-xs text-muted">Leyendo listas de ClickUp…</span>
      ) : options ? (
        <>
          <AppSelect aria-label="Lista de ClickUp" className="w-48" value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="-">{`Lista de ${options.space}…`}</option>
            {options.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.folder ? `${l.folder} › ${l.name}` : l.name}
              </option>
            ))}
          </AppSelect>
          <AppSelect aria-label="Asignar a" className="w-48" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="-">Sin asignar</option>
            {options.members.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
              </option>
            ))}
          </AppSelect>
          <Button
            size="sm"
            variant="primary"
            isDisabled={pending || listId === "-"}
            onPress={() =>
              startSend(async () => {
                try {
                  localStorage.setItem(LIST_KEY, listId);
                } catch {}
                const r = await onSend({ listId, assigneeId: assignee === "-" ? null : Number(assignee) });
                setResult(r);
                if (r.ok) setOpen(false);
              })
            }
          >
            {pending ? "Enviando…" : "Enviar"}
          </Button>
        </>
      ) : null}
      <Button size="sm" variant="ghost" onPress={() => setOpen(false)} isDisabled={pending}>
        Cancelar
      </Button>
      {result && !result.ok && <span className="w-full text-xs text-red">{result.message}</span>}
    </span>
  );
}
