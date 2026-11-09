"use client";

import { useEffect } from "react";

type ClarityFn = (...args: unknown[]) => void;

/**
 * Etiqueta la sesión de Clarity con el id interno de la persona y su equipo (nunca nombre ni correo),
 * para filtrar grabaciones por equipo o rol. No hace nada si Clarity no está activo.
 */
export function ClarityIdentify({ userId, teamId, role }: { userId: number; teamId: number; role: string }) {
  useEffect(() => {
    const clarity = (window as unknown as { clarity?: ClarityFn }).clarity;
    if (!clarity) return;
    clarity("identify", `u${userId}`);
    clarity("set", "team", String(teamId));
    clarity("set", "role", role);
  }, [userId, teamId, role]);
  return null;
}
