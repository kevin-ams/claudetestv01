"use client";

import { useActionState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { cancelMfaLoginAction, loginAction, verifyMfaLoginAction, type FormState } from "@/lib/auth/actions";

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  if (state.mfa) return <MfaForm />;

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

/** Segundo paso: código de 6 dígitos de la app de autenticación, o un código de recuperación. */
function MfaForm() {
  const [state, formAction, pending] = useActionState(verifyMfaLoginAction, { error: null, mfa: true } as FormState);
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-muted">
        Tu cuenta tiene doble factor. Escribe el código de 6 dígitos de tu app de autenticación, o uno de tus códigos de recuperación.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <TextField name="code" isRequired fullWidth autoComplete="one-time-code" autoFocus>
          <Label>Código</Label>
          <Input inputMode="text" placeholder="123456" maxLength={12} />
        </TextField>
        {state.error && (
          <p role="alert" className="rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
            {state.error}
          </p>
        )}
        <Button type="submit" isPending={pending} fullWidth>
          {pending ? "Verificando…" : "Verificar y entrar"}
        </Button>
      </form>
      <form action={cancelMfaLoginAction}>
        <Button type="submit" variant="ghost" fullWidth className="text-sm text-muted">
          Volver a empezar
        </Button>
      </form>
    </div>
  );
}
