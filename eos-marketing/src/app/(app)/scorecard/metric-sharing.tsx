"use client";

import { useState, useTransition } from "react";
import { Button, Chip } from "@heroui/react";
import { AppCheckbox } from "@/components/ui/checkbox";
import type { MetricSharing } from "@/lib/domain/scorecard";
import { setMetricSharingAction } from "./actions";

/** "Visible para otros equipos": a todos o a equipos elegidos. */
export function MetricSharingControl({
  metricId,
  sharing,
  teams,
}: {
  metricId: number;
  sharing: MetricSharing;
  teams: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(sharing.shared_all);
  const [selected, setSelected] = useState(() => new Set(sharing.team_ids));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = sharing.shared_all ? teams.length : sharing.team_ids.length;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {count > 0 && (
          <Chip size="sm" variant="soft" color="accent">
            {sharing.shared_all ? "Todos los equipos" : `${count} equipo(s)`}
          </Chip>
        )}
        <Button size="sm" variant="ghost" className="text-xs text-primary" onPress={() => setOpen((o) => !o)}>
          {open ? "Cerrar" : "Compartir"}
        </Button>
      </div>
      {open && (
        <div className="flex w-64 flex-col gap-1.5 rounded-lg border border-border bg-background p-3 text-left">
          {teams.length === 0 ? (
            <p className="text-xs text-muted">No hay otros equipos todavía. Créalos en Ajustes › Equipos.</p>
          ) : (
            <>
              <AppCheckbox checked={all} onChange={(e) => setAll(e.target.checked)} className="text-sm font-medium">
                Visible para todos los equipos
              </AppCheckbox>
              {!all &&
                teams.map((t) => (
                  <AppCheckbox
                    key={t.id}
                    className="text-sm"
                    checked={selected.has(t.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(t.id);
                      else next.delete(t.id);
                      setSelected(next);
                    }}
                  >
                    {t.name}
                  </AppCheckbox>
                ))}
              <Button
                size="sm"
                className="mt-1 self-start"
                isPending={pending}
                onPress={() =>
                  startTransition(async () => {
                    const res = await setMetricSharingAction(metricId, all, [...selected]);
                    setMessage(res.message);
                  })
                }
              >
                Guardar
              </Button>
            </>
          )}
          {message && <p className="text-xs text-green">{message}</p>}
        </div>
      )}
    </div>
  );
}
