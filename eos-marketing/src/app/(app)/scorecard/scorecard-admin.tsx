"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Card, Input } from "@heroui/react";
import { AppSelect } from "@/components/ui/select";
import { useState, useTransition } from "react";
import type { ScorecardMetric, ScorecardOwner } from "@/lib/domain/types";
import type { MetricSharing } from "@/lib/domain/scorecard";
import { MetricSharingControl } from "./metric-sharing";
import { ArrowDown, ArrowUp, Plus, Xmark } from "@gravity-ui/icons";
import { describeFormula, formulaError, parseFormula, usedVars, type MetricFormula } from "@/lib/domain/scorecard-formula";
import {
  createMetricAction,
  archiveMetricAction,
  createOwnerAction,
  deleteOwnerAction,
  moveMetricAction,
  setMetricFormulaAction,
} from "./actions";

export function ScorecardAdmin({
  metrics,
  owners,
  sharing,
  shareTeams,
}: {
  metrics: ScorecardMetric[];
  owners: ScorecardOwner[];
  sharing: Record<number, MetricSharing>;
  shareTeams: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="block gap-0 p-4">
      <Button size="sm" variant="ghost"
        className="text-sm text-primary"
        onPress={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar" : "Gestionar indicadores y dueños"}
      </Button>

      {open && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Indicadores</h4>
            {message && (
              <p className={`mb-2 rounded-lg px-3 py-2 text-xs ${message.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`} role="status">
                {message.message}
              </p>
            )}
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {metrics.map((m, i) => (
                <li key={m.id} className="flex flex-col gap-1 border-b border-border pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-start gap-1">
                      <span className="flex flex-col">
                        <Button isIconOnly size="sm" variant="ghost" className="h-5 min-w-5" aria-label={`Subir ${m.name}`} isDisabled={i === 0 || pending}
                          onPress={() => start(() => moveMetricAction(m.id, "up"))}>
                          <ArrowUp width={12} height={12} aria-hidden />
                        </Button>
                        <Button isIconOnly size="sm" variant="ghost" className="h-5 min-w-5" aria-label={`Bajar ${m.name}`} isDisabled={i === metrics.length - 1 || pending}
                          onPress={() => start(() => moveMetricAction(m.id, "down"))}>
                          <ArrowDown width={12} height={12} aria-hidden />
                        </Button>
                      </span>
                      <span className="pt-1.5">{m.name}</span>
                    </span>
                    <div className="flex items-start gap-1">
                      <MetricSharingControl
                        metricId={m.id}
                        sharing={sharing[m.id] ?? { shared_all: false, team_ids: [] }}
                        teams={shareTeams}
                      />
                      <Button size="sm" variant="ghost"
                        className="text-xs text-red"
                        isDisabled={pending}
                        onPress={() => {
                          if (!confirm(`¿Archivar “${m.name}”? Deja de verse en el Scorecard; sus datos se guardan y se puede restaurar en Ajustes › Indicadores archivados.`)) return;
                          start(async () => setMessage(await archiveMetricAction(m.id)));
                        }}
                      >
                        Archivar
                      </Button>
                    </div>
                  </div>
                  <FormulaControl metric={m} metrics={metrics} />
                </li>
              ))}
            </ul>
            <form action={createMetricAction} className="flex flex-col gap-2">
              <Input fullWidth name="name" required placeholder="Nombre del indicador" />
              <Input fullWidth name="predicts" placeholder="¿Qué predice?" />
              <div className="flex gap-2">
                <AppSelect fullWidth name="direction" defaultValue="higher_better">
                  <option value="higher_better">Mayor mejor</option>
                  <option value="lower_better">Menor mejor</option>
                </AppSelect>
                <AppSelect fullWidth name="format" defaultValue="count">
                  <option value="count">Conteo</option>
                  <option value="percentage">%</option>
                  <option value="currency">Moneda</option>
                </AppSelect>
                <AppSelect fullWidth name="aggregation" defaultValue="sum">
                  <option value="sum">Suma (rollup)</option>
                  <option value="average">Promedio (rollup)</option>
                </AppSelect>
              </div>
              <p className="text-xs text-muted">
                Para un indicador calculado (sumas, restas, multiplicaciones o divisiones de otros indicadores), agrégalo y
                luego usa “Calcular” en la lista.
              </p>
              <Button variant="primary" type="submit" className="self-start">
                + Agregar indicador
              </Button>
            </form>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Dueños del scorecard</h4>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {owners.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    {o.name}
                    {o.is_rollup && " (rollup)"}
                  </span>
                  <Button size="sm" variant="ghost"
                    className="text-xs text-red"
                    onPress={() => deleteOwnerAction(o.id)}
                  >
                    Eliminar
                  </Button>
                </li>
              ))}
            </ul>
            <form action={createOwnerAction} className="flex flex-col gap-2">
              <Input fullWidth name="name" required placeholder="Nombre del dueño" />
              <AppCheckbox name="isRollup" className="flex items-center gap-2 text-sm">
                Es un rollup calculado (ej. &quot;General&quot;)
              </AppCheckbox>
              <Button variant="primary" type="submit" className="self-start">
                + Agregar dueño
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Cambia un indicador entre manual y calculado: variables (A, B, C…) que apuntan a otros indicadores y
 * una fórmula con + − × ÷ y paréntesis, p. ej. "A + B - C" o "(A + B) / C * 100".
 */
function FormulaControl({ metric, metrics }: { metric: ScorecardMetric; metrics: ScorecardMetric[] }) {
  const saved = parseFormula(metric.calc_formula);
  const [editing, setEditing] = useState(false);
  const [vars, setVars] = useState<{ letter: string; id: string }[]>(
    saved ? Object.entries(saved.vars).sort().map(([letter, id]) => ({ letter, id: String(id) })) : [{ letter: "A", id: "-" }, { letter: "B", id: "-" }]
  );
  const [expr, setExpr] = useState(saved?.expr ?? "A + B");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const options = metrics.filter((m) => m.id !== metric.id);
  const nameOf = (id: number) => metrics.find((m) => m.id === id)?.name ?? "?";

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-7 text-xs">
        {saved ? (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">= {describeFormula(saved, nameOf)}</span>
        ) : (
          <span className="text-muted">Se captura a mano</span>
        )}
        <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onPress={() => setEditing(true)}>
          {saved ? "Editar fórmula" : "Calcular"}
        </Button>
      </div>
    );
  }

  const formula: MetricFormula = {
    expr,
    vars: Object.fromEntries(vars.filter((v) => v.id !== "-").map((v) => [v.letter, Number(v.id)])),
  };
  const error = formulaError(formula);
  const unused = vars.filter((v) => v.id !== "-" && !usedVars(formula).includes(v.letter)).map((v) => v.letter);
  const nextLetter = LETTERS.find((l) => !vars.some((v) => v.letter === l));
  const insert = (text: string) => setExpr((e) => `${e.trimEnd()} ${text}`.trimStart());

  return (
    <div className="ml-7 flex flex-col gap-2 rounded-lg border border-border p-2 text-xs">
      <p className="text-muted">Elige los indicadores como variables y escribe la fórmula. Para un porcentaje, multiplica por 100.</p>
      <ul className="flex flex-col gap-1">
        {vars.map((v, i) => (
          <li key={v.letter} className="flex items-center gap-1">
            <button type="button" className="w-6 rounded bg-primary/10 py-1 text-center font-mono font-bold text-primary hover:bg-primary/20" title="Insertar en la fórmula" onClick={() => insert(v.letter)}>
              {v.letter}
            </button>
            <span className="text-muted">=</span>
            <AppSelect aria-label={`Indicador de ${v.letter}`} value={v.id} className="w-60" onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}>
              <option value="-">Elegir indicador…</option>
              {options.map((x) => (
                <option key={x.id} value={String(x.id)}>
                  {x.name}
                </option>
              ))}
            </AppSelect>
            {vars.length > 1 && (
              <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar ${v.letter}`} onPress={() => setVars(vars.filter((_, j) => j !== i))}>
                <Xmark aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {nextLetter && (
        <Button size="sm" variant="ghost" className="self-start text-xs text-primary" onPress={() => setVars([...vars, { letter: nextLetter, id: "-" }])}>
          <Plus aria-hidden /> Variable {nextLetter}
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-semibold">Fórmula =</span>
        <Input aria-label="Fórmula" value={expr} onChange={(e) => setExpr(e.target.value)} className="w-56 font-mono" placeholder="A + B - C" />
        {["+", "−", "×", "÷", "(", ")"].map((op) => (
          <Button key={op} size="sm" variant="outline" className="h-7 min-w-7 px-1 font-mono" onPress={() => insert(op === "−" ? "-" : op === "×" ? "*" : op === "÷" ? "/" : op)}>
            {op}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="text-yellow">{error}</p>
      ) : (
        <p className="text-muted">
          = {describeFormula(formula, nameOf)}
          {unused.length > 0 && <span className="text-yellow"> · {unused.join(", ")} no se usa(n) en la fórmula</span>}
        </p>
      )}
      {result && !result.ok && <p className="text-red">{result.message}</p>}
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="primary"
          isPending={pending}
          isDisabled={Boolean(error)}
          onPress={() =>
            start(async () => {
              const r = await setMetricFormulaAction(metric.id, formula);
              setResult(r);
              if (r.ok) setEditing(false);
            })
          }
        >
          Guardar fórmula
        </Button>
        {saved && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              start(async () => {
                if (!confirm("¿Volver a capturar este indicador a mano? Los valores calculados dejarán de mostrarse.")) return;
                const r = await setMetricFormulaAction(metric.id, null);
                setResult(r);
                if (r.ok) setEditing(false);
              })
            }
          >
            Quitar cálculo
          </Button>
        )}
        <Button size="sm" variant="ghost" onPress={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
