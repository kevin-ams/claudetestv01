"use client";

import { Button, Input, TextArea } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useState } from "react";
import type { PublicUser } from "@/lib/domain/types";
import { createIssueAction } from "./actions";

export function AddIssueForm({ members }: { members: PublicUser[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="primary" onPress={() => setOpen(true)}>
        + Nuevo Issue
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await createIssueAction(fd);
        setOpen(false);
      }}
      className="card card--default flex max-w-xl flex-col gap-2 p-4"
    >
      <Input fullWidth name="title" required placeholder="Título del issue" />
      <TextArea fullWidth name="description" className="min-h-16" placeholder="Detalle (opcional)" />
      <div className="flex gap-2">
        <AppSelect fullWidth name="ownerId" defaultValue="none">
          <option value="none">Sin dueño</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </AppSelect>
        <AppSelect fullWidth name="term" defaultValue="short_term">
          <option value="short_term">Corto plazo</option>
          <option value="long_term">Largo plazo</option>
        </AppSelect>
        <Input fullWidth type="date" name="dueDate" aria-label="Fecha" title="Fecha específica (opcional)" />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" type="submit">
          Agregar
        </Button>
        <Button variant="outline" type="button" onPress={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
