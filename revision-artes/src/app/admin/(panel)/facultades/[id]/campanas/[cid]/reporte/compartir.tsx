"use client";

import { Button, Input, Label, TextArea, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { enviarReporteAction } from "../../../../../actions";

export function EnviarReporteForm({ campanaId, correoDisponible }: { campanaId: number; correoDisponible: boolean }) {
  const { state, pending, formProps } = useFormAction(enviarReporteAction.bind(null, campanaId));
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <TextField name="correos" isRequired>
        <Label>Correos de Diseño</Label>
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
