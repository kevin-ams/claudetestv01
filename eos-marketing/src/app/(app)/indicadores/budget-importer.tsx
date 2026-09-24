"use client";

import { buttonVariants } from "@heroui/styles";
import { Button, Card, CloseButton, Input } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Career } from "@/lib/domain/types";
import {
  careerLabel,
  guessColumns,
  matchCareer,
  money,
  parseAmount,
  parseCsv,
  parseDate,
  type ColumnKind,
} from "@/lib/domain/careers-shared";
import { shiftWeek } from "@/lib/utils/dates";
import { importBudgetAction, type ActionResult } from "./actions";

type Parsed = { fileName: string; header: string[]; body: string[][] };

const IGNORE = "ignore";

export function BudgetImporter({
  careers,
  aliases,
  week,
  onClose,
}: {
  careers: Pick<Career, "id" | "code" | "name">[];
  aliases: Record<string, number>;
  week: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [cols, setCols] = useState<Record<ColumnKind, number>>({ campaign: -1, spend: -1, date: -1, code: -1 });
  const [targetWeek, setTargetWeek] = useState(week);
  const [mode, setMode] = useState<"replace" | "add">("replace");
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedCareers = useMemo(
    () => [...careers].sort((a, b) => careerLabel(a).localeCompare(careerLabel(b), "es")),
    [careers]
  );

  async function onFile(file: File) {
    setResult(null);
    setOverrides({});
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setResult({ ok: false, message: "El archivo no tiene filas de datos." });
      setParsed(null);
      return;
    }
    const [header, ...body] = rows;
    const guessed = guessColumns(header);
    setParsed({ fileName: file.name, header, body });
    setCols(guessed);

    // Si el reporte trae fecha de inicio, propone esa semana.
    if (guessed.date !== -1) {
      const first = body.map((r) => parseDate(r[guessed.date] ?? "")).find(Boolean);
      if (first) setTargetWeek(shiftWeek(first, 0));
    }
  }

  const lines = useMemo(() => {
    if (!parsed) return [];
    const matchCol = cols.code !== -1 ? cols.code : cols.campaign;
    return parsed.body.map((r, i) => {
      const text = (matchCol !== -1 ? r[matchCol] : "")?.trim() ?? "";
      const label = (cols.campaign !== -1 ? r[cols.campaign] : text)?.trim() ?? "";
      const amount = cols.spend !== -1 ? parseAmount(r[cols.spend] ?? "") : null;
      const auto = matchCareer(text, careers, aliases);
      const override = overrides[i];
      const careerId =
        override === undefined ? auto : override === IGNORE ? null : Number(override);
      return { i, text, label, amount, auto, careerId, manual: override !== undefined };
    });
  }, [parsed, cols, careers, aliases, overrides]);

  // Filas sin nombre (totales del reporte) o sin importe no se importan.
  const usable = lines.filter((l) => l.label && l.amount !== null);
  const assigned = usable.filter((l) => l.careerId !== null);
  const total = assigned.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const careersTouched = new Set(assigned.map((l) => l.careerId)).size;

  function submit() {
    startTransition(async () => {
      const res = await importBudgetAction({
        week: targetWeek,
        mode,
        fileName: parsed?.fileName ?? "",
        rows: assigned.map((l) => ({ careerId: l.careerId!, amount: l.amount! })),
        aliases: assigned
          .filter((l) => l.manual && l.careerId !== l.auto)
          .map((l) => ({ text: l.text, careerId: l.careerId! })),
      });
      setResult(res);
      if (res.ok) {
        setParsed(null);
        router.refresh();
      }
    });
  }

  const colSelect = (kind: ColumnKind, label: string, optional = false) => (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <AppSelect fullWidth
        value={cols[kind]}
        onChange={(e) => setCols({ ...cols, [kind]: Number(e.target.value) })}
      >
        <option value={-1}>{optional ? "— No usar —" : "— Elegir columna —"}</option>
        {parsed?.header.map((h, i) => (
          <option key={i} value={i}>
            {h || `Columna ${i + 1}`}
          </option>
        ))}
      </AppSelect>
    </label>
  );

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">Importar consumo semanal (CSV de Meta)</h2>
          <p className="text-sm text-muted">
            Exporta el reporte de Meta Ads de la semana con las columnas{" "}
            <b>Nombre de la campaña</b> e <b>Importe gastado</b>. La carrera se reconoce por su
            código dentro del nombre de la campaña (p. ej. &quot;LEAD_FISICC_IME_Sep&quot;); las
            que no se reconozcan las puedes asignar a mano y el sistema las recordará.
          </p>
        </div>
        <CloseButton onPress={onClose} aria-label="Cerrar importador" />
      </div>

      <label className={`${buttonVariants({ variant: "outline" })} cursor-pointer self-start`}>
        {parsed ? `Archivo: ${parsed.fileName} · elegir otro` : "Elegir archivo CSV"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Archivo CSV de Meta"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />
      </label>

      {parsed && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {colSelect("campaign", "Campaña")}
            {colSelect("spend", "Importe gastado")}
            {colSelect("code", "Código de carrera", true)}
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Semana (lunes)
              <Input fullWidth
                type="date"
                value={targetWeek}
                onChange={(e) => e.target.value && setTargetWeek(shiftWeek(e.target.value, 0))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Si ya hay consumo esa semana
              <AppSelect fullWidth value={mode} onChange={(e) => setMode(e.target.value as "replace" | "add")}>
                <option value="replace">Reemplazarlo</option>
                <option value="add">Sumarlo</option>
              </AppSelect>
            </label>
          </div>

          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Campaña</th>
                  <th className="px-2 text-right">Importe</th>
                  <th className="px-2">Carrera</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const skip = !l.label || l.amount === null;
                  return (
                    <tr
                      key={l.i}
                      className={`border-b border-border last:border-0 ${
                        skip ? "text-muted opacity-60" : l.careerId === null ? "bg-yellow-bg" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5">{l.label || <i>(fila sin campaña: se omite)</i>}</td>
                      <td className="px-2 text-right tabular-nums">{money(l.amount)}</td>
                      <td className="px-2 py-1">
                        {skip ? (
                          <span className="text-xs">Se omite</span>
                        ) : (
                          <AppSelect fullWidth
                            className="py-1 text-xs"
                            value={l.careerId === null ? IGNORE : String(l.careerId)}
                            onChange={(e) => setOverrides({ ...overrides, [l.i]: e.target.value })}
                          >
                            <option value={IGNORE}>— Sin asignar (no importar) —</option>
                            {sortedCareers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {careerLabel(c)}
                              </option>
                            ))}
                          </AppSelect>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              <b>{assigned.length}</b> de {usable.length} filas asignadas · {careersTouched} carreras ·
              total <b>{money(total)}</b>
            </p>
            <Button variant="primary"
              className="ml-auto"
              isDisabled={pending || assigned.length === 0 || cols.spend === -1}
              onPress={submit}
            >
              {pending ? "Importando..." : `Importar a la semana del ${targetWeek}`}
            </Button>
          </div>
        </>
      )}

      {result && <p className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}
    </Card>
  );
}
