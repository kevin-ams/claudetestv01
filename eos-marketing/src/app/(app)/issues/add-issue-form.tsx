"use client";

import { useState } from "react";
import type { PublicUser } from "@/lib/domain/types";
import { createIssueAction } from "./actions";

export function AddIssueForm({ members }: { members: PublicUser[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="eos-btn eos-btn-primary" onClick={() => setOpen(true)}>
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
      className="eos-card flex max-w-xl flex-col gap-2 p-4"
    >
      <input name="title" required className="eos-input" placeholder="Título del issue" />
      <textarea name="description" className="eos-input min-h-16" placeholder="Detalle (opcional)" />
      <div className="flex gap-2">
        <select name="ownerId" defaultValue="none" className="eos-input">
          <option value="none">Sin dueño</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select name="term" defaultValue="short_term" className="eos-input">
          <option value="short_term">Corto plazo</option>
          <option value="long_term">Largo plazo</option>
        </select>
        <input type="date" name="dueDate" className="eos-input" aria-label="Fecha" title="Fecha específica (opcional)" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="eos-btn eos-btn-primary">
          Agregar
        </button>
        <button type="button" className="eos-btn eos-btn-secondary" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
