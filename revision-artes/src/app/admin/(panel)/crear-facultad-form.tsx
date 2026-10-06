"use client";

import { Button, Input, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { createFacultadAction } from "./actions";

export function CrearFacultadForm() {
  const { state, pending, formProps } = useFormAction(createFacultadAction);
  return (
    <form {...formProps} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextField name="nombre" isRequired aria-label="Nombre de la facultad" className="flex-1">
          <Input placeholder="Ej. Facultad de Ingeniería" />
        </TextField>
        <Button type="submit" isPending={pending}>
          Agregar facultad
        </Button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}
