"use client";

import { CATEGORIES, getCatalogItem } from "@/lib/plano/catalog";
import type { Plan } from "@/lib/plano/types";
import { exportCsv, equipmentRows } from "./export";
import { Section } from "./fields";

export function EquipmentPanel({ plan, select }: { plan: Plan; select: (ids: string[]) => void }) {
  const rows = equipmentRows(plan);
  return (
    <div>
      <Section title={`Equipo (${plan.items.length})`} right={<button className="text-xs text-primary underline" onClick={() => exportCsv(plan)}>Exportar CSV</button>}>
        {rows.length === 0 && <p className="text-sm text-slate-500">Aún no hay elementos en el plano.</p>}
        {CATEGORIES.map((cat) => {
          const catRows = rows.filter((r) => getCatalogItem(r.type)?.category === cat.id);
          if (!catRows.length) return null;
          return (
            <div key={cat.id}>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {cat.icon} {cat.label}
              </h4>
              <ul className="mb-2 divide-y divide-border rounded-md border border-border bg-white">
                {catRows.map((r) => (
                  <li key={r.type}>
                    <button
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-slate-50"
                      onClick={() => select(plan.items.filter((i) => i.type === r.type).map((i) => i.id))}
                      title={r.labels.join(", ")}
                    >
                      <span>
                        <b className="mr-1.5 inline-block min-w-5 text-right">{r.qty}×</b>
                        {getCatalogItem(r.type)?.name ?? r.type}
                      </span>
                      {r.watts > 0 && <span className="text-xs text-slate-500">{r.watts} W</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Section>
    </div>
  );
}
