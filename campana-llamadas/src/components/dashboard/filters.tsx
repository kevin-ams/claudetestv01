"use client";

import { useEffect, useRef, useState } from "react";

export type Option<T extends string = string> = { value: T; label: string; count?: number };

export function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = (v: T) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  const summary =
    selected.length === 0
      ? "Todos"
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} seleccionados`;

  return (
    <div className="relative" ref={ref}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`input flex items-center justify-between gap-2 text-left ${
          selected.length ? "border-primary font-medium text-primary" : ""
        }`}
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden className="text-xs text-muted">
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 max-h-72 w-72 max-w-[85vw] overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-primary hover:bg-background"
            >
              Limpiar selección
            </button>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-background"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              <span className="flex-1">{o.label}</span>
              {o.count !== undefined && (
                <span className="text-xs tabular-nums text-muted">{o.count}</span>
              )}
            </label>
          ))}
          {!options.length && <p className="px-2 py-1.5 text-sm text-muted">Sin opciones</p>}
        </div>
      )}
    </div>
  );
}
