"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { AcPipeline } from "@/lib/activecampaign/types";
import { RANGE_OPTIONS } from "./format";


export function Filters({
  pipelines,
  selectedPipelines,
  owners,
  careers,
}: {
  pipelines: AcPipeline[];
  selectedPipelines: string[];
  owners: { id: string; name: string }[];
  careers: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function togglePipeline(id: string) {
    const set = new Set(selectedPipelines);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    update({ p: [...set].join(",") || null });
  }

  const range = params.get("r") ?? "30d";

  return (
    <div className={`card mb-6 flex flex-col gap-3 p-4 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Embudos</span>
        <button
          onClick={() => update({ p: null })}
          className={`badge border ${selectedPipelines.length === 0 ? "border-primary bg-primary text-white" : "border-border bg-card"}`}
        >
          Todos
        </button>
        {pipelines.map((p) => {
          const active = selectedPipelines.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => togglePipeline(p.id)}
              className={`badge border ${active ? "border-primary bg-primary text-white" : "border-border bg-card"}`}
            >
              {p.title}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Fecha de creación
          <select className="input" value={range} onChange={(e) => update({ r: e.target.value })}>
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {range === "custom" && (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Desde
              <input
                type="date"
                className="input"
                defaultValue={params.get("from") ?? ""}
                onChange={(e) => update({ from: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Hasta
              <input
                type="date"
                className="input"
                defaultValue={params.get("to") ?? ""}
                onChange={(e) => update({ to: e.target.value })}
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Carrera
          <select className="input" value={params.get("c") ?? ""} onChange={(e) => update({ c: e.target.value })}>
            <option value="">Todas</option>
            {careers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Asesor
          <select className="input" value={params.get("o") ?? ""} onChange={(e) => update({ o: e.target.value })}>
            <option value="">Todos</option>
            {owners.map((o) => (
              <option key={o.id || "none"} value={o.id || "none"}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Estado
          <select className="input" value={params.get("s") ?? ""} onChange={(e) => update({ s: e.target.value })}>
            <option value="">Todos</option>
            <option value="open">Abiertos</option>
            <option value="won">Ganados</option>
            <option value="lost">Perdidos</option>
          </select>
        </label>
      </div>
    </div>
  );
}
