"use client";

import { FormMessage } from "@/components/form-message";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "../auth-actions";

type Valores = {
  titulo: string;
  campana: string;
  formato: string;
  descripcion: string;
  drive_url: string;
  fecha_publicacion: string | null;
  carrera_id: number | null;
};

export function ArteForm({
  action,
  carreras,
  valores,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  carreras: { id: number; nombre: string }[];
  valores?: Valores;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useFormAction(action);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="titulo">Título del arte *</label>
        <input id="titulo" name="titulo" required defaultValue={valores?.titulo} className="input" placeholder="Ej. Post de lanzamiento – Admisiones 2027" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="carreraId">Carrera</label>
          <select id="carreraId" name="carreraId" defaultValue={valores?.carrera_id ?? ""} className="input">
            <option value="">Toda la facultad</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="campana">Campaña</label>
          <input id="campana" name="campana" defaultValue={valores?.campana} className="input" placeholder="Ej. Admisiones 2027" />
        </div>
        <div>
          <label className="label" htmlFor="formato">Formato / canal</label>
          <input id="formato" name="formato" defaultValue={valores?.formato} className="input" placeholder="Ej. Post Instagram 1080×1350" />
        </div>
        <div>
          <label className="label" htmlFor="fechaPublicacion">Fecha de publicación</label>
          <input id="fechaPublicacion" name="fechaPublicacion" type="date" defaultValue={valores?.fecha_publicacion ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="driveUrl">Enlace de Google Drive *</label>
        <input id="driveUrl" name="driveUrl" type="url" required defaultValue={valores?.drive_url} className="input" placeholder="https://drive.google.com/file/d/…/view" />
        <p className="mt-1 text-xs text-muted">
          Archivo o carpeta compartidos como “Cualquier persona con el enlace puede ver”.
          {valores && " Si cambias el enlace se registra como nueva versión y vuelve a quedar pendiente."}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="descripcion">Copy / indicaciones</label>
        <textarea id="descripcion" name="descripcion" rows={4} defaultValue={valores?.descripcion} className="input" placeholder="Texto de la publicación, hashtags, notas para la facultad…" />
      </div>
      <FormMessage error={state.error} success={state.ok ? "Cambios guardados" : null} />
      <div>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
