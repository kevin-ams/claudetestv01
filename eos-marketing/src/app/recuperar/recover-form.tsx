"use client";

import { useActionState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { requestPasswordResetAction, type RecoverState } from "@/lib/auth/password-actions";

export function RecoverForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, { error: null } as RecoverState);
  if (state.sent) {
    return (
      <p role="status" className="mt-4 rounded-lg bg-green-bg px-3 py-2 text-sm text-green">
        Si <b>{state.email}</b> tiene una cuenta, te enviamos un enlace para crear tu nueva contraseña. Revisa también la
        carpeta de spam.
      </p>
    );
  }
  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <TextField key={state.email ?? ""} name="email" type="email" isRequired fullWidth autoComplete="email" defaultValue={state.email ?? ""}>
        <Label>Correo</Label>
        <Input placeholder="tu@correo.com" />
      </TextField>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
          {state.error}
        </p>
      )}
      <Button type="submit" isPending={pending} fullWidth>
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </Button>
    </form>
  );
}
