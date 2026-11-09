"use client";

import { useTransition } from "react";
import { statusTone } from "@/lib/domain/editorial-shared";

const TONE = {
  green: "bg-green-bg text-green",
  red: "bg-red-bg text-red",
  yellow: "bg-yellow-bg text-yellow",
  muted: "bg-border/60 text-muted",
  primary: "bg-primary/10 text-primary",
} as const;

export function statusClass(status: string) {
  return TONE[statusTone(status)];
}

/** Estado como "pastilla" que se cambia en el lugar (select nativo, compacto para tablas). */
export function StatusSelect({
  status,
  options,
  onChange,
  disabled,
  label,
}: {
  status: string;
  options: string[];
  onChange: (status: string) => Promise<void>;
  disabled?: boolean;
  label: string;
}) {
  const [pending, start] = useTransition();
  const all = options.includes(status) || !status ? options : [status, ...options];
  return (
    <select
      aria-label={label}
      disabled={disabled || pending}
      value={status}
      onChange={(e) => {
        const v = e.target.value;
        start(() => onChange(v));
      }}
      className={`max-w-40 cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary disabled:cursor-default ${statusClass(status)} ${pending ? "opacity-60" : ""}`}
    >
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
