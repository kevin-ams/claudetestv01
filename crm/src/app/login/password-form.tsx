"use client";

import { useActionState } from "react";
import { passwordLoginAction } from "@/lib/auth/actions";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(passwordLoginAction, {});

  return (
    <form action={formAction} className="space-y-3 text-left">
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </div>
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      <button type="submit" className="btn btn-secondary w-full" disabled={pending}>
        Entrar con correo y contraseña
      </button>
    </form>
  );
}
