"use client";

import { Button, Checkbox, Input, Label, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { createCarreraAction, updateFacultadAction } from "../../actions";

export function AjustesFacultadForm({ id, nombre, activa }: { id: number; nombre: string; activa: boolean }) {
  const { state, pending, formProps } = useFormAction(updateFacultadAction.bind(null, id));
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <TextField name="nombre" defaultValue={nombre} isRequired>
        <Label>Nombre</Label>
        <Input />
      </TextField>
      <Checkbox name="activa" defaultSelected={activa}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Acceso al portal activo
        </Checkbox.Content>
      </Checkbox>
      <FormMessage error={state.error} success={state.ok ? "Guardado" : null} />
      <div>
        <Button type="submit" variant="secondary" isPending={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

export function CrearCarreraForm({ facultadId }: { facultadId: number }) {
  const { state, pending, formProps } = useFormAction(createCarreraAction.bind(null, facultadId), {
    resetOnSuccess: true,
  });
  return (
    <form {...formProps} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <TextField name="nombre" isRequired aria-label="Nombre de la carrera" className="flex-1">
          <Input placeholder="Nueva carrera" />
        </TextField>
        <Button type="submit" isPending={pending}>
          Agregar
        </Button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}
