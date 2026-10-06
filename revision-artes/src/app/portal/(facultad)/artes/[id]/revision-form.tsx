"use client";

import { useState } from "react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { revisarArteAction } from "../../../actions";

const MENSAJES = {
  aprobado: "¡Arte aprobado! Gracias.",
  cambios: "Enviamos tu solicitud de cambios al equipo de comunicación.",
  comentario: "Comentario enviado.",
};

export function RevisionForm({ arteId }: { arteId: number }) {
  const { state, pending, formProps } = useFormAction(revisarArteAction.bind(null, arteId), { resetOnSuccess: true });
  const [ultima, setUltima] = useState<keyof typeof MENSAJES>("comentario");

  return (
    <form {...formProps} className="flex flex-col gap-3">
      <textarea
        name="comentario"
        rows={4}
        className="input"
        placeholder="Comentarios o cambios que necesitas (obligatorio si solicitas cambios)…"
      />
      <FormMessage error={state.error} success={state.ok ? MENSAJES[ultima] : null} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="accion"
          value="aprobado"
          disabled={pending}
          onClick={() => setUltima("aprobado")}
          className="btn bg-green text-white hover:opacity-90"
        >
          ✓ Aprobar
        </button>
        <button
          type="submit"
          name="accion"
          value="cambios"
          disabled={pending}
          onClick={() => setUltima("cambios")}
          className="btn btn-danger"
        >
          Solicitar cambios
        </button>
        <button
          type="submit"
          name="accion"
          value="comentario"
          disabled={pending}
          onClick={() => setUltima("comentario")}
          className="btn btn-secondary"
        >
          Solo comentar
        </button>
      </div>
    </form>
  );
}
