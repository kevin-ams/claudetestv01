"use client";

import { Button, Input } from "@heroui/react";
import { useActionState } from "react";
import { setupAdminAction, type FormState } from "@/lib/auth/actions";

const initialState: FormState = { error: null };

export function SetupForm() {
  const [state, formAction, pending] = useActionState(
    setupAdminAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium" htmlFor="teamName">
          Nombre de tu equipo / empresa
        </label>
        <Input fullWidth
          id="teamName"
          name="teamName"
          required
          className="mt-1"
          placeholder="Ej. Marketing"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="name">
          Tu nombre
        </label>
        <Input fullWidth id="name" name="name" required className="mt-1" placeholder="Ej. Kevin" />
        <p className="mt-1 text-xs text-muted">
          Si tu nombre es uno del equipo (Kevin, Lucero, Luis, Andrea, Patty o
          Miguel), tu cuenta tomará ese lugar y sus carreras.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="email">
          Correo
        </label>
        <Input fullWidth
          id="email"
          name="email"
          type="email"
          required
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">
          Contraseña
        </label>
        <Input fullWidth
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className="mt-1"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red">{state.error}</p>
      )}
      <Button variant="primary" type="submit" isDisabled={pending} className="mt-2">
        {pending ? "Creando..." : "Crear equipo y entrar"}
      </Button>
    </form>
  );
}
