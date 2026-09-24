"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { stopDemoAction } from "./ajustes/demo/actions";

/** Aviso fijo mientras se ve la demo, con botón para salir. */
export function DemoBanner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="border-b border-yellow/30 bg-yellow-bg px-4 py-2 text-sm text-yellow md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <b>Modo demo:</b> estás viendo información de ejemplo. Nada de lo que hagas aquí afecta tus datos reales.
        </span>
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm"
          onClick={() =>
            startTransition(async () => {
              const res = await stopDemoAction().catch((e) => ({ ok: false, message: String(e) }));
              if (!res.ok) {
                setError(res.message);
                return;
              }
              router.push("/ajustes/demo");
              router.refresh();
            })
          }
        >
          {pending ? "Desactivando…" : "Desactivar demo y volver"}
        </button>
      </div>
      {pending && (
        <div className="mt-2">
          <ProgressBar label="Borrando la información demo…" />
        </div>
      )}
      {error && <p className="mt-2 font-semibold text-red">✕ {error}</p>}
    </div>
  );
}
