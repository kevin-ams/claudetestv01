"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { createAdminAction } from "../actions";

export function CrearAdminForm() {
  const { state, pending, formProps } = useFormAction(createAdminAction, { resetOnSuccess: true });
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="name" isRequired>
          <Label>Nombre</Label>
          <Input />
        </TextField>
        <TextField name="email" type="email" isRequired>
          <Label>Correo</Label>
          <Input />
        </TextField>
        <TextField name="password" type="password" isRequired autoComplete="new-password">
          <Label>Contraseña (mín. 8)</Label>
          <Input />
        </TextField>
      </div>
      <FormMessage error={state.error} success={state.ok ? "Administrador agregado" : null} />
      <div>
        <Button type="submit" isPending={pending}>
          Agregar administrador
        </Button>
      </div>
    </form>
  );
}
