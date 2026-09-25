"use client";

import { useState } from "react";
import { CATALOG, CATEGORIES } from "@/lib/plano/catalog";
import type { CatalogItem } from "@/lib/plano/types";
import { createItem } from "@/lib/plano/util";
import { ItemSymbol, PX } from "./symbol";

function Preview({ c }: { c: CatalogItem }) {
  const item = createItem(c.type, 0, 0);
  const span = Math.max(c.w, c.h) * PX;
  const pad = span * 0.12 + 4;
  return (
    <svg viewBox={`${-span / 2 - pad} ${-span / 2 - pad} ${span + pad * 2} ${span + pad * 2}`} className="h-9 w-9 shrink-0" aria-hidden>
      <ItemSymbol item={item} />
    </svg>
  );
}

export function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const q = query.trim().toLowerCase();
  const matches = (c: CatalogItem) =>
    !q || c.name.toLowerCase().includes(q) || c.type.includes(q) || (c.keywords ?? "").includes(q);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <input
          className="input"
          placeholder="Buscar elemento…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="mt-2 text-[11px] leading-snug text-muted">Arrastra al plano o haz clic para agregar al centro.</p>
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        {CATEGORIES.map((cat) => {
          const items = CATALOG.filter((c) => c.category === cat.id && matches(c));
          if (!items.length) return null;
          const isClosed = !q && closed.has(cat.id);
          return (
            <section key={cat.id}>
              <button
                className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-border bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                onClick={() =>
                  setClosed((s) => {
                    const n = new Set(s);
                    if (n.has(cat.id)) n.delete(cat.id);
                    else n.add(cat.id);
                    return n;
                  })
                }
              >
                <span aria-hidden>{cat.icon}</span>
                <span className="flex-1">{cat.label}</span>
                <span className="text-slate-400">{isClosed ? "▸" : "▾"}</span>
              </button>
              {!isClosed && (
                <div className="grid grid-cols-2 gap-1 p-2">
                  {items.map((c) => (
                    <button
                      key={c.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-plano", c.type);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => onAdd(c.type)}
                      title={c.watts ? `${c.name} · ${c.watts} W` : c.name}
                      className="flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-center text-[11px] leading-tight text-slate-700 hover:border-border hover:bg-slate-50 active:cursor-grabbing"
                    >
                      <Preview c={c} />
                      <span className="line-clamp-2">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
