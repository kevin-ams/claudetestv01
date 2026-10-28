"use client";

import { ArrowsRotateRight } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SyncProgress } from "@/lib/domain/deals-shared";
import { syncDealsStepAction } from "./actions";

const PHASE: Record<SyncProgress["phase"], string> = {
  idle: "Sin sincronizar",
  meta: "Leyendo embudos, etapas y campos…",
  deals: "Descargando tratos…",
  enrich: "Leyendo notas, historial y contacto de cada trato…",
  done: "Sincronizado",
};

const WHEN = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

/** Sincroniza en tandas (cada una, una llamada al servidor) hasta terminar; retoma donde quedó. */
export function DealsSyncButton({ initial, canSync }: { initial: SyncProgress; canSync: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(initial.error);

  async function run(mode: "full" | "incremental" | "continue") {
    setRunning(true);
    setError(null);
    try {
      let step = await syncDealsStepAction(mode);
      setP(step);
      for (let i = 0; i < 5000 && !step.error && step.phase !== "done"; i++) {
        step = await syncDealsStepAction("continue");
        setP(step);
      }
      if (step.error) setError(step.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Se interrumpió la sincronización. Vuelve a intentarlo: retoma donde quedó.");
    } finally {
      setRunning(false);
    }
  }

  const unfinished = !running && (p.phase === "meta" || p.phase === "deals" || p.phase === "enrich");
  const pct = p.totalDeals ? Math.round((1 - p.pendingEnrich / p.totalDeals) * 100) : 0;

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      {canSync && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="primary" isPending={running} onPress={() => run(unfinished ? "continue" : "incremental")}>
            <ArrowsRotateRight aria-hidden />
            {running ? "Sincronizando…" : unfinished ? "Continuar sincronización" : "Sincronizar"}
          </Button>
          <Button variant="outline" isDisabled={running} onPress={() => run("full")}>
            Completa
          </Button>
        </div>
      )}
      <p className="text-xs text-muted" role="status" aria-live="polite">
        {running || unfinished ? (
          <>
            {PHASE[p.phase]}
            {p.phase === "enrich" && ` ${pct}% (${p.totalDeals - p.pendingEnrich} de ${p.totalDeals})`}
          </>
        ) : p.lastSyncedAt ? (
          <>Última sincronización: {WHEN.format(new Date(p.lastSyncedAt))} · {p.totalDeals} tratos · pulsa Sincronizar para traer lo nuevo</>
        ) : (
          "Aún no se ha sincronizado"
        )}
      </p>
      {error && <p className="max-w-md text-xs text-red">{error}</p>}
    </div>
  );
}
