"use client";

import { Chip } from "@heroui/react";
import type { PuntoVisor } from "./visor-arte";

export type PuntoDetalle = PuntoVisor & { comentario: string; autor?: string };

const NUMERO: Record<PuntoVisor["tipo"], string> = {
  guardado: "bg-danger text-danger-foreground",
  atendido: "bg-success text-success-foreground",
  borrador: "bg-accent text-accent-foreground",
};

export function NumeroPunto({ punto }: { punto: Pick<PuntoVisor, "numero" | "tipo"> }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${NUMERO[punto.tipo]}`}
    >
      {punto.numero}
    </span>
  );
}

/** Lista de puntos guardados, resaltando el que está activo en la imagen. */
export function PuntosLista({
  puntos,
  activo,
  onActivo,
}: {
  puntos: PuntoDetalle[];
  activo: string | null;
  onActivo: (key: string | null) => void;
}) {
  if (puntos.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {puntos.map((p) => (
        <li
          key={p.key}
          onMouseEnter={() => onActivo(p.key)}
          onMouseLeave={() => onActivo(null)}
          className={`flex gap-3 rounded-xl p-3 transition-colors ${activo === p.key ? "bg-accent-soft" : "bg-surface-secondary"}`}
        >
          <NumeroPunto punto={p} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="whitespace-pre-wrap">{p.comentario}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              {p.autor && <span>{p.autor}</span>}
              {p.tipo === "atendido" && (
                <Chip size="sm" color="success" variant="soft">
                  Atendido
                </Chip>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
