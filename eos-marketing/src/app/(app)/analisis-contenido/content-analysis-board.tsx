"use client";

import { Button, Card, Input } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import {
  HYGIENE_FLOOR,
  PERIOD_LABEL,
  type Breakdown,
  type Period,
  type PeriodKind,
  type PersonRow,
  type Totals,
  type TrendPoint,
} from "@/lib/domain/content-analytics";
import { CAPA_TARGET } from "@/lib/domain/editorial-shared";

type Member = { id: number; name: string };

const SERIES = [
  { key: "Hero", color: "var(--capa-hero)" },
  { key: "Hub", color: "var(--capa-hub)" },
  { key: "Hygiene", color: "var(--capa-hygiene)" },
  { key: "other", label: "Sin capa", color: "var(--capa-other)" },
] as const;

export function ContentAnalysisBoard({
  period,
  prevRef,
  nextRef,
  today,
  current,
  previous,
  trend,
  people,
  pilares,
  facultades,
  frentes,
  estados,
  pilarHints,
  members,
  trendUnit,
}: {
  trendUnit: "semana" | "mes";
  period: Period;
  prevRef: string;
  nextRef: string;
  today: string;
  current: Totals;
  previous: Totals;
  trend: TrendPoint[];
  people: PersonRow[];
  pilares: Breakdown[];
  facultades: Breakdown[];
  frentes: Breakdown[];
  estados: Breakdown[];
  pilarHints: Record<string, string>;
  members: Member[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (params: Record<string, string>) => router.push(`${pathname}?${new URLSearchParams(params)}`, { scroll: false });
  const [desde, setDesde] = useState(period.kind === "rango" ? period.from : "");
  const [hasta, setHasta] = useState(period.kind === "rango" ? period.to : "");
  const name = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin asignar";

  return (
    <div className="flex flex-col gap-6">
      {/* Periodo */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          aria-label="Periodo"
          options={(Object.keys(PERIOD_LABEL) as PeriodKind[]).map((k) => ({ id: k, label: PERIOD_LABEL[k] }))}
          value={period.kind}
          onChange={(k) => go(k === "rango" ? { periodo: k, desde: period.from, hasta: period.to } : { periodo: k, fecha: period.ref })}
        />
        {period.kind === "rango" ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go({ periodo: "rango", desde, hasta });
            }}
          >
            <Input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span className="text-muted">a</span>
            <Input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <Button type="submit" size="sm" variant="secondary">
              Ver
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" aria-label="Periodo anterior" onPress={() => go({ periodo: period.kind, fecha: prevRef })}>
              ‹
            </Button>
            <span className="min-w-44 text-center font-semibold capitalize">{period.label}</span>
            <Button size="sm" variant="outline" aria-label="Periodo siguiente" onPress={() => go({ periodo: period.kind, fecha: nextRef })}>
              ›
            </Button>
            <Button size="sm" variant="ghost" onPress={() => go({ periodo: period.kind, fecha: today })}>
              Hoy
            </Button>
          </div>
        )}
      </div>
      {period.kind === "rango" && <p className="-mt-4 text-sm text-muted">{period.label}</p>}

      {/* Indicadores principales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Piezas publicadas" value={current.published} prev={previous.published} detail={`de ${current.pieces} planificadas`} />
        <Stat
          label="Cumplimiento"
          value={current.completion}
          prev={previous.completion}
          unit="%"
          detail="publicadas ÷ planificadas (sin canceladas ni reprogramadas)"
        />
        <Stat
          label="% Hygiene"
          value={current.hygienePct}
          prev={previous.hygienePct}
          unit="%"
          detail={`piso SEO ≥ ${HYGIENE_FLOOR}% · de las publicadas`}
          tone={current.hygienePct === null ? undefined : current.hygienePct >= HYGIENE_FLOOR ? "good" : "bad"}
        />
        <Stat label="Coberturas realizadas" value={current.coverages} prev={previous.coverages} />
        <Stat label="Hero publicadas" value={current.byCapa.Hero} prev={previous.byCapa.Hero} detail={`Hub ${current.byCapa.Hub} · Hygiene ${current.byCapa.Hygiene}`} />
        <Stat
          label="Buffer esporádico usado"
          value={current.buffer}
          prev={previous.buffer}
          detail={`de ${current.bufferSlots} slots en el periodo`}
          lowerIsBetter
          tone={current.buffer > current.bufferSlots ? "bad" : undefined}
        />
        <Stat
          label="Reprogramadas / canceladas"
          value={current.rescheduled + current.cancelled}
          prev={previous.rescheduled + previous.cancelled}
          detail={`${current.rescheduled} reprogramadas · ${current.cancelled} canceladas`}
          lowerIsBetter
        />
        <Stat
          label="Horas fuera de horario"
          value={current.overtime}
          prev={previous.overtime}
          unit=" h"
          detail={`${current.replaced} h repuestas · saldo ${Math.round((current.overtime - current.replaced) * 100) / 100} h`}
          lowerIsBetter
        />
      </div>
      <p className="-mt-3 text-xs text-muted">Las flechas comparan con el periodo anterior de la misma duración.</p>

      {/* Tendencia */}
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Piezas publicadas por {trendUnit}</h2>
          <Legend />
        </div>
        <StackedBars data={trend} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold">Mezcla por capa (publicadas)</h2>
          <CapaMix totals={current} />
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold">Coberturas realizadas</h2>
          <SimpleBars data={trend.map((t) => ({ label: t.label, value: t.coverages }))} color="var(--capa-hero)" />
        </Card>
      </div>

      {/* Por persona */}
      <Card className="block gap-0 overflow-x-auto p-0">
        <div className="px-4 pt-4">
          <h2 className="font-semibold">Por persona</h2>
        </div>
        <table className="mt-2 w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Persona</th>
              <th className="px-2 text-right">Publicadas</th>
              <th className="px-2 text-right">Cumplimiento</th>
              <th className="px-2 text-right">Hero</th>
              <th className="px-2 text-right">Hub</th>
              <th className="px-2 text-right">Hygiene</th>
              <th className="px-2 text-right">Coberturas</th>
              <th className="px-2 pr-4 text-right">Fuera de horario</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-muted">
                  Sin datos en este periodo.
                </td>
              </tr>
            )}
            {people.map((r) => (
              <tr key={r.id ?? "none"} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{name(r.id)}</td>
                <td className="px-2 text-right tabular-nums">
                  {r.published} <span className="text-muted">/ {r.total}</span>
                </td>
                <td className="px-2 text-right tabular-nums">{r.total ? `${Math.round((r.published / r.total) * 100)}%` : "—"}</td>
                <td className="px-2 text-right tabular-nums">{r.Hero}</td>
                <td className="px-2 text-right tabular-nums">{r.Hub}</td>
                <td className="px-2 text-right tabular-nums">{r.Hygiene}</td>
                <td className="px-2 text-right tabular-nums">{r.coverages}</td>
                <td className="px-2 pr-4 text-right tabular-nums">
                  {r.overtime} h {r.replaced > 0 && <span className="text-muted">({r.replaced} repuestas)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Por pilar" rows={pilares} hints={pilarHints} />
        <BreakdownCard title="Por facultad / instituto" rows={facultades} limit={12} />
        <BreakdownCard title="Por frente" rows={frentes} limit={10} />
        <BreakdownCard title="Por estado (todas las piezas)" rows={estados} />
      </div>
    </div>
  );
}

// ---------------- Piezas ----------------

function Stat({
  label,
  value,
  prev,
  unit = "",
  detail,
  lowerIsBetter = false,
  tone,
}: {
  label: string;
  value: number | null;
  prev: number | null;
  unit?: string;
  detail?: string;
  lowerIsBetter?: boolean;
  tone?: "good" | "bad";
}) {
  const delta = value !== null && prev !== null ? Math.round((value - prev) * 100) / 100 : null;
  const better = delta === null || delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tone === "good" ? "text-green" : tone === "bad" ? "text-red" : ""}`}>
        {value === null ? "—" : `${value}${unit}`}
      </p>
      <p className="text-xs text-muted">
        {delta !== null && delta !== 0 && (
          <span className={better ? "text-green" : "text-red"}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
            {unit}{" "}
          </span>
        )}
        {delta === 0 && <span>= igual que antes </span>}
        {detail}
      </p>
    </Card>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted" aria-label="Leyenda">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {"label" in s ? s.label : s.key}
        </li>
      ))}
    </ul>
  );
}

/** Barras apiladas por capa con tooltip al pasar el cursor. */
function StackedBars({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.published));
  if (data.length === 0) return <p className="mt-3 text-sm text-muted">Sin semanas en este periodo.</p>;
  const h = 180;
  return (
    <div className="relative mt-4">
      <div className="flex items-end gap-1.5 border-b border-border" style={{ height: h }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div
            key={d.key}
            className={`flex h-full min-w-0 flex-1 cursor-default flex-col justify-end rounded-t ${hover === i ? "bg-[var(--chart-cursor,rgba(0,0,0,0.04))]" : ""}`}
            onMouseEnter={() => setHover(i)}
            role="img"
            aria-label={`${d.label}: ${d.published} publicadas (Hero ${d.Hero}, Hub ${d.Hub}, Hygiene ${d.Hygiene})`}
          >
            <span className="mb-1 text-center text-[11px] tabular-nums text-muted">{d.published || ""}</span>
            <div className="mx-auto flex w-full max-w-10 flex-col-reverse gap-[2px]">
              {SERIES.map((s) => {
                const v = d[s.key];
                if (!v) return null;
                return <div key={s.key} className="first:rounded-b-none last:rounded-t" style={{ height: (v / max) * (h - 24), background: s.color }} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => (
          <span key={d.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted">
            {d.label}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: `min(calc(${((hover + 0.5) / data.length) * 100}% + 12px), calc(100% - 170px))` }}
        >
          <p className="font-semibold">{data[hover].label}</p>
          <p>
            {data[hover].published} publicadas de {data[hover].planned}
          </p>
          {SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: s.color }} />
              {"label" in s ? s.label : s.key}: {data[hover][s.key]}
            </p>
          ))}
          <p className="text-muted">{data[hover].coverages} coberturas</p>
        </div>
      )}
    </div>
  );
}

function SimpleBars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="mt-3 text-sm text-muted">Sin datos.</p>;
  return (
    <div className="mt-4">
      <div className="flex h-32 items-end gap-1.5 border-b border-border">
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.label}: ${d.value}`}>
            <span className="mb-1 text-center text-[11px] tabular-nums text-muted">{d.value || ""}</span>
            <div className="mx-auto w-full max-w-10 rounded-t" style={{ height: (d.value / max) * 100, background: color }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CapaMix({ totals }: { totals: Totals }) {
  const tagged = totals.byCapa.Hero + totals.byCapa.Hub + totals.byCapa.Hygiene;
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-border/60">
        {SERIES.slice(0, 3).map((s) => (
          <div key={s.key} style={{ width: `${tagged ? (totals.byCapa[s.key] / tagged) * 100 : 0}%`, background: s.color }} />
        ))}
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {SERIES.slice(0, 3).map((s) => {
          const pct = tagged ? Math.round((totals.byCapa[s.key] / tagged) * 100) : 0;
          return (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                {s.key}
              </span>
              <span className="tabular-nums">
                {totals.byCapa[s.key]} · {pct}% <span className="text-muted">(objetivo {CAPA_TARGET[s.key]}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BreakdownCard({ title, rows, hints, limit }: { title: string; rows: Breakdown[]; hints?: Record<string, string>; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const total = rows.reduce((a, r) => a + r.total, 0);
  return (
    <Card className="p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sin piezas en este periodo.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {shown.map((r) => (
            <li key={r.key}>
              <div className="flex justify-between gap-2">
                <span className="truncate">
                  {r.key}
                  {hints?.[r.key] && <span className="text-xs text-muted"> · obj. {hints[r.key].split("·")[0].trim()}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {r.published}/{r.total} · {Math.round((r.total / total) * 100)}%
                </span>
              </div>
              <div className="mt-1 flex h-1.5 gap-[2px] rounded-full bg-border/60">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(r.published / max) * 100}%` }} />
                <div className="h-1.5 rounded-full bg-primary/30" style={{ width: `${((r.total - r.published) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {limit && rows.length > limit && (
        <Button size="sm" variant="ghost" className="mt-2" onPress={() => setAll((v) => !v)}>
          {all ? "Ver menos" : `Ver todas (${rows.length})`}
        </Button>
      )}
      <p className="mt-2 text-xs text-muted">Barra sólida: publicadas · clara: aún no publicadas.</p>
    </Card>
  );
}
