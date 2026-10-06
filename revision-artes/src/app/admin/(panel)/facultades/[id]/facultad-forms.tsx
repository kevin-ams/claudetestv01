"use client";

import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { createCarreraAction, updateFacultadAction } from "../../actions";

export function AjustesFacultadForm({ id, nombre, activa }: { id: number; nombre: string; activa: boolean }) {
  const { state, pending, formProps } = useFormAction(updateFacultadAction.bind(null, id));
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" defaultValue={nombre} required className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activa" defaultChecked={activa} />
        Acceso al portal activo
      </label>
      <FormMessage error={state.error} success={state.ok ? "Guardado" : null} />
      <div>
        <button type="submit" disabled={pending} className="btn btn-secondary">Guardar</button>
      </div>
    </form>
  );
}

export function CrearCarreraForm({ facultadId }: { facultadId: number }) {
  const { state, pending, formProps } = useFormAction(createCarreraAction.bind(null, facultadId), { resetOnSuccess: true });
  return (
    <form {...formProps} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input name="nombre" placeholder="Nueva carrera" required className="input" aria-label="Nombre de la carrera" />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0">Agregar</button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}
