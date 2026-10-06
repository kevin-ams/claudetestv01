"use client";

import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { comentarArteAction } from "../../actions";

export function ComentarioForm({ arteId }: { arteId: number }) {
  const { state, pending, formProps } = useFormAction(comentarArteAction.bind(null, arteId), { resetOnSuccess: true });
  return (
    <form {...formProps} className="flex flex-col gap-2">
      <textarea name="comentario" rows={2} required className="input" placeholder="Responder o dejar una nota para la facultad…" />
      <FormMessage error={state.error} />
      <div>
        <button type="submit" disabled={pending} className="btn btn-secondary">Comentar</button>
      </div>
    </form>
  );
}
