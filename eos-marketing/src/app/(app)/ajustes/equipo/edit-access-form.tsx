"use client";

import { Button, Input } from "@heroui/react";
import { useActionState, useState } from "react";
import { updateAccessAction, type FormState } from "./actions";

const initialState: FormState = { error: null, success: null };

export function EditAccessForm({
  userId,
  name,
  email,
}: {
  userId: number;
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateAccessAction.bind(null, userId),
    initialState
  );

  if (!open) {
    return (
      <Button size="sm" variant="ghost" type="button" className="text-xs text-primary" onPress={() => setOpen(true)}>
        Editar acceso
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex w-full flex-col gap-2 rounded-lg bg-background p-3">
      <Input fullWidth name="name" required defaultValue={name} placeholder="Nombre" />
      <Input fullWidth name="email" type="email" required defaultValue={email} placeholder="Correo" />
      <Input fullWidth
        name="password"
        type="password"
        minLength={8}
        placeholder="Nueva contraseña (vacío = no cambiar)"
      />
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      {state.success && <p className="text-sm text-green">{state.success}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" type="submit" isDisabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Button variant="outline" size="sm" type="button" onPress={() => setOpen(false)}>
          Cerrar
        </Button>
      </div>
    </form>
  );
}
