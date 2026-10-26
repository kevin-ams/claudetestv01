"use client";

import { ArrowRotateLeft } from "@gravity-ui/icons";
import { Button, Card } from "@heroui/react";
import { useState, useTransition } from "react";
import { restoreMetricAction } from "@/app/(app)/scorecard/actions";

type Item = { id: number; name: string; predicts: string; archived_at: string | null };

const WHEN = new Intl.DateTimeFormat("es", { dateStyle: "medium" });

export function ArchivedMetrics({ metrics, editable }: { metrics: Item[]; editable: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="flex flex-col gap-3 p-4">
      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`} role="status">
          {message.message}
        </p>
      )}
      {metrics.length === 0 ? (
        <p className="text-sm text-muted">No hay indicadores archivados.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {metrics.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-muted">
                  {m.predicts && `${m.predicts} · `}
                  {m.archived_at ? `Archivado el ${WHEN.format(new Date(m.archived_at))}` : "Archivado"}
                </p>
              </div>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={pending}
                  onPress={() =>
                    start(async () => {
                      const r = await restoreMetricAction(m.id).catch(() => ({
                        ok: false,
                        message: "No se pudo restaurar. Si se publicó una versión nueva, recarga la página.",
                      }));
                      setMessage(r);
                    })
                  }
                >
                  <ArrowRotateLeft aria-hidden /> Restaurar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
