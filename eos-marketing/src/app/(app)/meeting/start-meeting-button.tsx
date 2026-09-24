"use client";

import { Button } from "@heroui/react";
import { useTransition } from "react";
import { startNewMeetingAction } from "./actions";

export function StartMeetingButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button variant="primary"
      isDisabled={pending}
      onPress={() => startTransition(() => startNewMeetingAction())}
    >
      {pending ? "Iniciando..." : "▶ Iniciar reunión"}
    </Button>
  );
}
