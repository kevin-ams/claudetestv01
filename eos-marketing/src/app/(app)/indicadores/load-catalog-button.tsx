"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadCareerCatalogAction, type ActionResult } from "./actions";

export function LoadCatalogButton() {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await loadCareerCatalogAction());
            router.refresh();
          })
        }
      >
        {pending ? "Cargando..." : "Cargar las 117 carreras del equipo de marketing"}
      </button>
      {result && <p className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}
    </div>
  );
}
