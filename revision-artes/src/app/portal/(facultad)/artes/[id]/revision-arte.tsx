"use client";

import { CircleCheck, Xmark } from "@gravity-ui/icons";
import { useEffect, useState } from "react";
import { Button, Card, Label, TextArea, TextField } from "@heroui/react";
import type { Anotacion } from "@/lib/domain/artes";
import { FormMessage } from "@/components/form-message";
import { NumeroPunto, PuntosLista } from "@/components/puntos-lista";
import { useFormAction } from "@/components/use-form-action";
import { aPuntos } from "@/components/visor-con-puntos";
import { VisorArte, type PuntoVisor } from "@/components/visor-arte";
import { guardarPuntoAction, quitarPuntoAction, revisarArteAction } from "../../../actions";
import type { PuntoBorrador } from "@/lib/domain/borradores";
import { celebrar } from "@/components/celebracion/confeti";

/** Punto marcado aún sin enviar. Se guarda en el servidor al pulsar "Listo". */
type Borrador = {
  key: string;
  id?: number;
  x: number;
  y: number;
  comentario: string;
  estado: "sin_guardar" | "guardando" | "guardado" | "error";
  error?: string;
};

const ESTADO_PUNTO: Record<Borrador["estado"], { texto: string; clase: string }> = {
  sin_guardar: { texto: "Sin guardar", clase: "bg-warning-soft text-warning-soft-foreground" },
  guardando: { texto: "Guardando…", clase: "bg-surface-tertiary text-muted" },
  guardado: { texto: "✓ Guardado", clase: "bg-success-soft text-success-soft-foreground" },
  error: { texto: "No se guardó", clase: "bg-danger-soft text-danger-soft-foreground" },
};

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
  borradoresIniciales,
  detalles,
  historial,
}: {
  arteId: number;
  version: number;
  driveUrl: string;
  titulo: string;
  guardadas: Anotacion[];
  /** Puntos que esta persona ya había guardado sin enviar. */
  borradoresIniciales: PuntoBorrador[];
  detalles: React.ReactNode;
  historial: React.ReactNode;
}) {
  const [borradores, setBorradores] = useState<Borrador[]>(() =>
    borradoresIniciales.map((b) => ({ key: `s${b.id}`, ...b, estado: "guardado" as const }))
  );
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2800);
    return () => clearTimeout(t);
  }, [aviso]);
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
        if (result.celebrar) celebrar("¡Campaña aprobada!");
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
    setBorradores((bs) => [...bs, { key, x, y, comentario: "", estado: "sin_guardar" }]);
    setEditando(key);
  }

  function escribir(key: string, comentario: string) {
    setBorradores((bs) =>
      bs.map((b) => (b.key === key ? { ...b, comentario, estado: "sin_guardar", error: undefined } : b))
    );
  }

  /** "Listo": guarda el punto en el servidor y confirma que quedó guardado. */
  async function guardar(key: string, numero: number) {
    const b = borradores.find((x) => x.key === key);
    if (!b) return;
    if (!b.comentario.trim()) {
      setBorradores((bs) =>
        bs.map((x) => (x.key === key ? { ...x, estado: "error", error: "Escribe qué hay que cambiar aquí." } : x))
      );
      return;
    }
    setBorradores((bs) => bs.map((x) => (x.key === key ? { ...x, estado: "guardando", error: undefined } : x)));
    const res = await guardarPuntoAction(arteId, version, { id: b.id, x: b.x, y: b.y, comentario: b.comentario.trim() });
    if (res.ok && res.punto) {
      const punto = res.punto;
      setBorradores((bs) =>
        bs.map((x) => (x.key === key ? { ...x, id: punto.id, comentario: punto.comentario, estado: "guardado" } : x))
      );
      setEditando((k) => (k === key ? null : k));
      setAviso({ texto: `Punto ${numero} guardado`, ok: true });
    } else {
      setBorradores((bs) =>
        bs.map((x) => (x.key === key ? { ...x, estado: "error", error: res.error ?? "No se pudo guardar" } : x))
      );
      setAviso({ texto: res.error ?? "No se pudo guardar el punto", ok: false });
    }
  }

  async function quitar(key: string) {
    const b = borradores.find((x) => x.key === key);
    setBorradores((bs) => bs.filter((x) => x.key !== key));
    setEditando((k) => (k === key ? null : k));
    if (b?.id) await quitarPuntoAction(arteId, b.id);
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
        {p.error && <p className="text-xs font-medium text-danger">{p.error}</p>}
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="ghost" onPress={() => quitar(key)}>
            Quitar
          </Button>
          <Button size="sm" isPending={p.estado === "guardando"} onPress={() => guardar(key, p.numero)}>
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
                <h3 className="text-sm font-semibold">Tus puntos (guardados; se envían con tu revisión)</h3>
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
                    <span
                      data-testid={`estado-punto-${p.numero}`}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_PUNTO[p.estado].clase}`}
                    >
                      {ESTADO_PUNTO[p.estado].texto}
                    </span>
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
      {aviso && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-[1050] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-xl ${
            aviso.ok ? "bg-success text-success-foreground" : "bg-danger text-danger-foreground"
          }`}
        >
          {aviso.ok && <CircleCheck aria-hidden className="size-4" />}
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
