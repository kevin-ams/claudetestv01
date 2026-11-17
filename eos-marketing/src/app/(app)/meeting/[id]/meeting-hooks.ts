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

/**
 * Sincronización liviana de la L10: cada pocos segundos se pide solo una "huella" de la reunión (una consulta)
 * y la página se recarga completa únicamente si algo cambió. Para no gastar funciones ni mantener despierta la base:
 * - no consulta con la pestaña oculta ni con la reunión terminada;
 * - se pausa tras 10 minutos sin actividad (una pantalla olvidada abierta) y retoma al volver;
 * - quien sigue la reunión consulta cada 8 s; quien dirige, cada 20 s (sus propios cambios ya recargan su vista).
 */
export function useMeetingPulse(meetingId: number, drives: boolean, active = true) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let last: string | null = null;
    let busy = false;
    let lastActivity = Date.now();
    const idle = () => Date.now() - lastActivity > IDLE_MS;
    const tick = async () => {
      if (busy || document.hidden || idle()) return;
      busy = true;
      try {
        const sig = await meetingPulseAction(meetingId);
        if (sig && last !== null && sig !== last) router.refresh();
        last = sig;
      } catch {
        // Sin conexión o versión nueva publicada: se intenta en la siguiente vuelta.
      } finally {
        busy = false;
      }
    };
    const wake = () => {
      const wasIdle = idle();
      lastActivity = Date.now();
      if (wasIdle) tick(); // al volver, se pone al día de inmediato
    };
    const onVisible = () => {
      if (!document.hidden) wake();
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, wake, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    tick();
    const t = setInterval(tick, drives ? 20000 : 8000);
    return () => {
      clearInterval(t);
      for (const e of events) window.removeEventListener(e, wake);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, drives, meetingId, active]);
}
