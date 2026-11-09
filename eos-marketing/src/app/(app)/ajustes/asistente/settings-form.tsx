"use client";

import { Button, Input } from "@heroui/react";
import { useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { callAction, type ActionResult } from "@/lib/client-actions";
import { saveAiSettingsAction } from "./actions";

type Values = { monthlyCapUsd: number; userDailyLimit: number; model: string };

export function AiSettingsForm({ initial, models, canEdit }: { initial: Values; models: { id: string; label: string }[]; canEdit: boolean }) {
  const [v, setV] = useState({ monthlyCapUsd: String(initial.monthlyCapUsd), userDailyLimit: String(initial.userDailyLimit), model: initial.model });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof v>) => {
    setV((s) => ({ ...s, ...patch }));
    setResult(null);
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setResult(
            await callAction(
              saveAiSettingsAction({ monthlyCapUsd: Number(v.monthlyCapUsd), userDailyLimit: Number(v.userDailyLimit), model: v.model }),
            ),
          );
        });
      }}
    >
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Tope mensual (USD)</span>
          <Input id="ai-cap" type="number" min={0} max={500} step="0.5" value={v.monthlyCapUsd} onChange={(e) => set({ monthlyCapUsd: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Preguntas por persona en 24 h</span>
          <Input id="ai-limit" type="number" min={0} max={500} step="1" value={v.userDailyLimit} onChange={(e) => set({ userDailyLimit: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-xs text-muted">Modelo que responde</span>
          <AppSelect fullWidth value={v.model} onChange={(e) => set({ model: e.target.value })}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </AppSelect>
        </label>
      </fieldset>
      {canEdit && (
        <Button type="submit" variant="primary" className="self-start" isPending={pending}>
          Guardar
        </Button>
      )}
      {result && (
        <p className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`} role="status">
          {result.message}
        </p>
      )}
    </form>
  );
}
