"use client";

import { Button, Input } from "@heroui/react";
import { useState, useTransition } from "react";
import { setReplyToAction, type MemberResult } from "./actions";

/** "Responder a" de los correos que envía el equipo (reportes, resumen L10, planificación, To-Dos, accesos). */
export function ReplyToForm({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [result, setResult] = useState<MemberResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card card--default mb-6 flex flex-col gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setReplyToAction(value).catch(() => ({
            ok: false,
            message: "No se pudo guardar. Si se publicó una versión nueva, recarga la página.",
          }));
          setResult(r);
        });
      }}
    >
      <div>
        <h2 className="text-sm font-semibold">Correo para respuestas</h2>
        <p className="text-xs text-muted">
          Cuando alguien responda un correo del equipo (reporte semanal, resumen de la L10, planificación de contenido,
          To-Do enviado o acceso), la respuesta llegará aquí. Vacío: llega a la persona que envió el correo.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Correo para respuestas"
          type="email"
          placeholder="equipo@tudominio.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          className="min-w-[220px] flex-1"
        />
        <Button variant="outline" type="submit" isPending={pending}>
          Guardar
        </Button>
      </div>
      {result && (
        <p className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`} role="status">
          {result.message}
        </p>
      )}
    </form>
  );
}
