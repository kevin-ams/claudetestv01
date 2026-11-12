"use client";

import { Button, TextArea, TextField } from "@heroui/react";
import { CircleCheck } from "@gravity-ui/icons";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { celebrar } from "@/components/celebracion/confeti";
import { aprobarManualAction } from "../../actions";

/** Marketing Digital aprueba el arte sin esperar a la facultad. */
export function AprobarManual({ arteId }: { arteId: number }) {
  const { state, pending, formProps } = useFormAction(
    async (prev, formData) => {
      const res = await aprobarManualAction(arteId, prev, formData);
      if (res.ok && res.celebrar) celebrar("¡Campaña aprobada!");
      return res;
    },
    { resetOnSuccess: true }
  );
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <TextField name="comentario" aria-label="Nota de la aprobación">
        <TextArea rows={2} placeholder="Nota opcional. Ej. Aprobado por el decano por correo el 12/11." />
      </TextField>
      <FormMessage error={state.error} success={state.ok ? (state.message ?? "Aprobado") : null} />
      <div>
        <Button type="submit" isPending={pending} className="bg-success text-success-foreground">
          <CircleCheck aria-hidden className="size-4" />
          Aprobar manualmente
        </Button>
      </div>
    </form>
  );
}
