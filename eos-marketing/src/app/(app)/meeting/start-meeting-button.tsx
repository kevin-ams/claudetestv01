"use client";

import { Play } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { startNewMeetingAction } from "./actions";

/** "Iniciar reunión" con confirmación, para no abrir una L10 por accidente. */
export function StartMeetingButton() {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="primary" isDisabled={pending} onPress={() => setAsking(true)}>
        <Play aria-hidden />
        {pending ? "Iniciando..." : "Iniciar reunión"}
      </Button>
      {asking && (
        <ConfirmDialog
          title="¿Iniciar la reunión L10?"
          confirmLabel="Sí, iniciar"
          pending={pending}
          onConfirm={() => startTransition(() => startNewMeetingAction())}
          onClose={() => setAsking(false)}
        >
          Empieza el cronómetro y quedas como quien dirige la reunión. Si la iniciaste por error, puedes descartarla al final
          de la página de la reunión sin que quede registro.
        </ConfirmDialog>
      )}
    </>
  );
}
