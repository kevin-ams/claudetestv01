"use client";

import { Bell } from "@gravity-ui/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Popover } from "@heroui/react";
import { marcarAvisoLeidoAction, marcarTodosAvisosAction } from "@/app/admin/(panel)/actions";

type Aviso = { id: number; titulo: string; mensaje: string; url: string; created_at: string; leido: boolean };

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

/** Cada cuánto se consultan avisos mientras la persona está usando el panel. */
const INTERVALO = 5 * 60_000;
/** Sin mover el mouse ni teclear durante este tiempo, se deja de consultar. */
const INACTIVIDAD = 15 * 60_000;

/**
 * Campanita de avisos del encabezado del admin. Para no gastar cómputo solo consulta
 * mientras la pestaña está visible y en uso: cada 5 minutos, al volver a la pestaña
 * (si pasó ese tiempo) y al abrir la campanita. En segundo plano o inactiva, no consulta.
 */
export function Campanita({ inicial }: { inicial: { avisos: Aviso[]; noLeidos: number } }) {
  const [datos, setDatos] = useState(inicial);
  const router = useRouter();
  const ultimaCarga = useRef(0);

  const cargar = useCallback(async () => {
    ultimaCarga.current = Date.now();
    try {
      const res = await fetch("/admin/api/avisos", { cache: "no-store" });
      if (res.ok) setDatos(await res.json());
    } catch {
      // sin conexión: se reintenta en el siguiente ciclo
    }
  }, []);

  useEffect(() => {
    ultimaCarga.current = Date.now(); // el servidor ya trajo los avisos al cargar la página
    let ultimaActividad = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const enUso = () => document.visibilityState === "visible" && Date.now() - ultimaActividad < INACTIVIDAD;
    const programar = () => {
      clearTimeout(timer);
      timer = undefined;
      if (!enUso()) return; // pausa: se reanuda con actividad o al volver a la pestaña
      const espera = Math.max(0, ultimaCarga.current + INTERVALO - Date.now());
      timer = setTimeout(async () => {
        if (enUso()) await cargar();
        programar();
      }, espera);
    };
    const reanudar = () => {
      ultimaActividad = Date.now();
      if (!timer) programar();
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        ultimaActividad = Date.now();
        programar(); // si ya pasó el intervalo, consulta de inmediato
      } else {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const eventos = ["pointerdown", "keydown", "pointermove", "scroll"] as const;
    eventos.forEach((e) => window.addEventListener(e, reanudar, { passive: true }));
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    programar();
    return () => {
      clearTimeout(timer);
      eventos.forEach((e) => window.removeEventListener(e, reanudar));
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [cargar]);

  async function abrir(aviso: Aviso) {
    if (!aviso.leido) {
      setDatos((d) => ({
        noLeidos: Math.max(0, d.noLeidos - 1),
        avisos: d.avisos.map((a) => (a.id === aviso.id ? { ...a, leido: true } : a)),
      }));
      await marcarAvisoLeidoAction(aviso.id);
    }
    if (aviso.url) router.push(aviso.url);
  }

  async function todosLeidos() {
    setDatos((d) => ({ noLeidos: 0, avisos: d.avisos.map((a) => ({ ...a, leido: true })) }));
    await marcarTodosAvisosAction();
  }

  return (
    <Popover onOpenChange={(open) => open && cargar()}>
      <Button
        size="sm"
        variant="tertiary"
        isIconOnly
        aria-label={datos.noLeidos > 0 ? `Avisos: ${datos.noLeidos} sin leer` : "Avisos"}
        className="relative"
      >
        <Bell aria-hidden className="size-4" />
        {datos.noLeidos > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-danger-foreground">
            {datos.noLeidos > 9 ? "9+" : datos.noLeidos}
          </span>
        )}
      </Button>
      <Popover.Content className="w-[min(380px,calc(100vw-32px))]" placement="bottom end">
        <Popover.Dialog className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <Popover.Heading className="font-semibold">Avisos</Popover.Heading>
            {datos.noLeidos > 0 && (
              <button type="button" onClick={todosLeidos} className="text-xs text-accent underline">
                Marcar todos como leídos
              </button>
            )}
          </div>
          {datos.avisos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No tienes avisos todavía.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {datos.avisos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => abrir(a)}
                    className={`flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-secondary ${a.leido ? "" : "bg-accent-soft"}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.leido ? "bg-transparent" : "bg-accent"}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">{a.titulo}</span>
                      {a.mensaje && <span className="mt-0.5 block text-xs text-muted">{a.mensaje}</span>}
                      <span className="mt-1 block text-[11px] text-muted">{fecha.format(new Date(a.created_at))}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
