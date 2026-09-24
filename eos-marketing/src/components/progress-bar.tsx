"use client";

import { Label, ProgressBar as HeroProgressBar } from "@heroui/react";

const COLOR = { primary: "accent", green: "success", red: "danger" } as const;

/**
 * Barra de carga (ProgressBar de HeroUI). Con `value` (0–100) muestra avance
 * real; sin `value` es indeterminada (para acciones de un solo paso).
 */
export function ProgressBar({
  value,
  tone = "primary",
  label,
}: {
  value?: number;
  tone?: "primary" | "green" | "red";
  label?: string;
}) {
  return (
    <HeroProgressBar
      aria-label={label ?? "Cargando"}
      color={COLOR[tone]}
      isIndeterminate={value === undefined}
      value={value === undefined ? undefined : Math.max(4, value)}
      className="w-full"
    >
      <HeroProgressBar.Track>
        <HeroProgressBar.Fill />
      </HeroProgressBar.Track>
      {label && <Label className="text-xs font-normal text-muted">{label}</Label>}
    </HeroProgressBar>
  );
}
