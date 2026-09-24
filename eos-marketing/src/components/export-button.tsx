"use client";

import { useState } from "react";

type Kind = "scorecard" | "indicadores";

const LABEL: Record<Kind, string> = {
  scorecard: "Scorecard",
  indicadores: "Indicadores de carrera",
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Descarga en Excel (.xlsm por defecto) con rango de semanas. */
export function ExportPanel({ kind, defaultFrom, defaultTo }: { kind: Kind; defaultFrom?: string; defaultTo?: string }) {
  const [from, setFrom] = useState(defaultFrom ?? isoDaysAgo(7 * 12));
  const [to, setTo] = useState(defaultTo ?? isoDaysAgo(0));
  const [format, setFormat] = useState<"xlsm" | "xlsx">("xlsm");
  const href = `/api/exportar/${kind}?desde=${from}&hasta=${to}&formato=${format}`;
  const valid = from && to && from <= to;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Desde
        <input type="date" className="eos-input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Hasta
        <input type="date" className="eos-input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Formato
        <select className="eos-input !w-auto" value={format} onChange={(e) => setFormat(e.target.value as "xlsm" | "xlsx")}>
          <option value="xlsm">Excel con macros (.xlsm)</option>
          <option value="xlsx">Excel (.xlsx)</option>
        </select>
      </label>
      <a
        href={valid ? href : undefined}
        aria-disabled={!valid}
        className={`eos-btn eos-btn-primary ${valid ? "" : "pointer-events-none opacity-50"}`}
        download
      >
        ⬇ Descargar {LABEL[kind]}
      </a>
    </div>
  );
}

/** Botón que despliega el panel de exportación. */
export function ExportButton({ kind, defaultFrom, defaultTo }: { kind: Kind; defaultFrom?: string; defaultTo?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <button className="eos-btn eos-btn-secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        ⬇ Exportar Excel
      </button>
      {open && (
        <div className="eos-card p-3">
          <ExportPanel kind={kind} defaultFrom={defaultFrom} defaultTo={defaultTo} />
        </div>
      )}
    </div>
  );
}
