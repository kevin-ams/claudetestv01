"use client";

import { Button } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/** Desplaza la ventana de semanas del Scorecard: 0 = semana actual con las próximas a la vista. */
export function WeekSlider({ offset, min = -52, max = 8, label }: { offset: number; min?: number; max?: number; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(offset);
  const go = (v: number) => {
    setValue(v);
    router.replace(v === 0 ? pathname : `${pathname}?semanas=${v}`, { scroll: false });
  };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <Button size="sm" variant="outline" aria-label="Semana anterior" onPress={() => go(Math.max(min, value - 1))}>
        ‹
      </Button>
      <input
        type="range"
        aria-label="Desplazar semanas"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={() => go(value)}
        onKeyUp={() => go(value)}
        className="w-56 accent-[var(--primary)]"
      />
      <Button size="sm" variant="outline" aria-label="Semana siguiente" onPress={() => go(Math.min(max, value + 1))}>
        ›
      </Button>
      <span className="text-muted">{label}</span>
      {value !== 0 && (
        <Button size="sm" variant="ghost" onPress={() => go(0)}>
          Volver a hoy
        </Button>
      )}
    </div>
  );
}
