"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/lib/auth/actions";

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="input mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="input mt-1"
        />
      </div>
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary mt-2">
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
