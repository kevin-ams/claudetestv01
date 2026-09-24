"use client";

import { Button, Input } from "@heroui/react";
import { useActionState } from "react";
import { addTeammateAction, type FormState } from "./actions";

const initialState: FormState = { error: null, success: null };

export function AddTeammateForm() {
  const [state, formAction, pending] = useActionState(
    addTeammateAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Input fullWidth name="name" required placeholder="Nombre completo" />
      <Input fullWidth name="email" type="email" required placeholder="Correo" />
      <Input fullWidth
        name="password"
        type="password"
        minLength={8}
        required
        placeholder="Contraseña temporal (mínimo 8 caracteres)"
      />
      <Input fullWidth name="seatTitle" placeholder="Asiento / rol (opcional)" />
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      {state.success && <p className="text-sm text-green">{state.success}</p>}
      <Button variant="primary" type="submit" isDisabled={pending} className="self-start">
        {pending ? "Agregando..." : "+ Agregar persona"}
      </Button>
      <p className="text-xs text-muted">
        Comparte el correo y la contraseña con esa persona para que pueda entrar y cambiarla luego.
      </p>
    </form>
  );
}
