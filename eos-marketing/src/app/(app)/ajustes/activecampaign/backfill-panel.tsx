"use client";

import { ArrowRight } from "@gravity-ui/icons";
import { Button, Card, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { AppCheckbox } from "@/components/ui/checkbox";
import type { BackfillRow } from "@/lib/domain/ac-sync";
import { runLeadsScan, ScanProgressBar, type ScanProgress } from "@/components/ac-sync-button";
import { backfillApplyAction, backfillPreviewAction, type LinkResult } from "./actions";
import { StatusIcon } from "@/components/status-icon";

/**
 * Solo administradores: calcula con el historial de ActiveCampaign los leads calificados de una
 * semana anterior, muestra la comparativa contra lo guardado y, tras confirmar, sobrescribe las
 * carreras elegidas.
 */
export function BackfillPanel({ weeks }: { weeks: { value: string; label: string }[] }) {
  const router = useRouter();
  const [week, setWeek] = useState(weeks[0]?.value ?? "");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [rows, setRows] = useState<BackfillRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [result, setResult] = useState<LinkResult | null>(null);
  const [applying, startApply] = useTransition();
  const weekLabel = weeks.find((w) => w.value === week)?.label ?? week;

  async function preview() {
    setLoading(true);
    setError("");
    setResult(null);
    setProgress(null);
    try {
      // Primero se pone al día el historial (con barra de avance); después se calcula la semana.
      const scan = await runLeadsScan(false, setProgress);
      if (!scan.ok) {
        setError(scan.message);
        return;
      }
      const r = await backfillPreviewAction(week);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setRows(r.rows);
      // Por defecto, solo las carreras que cambian.
      setSelected(new Set(r.rows.filter((x) => x.incoming !== x.current).map((x) => x.career_id)));
    } catch {
      setError("Se interrumpió la consulta. Vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const chosen = (rows ?? []).filter((r) => selected.has(r.career_id));
  const overwrites = chosen.filter((r) => r.current !== null).length;
  const manual = chosen.filter((r) => r.current !== null && r.current_source !== "activecampaign").length;
  const sumCurrent = chosen.reduce((s, r) => s + (r.current ?? 0), 0);
  const sumIncoming = chosen.reduce((s, r) => s + r.incoming, 0);

  function apply() {
    startApply(async () => {
      const r = await backfillApplyAction(
        week,
        chosen.map((x) => ({ careerId: x.career_id, leads: x.incoming }))
      );
      setResult(r);
      if (r.ok) {
        setRows(null);
        router.refresh();
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">Actualizar una semana anterior</h2>
        <p className="text-sm text-muted">
          Solo administradores. Calcula con el historial de ActiveCampaign los leads calificados (tratos que entraron al
          embudo de la carrera) de la semana que elijas. Antes de guardar verás la comparativa.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AppSelect className="w-auto" aria-label="Semana" value={week} onChange={(e) => setWeek(e.target.value)}>
          {weeks.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </AppSelect>
        <Button variant="outline" onPress={preview} isDisabled={loading || !week}>
          {loading ? "Revisando historial…" : "Ver comparativa"}
        </Button>
        {error && <span className="text-sm text-red">{error}</span>}
        {result && <span className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</span>}
      </div>
      {loading && <ScanProgressBar progress={progress} />}

      {rows && (
        <Modal.Backdrop isOpen onOpenChange={(open) => !open && !applying && setRows(null)}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-3xl" aria-label="Confirmar actualización de semana anterior">
              <Modal.CloseTrigger />
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold">Leads de la semana {weekLabel}</h3>
                <div className="rounded-lg border border-yellow/30 bg-yellow-bg p-3 text-sm">
                  <p className="font-semibold"><StatusIcon status="warning" />Esto sobrescribe datos de una semana anterior</p>
                  <ul className="mt-1 list-disc pl-5">
                    <li>
                      El dato nuevo son los tratos que <b>entraron al embudo</b> de la carrera esa semana, según su historial
                      en ActiveCampaign. Los tratos eliminados ya no aparecen.
                    </li>
                    <li>
                      Las carreras marcadas reemplazan su valor actual
                      {manual > 0 && (
                        <>
                          , incluidas <b>{manual} capturada(s) a mano</b>
                        </>
                      )}
                      . No se puede deshacer.
                    </li>
                  </ul>
                </div>
                <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                        <th className="w-8 px-2 py-2" />
                        <th className="px-2">Carrera</th>
                        <th className="px-2 text-right">Guardado</th>
                        <th className="px-2 text-right">ActiveCampaign</th>
                        <th className="px-2 text-right">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const diff = r.incoming - (r.current ?? 0);
                        return (
                          <tr key={r.career_id} className="border-b border-border last:border-0">
                            <td className="px-2 py-1.5">
                              <AppCheckbox
                                aria-label={`Actualizar ${r.name}`}
                                checked={selected.has(r.career_id)}
                                onChange={(e) => toggle(r.career_id, e.target.checked)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              {r.code && <span className="mr-1 font-mono text-xs font-semibold text-primary">{r.code}</span>}
                              {r.name}
                            </td>
                            <td className="px-2 text-right tabular-nums">
                              {r.current === null ? (
                                <span className="text-muted">sin dato</span>
                              ) : (
                                <>
                                  {r.current}
                                  <span className="ml-1 text-[11px] text-muted">{r.current_source === "activecampaign" ? "AC" : "manual"}</span>
                                </>
                              )}
                            </td>
                            <td className="px-2 text-right font-semibold tabular-nums">
                              {r.incoming}
                            </td>
                            <td
                              className={`px-2 text-right tabular-nums ${
                                diff === 0 ? "text-muted" : diff > 0 ? "text-green" : "text-red"
                              }`}
                            >
                              {diff === 0 ? "igual" : `${diff > 0 ? "+" : ""}${diff}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm">
                  <b>{chosen.length}</b> carrera(s) marcada(s) · {overwrites} con dato que se sobrescribe · total{" "}
                  <span className="tabular-nums">{sumCurrent}</span> <ArrowRight width={12} height={12} className="inline-block align-[-1px]" aria-hidden /> <b className="tabular-nums">{sumIncoming}</b> leads
                </p>
                {result && !result.ok && <p className="text-sm text-red">{result.message}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" onPress={apply} isDisabled={applying || chosen.length === 0}>
                    {applying ? "Guardando…" : `Sobrescribir ${chosen.length} carrera(s)`}
                  </Button>
                  <Button variant="outline" onPress={() => setRows(null)} isDisabled={applying}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </Card>
  );
}
