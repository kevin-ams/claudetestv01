"use client";

import { Button, Card } from "@heroui/react";
import { useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { probeAcHistoryAction } from "./actions";

/** Prueba de solo lectura: ¿ActiveCampaign entrega el historial de cambios de embudo/etapa de un trato? */
export function AcHistoryPanel({ pipelines }: { pipelines: { id: string; title: string }[] }) {
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "-");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">Historial de tratos en ActiveCampaign</h2>
        <p className="text-sm text-muted">
          Prueba de solo lectura: toma el trato más reciente del embudo y revisa si ActiveCampaign entrega su historial
          de cambios de embudo y etapa con fecha. No muestra nombres, correos ni notas.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AppSelect className="w-auto" aria-label="Embudo" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </AppSelect>
        <Button
          variant="outline"
          isDisabled={pending || pipelineId === "-"}
          onPress={() =>
            start(async () => {
              setCopied(false);
              setResult(await probeAcHistoryAction(pipelineId));
            })
          }
        >
          {pending ? "Consultando…" : "Probar historial"}
        </Button>
        {result?.ok && (
          <Button
            variant="ghost"
            onPress={async () => {
              await navigator.clipboard.writeText(result.message);
              setCopied(true);
            }}
          >
            {copied ? "✓ Copiado" : "Copiar resultado"}
          </Button>
        )}
      </div>
      {result &&
        (result.ok ? (
          <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-background p-3 text-xs">{result.message}</pre>
        ) : (
          <p className="text-sm text-red">{result.message}</p>
        ))}
    </Card>
  );
}
