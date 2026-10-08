"use client";

import { Button } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { correoPruebaAction } from "../actions";

export function CorreoPrueba({ disponible }: { disponible: boolean }) {
  const { state, pending, formProps } = useFormAction(correoPruebaAction);
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <FormMessage error={state.error} success={state.ok ? (state.message ?? "Enviado") : null} />
      <div>
        <Button type="submit" variant="secondary" isPending={pending} isDisabled={!disponible}>
          Enviarme un correo de prueba
        </Button>
      </div>
    </form>
  );
}
