"use client";

import { ArrowsRotateRight } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { startBackgroundSyncAction, syncLeadsStepAction, syncStatusAction, type SyncStep } from "@/app/(app)/indicadores/actions";

export type ScanProgress = { pipelinesDone: number; pipelinesTotal: number; dealsDone: number; dealsTotal: number; checked: number };

/**
 * Revisa el historial de ActiveCampaign en tandas hasta terminar (cada tanda es una llamada
 * al servidor). Con `write`, al final guarda los leads de la semana en curso. Se detiene si
 * varias tandas seguidas no avanzan.
 */
export async function runLeadsScan(write: boolean, onProgress: (p: ScanProgress) => void): Promise<SyncStep> {
  const startedAt = new Date().toISOString();
  let checked = 0;
  let stalled = 0;
  let lastKey = "";
  const fail = (message: string): SyncStep => ({
    ok: false,
    done: true,
    pipelinesDone: 0,
    pipelinesTotal: 0,
    dealsDone: 0,
    dealsTotal: 0,
    checked,
    message,
  });
  try {
    for (let i = 0; i < 3000; i++) {
      const step = await syncLeadsStepAction(startedAt, write);
      checked += step.checked;
      onProgress({ ...step, checked });
      if (step.done) return { ...step, checked };
      const key = `${step.pipelinesDone}/${step.dealsDone}`;
      stalled = step.checked === 0 && key === lastKey ? stalled + 1 : 0;
      lastKey = key;
      if (stalled >= 5) return fail(`La revisión no avanza. ${step.message || "Vuelve a intentarlo en unos minutos (retoma donde quedó)."}`);
    }
    return fail("La revisión tomó demasiado; vuelve a intentarlo (retoma donde quedó).");
  } catch {
    return fail("Se interrumpió la revisión. Vuelve a intentarlo: retoma donde quedó.");
  }
}

/** Barra de avance de la revisión del historial. */
export function ScanProgressBar({ progress, background = false }: { progress: ScanProgress | null; background?: boolean }) {
  const total = progress?.dealsTotal ?? 0;
  const pct = total ? Math.round(((progress?.dealsDone ?? 0) / total) * 100) : 0;
  return (
    <div className="flex w-full max-w-md flex-col gap-1" role="status" aria-live="polite">
      <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
        <div
          className={`h-full rounded-full bg-primary transition-all duration-500 ${total ? "" : "w-1/3 animate-pulse"}`}
          style={total ? { width: `${Math.min(100, Math.max(pct, 3))}%` } : undefined}
        />
      </div>
      <p className="text-xs text-muted">
        {progress
          ? `${total ? `${pct}% · tratos revisados: ${progress.dealsDone} de ${total}` : "Contando tratos…"} · embudos: ${progress.pipelinesDone} de ${progress.pipelinesTotal}${background ? "" : ` · historiales leídos: ${progress.checked}`}`
          : "Conectando con ActiveCampaign…"}
        {background ? " · corre en segundo plano: puedes cerrar esta página." : " · no cierres esta página."}
      </p>
    </div>
  );
}

/** Consulta el avance de la sincronización en segundo plano hasta que termine (o 16 minutos). */
async function pollBackground(startedAt: string, onProgress: (p: ScanProgress) => void): Promise<{ ok: boolean; message: string }> {
  const until = Date.now() + 16 * 60 * 1000;
  while (Date.now() < until) {
    try {
      const s = await syncStatusAction(startedAt);
      onProgress({ ...s, checked: 0 });
      if (s.done) return { ok: true, message: s.message };
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: false, message: "La sincronización sigue en curso; la sincronización de cada hora completará lo pendiente." };
}

/**
 * "Actualizar leads desde ActiveCampaign": lanza la revisión del historial en segundo plano (sigue
 * aunque se cierre la página) y muestra el avance; si el segundo plano no está disponible, la hace
 * desde la pantalla. Guarda la semana en curso.
 */
export function AcSyncButton({
  label = "Actualizar leads desde ActiveCampaign",
  variant = "outline",
  disabled,
  pendingSince = null,
}: {
  label?: string;
  variant?: "outline" | "primary" | "secondary";
  disabled?: boolean;
  /** Si hay una sincronización en segundo plano en curso (pedida a esta hora), se muestra su avance. */
  pendingSince?: string | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(Boolean(pendingSince));
  const [background, setBackground] = useState(Boolean(pendingSince));
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Al volver a la página con una sincronización en curso, se retoma el avance.
  useEffect(() => {
    if (!pendingSince) return;
    let cancelled = false;
    pollBackground(pendingSince, (p) => !cancelled && setProgress(p)).then((r) => {
      if (cancelled) return;
      setResult(r);
      setRunning(false);
      router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [pendingSince, router]);

  async function run() {
    setRunning(true);
    setResult(null);
    setProgress(null);
    const start = await startBackgroundSyncAction().catch(() => null);
    if (start?.message) {
      setResult({ ok: false, message: start.message });
    } else if (start?.background) {
      setBackground(true);
      setResult(await pollBackground(start.startedAt, setProgress));
    } else {
      setBackground(false);
      setResult(await runLeadsScan(true, setProgress));
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant={variant} isDisabled={running || disabled} onPress={run} className="h-auto min-h-9 whitespace-normal py-1.5 text-left">
        <ArrowsRotateRight aria-hidden />
        {running ? "Actualizando…" : label}
      </Button>
      {running && <ScanProgressBar progress={progress} background={background} />}
      {result && (
        <p className={`max-w-xl rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`}>{result.message}</p>
      )}
    </div>
  );
}
