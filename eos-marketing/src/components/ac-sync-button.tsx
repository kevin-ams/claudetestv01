"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { syncLeadsStepAction, type SyncStep } from "@/app/(app)/indicadores/actions";

export type ScanProgress = { pipelinesDone: number; pipelinesTotal: number; checked: number };

/**
 * Revisa el historial de ActiveCampaign en tandas hasta terminar (cada tanda es una llamada
 * al servidor). Con `write`, al final guarda los leads de la semana en curso.
 */
export async function runLeadsScan(write: boolean, onProgress: (p: ScanProgress) => void): Promise<SyncStep> {
  const startedAt = new Date().toISOString();
  let checked = 0;
  try {
    for (let i = 0; i < 3000; i++) {
      const step = await syncLeadsStepAction(startedAt, write);
      checked += step.checked;
      onProgress({ pipelinesDone: step.pipelinesDone, pipelinesTotal: step.pipelinesTotal, checked });
      if (step.done) return { ...step, checked };
    }
    return { ok: false, done: true, pipelinesDone: 0, pipelinesTotal: 0, checked, message: "La revisión tomó demasiado; vuelve a intentarlo (retoma donde quedó)." };
  } catch {
    return { ok: false, done: true, pipelinesDone: 0, pipelinesTotal: 0, checked, message: "Se interrumpió la revisión. Vuelve a intentarlo: retoma donde quedó." };
  }
}

/** Barra de avance de la revisión del historial. */
export function ScanProgressBar({ progress }: { progress: ScanProgress | null }) {
  const pct = progress?.pipelinesTotal ? Math.round((progress.pipelinesDone / progress.pipelinesTotal) * 100) : 0;
  return (
    <div className="flex w-full max-w-md flex-col gap-1" role="status" aria-live="polite">
      <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
        <div
          className={`h-full rounded-full bg-primary transition-all duration-500 ${progress?.pipelinesTotal ? "" : "w-1/3 animate-pulse"}`}
          style={progress?.pipelinesTotal ? { width: `${Math.max(pct, 3)}%` } : undefined}
        />
      </div>
      <p className="text-xs text-muted">
        {progress?.pipelinesTotal
          ? `Embudos revisados: ${progress.pipelinesDone} de ${progress.pipelinesTotal} · ${progress.checked} trato(s) con historial leído`
          : "Conectando con ActiveCampaign…"}
        {" · "}no cierres esta página.
      </p>
    </div>
  );
}

/** "Actualizar leads desde ActiveCampaign": revisa el historial y guarda la semana en curso, con barra de avance. */
export function AcSyncButton({
  label = "↻ Actualizar leads desde ActiveCampaign",
  variant = "outline",
  disabled,
}: {
  label?: string;
  variant?: "outline" | "primary" | "secondary";
  disabled?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<SyncStep | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    setProgress(null);
    setResult(await runLeadsScan(true, setProgress));
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant={variant} isDisabled={running || disabled} onPress={run} className="h-auto min-h-9 whitespace-normal py-1.5 text-left">
        {running ? "Actualizando…" : label}
      </Button>
      {running && <ScanProgressBar progress={progress} />}
      {result && (
        <p className={`max-w-xl rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`}>{result.message}</p>
      )}
    </div>
  );
}
