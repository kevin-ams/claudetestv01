"use client";

import { useActionState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { loginAction, type FormState } from "@/lib/auth/actions";

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      {/* Tras un error, React limpia el formulario: se vuelve a llenar el correo. */}
      <TextField
        key={state.email ?? ""}
        name="email"
        type="email"
        isRequired
        fullWidth
        autoComplete="email"
        defaultValue={state.email ?? ""}
      >
        <Label>Correo</Label>
        <Input placeholder="tu@correo.com" />
      </TextField>
      <TextField name="password" type="password" isRequired fullWidth autoComplete="current-password">
        <Label>Contraseña</Label>
        <Input />
      </TextField>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
          {state.error}
        </p>
      )}
      <Button type="submit" isPending={pending} fullWidth className="mt-2">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
