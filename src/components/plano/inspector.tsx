"use client";

import { getCatalogItem, isLight, STRETCHY } from "@/lib/plano/catalog";
import { cableRun, createsCycle, isSource, needsPower, type ElectricalReport } from "@/lib/plano/electrical";
import type { Plan, PlanItem } from "@/lib/plano/types";
import { kelvinToHex } from "@/lib/plano/util";
import { NumberField, Row, Section, Toggle } from "./fields";

interface Props {
  plan: Plan;
  selection: string[];
  report: ElectricalReport;
  update: (fn: (p: Plan) => Plan, opts?: { transient?: boolean }) => void;
  checkpoint: () => void;
  actions: {
    duplicate: () => void;
    remove: () => void;
    front: () => void;
    back: () => void;
    align: (axis: "x" | "y") => void;
    distribute: (axis: "x" | "y") => void;
    rotate: (deg: number) => void;
  };
}

const KELVIN_PRESETS = [
  { k: 1900, label: "Vela" },
  { k: 2700, label: "Cálida" },
  { k: 3200, label: "Tungsteno" },
  { k: 4300, label: "Neutra" },
  { k: 5600, label: "Día" },
  { k: 6500, label: "Nublado" },
];

export function Inspector({ plan, selection, report, update, checkpoint, actions }: Props) {
  const items = selection.map((id) => plan.items.find((i) => i.id === id)).filter(Boolean) as PlanItem[];

  if (items.length === 0) return <StageSettings plan={plan} update={update} checkpoint={checkpoint} />;

  if (items.length > 1) {
    const watts = items.reduce((s, i) => s + (i.watts ?? 0), 0);
    return (
      <div>
        <Section title={`${items.length} elementos seleccionados`}>
          <p className="text-sm text-slate-600">Potencia combinada: <b>{watts} W</b></p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-secondary" onClick={() => actions.align("y")}>Alinear en fila</button>
            <button className="btn btn-secondary" onClick={() => actions.align("x")}>Alinear en columna</button>
            <button className="btn btn-secondary" onClick={() => actions.distribute("x")}>Distribuir ↔</button>
            <button className="btn btn-secondary" onClick={() => actions.distribute("y")}>Distribuir ↕</button>
            <button className="btn btn-secondary" onClick={() => actions.rotate(-15)}>⟲ 15°</button>
            <button className="btn btn-secondary" onClick={() => actions.rotate(15)}>⟳ 15°</button>
          </div>
          <Toggle
            label="Bloquear posición"
            checked={items.every((i) => i.locked)}
            onChange={(v) => {
              checkpoint();
              update((p) => ({ ...p, items: p.items.map((i) => (selection.includes(i.id) ? { ...i, locked: v } : i)) }));
            }}
          />
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={actions.duplicate}>Duplicar</button>
            <button className="btn btn-danger flex-1" onClick={actions.remove}>Eliminar</button>
          </div>
        </Section>
      </div>
    );
  }

  const it = items[0];
  const cat = getCatalogItem(it.type);
  const set = (patch: Partial<PlanItem>, discrete = false) => {
    if (discrete) checkpoint();
    update((p) => ({ ...p, items: p.items.map((i) => (i.id === it.id ? { ...i, ...patch } : i)) }), { transient: !discrete });
  };
  const light = isLight(it.type);
  const powered = needsPower(it) || isSource(it) || light;
  const sources = plan.items.filter((s) => s.source && s.id !== it.id && !createsCycle(it, s, plan.items));
  const parent = it.powerFrom ? plan.items.find((s) => s.id === it.powerFrom) : undefined;
  const srcRep = report.sources.find((s) => s.item.id === it.id);
  const issue = report.cableIssues.find((c) => c.item.id === it.id);

  return (
    <div>
      <Section
        title={cat?.name ?? it.type}
        right={<span className="font-mono text-[10px] text-slate-400">{it.id.slice(0, 6)}</span>}
      >
        <Row label={it.type === "texto" ? "Texto" : "Etiqueta"}>
          <input className="input" value={it.label} onFocus={checkpoint} onChange={(e) => set({ label: e.target.value })} />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="X">
            <NumberField value={it.x} suffix="m" step={0.05} onFocus={checkpoint} onChange={(x) => set({ x })} />
          </Row>
          <Row label="Y">
            <NumberField value={it.y} suffix="m" step={0.05} onFocus={checkpoint} onChange={(y) => set({ y })} />
          </Row>
          <Row label="Ancho">
            <NumberField value={it.w} suffix="m" step={0.05} min={0.02} onFocus={checkpoint} onChange={(w) => set({ w })} />
          </Row>
          <Row label="Fondo">
            <NumberField value={it.h} suffix="m" step={0.05} min={0.02} onFocus={checkpoint} onChange={(h) => set({ h })} />
          </Row>
        </div>
        {!STRETCHY.has(it.type) && cat && (it.w !== cat.w || it.h !== cat.h) && (
          <button className="text-xs text-primary underline" onClick={() => set({ w: cat.w, h: cat.h }, true)}>
            Restablecer tamaño ({cat.w} × {cat.h} m)
          </button>
        )}
        <Row label="Rotación" hint={`${Math.round(it.rotation)}°`}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-180}
              max={180}
              step={5}
              value={it.rotation}
              className="flex-1 accent-[var(--primary)]"
              onPointerDown={checkpoint}
              onChange={(e) => set({ rotation: +e.target.value })}
            />
            <button className="btn btn-secondary px-2 py-1" onClick={() => actions.rotate(-45)} title="Girar -45°">⟲</button>
            <button className="btn btn-secondary px-2 py-1" onClick={() => actions.rotate(45)} title="Girar 45°">⟳</button>
          </div>
        </Row>
        <div className="grid grid-cols-[auto_1fr] items-end gap-2">
          <Row label="Color">
            <input type="color" className="h-9 w-12 cursor-pointer rounded border border-border" value={it.color} onFocus={checkpoint} onChange={(e) => set({ color: e.target.value })} />
          </Row>
          {it.type === "texto" && (
            <Row label="Tamaño de texto">
              <NumberField value={it.fontSize ?? 0.25} suffix="m" step={0.05} min={0.05} onFocus={checkpoint} onChange={(fontSize) => set({ fontSize })} />
            </Row>
          )}
        </div>
      </Section>

      {light && (
        <Section
          title="Luz"
          right={<span className="h-4 w-4 rounded-full border border-slate-300" style={{ background: it.beamColor ?? kelvinToHex(it.kelvin ?? 5600) }} />}
        >
          <Toggle label="Mostrar haz de luz" checked={!!it.showBeam} onChange={(v) => set({ showBeam: v }, true)} />
          <Row label="Temperatura de color" hint={`${it.kelvin ?? 5600} K`}>
            <input
              type="range"
              min={1800}
              max={10000}
              step={100}
              value={it.kelvin ?? 5600}
              className="w-full"
              style={{ accentColor: kelvinToHex(it.kelvin ?? 5600) }}
              onPointerDown={checkpoint}
              onChange={(e) => set({ kelvin: +e.target.value })}
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {KELVIN_PRESETS.map((p) => (
                <button
                  key={p.k}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-slate-50"
                  onClick={() => set({ kelvin: p.k }, true)}
                >
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: kelvinToHex(p.k) }} />
                  {p.label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Color RGB / gel" hint={it.beamColor ? "" : "sin gel"}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-border"
                value={it.beamColor ?? kelvinToHex(it.kelvin ?? 5600)}
                onFocus={checkpoint}
                onChange={(e) => set({ beamColor: e.target.value })}
              />
              {it.beamColor && (
                <button className="text-xs text-primary underline" onClick={() => set({ beamColor: undefined }, true)}>
                  Quitar color
                </button>
              )}
            </div>
          </Row>
          <Row label="Intensidad / dimmer" hint={`${it.intensity ?? 100}%`}>
            <input type="range" min={0} max={100} step={5} value={it.intensity ?? 100} className="w-full accent-[var(--primary)]" onPointerDown={checkpoint} onChange={(e) => set({ intensity: +e.target.value })} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Apertura">
              <NumberField value={it.beam} suffix="°" step={5} min={5} max={360} decimals={0} onFocus={checkpoint} onChange={(beam) => set({ beam })} />
            </Row>
            <Row label="Alcance">
              <NumberField value={it.throw} suffix="m" step={0.5} min={0.2} onFocus={checkpoint} onChange={(t) => set({ throw: t })} />
            </Row>
          </div>
          <Row label="Canal DMX / dimmer">
            <input className="input" value={it.channel ?? ""} placeholder="p. ej. 1, 12-14, Dim A" onFocus={checkpoint} onChange={(e) => set({ channel: e.target.value })} />
          </Row>
        </Section>
      )}

      {powered && (
        <Section title="Corriente">
          {!isSource(it) && (
            <Row label="Consumo">
              <NumberField value={it.watts ?? 0} suffix="W" step={10} min={0} decimals={0} onFocus={checkpoint} onChange={(watts) => set({ watts })} />
            </Row>
          )}
          {isSource(it) && (
            <div className="grid grid-cols-2 gap-2">
              <Row label="Capacidad">
                <NumberField
                  value={it.source!.amps}
                  suffix="A"
                  step={1}
                  min={1}
                  decimals={0}
                  onFocus={checkpoint}
                  onChange={(amps) => set({ source: { ...it.source!, amps } })}
                />
              </Row>
              <Row label="Enchufes">
                <NumberField
                  value={it.source!.sockets}
                  step={1}
                  min={1}
                  decimals={0}
                  onFocus={checkpoint}
                  onChange={(sockets) => set({ source: { ...it.source!, sockets: Math.round(sockets) } })}
                />
              </Row>
            </div>
          )}
          {srcRep && (
            <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <div className="mb-1 flex justify-between">
                <span>Carga {Math.round(srcRep.load)} W · {srcRep.amps.toFixed(1)} A</span>
                <span>{Math.round((srcRep.load / srcRep.capacity) * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-200">
                <div
                  className={`h-full ${srcRep.overloaded ? "bg-red-600" : srcRep.load > srcRep.capacity * 0.75 ? "bg-amber-500" : "bg-green-600"}`}
                  style={{ width: `${Math.min(100, (srcRep.load / srcRep.capacity) * 100)}%` }}
                />
              </div>
              <div className="mt-1">Máx. seguro {Math.round(srcRep.capacity)} W · {srcRep.socketsUsed}/{it.source!.sockets} enchufes</div>
            </div>
          )}
          {(needsPower(it) || (isSource(it) && it.source!.kind !== "toma" && it.source!.kind !== "generador")) && (
            <>
              <Row label="Conectado a">
                <select
                  className="input"
                  value={it.powerFrom ?? ""}
                  onChange={(e) => set({ powerFrom: e.target.value || undefined }, true)}
                >
                  <option value="">— Sin conectar —</option>
                  {sources
                    .map((s) => ({ s, d: cableRun(it, s) }))
                    .sort((a, b) => a.d - b.d)
                    .map(({ s, d }) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({d.toFixed(1)} m)
                      </option>
                    ))}
                </select>
              </Row>
              <Row label="Largo de su cable">
                <NumberField value={it.cable ?? cat?.cable ?? 2} suffix="m" step={0.5} min={0} onFocus={checkpoint} onChange={(cable) => set({ cable })} />
              </Row>
              {parent && (
                <p className={`text-xs ${issue ? "font-medium text-red-600" : "text-slate-500"}`}>
                  Recorrido estimado {cableRun(it, parent).toFixed(1)} m
                  {issue ? ` — necesita extensión de ${issue.extension} m` : " — el cable alcanza ✓"}
                </p>
              )}
            </>
          )}
        </Section>
      )}

      <Section title="Notas">
        <textarea className="input min-h-20" value={it.notes} placeholder="Gel, altura, trípode, marca, etc." onFocus={checkpoint} onChange={(e) => set({ notes: e.target.value })} />
        <div className="flex flex-wrap gap-3">
          <Toggle label="Bloqueado" checked={!!it.locked} onChange={(v) => set({ locked: v }, true)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={actions.front}>Traer al frente</button>
          <button className="btn btn-secondary" onClick={actions.back}>Enviar atrás</button>
          <button className="btn btn-secondary" onClick={actions.duplicate}>Duplicar</button>
          <button className="btn btn-danger" onClick={actions.remove}>Eliminar</button>
        </div>
      </Section>
    </div>
  );
}

function StageSettings({ plan, update, checkpoint }: Pick<Props, "plan" | "update" | "checkpoint">) {
  const setStage = (patch: Partial<Plan["stage"]>, discrete = false) => {
    if (discrete) checkpoint();
    update((p) => ({ ...p, stage: { ...p.stage, ...patch } }), { transient: !discrete });
  };
  return (
    <div>
      <Section title="Escenario">
        <div className="grid grid-cols-2 gap-2">
          <Row label="Ancho">
            <NumberField value={plan.stage.width} suffix="m" step={0.5} min={1} max={100} onFocus={checkpoint} onChange={(width) => setStage({ width })} />
          </Row>
          <Row label="Profundidad">
            <NumberField value={plan.stage.depth} suffix="m" step={0.5} min={1} max={100} onFocus={checkpoint} onChange={(depth) => setStage({ depth })} />
          </Row>
        </div>
        <Row label="Cuadrícula">
          <select className="input" value={plan.stage.grid} onChange={(e) => setStage({ grid: +e.target.value }, true)}>
            <option value={0.25}>25 cm</option>
            <option value={0.5}>50 cm</option>
            <option value={1}>1 m</option>
          </select>
        </Row>
        <Toggle label="Mostrar cuadrícula" checked={plan.stage.showGrid} onChange={(v) => setStage({ showGrid: v }, true)} />
        <Toggle label="Ajustar a la cuadrícula" checked={plan.stage.snap} onChange={(v) => setStage({ snap: v }, true)} />
        <Row label="Color del piso">
          <input type="color" className="h-9 w-12 cursor-pointer rounded border border-border" value={plan.stage.floorColor} onFocus={checkpoint} onChange={(e) => setStage({ floorColor: e.target.value })} />
        </Row>
      </Section>
      <Section title="Atajos">
        <ul className="space-y-1 text-xs text-slate-600">
          <li><b>Arrastrar fondo</b> mover vista · <b>rueda</b> zoom</li>
          <li><b>Shift + arrastrar</b> selección múltiple</li>
          <li><b>R / Shift+R</b> rotar ±15° · <b>flechas</b> mover (Shift ×10)</li>
          <li><b>Ctrl+D</b> duplicar · <b>Ctrl+C / V</b> copiar / pegar</li>
          <li><b>Ctrl+Z / Ctrl+Shift+Z</b> deshacer / rehacer</li>
          <li><b>Supr</b> eliminar · <b>C</b> conectar · <b>V</b> seleccionar · <b>Esc</b> cancelar</li>
        </ul>
      </Section>
    </div>
  );
}
