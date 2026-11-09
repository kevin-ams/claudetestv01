"use client";

import { Envelope } from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import { useState, useTransition } from "react";

/** "Enviar por correo": abre un campo para destinatarios (opcional) y muestra el resultado. */
export function SendEmailButton({
  send,
  label = "Enviar por correo",
  hint,
  placeholder = "Otros correos (opcional), separados por coma",
  defaultRecipients = "",
  requireRecipients = false,
  variant = "outline",
  size,
}: {
  send: (recipients: string) => Promise<{ ok: boolean; message: string }>;
  label?: string;
  hint?: string;
  placeholder?: string;
  defaultRecipients?: string;
  requireRecipients?: boolean;
  variant?: "outline" | "secondary" | "primary" | "ghost";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultRecipients);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant={variant} size={size} onPress={() => { setOpen(true); setResult(null); }}>
        <Envelope aria-hidden />
        {label}
      </Button>
    );
  }
  return (
    <form
      className="flex w-full max-w-xl flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await send(to);
          setResult(r);
          if (r.ok) setOpen(false);
        });
      }}
    >
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <Input aria-label="Destinatarios" placeholder={placeholder} value={to} onChange={(e) => setTo(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" isPending={pending} isDisabled={requireRecipients && !to.trim()}>
          Enviar
        </Button>
        <Button type="button" size="sm" variant="ghost" onPress={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
      {result && !result.ok && <p className="text-xs text-red">{result.message}</p>}
    </form>
  );
}

/** Mensaje que queda visible después de enviar (el formulario se cierra). */
export function SendEmailInline(props: Parameters<typeof SendEmailButton>[0]) {
  const [last, setLast] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <SendEmailButton
        {...props}
        send={async (r) => {
          const res = await props.send(r);
          setLast(res);
          return res;
        }}
      />
      {last?.ok && <p className="text-xs text-green">{last.message}</p>}
    </div>
  );
}
