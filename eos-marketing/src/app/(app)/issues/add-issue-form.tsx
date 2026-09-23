"use client";

import { useState } from "react";
import type { PublicUser } from "@/lib/domain/types";
import { createIssueAction } from "./actions";

export function AddIssueForm({ members }: { members: PublicUser[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Nuevo Issue
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await createIssueAction(fd);
        setOpen(false);
      }}
      className="card flex max-w-xl flex-col gap-2 p-4"
    >
      <input name="title" required className="input" placeholder="Título del issue" />
      <textarea name="description" className="input min-h-16" placeholder="Detalle (opcional)" />
      <div className="flex gap-2">
        <select name="ownerId" defaultValue="none" className="input">
          <option value="none">Sin dueño</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select name="term" defaultValue="short_term" className="input">
          <option value="short_term">Corto plazo</option>
          <option value="long_term">Largo plazo</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">
          Agregar
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
