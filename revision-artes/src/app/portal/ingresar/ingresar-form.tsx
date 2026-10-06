"use client";

import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { ingresarAction } from "../actions";

export function IngresarForm({ codigo }: { codigo: string }) {
  const { state, pending, formProps } = useFormAction(ingresarAction);
  return (
    <form {...formProps} className="mt-6 flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="name">Nombre completo</label>
        <input id="name" name="name" required autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="codigo">Código de acceso de tu facultad</label>
        <input
          id="codigo"
          name="codigo"
          required
          defaultValue={codigo}
          autoComplete="off"
          placeholder="XXXXX-XXXXX"
          className="input font-mono uppercase tracking-wider"
        />
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className="btn btn-primary mt-2">
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
