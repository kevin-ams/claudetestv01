"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Card, Input } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
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
    <Card className="block gap-0 p-4">
      <Button size="sm" variant="ghost"
        className="text-sm text-primary"
        onPress={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar" : "Gestionar indicadores y dueños"}
      </Button>

      {open && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Indicadores</h4>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {metrics.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.name}</span>
                  <Button size="sm" variant="ghost"
                    className="text-xs text-red"
                    onPress={() => archiveMetricAction(m.id)}
                  >
                    Archivar
                  </Button>
                </li>
              ))}
            </ul>
            <form action={createMetricAction} className="flex flex-col gap-2">
              <Input fullWidth name="name" required placeholder="Nombre del indicador" />
              <Input fullWidth name="predicts" placeholder="¿Qué predice?" />
              <div className="flex gap-2">
                <AppSelect fullWidth name="direction" defaultValue="higher_better">
                  <option value="higher_better">Mayor mejor</option>
                  <option value="lower_better">Menor mejor</option>
                </AppSelect>
                <AppSelect fullWidth name="format" defaultValue="count">
                  <option value="count">Conteo</option>
                  <option value="percentage">%</option>
                  <option value="currency">Moneda</option>
                </AppSelect>
                <AppSelect fullWidth name="aggregation" defaultValue="sum">
                  <option value="sum">Suma (rollup)</option>
                  <option value="average">Promedio (rollup)</option>
                </AppSelect>
              </div>
              <Button variant="primary" type="submit" className="self-start">
                + Agregar indicador
              </Button>
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
                  <Button size="sm" variant="ghost"
                    className="text-xs text-red"
                    onPress={() => deleteOwnerAction(o.id)}
                  >
                    Eliminar
                  </Button>
                </li>
              ))}
            </ul>
            <form action={createOwnerAction} className="flex flex-col gap-2">
              <Input fullWidth name="name" required placeholder="Nombre del dueño" />
              <AppCheckbox name="isRollup" className="flex items-center gap-2 text-sm">
                Es un rollup calculado (ej. &quot;General&quot;)
              </AppCheckbox>
              <Button variant="primary" type="submit" className="self-start">
                + Agregar dueño
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
