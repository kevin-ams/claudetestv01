"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { meetingPulseAction } from "../actions";

/** Segundos desde `since`; con `until` (reunión terminada) el reloj queda detenido en esa hora. */
export function useElapsed(since: string | null, until: string | null = null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!since) return 0;
  const end = until ? new Date(until).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(since).getTime()) / 1000));
}

export function formatClock(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const s = Math.abs(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${sign}${m}:${String(sec).padStart(2, "0")}`;
}

/** Sin mover el mouse ni usar el teclado por este tiempo, la sincronización se pausa hasta volver. */
const IDLE_MS = 10 * 60 * 1000;
/** Espera máxima entre consultas cuando nada cambia. */
const MAX_DELAY_MS = 30 * 1000;

/** Siguiente espera: vuelve a la base si hubo cambio; si no, crece 1.5× hasta el máximo. */
export function nextPulseDelay(current: number, base: number, changed: boolean): number {
  return changed ? base : Math.min(Math.round(current * 1.5), Math.max(base, MAX_DELAY_MS));
}

/**
 * Sincronización liviana de la L10: se pide solo una "huella" de la reunión (una consulta)
 * y la página se recarga completa únicamente si algo cambió. Para no gastar funciones ni mantener despierta la base:
 * - no consulta con la pestaña oculta ni con la reunión terminada;
 * - se pausa tras 10 minutos sin actividad (una pantalla olvidada abierta) y retoma al volver;
 * - la espera se adapta: quien sigue la reunión empieza en 8 s y quien dirige en 20 s (sus propios cambios ya
 *   recargan su vista); mientras nada cambia, la espera crece hasta 30 s y vuelve a la base con cualquier
 *   cambio o en cuanto la persona interactúa con la página.
 */
export function useMeetingPulse(meetingId: number, drives: boolean, active = true) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const base = drives ? 20000 : 8000;
    let last: string | null = null;
    let busy = false;
    let stopped = false;
    let delay = base;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastActivity = Date.now();
    const idle = () => Date.now() - lastActivity > IDLE_MS;
    const schedule = () => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(tick, delay);
    };
    const tick = async () => {
      if (busy) return;
      if (document.hidden || idle()) return schedule();
      busy = true;
      try {
        const sig = await meetingPulseAction(meetingId);
        const changed = !!sig && last !== null && sig !== last;
        if (changed) router.refresh();
        delay = nextPulseDelay(delay, base, changed);
        last = sig;
      } catch {
        // Sin conexión o versión nueva publicada: se intenta en la siguiente vuelta.
      } finally {
        busy = false;
        schedule();
      }
    };
    const wake = () => {
      const wasIdle = idle();
      lastActivity = Date.now();
      if (wasIdle) {
        delay = base;
        tick(); // al volver, se pone al día de inmediato
      } else if (delay > base) {
        // Alguien está usando la página: se vuelve a la espera corta.
        delay = base;
        schedule();
      }
    };
    const onVisible = () => {
      if (!document.hidden) wake();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, wake, { passive: true });
    // Mover el mouse solo cuenta como actividad (no reinicia la espera para no consultar de más).
    const onMove = () => {
      const wasIdle = idle();
      lastActivity = Date.now();
      if (wasIdle) {
        delay = base;
        tick();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, wake);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, drives, meetingId, active]);
}
