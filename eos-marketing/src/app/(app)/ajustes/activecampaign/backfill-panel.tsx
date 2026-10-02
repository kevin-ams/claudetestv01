"use client";

import { Button, Card, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { AppCheckbox } from "@/components/ui/checkbox";
import type { BackfillRow } from "@/lib/domain/ac-sync";
import { backfillApplyAction, backfillPreviewAction, type LinkResult } from "./actions";

/**
 * Solo administradores: trae de ActiveCampaign los leads de una semana anterior, muestra la
 * comparativa contra lo guardado y, tras confirmar, sobrescribe las carreras elegidas.
 */
export function BackfillPanel({ weeks }: { weeks: { value: string; label: string }[] }) {
  const router = useRouter();
  const [week, setWeek] = useState(weeks[0]?.value ?? "");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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
    const all: BackfillRow[] = [];
    let offset = 0;
    try {
      for (let i = 0; i < 200; i++) {
        const step = await backfillPreviewAction(week, offset);
        if (!step.ok) {
          setError(step.message);
          return;
        }
        all.push(...step.rows);
        setProgress({ done: step.next, total: step.total });
        if (step.done) break;
        offset = step.next;
      }
      all.sort((a, b) => a.name.localeCompare(b.name, "es"));
      setRows(all);
      // Por defecto, solo las carreras que cambian.
      setSelected(new Set(all.filter((r) => r.incoming !== null && r.incoming !== r.current).map((r) => r.career_id)));
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

  const chosen = (rows ?? []).filter((r) => selected.has(r.career_id) && r.incoming !== null);
  const overwrites = chosen.filter((r) => r.current !== null).length;
  const manual = chosen.filter((r) => r.current !== null && r.current_source !== "activecampaign").length;
  const sumCurrent = chosen.reduce((s, r) => s + (r.current ?? 0), 0);
  const sumIncoming = chosen.reduce((s, r) => s + (r.incoming ?? 0), 0);

  function apply() {
    startApply(async () => {
      const r = await backfillApplyAction(
        week,
        chosen.map((x) => ({ careerId: x.career_id, leads: x.incoming! }))
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
          Solo administradores. Trae de ActiveCampaign los tratos que hay <b>hoy</b> en la etapa de cada carrera y los
          guarda en la semana que elijas. Antes de guardar verás la comparativa.
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
          {loading
            ? progress
              ? `Consultando ${progress.done}/${progress.total} etapas…`
              : "Consultando ActiveCampaign…"
            : "Ver comparativa"}
        </Button>
        {error && <span className="text-sm text-red">{error}</span>}
        {result && <span className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</span>}
      </div>

      {rows && (
        <Modal.Backdrop isOpen onOpenChange={(open) => !open && !applying && setRows(null)}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-3xl" aria-label="Confirmar actualización de semana anterior">
              <Modal.CloseTrigger />
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold">Leads de la semana {weekLabel}</h3>
                <div className="rounded-lg border border-yellow/30 bg-yellow-bg p-3 text-sm">
                  <p className="font-semibold">⚠ Esto sobrescribe datos de una semana anterior</p>
                  <ul className="mt-1 list-disc pl-5">
                    <li>
                      ActiveCampaign solo da los tratos que hay <b>hoy</b> en la etapa, no los que había esa semana.
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
                        <th className="px-2 text-right">ActiveCampaign hoy</th>
                        <th className="px-2 text-right">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const diff = r.incoming !== null ? r.incoming - (r.current ?? 0) : null;
                        return (
                          <tr key={r.career_id} className="border-b border-border last:border-0">
                            <td className="px-2 py-1.5">
                              <AppCheckbox
                                aria-label={`Actualizar ${r.name}`}
                                checked={selected.has(r.career_id)}
                                disabled={r.incoming === null}
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
                              {r.incoming === null ? (
                                <span className="text-xs font-normal text-red" title={r.error}>
                                  Error
                                </span>
                              ) : (
                                r.incoming
                              )}
                            </td>
                            <td
                              className={`px-2 text-right tabular-nums ${
                                diff === null || diff === 0 ? "text-muted" : diff > 0 ? "text-green" : "text-red"
                              }`}
                            >
                              {diff === null ? "—" : diff === 0 ? "igual" : `${diff > 0 ? "+" : ""}${diff}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm">
                  <b>{chosen.length}</b> carrera(s) marcada(s) · {overwrites} con dato que se sobrescribe · total{" "}
                  <span className="tabular-nums">{sumCurrent}</span> → <b className="tabular-nums">{sumIncoming}</b> leads
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
