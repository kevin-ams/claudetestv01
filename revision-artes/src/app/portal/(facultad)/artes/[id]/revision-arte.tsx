"use client";

import { Xmark } from "@gravity-ui/icons";
import { useState } from "react";
import { Button, Card, Label, TextArea, TextField } from "@heroui/react";
import type { Anotacion } from "@/lib/domain/artes";
import { FormMessage } from "@/components/form-message";
import { NumeroPunto, PuntosLista } from "@/components/puntos-lista";
import { useFormAction } from "@/components/use-form-action";
import { aPuntos } from "@/components/visor-con-puntos";
import { VisorArte, type PuntoVisor } from "@/components/visor-arte";
import { revisarArteAction } from "../../../actions";

type Borrador = { key: string; x: number; y: number; comentario: string };

const MENSAJES = {
  aprobado: "¡Arte aprobado! Gracias.",
  cambios: "Enviamos tu solicitud de cambios al equipo de Marketing Digital.",
  comentario: "Comentario enviado.",
};

/**
 * Revisión de la versión actual: la persona marca puntos sobre la imagen,
 * describe cada cambio y envía su decisión junto con los puntos.
 */
export function RevisionArte({
  arteId,
  version,
  driveUrl,
  titulo,
  guardadas,
  detalles,
  historial,
}: {
  arteId: number;
  version: number;
  driveUrl: string;
  titulo: string;
  guardadas: Anotacion[];
  detalles: React.ReactNode;
  historial: React.ReactNode;
}) {
  const [borradores, setBorradores] = useState<Borrador[]>([]);
  const [activo, setActivo] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [ultima, setUltima] = useState<keyof typeof MENSAJES>("comentario");
  const { state, pending, formProps } = useFormAction(
    async (prev, formData) => {
      const result = await revisarArteAction(arteId, version, prev, formData);
      // Los puntos ya quedaron guardados: se limpian los borradores.
      if (result.ok) {
        setBorradores([]);
        setEditando(null);
      }
      return result;
    },
    { resetOnSuccess: true }
  );

  const existentes = aPuntos(guardadas);
  const base = guardadas.reduce((m, a) => Math.max(m, a.numero), 0);
  const nuevos: (PuntoVisor & Borrador)[] = borradores.map((b, i) => ({ ...b, numero: base + i + 1, tipo: "borrador" }));

  function agregar(x: number, y: number) {
    const key = `b${Date.now()}`;
    setBorradores((bs) => [...bs, { key, x, y, comentario: "" }]);
    setEditando(key);
  }

  function escribir(key: string, comentario: string) {
    setBorradores((bs) => bs.map((b) => (b.key === key ? { ...b, comentario } : b)));
  }

  function quitar(key: string) {
    setBorradores((bs) => bs.filter((b) => b.key !== key));
    setEditando((k) => (k === key ? null : k));
  }

  function editorFlotante(key: string) {
    const p = nuevos.find((n) => n.key === key);
    if (!p) return null;
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-overlay p-3 text-overlay-foreground shadow-xl">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <NumeroPunto punto={p} /> ¿Qué hay que cambiar aquí?
        </div>
        <TextField aria-label={`Cambio del punto ${p.numero}`} value={p.comentario} onChange={(v) => escribir(key, v)}>
          <TextArea rows={3} autoFocus placeholder="Ej. El logo debe ir en blanco" />
        </TextField>
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="ghost" onPress={() => quitar(key)}>
            Quitar
          </Button>
          <Button size="sm" onPress={() => setEditando(null)}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        <Card data-guia="visor">
          <Card.Content className="flex flex-col gap-4">
            <VisorArte
              driveUrl={driveUrl}
              title={titulo}
              puntos={[...existentes, ...nuevos]}
              onAddPoint={agregar}
              activo={activo}
              onActivo={setActivo}
              editando={editando}
              renderEditor={editorFlotante}
            />
            {nuevos.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Tus puntos (se envían con tu revisión)</h3>
                {nuevos.map((p) => (
                  <div
                    key={p.key}
                    onMouseEnter={() => setActivo(p.key)}
                    className={`flex items-start gap-3 rounded-xl p-3 ${activo === p.key ? "bg-accent-soft" : "bg-surface-secondary"}`}
                  >
                    <NumeroPunto punto={p} />
                    <button
                      type="button"
                      onClick={() => setEditando(p.key)}
                      className={`flex-1 text-left text-sm ${p.comentario ? "" : "italic text-danger"}`}
                    >
                      {p.comentario || "Falta describir el cambio — clic para escribirlo"}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label={`Quitar punto ${p.numero}`}
                      onPress={() => quitar(p.key)}
                    >
                      <Xmark aria-hidden className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {existentes.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Puntos ya marcados en esta versión</h3>
                <PuntosLista puntos={existentes} activo={activo} onActivo={setActivo} />
              </div>
            )}
          </Card.Content>
        </Card>
        {detalles}
      </div>

      <aside className="flex flex-col gap-6">
        <Card>
          <Card.Header>
            <Card.Title>Tu revisión</Card.Title>
            <Card.Description>
              {nuevos.length > 0
                ? `${nuevos.length} ${nuevos.length === 1 ? "punto marcado" : "puntos marcados"} en la imagen.`
                : "Puedes marcar puntos haciendo clic sobre la imagen."}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form {...formProps} className="flex flex-col gap-3">
              <input
                type="hidden"
                name="puntos"
                value={JSON.stringify(nuevos.map(({ x, y, comentario }) => ({ x, y, comentario })))}
              />
              <TextField name="comentario" data-guia="comentario">
                <Label>Comentario general</Label>
                <TextArea rows={3} placeholder="Comentarios o cambios generales (opcional si marcaste puntos)…" />
              </TextField>
              <FormMessage error={state.error} success={state.ok ? MENSAJES[ultima] : null} />
              <div className="flex flex-wrap gap-2" data-guia="acciones">
                <Button
                  type="submit"
                  name="accion"
                  value="aprobado"
                  isDisabled={pending}
                  onPress={() => setUltima("aprobado")}
                  className="bg-success text-success-foreground"
                >
                  ✓ Aprobar
                </Button>
                <Button
                  type="submit"
                  name="accion"
                  value="cambios"
                  variant="danger"
                  isDisabled={pending}
                  onPress={() => setUltima("cambios")}
                >
                  Solicitar cambios
                </Button>
                <Button
                  type="submit"
                  name="accion"
                  value="comentario"
                  variant="tertiary"
                  isDisabled={pending}
                  onPress={() => setUltima("comentario")}
                >
                  Solo comentar
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
        {historial}
      </aside>
    </div>
  );
}
