"use client";

import { useEffect, useState } from "react";
import { CLAVE_NOMBRE } from "./casilla-cambio";

/** Nombre (opcional) de quien marca los cambios; se guarda en este navegador. */
export function NombreDiseno() {
  const [nombre, setNombre] = useState("");
  useEffect(() => {
    try {
      // Valor guardado en este navegador; se lee al montar para no desajustar el render del servidor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNombre(localStorage.getItem(CLAVE_NOMBRE) ?? "");
    } catch {
      // almacenamiento no disponible
    }
  }, []);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Tu nombre:</span>
      <input
        value={nombre}
        onChange={(e) => {
          setNombre(e.target.value);
          try {
            localStorage.setItem(CLAVE_NOMBRE, e.target.value.trim());
          } catch {
            // almacenamiento no disponible
          }
        }}
        placeholder="Para registrar quién marca"
        maxLength={80}
        className="w-56 rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--ges-royal)]"
      />
    </label>
  );
}
