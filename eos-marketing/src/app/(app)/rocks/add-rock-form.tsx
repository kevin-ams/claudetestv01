"use client";

import { useState } from "react";
import type { PublicUser } from "@/lib/domain/types";
import { createRockAction } from "./actions";

export function AddRockForm({
  members,
  quarter,
  year,
}: {
  members: PublicUser[];
  quarter: number;
  year: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="eos-btn eos-btn-primary" onClick={() => setOpen(true)}>
        + Nuevo Rock
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await createRockAction(fd);
        setOpen(false);
      }}
      className="eos-card flex w-full max-w-xl flex-col gap-2 p-4"
    >
      <input type="hidden" name="quarter" value={quarter} />
      <input type="hidden" name="year" value={year} />
      <input name="title" required className="eos-input" placeholder="Título del Rock" />
      <textarea
        name="description"
        className="eos-input min-h-16"
        placeholder="Descripción / criterio de éxito"
      />
      <select name="ownerId" defaultValue="none" className="eos-input">
        <option value="none">Sin dueño</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <input type="date" name="dueDate" className="eos-input" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isCompanyRock" />
        Rock de la empresa
      </label>
      <div className="flex gap-2">
        <button type="submit" className="eos-btn eos-btn-primary">
          Crear Rock
        </button>
        <button type="button" className="eos-btn eos-btn-secondary" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
