"use client";

import { Alert, Button, Checkbox } from "@heroui/react";
import type { Revisor } from "@/lib/domain/artes";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { notificarAction } from "../../actions";

/** Casillas con las personas de facultad que revisaron el arte. */
export function RevisoresCheckboxes({ revisores }: { revisores: Revisor[] }) {
  return (
    <div className="flex flex-col gap-2">
      {revisores.map((r) => (
        <Checkbox key={r.email} name="notificar" value={r.email} defaultSelected={r.comento}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="text-sm">
              {r.nombre} <span className="text-muted">· {r.email}</span>
            </span>
          </Checkbox.Content>
        </Checkbox>
      ))}
    </div>
  );
}

export function CorreoNoConfigurado() {
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>
          El envío de correos no está configurado (falta RESEND_API_KEY). Los avisos no se enviarán.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** Reenvía el aviso de la versión actual (por si no se envió al publicarla). */
export function NotificarForm({
  arteId,
  version,
  revisores,
  correoConfigurado,
}: {
  arteId: number;
  version: number;
  revisores: Revisor[];
  correoConfigurado: boolean;
}) {
  const { state, pending, formProps } = useFormAction(notificarAction.bind(null, arteId));
  return (
    <form {...formProps} className="flex flex-col gap-3">
      {!correoConfigurado && <CorreoNoConfigurado />}
      <RevisoresCheckboxes revisores={revisores} />
      <FormMessage error={state.error} success={state.ok ? (state.message ?? "Listo") : null} />
      <div>
        <Button type="submit" variant="secondary" isPending={pending} isDisabled={!correoConfigurado}>
          Enviar aviso de la v{version}
        </Button>
      </div>
    </form>
  );
}
