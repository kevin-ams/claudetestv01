"use client";

import { useMemo, useState } from "react";
import { fmtDate, fmtDays, fmtHours } from "./format";

export type DealRow = {
  id: string;
  title: string;
  contact: string;
  url: string | null;
  career: string;
  pipeline: string;
  stage: string;
  owner: string;
  status: "open" | "won" | "lost";
  createdAt: string;
  daysInStage: number;
  stale: boolean;
  notesCount: number;
  enriched: boolean;
  hoursToFirstNote: number | null;
  firstNote: string | null;
  firstNoteAt: string | null;
  lastNote: string | null;
  lastNoteAt: string | null;
  utmSource: string;
  utmMedium: string;
  utmTerm: string;
  utmCampaign: string;
  classification: string;
};

type SortKey = "createdAt" | "daysInStage" | "notesCount" | "hoursToFirstNote" | "lastNoteAt";

const STATUS_LABEL = { open: "Abierto", won: "Ganado", lost: "Perdido" };
const STATUS_CLASS = {
  open: "bg-background text-foreground",
  won: "bg-green-bg text-green",
  lost: "bg-red-bg text-red",
};
const PAGE = 50;

function csvCell(v: string | number | null) {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function DealsTable({ rows, staleDays }: { rows: DealRow[]; staleDays: number }) {
  const [query, setQuery] = useState("");
  const [onlyStale, setOnlyStale] = useState(false);
  const [onlyNoNote, setOnlyNoNote] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!onlyStale || r.stale) &&
        (!onlyNoNote || (r.enriched && r.notesCount === 0)) &&
        (!q ||
          [r.title, r.contact, r.career, r.owner, r.stage, r.utmSource, r.utmTerm, r.classification]
            .join(" ")
            .toLowerCase()
            .includes(q))
    );
    return list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av < bv ? -1 : 1) * sort.dir;
    });
  }, [rows, query, onlyStale, onlyNoNote, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);

  function sortBy(key: SortKey) {
    setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }));
  }

  function exportCsv() {
    const header = [
      "ID", "Trato", "Contacto", "Carrera", "Embudo", "Etapa", "Asesor", "Estado", "Creado",
      "Días en etapa", "Notas", "Horas a 1a nota", "Primera nota", "Fecha 1a nota", "Última nota",
      "Fecha última nota", "UTM source", "UTM medium", "UTM term", "UTM campaign", "Clasificación",
    ];
    const lines = filtered.map((r) =>
      [
        r.id, r.title, r.contact, r.career, r.pipeline, r.stage, r.owner, STATUS_LABEL[r.status],
        r.createdAt.slice(0, 10), r.daysInStage.toFixed(1), r.notesCount,
        r.hoursToFirstNote === null ? null : r.hoursToFirstNote.toFixed(1), r.firstNote, r.firstNoteAt,
        r.lastNote, r.lastNoteAt, r.utmSource, r.utmMedium, r.utmTerm, r.utmCampaign, r.classification,
      ]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tratos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sortTh = (k: SortKey, label: string, className = "") => (
    <th className={`py-2 pr-3 font-medium ${className}`}>
      <button onClick={() => sortBy(k)} className="hover:text-foreground">
        {label}
        {sort.key === k ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          className="input !w-64"
          placeholder="Buscar trato, contacto, carrera…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyStale} onChange={(e) => { setOnlyStale(e.target.checked); setPage(0); }} />
          Estancados (≥{staleDays} d)
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyNoNote} onChange={(e) => { setOnlyNoNote(e.target.checked); setPage(0); }} />
          Sin notas
        </label>
        <span className="text-xs text-muted">{filtered.length} tratos</span>
        <button className="btn btn-secondary ml-auto !py-1.5 text-xs" onClick={exportCsv}>
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Trato</th>
              <th className="py-2 pr-3 font-medium">Carrera</th>
              <th className="py-2 pr-3 font-medium">Etapa</th>
              <th className="py-2 pr-3 font-medium">Asesor</th>
              {sortTh("createdAt", "Creado")}
              {sortTh("daysInStage", "En etapa", "text-right")}
              {sortTh("notesCount", "Notas", "text-right")}
              {sortTh("hoursToFirstNote", "1.ª nota", "text-right")}
              {sortTh("lastNoteAt", "Última nota")}
              <th className="py-2 pr-3 font-medium">UTM</th>
              <th className="py-2 font-medium">Clasif.</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-border align-top last:border-0">
                <td className="max-w-56 py-2 pr-3">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                      {r.title || `Trato ${r.id}`}
                    </a>
                  ) : (
                    <span className="font-medium">{r.title || `Trato ${r.id}`}</span>
                  )}
                  <div className="truncate text-xs text-muted">{r.contact}</div>
                </td>
                <td className="py-2 pr-3">{r.career}</td>
                <td className="py-2 pr-3">
                  <span className={`badge ${STATUS_CLASS[r.status]}`}>
                    {r.status === "open" ? r.stage : STATUS_LABEL[r.status]}
                  </span>
                  <div className="text-xs text-muted">{r.pipeline}</div>
                </td>
                <td className="py-2 pr-3">{r.owner}</td>
                <td className="whitespace-nowrap py-2 pr-3">{fmtDate(r.createdAt)}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${r.stale ? "font-semibold text-red" : ""}`}>
                  {fmtDays(r.daysInStage)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.enriched ? r.notesCount : "…"}</td>
                <td className="py-2 pr-3 text-right tabular-nums" title={r.firstNote ?? ""}>
                  {fmtHours(r.hoursToFirstNote)}
                </td>
                <td className="max-w-64 py-2 pr-3">
                  {r.lastNote ? (
                    <>
                      <div className="line-clamp-2 text-xs" title={r.lastNote}>
                        {r.lastNote}
                      </div>
                      <div className="text-[11px] text-muted">{fmtDate(r.lastNoteAt)}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  <div>{r.utmSource}</div>
                  <div className="text-muted">
                    {r.utmMedium}
                    {r.utmTerm && r.utmTerm !== "(sin dato)" ? ` · ${r.utmTerm}` : ""}
                  </div>
                </td>
                <td className="py-2 text-xs">{r.classification}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button className="btn btn-secondary !py-1" disabled={current === 0} onClick={() => setPage(current - 1)}>
            ←
          </button>
          <span className="text-muted">
            {current + 1} / {pages}
          </span>
          <button className="btn btn-secondary !py-1" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
