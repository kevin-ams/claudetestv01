"use client";

import { useState } from "react";
import type { ScorecardMetric, ScorecardOwner } from "@/lib/domain/types";
import {
  createMetricAction,
  archiveMetricAction,
  createOwnerAction,
  deleteOwnerAction,
} from "./actions";

export function ScorecardAdmin({
  metrics,
  owners,
}: {
  metrics: ScorecardMetric[];
  owners: ScorecardOwner[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card p-4">
      <button
        className="text-sm font-semibold text-primary underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar" : "Gestionar indicadores y dueños"}
      </button>

      {open && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Indicadores</h4>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {metrics.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.name}</span>
                  <button
                    className="text-xs text-red"
                    onClick={() => archiveMetricAction(m.id)}
                  >
                    Archivar
                  </button>
                </li>
              ))}
            </ul>
            <form action={createMetricAction} className="flex flex-col gap-2">
              <input name="name" required className="input" placeholder="Nombre del indicador" />
              <input name="predicts" className="input" placeholder="¿Qué predice?" />
              <div className="flex gap-2">
                <select name="direction" className="input" defaultValue="higher_better">
                  <option value="higher_better">Mayor mejor</option>
                  <option value="lower_better">Menor mejor</option>
                </select>
                <select name="format" className="input" defaultValue="count">
                  <option value="count">Conteo</option>
                  <option value="percentage">%</option>
                  <option value="currency">Moneda</option>
                </select>
                <select name="aggregation" className="input" defaultValue="sum">
                  <option value="sum">Suma (rollup)</option>
                  <option value="average">Promedio (rollup)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary self-start">
                + Agregar indicador
              </button>
            </form>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Dueños del scorecard</h4>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {owners.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    {o.name}
                    {o.is_rollup && " (rollup)"}
                  </span>
                  <button
                    className="text-xs text-red"
                    onClick={() => deleteOwnerAction(o.id)}
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
            <form action={createOwnerAction} className="flex flex-col gap-2">
              <input name="name" required className="input" placeholder="Nombre del dueño" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isRollup" />
                Es un rollup calculado (ej. &quot;General&quot;)
              </label>
              <button type="submit" className="btn btn-primary self-start">
                + Agregar dueño
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
