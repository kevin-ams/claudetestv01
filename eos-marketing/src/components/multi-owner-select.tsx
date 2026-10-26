"use client";

import { ChevronDown } from "@gravity-ui/icons";
import { useEffect, useRef, useState } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";

type Person = { id: number; name: string };

/**
 * Elegir una o varias personas (p. ej. dueños de un To-Do: se crea uno por persona).
 * Con `name`, agrega un <input hidden> por persona para enviarse en un formulario.
 */
export function MultiOwnerSelect({
  members,
  value,
  onChange,
  name,
  emptyLabel = "Sin dueño",
  className = "",
  inline = false,
}: {
  members: Person[];
  value: number[];
  onChange: (ids: number[]) => void;
  name?: string;
  emptyLabel?: string;
  className?: string;
  /** La lista se despliega dentro del flujo (p. ej. en una ventana modal, donde un menú flotante queda tapado). */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chosen = members.filter((m) => value.includes(m.id));
  const label = chosen.length === 0 ? emptyLabel : chosen.length <= 2 ? chosen.map((m) => m.name).join(", ") : `${chosen[0].name} +${chosen.length - 1}`;
  const toggle = (id: number, on: boolean) => onChange(on ? [...value.filter((v) => v !== id), id] : value.filter((v) => v !== id));

  return (
    <div ref={box} className={`relative ${className}`}>
      {name && value.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Dueños: ${label}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full min-w-40 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm shadow-xs hover:bg-default"
      >
        <span className={`truncate ${chosen.length ? "" : "text-muted"}`}>{label}</span>
        <ChevronDown className="shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className={`${inline ? "relative w-full" : "absolute left-0 z-30 w-64"} mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg`} role="listbox" aria-multiselectable>
          <p className="px-1 text-[11px] text-muted">Elige una o varias personas: se crea un To-Do para cada una.</p>
          {members.map((m) => (
            <AppCheckbox key={m.id} checked={value.includes(m.id)} onChange={(e) => toggle(m.id, e.target.checked)}>
              <span className="text-sm">{m.name}</span>
            </AppCheckbox>
          ))}
          {value.length > 0 && (
            <button type="button" className="mt-1 self-start px-1 text-xs text-primary hover:underline" onClick={() => onChange([])}>
              Quitar todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
