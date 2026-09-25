"use client";

import { useState, type ReactNode } from "react";

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
        {hint && <span className="normal-case tracking-normal text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function NumberField({
  value,
  onChange,
  onFocus,
  step = 0.1,
  min,
  max,
  suffix,
  decimals = 2,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  onFocus?: () => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  decimals?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === undefined ? "" : String(+value.toFixed(decimals)));
  return (
    <div className="relative">
      <input
        type="number"
        className="input pr-9"
        value={shown}
        step={step}
        min={min}
        max={max}
        onFocus={() => {
          setText(shown);
          onFocus?.();
        }}
        onBlur={() => setText(null)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) {
            onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
          }
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</h3>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
