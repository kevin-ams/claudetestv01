"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Input, TextArea } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
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
      <Button variant="primary" onPress={() => setOpen(true)}>
        + Nuevo Rock
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await createRockAction(fd);
        setOpen(false);
      }}
      className="card card--default flex w-full max-w-xl flex-col gap-2 p-4"
    >
      <input type="hidden" name="quarter" value={quarter} />
      <input type="hidden" name="year" value={year} />
      <Input fullWidth name="title" required placeholder="Título del Rock" />
      <TextArea fullWidth
        name="description"
        className="min-h-16"
        placeholder="Descripción / criterio de éxito"
      />
      <AppSelect fullWidth name="ownerId" defaultValue="none">
        <option value="none">Sin dueño</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </AppSelect>
      <Input fullWidth type="date" name="dueDate" />
      <AppCheckbox name="isCompanyRock" className="flex items-center gap-2 text-sm">
        Rock de la empresa
      </AppCheckbox>
      <div className="flex gap-2">
        <Button variant="primary" type="submit">
          Crear Rock
        </Button>
        <Button variant="outline" type="button" onPress={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
