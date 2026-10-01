"use client";

import { Button, Input } from "@heroui/react";
import { useActionState } from "react";
import { AppSelect } from "@/components/ui/select";
import { addTeammateAction, type FormState } from "./actions";

const initialState: FormState = { error: null, success: null };

export function AddTeammateForm({ roles }: { roles: { id: number; name: string }[] }) {
  const [state, formAction, pending] = useActionState(
    addTeammateAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Input fullWidth name="name" placeholder="Nombre completo (si es nueva)" />
      <Input fullWidth name="email" type="email" required placeholder="Correo" />
      <Input fullWidth
        name="password"
        type="password"
        minLength={8}
        placeholder="Contraseña temporal (mín. 8; vacía si ya tiene cuenta)"
      />
      <Input fullWidth name="seatTitle" placeholder="Puesto (opcional)" />
      <AppSelect fullWidth name="roleId" aria-label="Rol" defaultValue={roles.find((r) => r.name === "Usuario")?.id ?? roles[0]?.id}>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            Rol: {r.name}
          </option>
        ))}
      </AppSelect>
      {state.error && <p className="text-sm text-red">{state.error}</p>}
      {state.success && <p className="text-sm text-green">{state.success}</p>}
      <Button variant="primary" type="submit" isDisabled={pending} className="self-start">
        {pending ? "Agregando..." : "+ Agregar persona"}
      </Button>
      <p className="text-xs text-muted">
        Si la persona ya tiene cuenta (por ejemplo, está en otro equipo), basta con su correo. Si es nueva, comparte con ella el correo y la contraseña temporal.
      </p>
    </form>
  );
}
