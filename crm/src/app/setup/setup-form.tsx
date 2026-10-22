"use client";

import { useActionState } from "react";
import { setupAdminAction } from "@/lib/auth/actions";

export function SetupForm() {
  const [state, formAction, pending] = useActionState(setupAdminAction, {});

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <div>
        <label className="label" htmlFor="name">Nombre</label>
        <input id="name" name="name" defaultValue={state.values?.name} className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" defaultValue={state.values?.email} className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" className="input" required />
      </div>
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        Crear y entrar
      </button>
    </form>
  );
}
