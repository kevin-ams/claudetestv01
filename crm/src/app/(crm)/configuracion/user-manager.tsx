"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createUserAction,
  resetPasswordAction,
  updateUserAccessAction,
  type ActionResult,
} from "./actions";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
  active: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  lastLoginAt: string | null;
};

function UserItem({
  user,
  isSelf,
  minLength,
  onResult,
}: {
  user: UserRow;
  isSelf: boolean;
  minLength: number;
  onResult: (r: ActionResult & { ok?: string }) => void;
}) {
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<ActionResult>, ok: string) {
    startTransition(async () => {
      const result = await fn();
      onResult(result.error ? result : { ok });
    });
  }

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${user.active ? "" : "opacity-60"} ${pending ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {user.name} {isSelf && <span className="text-xs text-muted">(tú)</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {user.email} · {[user.hasGoogle && "Google", user.hasPassword && "Contraseña"].filter(Boolean).join(" + ") || "Sin acceso aún"}
          {!user.active && " · Desactivado"}
        </p>
      </div>
      <select
        className="input w-36"
        value={user.role}
        disabled={pending}
        onChange={(e) =>
          act(() => updateUserAccessAction(user.id, e.target.value as UserRow["role"], user.active), "Rol actualizado")
        }
      >
        <option value="admin">Administrador</option>
        <option value="member">Miembro</option>
      </select>
      <button
        className="btn btn-ghost text-xs"
        disabled={pending}
        onClick={() => {
          const password = prompt(`Nueva contraseña temporal para ${user.name} (mínimo ${minLength} caracteres):`);
          if (password) act(() => resetPasswordAction(user.id, password), "Contraseña asignada");
        }}
      >
        {user.hasPassword ? "Cambiar contraseña" : "Asignar contraseña"}
      </button>
      {!isSelf && (
        <button
          className="btn btn-ghost text-xs"
          disabled={pending}
          onClick={() =>
            act(
              () => updateUserAccessAction(user.id, user.role, !user.active),
              user.active ? "Acceso desactivado" : "Acceso reactivado"
            )
          }
        >
          {user.active ? "Desactivar" : "Reactivar"}
        </button>
      )}
    </li>
  );
}

export function UserManager({
  users,
  currentUserId,
  minLength,
}: {
  users: UserRow[];
  currentUserId: number;
  minLength: number;
}) {
  const [result, setResult] = useState<ActionResult & { ok?: string }>({});
  const [formKey, setFormKey] = useState(0);
  const [addState, addAction, adding] = useActionState(
    async (prev: ActionResult, form: FormData) => {
      const r = await createUserAction(prev, form);
      if (!r.error) setFormKey((k) => k + 1);
      return r;
    },
    {}
  );

  return (
    <div className="mt-4">
      <ul className="divide-y divide-border">
        {users.map((u) => (
          <UserItem
            key={u.id}
            user={u}
            isSelf={u.id === currentUserId}
            minLength={minLength}
            onResult={setResult}
          />
        ))}
      </ul>
      {result.error && <p className="mt-2 text-sm text-red">{result.error}</p>}
      {result.ok && <p className="mt-2 text-sm text-green">{result.ok}</p>}

      <form key={formKey} action={addAction} className="mt-4 border-t border-border pt-4">
        <p className="label">Nuevo usuario con contraseña (externos o soporte)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="name" placeholder="Nombre" className="input" required />
          <input name="email" type="email" placeholder="Correo (cualquier dominio)" className="input" required />
          <input
            name="password"
            type="text"
            placeholder={`Contraseña temporal (mín. ${minLength})`}
            className="input"
            autoComplete="off"
            minLength={minLength}
            required
          />
          <select name="role" defaultValue="member" className="input">
            <option value="member">Miembro</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={adding}>
            Crear usuario
          </button>
          {addState.error && <p className="text-sm text-red">{addState.error}</p>}
        </div>
        <p className="mt-2 text-xs text-muted">
          Comparte la contraseña temporal por un canal seguro; la persona puede cambiarla en Mi perfil.
        </p>
      </form>
    </div>
  );
}
