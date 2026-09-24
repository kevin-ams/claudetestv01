"use client";

import { Button, Card } from "@heroui/react";
import { useState, type ReactNode } from "react";

export function EditableSection({
  title,
  subtitle,
  action,
  view,
  editForm,
}: {
  title: string;
  subtitle?: string;
  action: (formData: FormData) => void | Promise<void>;
  view: ReactNode;
  editForm: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="block gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <Button size="sm" variant="ghost"
          type="button"
          className="shrink-0 text-xs text-primary"
          onPress={() => setEditing((e) => !e)}
        >
          {editing ? "Cancelar" : "Editar"}
        </Button>
      </div>
      <div className="mt-3">
        {editing ? (
          <form
            action={async (fd) => {
              await action(fd);
              setEditing(false);
            }}
            className="flex flex-col gap-3"
          >
            {editForm}
            <Button variant="primary" type="submit" className="self-start">
              Guardar
            </Button>
          </form>
        ) : (
          view
        )}
      </div>
    </Card>
  );
}
