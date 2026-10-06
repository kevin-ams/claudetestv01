"use client";

import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { createAdminAction } from "../actions";

export function CrearAdminForm() {
  const { state, pending, formProps } = useFormAction(createAdminAction, { resetOnSuccess: true });
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-3">
      <input name="name" placeholder="Nombre" required className="input" aria-label="Nombre" />
      <input name="email" type="email" placeholder="Correo" required className="input" aria-label="Correo" />
      <input name="password" type="password" placeholder="Contraseña (mín. 8)" required className="input" aria-label="Contraseña" autoComplete="new-password" />
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className="btn btn-primary">Agregar administrador</button>
        <FormMessage error={state.error} success={state.ok ? "Administrador agregado" : null} />
      </div>
    </form>
  );
}
