"use client";

import { Button } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Botón de envío que se deshabilita mientras el formulario guarda (evita registros duplicados por doble clic). */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "type" | "children"> & { children: ReactNode; pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" isDisabled={pending || props.isDisabled}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
