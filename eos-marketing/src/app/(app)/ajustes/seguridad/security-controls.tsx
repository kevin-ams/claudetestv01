"use client";

import { Button } from "@heroui/react";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Segmented } from "@/components/ui/segmented";
import { callAction, type ActionResult } from "@/lib/client-actions";
import { resetMfaAction, setMfaModeAction } from "./actions";

type Mode = "off" | "optional";

export function MfaModeSwitch({ mode, canEdit }: { mode: Mode; canEdit: boolean }) {
  const [value, setValue] = useState<Mode>(mode);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <fieldset disabled={!canEdit || pending} className="contents">
        <Segmented<Mode>
          aria-label="Doble factor"
          value={value}
          options={[
            { id: "off", label: "Apagado" },
            { id: "optional", label: "Disponible (opcional)" },
          ]}
          onChange={(next) => {
            if (!canEdit || next === value) return;
            setValue(next);
            start(async () => setResult(await callAction(setMfaModeAction(next))));
          }}
        />
      </fieldset>
      {result && <p className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}
    </div>
  );
}

export function ResetMfaButton({ userId, name }: { userId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onPress={() => setOpen(true)} isDisabled={pending}>
        Quitar
      </Button>
      {result && <span className={result.ok ? "text-green" : "text-red"}>{result.message}</span>}
      {open && (
        <ConfirmDialog
          title={`¿Quitar el doble factor de ${name}?`}
          confirmLabel="Quitar doble factor"
          danger
          pending={pending}
          onClose={() => setOpen(false)}
          onConfirm={() =>
            start(async () => {
              setResult(await callAction(resetMfaAction(userId)));
              setOpen(false);
            })
          }
        >
          Úsalo solo si perdió su teléfono y sus códigos de recuperación. Podrá entrar solo con su contraseña y volver a activarlo. Queda en
          la bitácora y se avisa al dueño de la plataforma.
        </ConfirmDialog>
      )}
    </>
  );
}
