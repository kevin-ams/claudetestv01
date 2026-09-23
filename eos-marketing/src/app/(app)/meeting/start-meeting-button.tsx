"use client";

import { useTransition } from "react";
import { startNewMeetingAction } from "./actions";

export function StartMeetingButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-primary"
      disabled={pending}
      onClick={() => startTransition(() => startNewMeetingAction())}
    >
      {pending ? "Iniciando..." : "▶ Iniciar reunión"}
    </button>
  );
}
