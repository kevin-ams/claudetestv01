"use client";

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
      <input name="name" required className="input" placeholder="Nombre completo" />
      <input name="email" type="email" required className="input" placeholder="Correo" />
      <input
        name="password"
        type="password"
        minLength={8}
        required
        className="input"
        placeholder="Contraseña temporal (mínimo 8 caracteres)"
      />
      <input name="seatTitle" className="input" placeholder="Asiento / rol (opcional)" />
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      {state.success && <p className="text-sm text-green">{state.success}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? "Agregando..." : "+ Agregar persona"}
      </button>
      <p className="text-xs text-muted">
        Comparte el correo y la contraseña con esa persona para que pueda entrar y cambiarla luego.
      </p>
    </form>
  );
}
