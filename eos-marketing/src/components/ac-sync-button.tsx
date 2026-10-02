"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { syncLeadsStepAction, type SyncStep } from "@/app/(app)/indicadores/actions";

/**
 * "Actualizar leads desde ActiveCampaign": corre la sincronización por tandas y muestra el
 * avance. Siempre escribe la semana en curso.
 */
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<SyncStep | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    let offset = 0;
    try {
      for (let i = 0; i < 200; i++) {
        const step = await syncLeadsStepAction(offset);
        setProgress({ done: step.next, total: step.total });
        if (step.done) {
          setResult(step);
          break;
        }
        offset = step.next;
      }
    } catch {
      setResult({ ok: false, done: true, next: offset, total: 0, message: "Se interrumpió la sincronización. Vuelve a intentarlo." });
    } finally {
      setRunning(false);
      setProgress(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant={variant} isDisabled={running || disabled} onPress={run} className="h-auto min-h-9 whitespace-normal py-1.5 text-left">
        {running ? `Actualizando${progress?.total ? ` ${progress.done}/${progress.total} etapas` : "…"}` : label}
      </Button>
      {result && (
        <p className={`max-w-xl rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`}>{result.message}</p>
      )}
    </div>
  );
}
