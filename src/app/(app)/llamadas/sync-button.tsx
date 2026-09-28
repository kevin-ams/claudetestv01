"use client";

import { useTransition } from "react";
import { syncCallsAction } from "./actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={pending}
      onClick={() => startTransition(() => syncCallsAction())}
    >
      {pending ? "Sincronizando…" : "↻ Sincronizar ahora"}
    </button>
  );
}
