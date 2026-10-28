"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SyncProgress } from "@/lib/activecampaign/types";
import { syncStepAction } from "./actions";

const PHASE_LABEL: Record<SyncProgress["phase"], string> = {
  idle: "Sin sincronizar",
  meta: "Leyendo embudos, etapas y campos…",
  deals: "Descargando tratos…",
  enrich: "Leyendo notas, actividad y campos de cada trato…",
  done: "Sincronizado",
  error: "Error",
};

export function SyncPanel({ initial }: { initial: SyncProgress }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(initial.error);

  async function run(mode: "full" | "incremental" | "continue") {
    setRunning(true);
    setError(null);
    try {
      let p = await syncStepAction(mode);
      setProgress(p);
      while (!p.error && p.phase !== "done") {
        p = await syncStepAction("continue");
        setProgress(p);
      }
      if (p.error) setError(p.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const interrupted = !running && ["meta", "deals", "enrich"].includes(progress.phase);
  const enrichedPct =
    progress.totalDeals > 0 ? 1 - progress.pendingEnrich / progress.totalDeals : 0;

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="flex flex-wrap justify-end gap-2">
        {interrupted ? (
          <button className="btn btn-primary" disabled={running} onClick={() => run("continue")}>
            Continuar sincronización
          </button>
        ) : (
          <button className="btn btn-primary" disabled={running} onClick={() => run("incremental")}>
            {running ? "Sincronizando…" : "Sincronizar"}
          </button>
        )}
        <button
          className="btn btn-secondary"
          disabled={running}
          onClick={() => run("full")}
          title="Vuelve a leer todos los tratos y elimina los que se borraron en ActiveCampaign"
        >
          Completa
        </button>
      </div>
      <p className="text-xs text-muted">
        {running || interrupted ? PHASE_LABEL[progress.phase] : null}
        {(running || interrupted) && progress.phase === "enrich" && (
          <> {Math.round(enrichedPct * 100)}% ({progress.totalDeals - progress.pendingEnrich}/{progress.totalDeals})</>
        )}
        {!running && !interrupted && progress.lastSyncedAt && (
          <>Última sincronización: {new Date(progress.lastSyncedAt).toLocaleString("es-MX")}</>
        )}
        {!running && !interrupted && !progress.lastSyncedAt && "Aún no se ha sincronizado"}
      </p>
      {error && <p className="max-w-md text-xs text-red">{error}</p>}
    </div>
  );
}
