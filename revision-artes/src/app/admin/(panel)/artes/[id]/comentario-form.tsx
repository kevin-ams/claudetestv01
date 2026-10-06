"use client";

import { Button, TextArea, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { comentarArteAction } from "../../actions";

export function ComentarioForm({ arteId }: { arteId: number }) {
  const { state, pending, formProps } = useFormAction(comentarArteAction.bind(null, arteId), {
    resetOnSuccess: true,
  });
  return (
    <form {...formProps} className="flex flex-col gap-2">
      <TextField name="comentario" isRequired aria-label="Comentario">
        <TextArea rows={2} placeholder="Responder o dejar una nota para la facultad…" />
      </TextField>
      <FormMessage error={state.error} />
      <div>
        <Button type="submit" size="sm" variant="secondary" isPending={pending}>
          Comentar
        </Button>
      </div>
    </form>
  );
}
