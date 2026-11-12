"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { createDisenadorAction } from "../actions";

export function CrearDisenador() {
  const { state, pending, formProps } = useFormAction(createDisenadorAction, { resetOnSuccess: true });
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="nombre" isRequired>
          <Label>Nombre</Label>
          <Input placeholder="Ej. Sofía López" />
        </TextField>
        <TextField name="email" type="email" isRequired>
          <Label>Correo</Label>
          <Input placeholder="sofia@galileo.edu" />
        </TextField>
      </div>
      <FormMessage error={state.error} success={state.ok ? (state.message ?? "Agregado") : null} />
      <div>
        <Button type="submit" isPending={pending}>
          Agregar diseñador
        </Button>
      </div>
    </form>
  );
}
