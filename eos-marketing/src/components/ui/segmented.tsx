"use client";

import type { ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";

/**
 * Control segmentado (una opción a la vez) hecho con ToggleButtonGroup de HeroUI.
 * `value` puede no coincidir con ninguna opción (nada seleccionado).
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = "sm",
  detached = false,
  className,
  "aria-label": ariaLabel,
}: {
  options: readonly { id: T; label: ReactNode }[];
  value: T | null;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  detached?: boolean;
  className?: string;
  "aria-label": string;
}) {
  const key = (v: T) => String(v);
  return (
    <ToggleButtonGroup
      aria-label={ariaLabel}
      size={size}
      isDetached={detached}
      className={className}
      selectionMode="single"
      selectedKeys={value === null ? [] : [key(value)]}
      onSelectionChange={(keys) => {
        const k = [...keys][0];
        const opt = options.find((o) => key(o.id) === String(k));
        if (opt && opt.id !== value) onChange(opt.id);
      }}
    >
      {options.map((o, i) => (
        <ToggleButton key={key(o.id)} id={key(o.id)}>
          {i > 0 && !detached && <ToggleButtonGroup.Separator />}
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
