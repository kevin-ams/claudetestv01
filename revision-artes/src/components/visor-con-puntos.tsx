"use client";

import { useState } from "react";
import type { Anotacion } from "@/lib/domain/artes";
import { VisorArte } from "./visor-arte";
import { PuntosLista, type PuntoDetalle } from "./puntos-lista";

export function aPuntos(anotaciones: Anotacion[]): PuntoDetalle[] {
  return anotaciones.map((a) => ({
    key: `a${a.id}`,
    numero: a.numero,
    x: a.x,
    y: a.y,
    tipo: a.atendida ? "atendido" : "guardado",
    comentario: a.comentario,
    autor: a.autor_nombre,
  }));
}

/** Visor de solo lectura: imagen con los puntos de una versión y su lista. */
export function VisorConPuntos({
  driveUrl,
  title,
  anotaciones,
}: {
  driveUrl: string;
  title: string;
  anotaciones: Anotacion[];
}) {
  const [activo, setActivo] = useState<string | null>(null);
  const puntos = aPuntos(anotaciones);
  return (
    <div className="flex flex-col gap-4">
      <VisorArte driveUrl={driveUrl} title={title} puntos={puntos} activo={activo} onActivo={setActivo} />
      {puntos.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Puntos marcados en esta versión</h3>
          <PuntosLista puntos={puntos} activo={activo} onActivo={setActivo} />
        </div>
      )}
    </div>
  );
}
