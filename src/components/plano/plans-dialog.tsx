"use client";

import { useRef, useState } from "react";
import { deletePlan, loadPlans, normalizePlan } from "@/lib/plano/storage";
import type { Plan } from "@/lib/plano/types";
import { clonePlan, newId, TEMPLATES } from "@/lib/plano/util";

interface Props {
  current: Plan;
  onOpen: (plan: Plan) => void;
  onClose: () => void;
}

export function PlansDialog({ current, onOpen, onClose }: Props) {
  const [plans, setPlans] = useState(() => {
    const stored = loadPlans();
    return stored.some((p) => p.id === current.id) ? stored.map((p) => (p.id === current.id ? current : p)) : [current, ...stored];
  });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.items)) throw new Error();
      onOpen({ ...normalizePlan(data), id: newId(), updatedAt: Date.now() });
    } catch {
      setError("El archivo no es un plano válido (.plano.json).");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-bold">Mis planos</h2>
          <button className="text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="grid flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Nuevo desde plantilla</h3>
            <ul className="space-y-2">
              {TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button className="w-full rounded-lg border border-border p-3 text-left hover:border-primary hover:bg-slate-50" onClick={() => onOpen(t.make())}>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.description}</div>
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn btn-secondary mt-3 w-full" onClick={() => fileRef.current?.click()}>
              Importar archivo .plano.json
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = "";
              }}
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Guardados en este navegador</h3>
            <ul className="space-y-2">
              {plans.map((p) => (
                <li key={p.id} className={`rounded-lg border p-3 ${p.id === current.id ? "border-primary bg-slate-50" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button className="text-left" onClick={() => onOpen(p)}>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.items.length} elementos · {p.stage.width}×{p.stage.depth} m · {new Date(p.updatedAt).toLocaleString("es")}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button
                        className="rounded px-2 py-1 text-xs hover:bg-slate-200"
                        title="Duplicar"
                        onClick={() => onOpen({ ...clonePlan(p), id: newId(), name: `${p.name} (copia)`, updatedAt: Date.now() })}
                      >
                        ⧉
                      </button>
                      {p.id !== current.id && (
                        <button
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          title="Eliminar"
                          onClick={() => {
                            if (!confirm(`¿Eliminar "${p.name}"?`)) return;
                            deletePlan(p.id);
                            setPlans((ps) => ps.filter((x) => x.id !== p.id));
                          }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Los planos se guardan automáticamente en este navegador. Exporta a .plano.json para respaldarlos o compartirlos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
