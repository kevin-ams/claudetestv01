"use client";

import { Play } from "@gravity-ui/icons";
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
      <Play aria-hidden />
      {pending ? "Iniciando..." : "Iniciar reunión"}
    </Button>
  );
}
