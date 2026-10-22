"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/auth/actions";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, {});

  return (
    <form action={formAction} className="mt-4 space-y-3">
      {hasPassword && (
        <div>
          <label className="label" htmlFor="current">Contraseña actual</label>
          <input id="current" name="current" type="password" autoComplete="current-password" className="input" required />
        </div>
      )}
      {!hasPassword && <input type="hidden" name="current" value="" />}
      <div>
        <label className="label" htmlFor="password">Nueva contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirmar</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required />
      </div>
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      {state.ok && <p className="text-sm text-green">{state.ok}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        Guardar
      </button>
    </form>
  );
}
