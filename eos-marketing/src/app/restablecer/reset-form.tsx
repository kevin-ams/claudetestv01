"use client";

import { useActionState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { resetPasswordAction, type ResetState } from "@/lib/auth/password-actions";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, { error: null } as ResetState);
  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <TextField name="password" type="password" isRequired fullWidth autoComplete="new-password">
        <Label>Nueva contraseña</Label>
        <Input />
      </TextField>
      <TextField name="confirm" type="password" isRequired fullWidth autoComplete="new-password">
        <Label>Repite la contraseña</Label>
        <Input />
      </TextField>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
          {state.error}
        </p>
      )}
      <Button type="submit" isPending={pending} fullWidth>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
