"use client";

import { autoConnect, suggestDistribution, type ElectricalReport } from "@/lib/plano/electrical";
import type { Plan } from "@/lib/plano/types";
import { NumberField, Row, Section } from "./fields";

interface Props {
  plan: Plan;
  report: ElectricalReport;
  update: (fn: (p: Plan) => Plan, opts?: { transient?: boolean }) => void;
  checkpoint: () => void;
  select: (ids: string[]) => void;
}

function Stat({ value, label, tone }: { value: string | number; label: string; tone?: "red" | "amber" | "green" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "green" ? "text-green-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-border bg-white p-2.5">
      <div className={`text-lg font-bold leading-tight ${color}`}>{value}</div>
      <div className="text-[11px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}

export function ElectricalPanel({ plan, report, update, checkpoint, select }: Props) {
  const e = plan.electrical;
  const setE = (patch: Partial<Plan["electrical"]>, discrete = false) => {
    if (discrete) checkpoint();
    update((p) => ({ ...p, electrical: { ...p.electrical, ...patch } }), { transient: !discrete });
  };
  const outlets = report.sources.filter((s) => s.item.source!.kind === "toma");
  const problems = report.sources.filter((s) => s.overloaded || s.overSockets || s.floating);

  const extensionsBySize = new Map<number, number>();
  for (const c of report.cableIssues) extensionsBySize.set(c.extension, (extensionsBySize.get(c.extension) ?? 0) + 1);
  const strips = plan.items.filter((i) => i.source?.kind === "regleta").length;

  return (
    <div>
      <Section title="Resumen">
        <div className="grid grid-cols-2 gap-2">
          <Stat value={`${Math.round(report.totalWatts)} W`} label={`Carga total · ${report.totalAmps.toFixed(1)} A a ${e.voltage} V`} />
          <Stat value={report.circuitsNeeded} label={`Circuitos de ${e.circuitAmps} A necesarios`} tone={outlets.length && outlets.length < report.circuitsNeeded ? "amber" : undefined} />
          <Stat value={report.plugsNeeded} label="Equipos a conectar" />
          <Stat value={report.unpowered.length} label="Sin conectar" tone={report.unpowered.length ? "red" : "green"} />
          <Stat value={outlets.length} label="Tomas de pared en el plano" />
          <Stat value={report.cableIssues.length} label="Extensiones necesarias" tone={report.cableIssues.length ? "amber" : "green"} />
        </div>
        <p className="text-[11px] leading-snug text-slate-500">
          Cada circuito soporta con seguridad {Math.round(report.circuitCapacity)} W ({e.circuitAmps} A × {e.voltage} V × {Math.round(e.safety * 100)}%).
          Idealmente cada toma de pared debe ir a un circuito (breaker) distinto.
        </p>
      </Section>

      <Section title="Asistente">
        <button
          className="btn btn-primary w-full"
          onClick={() => {
            checkpoint();
            update((p) => ({ ...p, items: suggestDistribution(p) }));
          }}
        >
          ⚡ Sugerir tomas y regletas
        </button>
        <p className="text-[11px] leading-snug text-slate-500">
          Agrupa los equipos por cercanía, coloca una regleta por grupo según carga y enchufes, y la lleva a la pared más cercana creando la toma si hace falta.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => {
              checkpoint();
              update((p) => ({ ...p, items: autoConnect(p) }));
            }}
          >
            Conectar a lo cercano
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              checkpoint();
              update((p) => ({ ...p, items: p.items.map((i) => ({ ...i, powerFrom: undefined })) }));
            }}
          >
            Desconectar todo
          </button>
        </div>
      </Section>

      {(problems.length > 0 || report.unpowered.length > 0 || report.cycles.length > 0) && (
        <Section title="Alertas">
          <ul className="space-y-1.5 text-sm">
            {problems.map((p) => (
              <li key={p.item.id}>
                <button className="text-left text-red-700 hover:underline" onClick={() => select([p.item.id])}>
                  ⚠ {p.item.label}:{" "}
                  {[
                    p.overloaded && `sobrecarga ${Math.round(p.load)} W de ${Math.round(p.capacity)} W`,
                    p.overSockets && `${p.socketsUsed} equipos en ${p.item.source!.sockets} enchufes`,
                    p.floating && "no está conectada a ninguna toma",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </button>
              </li>
            ))}
            {report.cycles.map((c) => (
              <li key={c.id} className="text-red-700">⚠ {c.label}: conexión en ciclo</li>
            ))}
            {report.unpowered.length > 0 && (
              <li>
                <button className="text-left text-amber-700 hover:underline" onClick={() => select(report.unpowered.map((u) => u.id))}>
                  ● {report.unpowered.length} equipo(s) sin conectar: {report.unpowered.map((u) => u.label).join(", ")}
                </button>
              </li>
            )}
          </ul>
        </Section>
      )}

      <Section title="Circuitos">
        {report.sources.length === 0 && <p className="text-sm text-slate-500">Agrega tomas de corriente desde la categoría Eléctrico o usa el asistente.</p>}
        <ul className="space-y-2">
          {report.sources.map((s) => {
            const pct = s.capacity ? (s.load / s.capacity) * 100 : 0;
            return (
              <li key={s.item.id} style={{ marginLeft: s.depth * 14 }}>
                <button className="w-full rounded-md border border-border bg-white p-2 text-left hover:border-slate-400" onClick={() => select([s.item.id])}>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{s.depth > 0 ? "↳ " : ""}{s.item.label}</span>
                    <span className="text-xs text-slate-500">{s.socketsUsed}/{s.item.source!.sockets}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200">
                    <div className={`h-full ${s.overloaded ? "bg-red-600" : pct > 75 ? "bg-amber-500" : "bg-green-600"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {Math.round(s.load)} W · {s.amps.toFixed(1)} A · {Math.round(pct)}%
                    {s.children.length > 0 && <> · {s.children.map((c) => c.label).join(", ")}</>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {(report.cableIssues.length > 0 || strips > 0) && (
        <Section title="Lista de compra / renta">
          <ul className="space-y-1 text-sm text-slate-700">
            {strips > 0 && <li>• {strips} regleta(s) / multicontacto(s)</li>}
            {[...extensionsBySize.entries()].sort((a, b) => a[0] - b[0]).map(([size, n]) => (
              <li key={size}>• {n} extensión(es) de {size} m</li>
            ))}
          </ul>
          {report.cableIssues.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-500">
              {report.cableIssues.map((c) => (
                <li key={c.item.id}>
                  <button className="text-left hover:underline" onClick={() => select([c.item.id])}>
                    {c.item.label} → {c.source.label}: recorrido {c.run.toFixed(1)} m, cable {c.cable} m → extensión {c.extension} m
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Parámetros eléctricos">
        <div className="grid grid-cols-2 gap-2">
          <Row label="Voltaje">
            <select className="input" value={e.voltage} onChange={(ev) => setE({ voltage: +ev.target.value }, true)}>
              <option value={110}>110 V</option>
              <option value={120}>120 V</option>
              <option value={127}>127 V</option>
              <option value={220}>220 V</option>
              <option value={230}>230 V</option>
              <option value={240}>240 V</option>
            </select>
          </Row>
          <Row label="Circuito">
            <NumberField value={e.circuitAmps} suffix="A" step={1} min={1} decimals={0} onFocus={checkpoint} onChange={(circuitAmps) => setE({ circuitAmps })} />
          </Row>
          <Row label="Uso máximo">
            <NumberField value={Math.round(e.safety * 100)} suffix="%" step={5} min={10} max={100} decimals={0} onFocus={checkpoint} onChange={(v) => setE({ safety: v / 100 })} />
          </Row>
          <Row label="Enchufes/toma">
            <NumberField value={e.socketsPerOutlet} step={1} min={1} decimals={0} onFocus={checkpoint} onChange={(v) => setE({ socketsPerOutlet: Math.round(v) })} />
          </Row>
        </div>
      </Section>
    </div>
  );
}
