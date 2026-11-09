"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@heroui/react";

/** Evento mínimo compatible con el onChange de un checkbox nativo. */
export type CheckboxChangeEvent = { target: { checked: boolean } };

/**
 * Checkbox de HeroUI con la forma de uso de un <input type="checkbox">:
 * checked/defaultChecked, name (formularios) y onChange={(e) => e.target.checked}.
 * Los hijos son la etiqueta.
 */
export function AppCheckbox({
  checked,
  defaultChecked,
  onChange,
  name,
  value = "on",
  disabled,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: CheckboxChangeEvent) => void;
  name?: string;
  value?: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Checkbox
      name={name}
      value={value}
      aria-label={ariaLabel}
      isDisabled={disabled}
      className={className}
      {...(checked !== undefined ? { isSelected: checked } : {})}
      {...(defaultChecked !== undefined ? { defaultSelected: defaultChecked } : {})}
      onChange={(isSelected: boolean) => onChange?.({ target: { checked: isSelected } })}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {children}
      </Checkbox.Content>
    </Checkbox>
  );
}
