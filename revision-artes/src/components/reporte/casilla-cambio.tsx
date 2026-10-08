"use client";

import { useOptimistic, useTransition, useState } from "react";
import { marcarCambioAction } from "@/app/reporte/actions";
import type { MarcaChecklist } from "@/lib/domain/checklist";

export const CLAVE_NOMBRE = "ra-diseno-nombre";

function leerNombre() {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? "";
  } catch {
    return "";
  }
}

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short" });

/**
 * Casilla del checklist de Diseño. Con `token` (enlace de Diseño) se puede
 * marcar y se guarda en el servidor; sin token (admin) es de solo lectura.
 */
export function CasillaCambio({
  token,
  arteId,
  item,
  marca,
  etiqueta,
}: {
  token?: string;
  arteId: number;
  item: string;
  marca?: MarcaChecklist;
  etiqueta: string;
}) {
  const [hecho, setHecho] = useOptimistic(Boolean(marca));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editable = Boolean(token);

  function alternar() {
    if (!token) return;
    const nuevo = !hecho;
    setError(null);
    startTransition(async () => {
      setHecho(nuevo);
      const res = await marcarCambioAction({ token, arteId, item, hecho: nuevo, nombre: leerNombre() });
      if (!res.ok) setError(res.error ?? "No se pudo guardar");
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        role="checkbox"
        aria-checked={hecho}
        aria-label={`${hecho ? "Hecho" : "Pendiente"}: ${etiqueta}`}
        disabled={!editable || pending}
        onClick={alternar}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold transition-colors ${
          hecho
            ? "border-[var(--ges-royal)] bg-[var(--ges-royal)] text-white"
            : "border-[var(--ges-charcoal)] bg-white"
        } ${editable ? "cursor-pointer hover:border-[var(--ges-royal)]" : "cursor-default"} disabled:opacity-100`}
      >
        {hecho ? "✓" : ""}
      </button>
      {error && <span className="mt-1 text-xs text-danger print:hidden">{error}</span>}
      {hecho && marca && (
        <span className="sr-only">
          Marcado {marca.por ? `por ${marca.por}` : ""} el {fecha.format(new Date(marca.en))}
        </span>
      )}
    </span>
  );
}
