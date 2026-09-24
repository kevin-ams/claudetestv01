"use client";

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
      <button type="button" className="text-xs font-medium text-primary underline" onClick={() => setOpen(true)}>
        Editar acceso
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex w-full flex-col gap-2 rounded-lg bg-background p-3">
      <input name="name" required className="eos-input" defaultValue={name} placeholder="Nombre" />
      <input name="email" type="email" required className="eos-input" defaultValue={email} placeholder="Correo" />
      <input
        name="password"
        type="password"
        minLength={8}
        className="eos-input"
        placeholder="Nueva contraseña (vacío = no cambiar)"
      />
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      {state.success && <p className="text-sm text-green">{state.success}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="eos-btn eos-btn-primary text-xs">
          {pending ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" className="eos-btn eos-btn-secondary text-xs" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>
    </form>
  );
}
