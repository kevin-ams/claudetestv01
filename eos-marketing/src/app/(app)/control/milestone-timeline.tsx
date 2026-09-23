import { CONTROL_STAGES, type ColumnKey, type ControlPlan } from "@/lib/domain/career-control";

/**
 * "Visualización de los hitos": un rombo numerado por hito, escalonado dentro
 * de cada etapa, con línea punteada y una barra con el nombre y cuántas
 * carreras están en ese hito.
 */
export function MilestoneTimeline({
  plan,
  counts,
  onSelect,
}: {
  plan: ControlPlan;
  counts: Record<ColumnKey, number>;
  onSelect: (key: ColumnKey) => void;
}) {
  return (
    <div className="card overflow-x-auto p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Visualización de los hitos</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-2.5 w-2.5 rotate-45 border-2 border-foreground" /> Ruta crítica
        </span>
      </div>
      <div className="mb-4 border-b-2 border-foreground/80" />
      <div className="flex min-w-[1300px] gap-4">
        {CONTROL_STAGES.map((stage) => {
          const items = plan.milestones.filter((m) => m.stage === stage.key);
          if (items.length === 0) return null;
          return (
            <div key={stage.key} className="flex flex-1 flex-col" style={{ flexGrow: items.length }}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: stage.color }}>
                {stage.label}
              </p>
              <div className="flex flex-1 items-end gap-2">
                {items.map((m, i) => {
                  const n = plan.milestones.indexOf(m) + 1;
                  const critical = plan.critical.has(m.key);
                  // Escalonado ascendente dentro de la etapa, como en la referencia.
                  const lift = i * 34;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => onSelect(m.key)}
                      className="group relative flex flex-1 flex-col items-center"
                      style={{ height: 250 }}
                      title={`${n}. ${m.label}: ${counts[m.key]} carrera(s)${critical ? " · ruta crítica" : ""}`}
                    >
                      <span className="absolute inset-y-0 left-1/2 border-l-2 border-dotted border-foreground/60" />
                      <span className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 58 + lift }}>
                        <span
                          className={`flex h-12 w-12 rotate-45 items-center justify-center rounded-[3px] shadow-sm transition-transform group-hover:scale-110 ${
                            critical ? "ring-2 ring-foreground ring-offset-2" : ""
                          }`}
                          style={{ background: stage.color }}
                        >
                          <span className="-rotate-45 text-lg font-semibold text-white">{n}</span>
                        </span>
                      </span>
                      <span
                        className="absolute left-1/2 w-[92%] -translate-x-1/2 rounded-[3px] px-1 py-1 text-center text-white"
                        style={{ bottom: 8 + lift, background: stage.color }}
                      >
                        <span className="line-clamp-2 block text-[11px] font-semibold leading-tight">{m.label}</span>
                        <span className="block text-[10px] leading-tight opacity-90">
                          {counts[m.key]} carrera{counts[m.key] === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
