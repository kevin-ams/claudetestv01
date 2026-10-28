import type { Dashboard, DimensionRow } from "@/lib/activecampaign/analytics";
import { fmtDays, fmtHours, fmtNum, fmtPct } from "./format";

// Status colors are reserved for won / lost; "open" uses the brand primary.
const STATUS_COLORS = { open: "var(--primary)", won: "var(--green)", lost: "var(--red)" };

export function Section({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card min-w-0 p-5 ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mb-4 text-xs text-muted">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-white shadow-lg group-hover:block">
      {children}
    </span>
  );
}

export function Timeline({ data, unit }: { data: Dashboard["timeline"]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div>
      <div className="flex h-44 items-end gap-[2px] border-b border-border">
        {data.map((d) => (
          <div key={d.bucket} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary transition-opacity group-hover:opacity-80"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 2 : 0 }}
            />
            <Tip>
              {d.label}: <b>{d.count}</b> tratos{d.won ? ` · ${d.won} ganados` : ""}
            </Tip>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
        {data.map((d, i) => (
          <div key={d.bucket} className="flex-1 overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 ? d.label : ""}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Tratos creados por {unit} · máximo {fmtNum(max)}
      </p>
    </div>
  );
}

export function BarList({
  rows,
  format = fmtNum,
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="group relative">
          <div className="mb-0.5 flex justify-between gap-2 text-xs">
            <span className="truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded bg-background">
            <div className="h-2 rounded bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          {r.hint && <Tip>{r.hint}</Tip>}
        </li>
      ))}
    </ul>
  );
}

export function StatusLegend() {
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
      {(["open", "won", "lost"] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[k] }} />
          {k === "open" ? "Abiertos" : k === "won" ? "Ganados" : "Perdidos"}
        </span>
      ))}
    </div>
  );
}

function StatusBar({ row, max }: { row: DimensionRow; max: number }) {
  const parts = [
    ["open", row.open],
    ["won", row.won],
    ["lost", row.lost],
  ] as const;
  return (
    <div className="flex h-2.5 gap-[2px] rounded" style={{ width: `${(row.total / max) * 100}%` }}>
      {parts.map(([k, v]) =>
        v > 0 ? (
          <div
            key={k}
            className="h-full first:rounded-l last:rounded-r"
            style={{ flexGrow: v, background: STATUS_COLORS[k] }}
          />
        ) : null
      )}
    </div>
  );
}

// Table of a dimension (career, UTM, classification…) with an inline open/won/lost bar.
export function DimensionTable({
  rows,
  dimensionLabel,
  limit = 12,
}: {
  rows: DimensionRow[];
  dimensionLabel: string;
  limit?: number;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">Sin tratos.</p>;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit);
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2 pr-3 font-medium">{dimensionLabel}</th>
            <th className="w-1/5 min-w-20 py-2 pr-3 font-medium" />
            <th className="py-2 pr-3 text-right font-medium">Tratos</th>
            <th className="py-2 pr-3 text-right font-medium">Abiertos</th>
            <th className="py-2 pr-3 text-right font-medium">Ganados</th>
            <th className="py-2 pr-3 text-right font-medium" title="Ganados / (ganados + perdidos)">
              Conversión
            </th>
            <th className="py-2 pr-3 text-right font-medium" title="Tiempo desde la creación del trato hasta la primera nota">
              1.ª nota
            </th>
            <th className="py-2 text-right font-medium" title="Tratos abiertos que superan el umbral de días en la misma etapa">
              Estancados
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.label} className="group border-b border-border last:border-0">
              <td className="max-w-48 truncate py-2 pr-3" title={r.label}>
                {r.label}
              </td>
              <td className="relative py-2 pr-3">
                <StatusBar row={r} max={max} />
                <Tip>
                  {r.open} abiertos · {r.won} ganados · {r.lost} perdidos
                </Tip>
              </td>
              <td className="py-2 pr-3 text-right font-semibold tabular-nums">{fmtNum(r.total)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.open)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.won)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtPct(r.winRate)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtHours(r.avgHoursToFirstNote)}</td>
              <td className={`py-2 text-right tabular-nums ${r.stale ? "text-red" : ""}`}>{fmtNum(r.stale)}</td>
            </tr>
          ))}
          {rest.length > 0 && (
            <tr className="text-xs text-muted">
              <td className="py-2" colSpan={8}>
                + {rest.length} más ({fmtNum(rest.reduce((s, r) => s + r.total, 0))} tratos)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StageTable({ stages, staleDays }: { stages: Dashboard["stages"]; staleDays: number }) {
  const max = Math.max(1, ...stages.map((s) => s.open));
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2 pr-3 font-medium">Etapa</th>
            <th className="w-1/5 min-w-20 py-2 pr-3 font-medium" />
            <th className="py-2 pr-3 text-right font-medium">Abiertos</th>
            <th className="py-2 pr-3 text-right font-medium">Prom. en etapa</th>
            <th className="py-2 pr-3 text-right font-medium">Mediana</th>
            <th className="py-2 pr-3 text-right font-medium">Máx.</th>
            <th className="py-2 pr-3 text-right font-medium">Estancados (≥{staleDays} d)</th>
            <th className="py-2 text-right font-medium">Sin notas</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.stageId} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">
                {s.pipelineName && <span className="text-xs text-muted">{s.pipelineName} · </span>}
                {s.name}
              </td>
              <td className="py-2 pr-3">
                <div className="h-2.5 rounded bg-primary" style={{ width: `${(s.open / max) * 100}%` }} />
              </td>
              <td className="py-2 pr-3 text-right font-semibold tabular-nums">{fmtNum(s.open)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtDays(s.avgDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtDays(s.medianDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtDays(s.maxDays)}</td>
              <td className={`py-2 pr-3 text-right tabular-nums ${s.stale ? "font-semibold text-red" : ""}`}>
                {fmtNum(s.stale)}
              </td>
              <td className="py-2 text-right tabular-nums">{fmtNum(s.noNote)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Career × stage matrix of open deals, single-hue sequential shading.
export function CareerStageMatrix({ matrix }: { matrix: Dashboard["careerStage"] }) {
  const values = Object.values(matrix.cells);
  const max = Math.max(1, ...values);
  if (matrix.careers.length === 0 || matrix.stages.length === 0) {
    return <p className="text-sm text-muted">Sin tratos abiertos.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr className="text-muted">
            <th className="py-1 pr-2 text-left font-medium">Carrera</th>
            {matrix.stages.map((s) => (
              <th key={s.id} className="min-w-16 px-1 py-1 text-center font-medium">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.careers.map((c) => (
            <tr key={c}>
              <td className="max-w-44 truncate py-1 pr-2" title={c}>
                {c}
              </td>
              {matrix.stages.map((s) => {
                const v = matrix.cells[`${c}::${s.id}`] ?? 0;
                const t = v / max;
                return (
                  <td
                    key={s.id}
                    className="rounded px-1 py-1.5 text-center tabular-nums"
                    title={`${c} · ${s.name}: ${v} abiertos`}
                    style={{
                      background: v ? `color-mix(in srgb, var(--primary) ${Math.round(12 + t * 88)}%, white)` : "var(--background)",
                      color: t > 0.45 ? "white" : v ? "var(--foreground)" : "var(--muted)",
                    }}
                  >
                    {v || "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
