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

/**
 * Sincronización liviana de la L10: cada pocos segundos se pide solo una "huella" de la reunión (una consulta)
 * y la página se recarga completa únicamente si algo cambió. Con la pestaña oculta no se consulta.
 * Quien dirige consulta menos seguido (sus propios cambios ya recargan su vista).
 */
export function useMeetingPulse(meetingId: number, drives: boolean) {
  const router = useRouter();
  useEffect(() => {
    let last: string | null = null;
    let busy = false;
    const tick = async () => {
      if (busy || document.hidden) return;
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
    tick();
    const t = setInterval(tick, drives ? 10000 : 4000);
    return () => clearInterval(t);
  }, [router, drives, meetingId]);
}
