"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: null, name: "" });
  return (
    <form action={action} className="mt-5 space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Tu nombre</span>
        <input name="name" className="input" autoComplete="name" defaultValue={state.name} key={state.name} required />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Contraseña</span>
        <input name="password" type="password" className="input" autoComplete="current-password" required />
      </label>
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
