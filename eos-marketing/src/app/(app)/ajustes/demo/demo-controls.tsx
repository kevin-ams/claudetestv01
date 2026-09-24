"use client";

import { useTransition } from "react";
import { enterDemoAction, startDemoAction, stopDemoAction } from "./actions";

export function DemoControls({ inDemo, hasDemo, canEdit }: { inDemo: boolean; hasDemo: boolean; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  if (!canEdit && !hasDemo) {
    return <p className="text-sm text-muted">Solo un administrador puede activar la información demo.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hasDemo && (
        <button className="btn btn-primary" disabled={pending} onClick={() => startTransition(() => startDemoAction())}>
          {pending ? "Preparando la demo…" : "Ver plataforma con información demo"}
        </button>
      )}
      {hasDemo && !inDemo && (
        <button className="btn btn-primary" disabled={pending} onClick={() => startTransition(() => enterDemoAction())}>
          Ir a la demo
        </button>
      )}
      {hasDemo && canEdit && (
        <button
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => {
            if (confirm("¿Regenerar la demo? Se borran los cambios hechos dentro de ella.")) {
              startTransition(() => startDemoAction());
            }
          }}
        >
          Regenerar demo
        </button>
      )}
      {hasDemo && (
        <button
          className="btn btn-danger"
          disabled={pending}
          onClick={() => startTransition(() => stopDemoAction())}
        >
          {pending ? "Procesando…" : "Desactivar información demo"}
        </button>
      )}
      {pending && <span className="text-sm text-muted">Esto tarda unos segundos…</span>}
    </div>
  );
}
