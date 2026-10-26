"use client";

import { CloudArrowUpIn } from "@gravity-ui/icons";
import { Button, Card, Chip, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import { careerLabel, money, num } from "@/lib/domain/careers-shared";
import type { GoalImportPart, GoalImportPreview } from "@/lib/domain/goals-shared";
import type { Career } from "@/lib/domain/types";
import { goalsImportApplyAction, goalsImportPreviewAction } from "./actions";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthShort = (m: string) => `${MONTH_LABELS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const STALE = "No se pudo completar. Si se publicó una versión nueva, recarga la página.";

/** "145 + 24 = 169 (ciclo 168,3)" */
function PartCell({ p, fmt }: { p: GoalImportPart | null; fmt: (n: number) => string }) {
  if (!p) return <span className="text-muted">—</span>;
  const months = Object.values(p.months).reduce((a, b) => a + b, 0);
  const off = Math.abs(p.total - p.cycle) > 0.011;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span title="Histórico (lo que ya se tenía)">{fmt(p.hist)}</span>
      <span className="text-muted"> + </span>
      <span title="Distribución mensual">{fmt(months)}</span>
      <span className="text-muted"> = </span>
      <b>{fmt(p.total)}</b>
      <span className={`block text-[11px] ${off ? "text-yellow" : "text-muted"}`}>
        ciclo {fmt(p.cycle)}
        {off ? ` · dif. ${fmt(Math.round((p.total - p.cycle) * 100) / 100)}` : " · cuadra"}
      </span>
    </span>
  );
}

/** Importación manual de metas y presupuesto desde Google Sheets, con vista previa. */
export function GoalsImport({ careers }: { careers: Career[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<GoalImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [leads, setLeads] = useState(true);
  const [budget, setBudget] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [reading, startRead] = useTransition();
  const [applying, startApply] = useTransition();

  const read = (map = mapping) =>
    startRead(async () => {
      setMessage(null);
      const r = await goalsImportPreviewAction(url, map).catch(() => ({ ok: false, message: STALE, preview: null }));
      if (!r.ok || !r.preview) {
        setMessage({ ok: false, message: r.message });
        return;
      }
      setPreview(r.preview);
      setLeads(r.preview.hasLeads);
      setBudget(r.preview.hasBudget);
    });

  const assign = (code: string, careerId: number | null) => {
    const next = { ...mapping };
    if (careerId) next[code.toUpperCase()] = careerId;
    else delete next[code.toUpperCase()];
    setMapping(next);
    read(next);
  };

  if (!open) {
    return (
      <Button variant="outline" className="self-start" onPress={() => setOpen(true)}>
        <CloudArrowUpIn aria-hidden /> Importar desde Google Sheets
      </Button>
    );
  }

  const rows = preview ? [...preview.rows].sort((a, b) => Number(Boolean(a.careerId)) - Number(Boolean(b.careerId)) || a.code.localeCompare(b.code)) : [];
  const matched = rows.filter((r) => r.careerId).length;
  const sorted = [...careers].sort((a, b) => careerLabel(a).localeCompare(careerLabel(b), "es"));

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Importar metas y presupuesto desde Google Sheets</h2>
          <p className="text-sm text-muted">
            Solo se importa cuando tú lo confirmas. Se leen las pestañas con “Meta del ciclo” y “Presupuesto del ciclo”:
            los meses (OCT, NOV, DIC, ENE 27…) se cargan como metas mensuales y lo que ya se tenía antes del primer mes
            (ciclo − lo que faltaba al inicio del mes) queda como <b>histórico</b> de la carrera.
          </p>
        </div>
        <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
          Cerrar
        </Button>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) read();
        }}
      >
        <Input
          aria-label="Enlace de Google Sheets"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-[280px] flex-1"
        />
        <Button type="submit" variant="secondary" isPending={reading} isDisabled={!url.trim()}>
          Leer hoja
        </Button>
      </form>
      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`} role="status">
          {message.message}
        </p>
      )}

      {preview && (
        <div className={`flex flex-col gap-3 ${reading ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              Meses: <b>{preview.months.map(monthShort).join(", ")}</b>
              {preview.dataDate && <span className="text-muted"> · datos al {preview.dataDate}</span>}
            </span>
            <Chip size="sm" variant="soft" color="success">
              {matched} con carrera
            </Chip>
            {rows.length - matched > 0 && (
              <Chip size="sm" variant="soft" color="warning">
                {rows.length - matched} sin asignar
              </Chip>
            )}
            <span className="ml-auto flex gap-3">
              <AppCheckbox checked={leads} disabled={!preview.hasLeads} onChange={(e) => setLeads(e.target.checked)}>
                <span className="text-sm">Metas de leads</span>
              </AppCheckbox>
              <AppCheckbox checked={budget} disabled={!preview.hasBudget} onChange={(e) => setBudget(e.target.checked)}>
                <span className="text-sm">Presupuesto</span>
              </AppCheckbox>
            </span>
          </div>

          {preview.earlierGoals.length > 0 && (
            <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
              {preview.earlierGoals.length} carrera(s) ya tienen metas en meses anteriores a {monthShort(preview.fromMonth)} (p. ej.{" "}
              {preview.earlierGoals.slice(0, 3).map((g) => g.label).join("; ")}). El “Total ciclo” solo suma el histórico y los meses
              desde {monthShort(preview.fromMonth)}, así que esas metas anteriores no se cuentan dos veces; se mantienen para las
              semanas pasadas en Indicadores.
            </p>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left">Código</th>
                  <th className="px-2 text-left">Carrera en la app</th>
                  <th className="px-2 text-right">Leads: histórico + meses</th>
                  <th className="px-2 text-right">Presupuesto: histórico + meses</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className={`border-b border-border last:border-0 ${r.careerId ? "" : "bg-yellow-bg/40"}`}>
                    <td className="px-2 py-1.5 align-top">
                      <span className="font-mono text-xs font-semibold">{r.code}</span>
                      <span className="block max-w-56 truncate text-[11px] text-muted" title={r.name}>
                        {r.name}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <AppSelect
                        aria-label={`Carrera para ${r.code}`}
                        className="w-72"
                        value={r.careerId ? String(r.careerId) : "-"}
                        onChange={(e) => assign(r.code, e.target.value === "-" ? null : Number(e.target.value))}
                      >
                        <option value="-">— Sin asignar (no importar) —</option>
                        {sorted.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {careerLabel(c)}
                          </option>
                        ))}
                      </AppSelect>
                      {r.match && r.match !== "code" && (
                        <span className="text-[11px] text-muted">
                          {r.match === "alias" ? "asignada antes" : r.match === "name" ? "por nombre" : "asignada a mano"}
                        </span>
                      )}
                      {r.warnings.map((w) => (
                        <span key={w} className="block text-[11px] text-yellow">
                          {w}
                        </span>
                      ))}
                    </td>
                    <td className="px-2 py-1.5 text-right align-top">{leads ? <PartCell p={r.leads} fmt={num} /> : <span className="text-muted">—</span>}</td>
                    <td className="px-2 py-1.5 text-right align-top">{budget ? <PartCell p={r.budget} fmt={money} /> : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              isPending={applying}
              isDisabled={matched === 0 || (!leads && !budget)}
              onPress={() => {
                if (!confirm(`Se reemplazan las metas de ${preview.months.map(monthShort).join(", ")} y el histórico de ${matched} carrera(s). ¿Continuar?`)) return;
                startApply(async () => {
                  const r = await goalsImportApplyAction({ url, mapping, leads, budget }).catch(() => ({ ok: false, message: STALE }));
                  setMessage(r);
                  if (r.ok) {
                    setPreview(null);
                    router.refresh();
                  }
                });
              }}
            >
              Importar {matched} carrera(s)
            </Button>
            <span className="text-xs text-muted">Las carreras sin asignar no se cargan. Las asignaciones se recuerdan para la próxima vez.</span>
          </div>
        </div>
      )}
    </Card>
  );
}
