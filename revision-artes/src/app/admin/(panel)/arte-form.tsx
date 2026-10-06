"use client";

import { Button, Description, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "../auth-actions";

type Valores = {
  titulo: string;
  campana_id: number | null;
  formato: string;
  descripcion: string;
  fecha_publicacion: string | null;
  carrera_id: number | null;
};

/**
 * Formulario de datos del arte. Al crear (`conEnlace`) también pide el enlace
 * de Drive; después, el enlace solo cambia subiendo una nueva versión.
 */
export function ArteForm({
  action,
  carreras,
  campanas,
  campanaInicial,
  valores,
  conEnlace,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  carreras: { id: number; nombre: string }[];
  campanas: { id: number; nombre: string }[];
  /** Campaña preseleccionada al crear desde la página de una campaña. */
  campanaInicial?: number | null;
  valores?: Valores;
  conEnlace: boolean;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useFormAction(action);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <TextField name="titulo" isRequired defaultValue={valores?.titulo}>
        <Label>Título del arte</Label>
        <Input placeholder="Ej. Post de lanzamiento – Admisiones 2027" />
      </TextField>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="carreraId" defaultValue={valores?.carrera_id ? String(valores.carrera_id) : "general"}>
          <Label>Carrera</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="general" textValue="Toda la facultad">
                Toda la facultad
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {carreras.map((c) => (
                <ListBox.Item key={c.id} id={String(c.id)} textValue={c.nombre}>
                  {c.nombre}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          name="campanaId"
          defaultValue={String(valores?.campana_id ?? campanaInicial ?? "ninguna")}
        >
          <Label>Campaña</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {campanas.map((c) => (
                <ListBox.Item key={c.id} id={String(c.id)} textValue={c.nombre}>
                  {c.nombre}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
              <ListBox.Item id="ninguna" textValue="Sin campaña (Otros artes)">
                Sin campaña (Otros artes)
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <TextField name="formato" defaultValue={valores?.formato}>
          <Label>Formato / canal</Label>
          <Input placeholder="Ej. Post Instagram 1080×1350" />
        </TextField>
        <TextField name="fechaPublicacion" type="date" defaultValue={valores?.fecha_publicacion ?? ""}>
          <Label>Fecha de publicación</Label>
          <Input />
        </TextField>
      </div>
      {conEnlace && (
        <TextField name="driveUrl" type="url" isRequired>
          <Label>Enlace de Google Drive</Label>
          <Input placeholder="https://drive.google.com/file/d/…/view" />
          <Description>Archivo o carpeta compartidos como “Cualquier persona con el enlace puede ver”.</Description>
        </TextField>
      )}
      <TextField name="descripcion" defaultValue={valores?.descripcion}>
        <Label>Copy / indicaciones</Label>
        <TextArea rows={4} placeholder="Texto de la publicación, hashtags, notas para la facultad…" />
      </TextField>
      <FormMessage error={state.error} success={state.ok ? "Cambios guardados" : null} />
      <div>
        <Button type="submit" isPending={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
