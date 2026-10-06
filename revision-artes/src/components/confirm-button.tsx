"use client";

import { useRef } from "react";
import { AlertDialog, Button } from "@heroui/react";

/**
 * Botón dentro de un <form> que pide confirmación en un diálogo antes de
 * enviarlo (para acciones destructivas o que cortan accesos).
 */
export function ConfirmButton({
  title,
  message,
  confirmLabel,
  variant = "danger-soft",
  size = "md",
  children,
  ariaLabel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  variant?: "danger" | "danger-soft" | "tertiary" | "secondary";
  size?: "sm" | "md";
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  return (
    <>
      <span ref={anchor} hidden />
      <AlertDialog>
        <Button variant={variant} size={size} aria-label={ariaLabel}>
          {children}
        </Button>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[420px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>{title}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>{message}</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Cancelar
                </Button>
                <Button
                  slot="close"
                  variant="danger"
                  onPress={() => anchor.current?.closest("form")?.requestSubmit()}
                >
                  {confirmLabel}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}
