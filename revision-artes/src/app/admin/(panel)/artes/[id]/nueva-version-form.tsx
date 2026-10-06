"use client";

import { Alert, Button, Checkbox, Description, Input, Label, TextArea, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import { nuevaVersionAction } from "../../actions";

type PuntoPendiente = { id: number; numero: number; comentario: string; autor: string };
type Solicitud = { id: number; autor: string; comentario: string };

/**
 * Sube una nueva versión del arte a partir de los cambios que pidió la
 * facultad: muestra lo solicitado, permite marcar qué puntos se atendieron
 * y pide el enlace de Drive del archivo corregido.
 */
export function NuevaVersionForm({
  arteId,
  versionActual,
  puntos,
  solicitudes,
}: {
  arteId: number;
  versionActual: number;
  puntos: PuntoPendiente[];
  solicitudes: Solicitud[];
}) {
  const { state, pending, formProps } = useFormAction(nuevaVersionAction.bind(null, arteId), {
    resetOnSuccess: true,
  });
  const hayCambios = puntos.length > 0 || solicitudes.length > 0;

  return (
    <form {...formProps} className="flex flex-col gap-4">
      {hayCambios ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Cambios solicitados en v{versionActual}</p>
          {solicitudes.map((s) => (
            <div key={s.id} className="rounded-xl bg-surface-secondary p-3 text-sm">
              <p className="whitespace-pre-wrap">{s.comentario}</p>
              <p className="mt-1 text-xs text-muted">{s.autor}</p>
            </div>
          ))}
          {puntos.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs text-muted">Marca los puntos que quedaron resueltos en la nueva versión:</legend>
              {puntos.map((p) => (
                <Checkbox key={p.id} name="atendidas" value={String(p.id)} defaultSelected>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="text-sm">
                      <span className="font-semibold text-danger">#{p.numero}</span> {p.comentario}{" "}
                      <span className="text-xs text-muted">· {p.autor}</span>
                    </span>
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </fieldset>
          )}
        </div>
      ) : (
        <Alert status="default">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>No hay cambios pendientes en la versión actual.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <TextField name="driveUrl" type="url" isRequired>
        <Label>Enlace de Drive de la v{versionActual + 1}</Label>
        <Input placeholder="https://drive.google.com/file/d/…/view" />
        <Description>Sube el archivo corregido a Drive y pega aquí su enlace.</Description>
      </TextField>
      <TextField name="nota" isRequired>
        <Label>¿Qué se cambió?</Label>
        <TextArea rows={3} placeholder="Ej. Se cambió el color del logo y se corrigió la fecha." />
      </TextField>
      <FormMessage
        error={state.error}
        success={state.ok ? `Nueva versión publicada. La facultad ya puede revisarla.` : null}
      />
      <div>
        <Button type="submit" isPending={pending}>
          Publicar v{versionActual + 1} para revisión
        </Button>
      </div>
    </form>
  );
}
