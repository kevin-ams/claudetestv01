"use client";

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
    <div className="eos-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-primary underline"
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? "Cancelar" : "Editar"}
        </button>
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
            <button type="submit" className="eos-btn eos-btn-primary self-start">
              Guardar
            </button>
          </form>
        ) : (
          view
        )}
      </div>
    </div>
  );
}
