"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { ingresarAction } from "../actions";

export function IngresarForm({ codigo }: { codigo: string }) {
  const { state, pending, formProps } = useFormAction(ingresarAction);
  return (
    <form {...formProps} className="mt-6 flex flex-col gap-4">
      <TextField name="name" isRequired autoComplete="name">
        <Label>Nombre completo</Label>
        <Input />
      </TextField>
      <TextField name="email" type="email" isRequired autoComplete="email">
        <Label>Correo electrónico</Label>
        <Input />
      </TextField>
      <TextField name="codigo" isRequired defaultValue={codigo} autoComplete="off">
        <Label>Código de acceso de tu facultad</Label>
        <Input placeholder="XXXXX-XXXXX" className="font-mono uppercase tracking-wider" />
      </TextField>
      <FormMessage error={state.error} />
      <Button type="submit" isPending={pending} fullWidth className="mt-2">
        Entrar
      </Button>
    </form>
  );
}
