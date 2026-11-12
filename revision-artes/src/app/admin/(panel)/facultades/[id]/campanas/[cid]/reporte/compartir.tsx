"use client";

import Link from "next/link";
import { Button, Checkbox, Input, Label, TextArea, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { enviarReporteAction } from "../../../../../actions";

export function EnviarReporteForm({
  campanaId,
  correoDisponible,
  disenadores,
}: {
  campanaId: number;
  correoDisponible: boolean;
  disenadores: { id: number; nombre: string; email: string }[];
}) {
  const { state, pending, formProps } = useFormAction(enviarReporteAction.bind(null, campanaId));
  return (
    <form {...formProps} className="flex flex-col gap-3">
      {disenadores.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Diseñadores</legend>
          {disenadores.map((d) => (
            <Checkbox key={d.id} name="disenadores" value={d.email}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="text-sm">
                  {d.nombre} <span className="text-muted">· {d.email}</span>
                </span>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </fieldset>
      ) : (
        <p className="text-xs text-muted">
          Tip: agrega tu equipo en{" "}
          <Link href="/admin/disenadores" className="font-medium text-accent underline">
            Diseñadores
          </Link>{" "}
          para elegirlos con un clic.
        </p>
      )}
      <TextField name="correos">
        <Label>{disenadores.length > 0 ? "Otros correos (opcional)" : "Correos de Diseño"}</Label>
        <Input placeholder="disenador@galileo.edu, otra@galileo.edu" />
      </TextField>
      <TextField name="nota">
        <Label>Nota (opcional)</Label>
        <TextArea rows={2} placeholder="Ej. Prioridad: los posts de esta semana." />
      </TextField>
      <FormMessage error={state.error} success={state.ok ? (state.message ?? "Enviado") : null} />
      <div>
        <Button type="submit" isPending={pending} isDisabled={!correoDisponible}>
          Enviar reporte a Diseño
        </Button>
      </div>
      {!correoDisponible && (
        <p className="text-xs text-danger">El envío de correos no está configurado (falta RESEND_API_KEY).</p>
      )}
    </form>
  );
}
