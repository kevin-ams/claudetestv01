"use client";

import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { createFacultadAction } from "./actions";

export function CrearFacultadForm() {
  const { state, pending, formProps } = useFormAction(createFacultadAction);
  return (
    <form {...formProps} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <input name="nombre" placeholder="Ej. Facultad de Ingeniería" required className="input" aria-label="Nombre de la facultad" />
        <div className="mt-1">
          <FormMessage error={state.error} />
        </div>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">
        Agregar facultad
      </button>
    </form>
  );
}
