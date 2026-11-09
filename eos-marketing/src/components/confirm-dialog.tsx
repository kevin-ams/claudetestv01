"use client";

import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";

/** Ventana de confirmación (en lugar del confirm() del navegador). */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && !pending && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md" aria-label={title}>
          <Modal.CloseTrigger />
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="text-sm text-muted">{children}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant={danger ? "danger" : "primary"} isPending={pending} onPress={onConfirm} autoFocus>
                {confirmLabel}
              </Button>
              <Button variant="outline" isDisabled={pending} onPress={onClose}>
                {cancelLabel}
              </Button>
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
