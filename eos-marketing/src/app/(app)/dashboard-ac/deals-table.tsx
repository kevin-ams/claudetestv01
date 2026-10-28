"use client";

import { Button, Chip } from "@heroui/react";
import { useMemo, useState } from "react";
import { STATUS_LABEL, fmtDate, fmtDays, fmtHours, type Deal } from "@/lib/domain/deals-shared";

type SortKey = "createdAt" | "daysInStage" | "notesCount" | "hoursToFirstNote" | "lastNoteAt";
const PAGE = 50;
const STATUS_COLOR = { open: "default", won: "success", lost: "danger" } as const;

function csvCell(v: string | number | null) {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const PRINT_MAX = 300;

export function DealsTable({
  deals,
  staleDays,
  dealUrl,
  timeZone,
  printing = false,
}: {
  deals: Deal[];
  staleDays: number;
  dealUrl: string | null;
  timeZone: string;
  /** Al exportar a PDF: sin controles y con hasta PRINT_MAX tratos. */
  printing?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [onlyStale, setOnlyStale] = useState(false);
  const [onlyNoNote, setOnlyNoNote] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = deals.filter(
      (d) =>
        (!onlyStale || d.stale) &&
        (!onlyNoNote || (d.enriched && d.notesCount === 0)) &&
        (!q || [d.title, d.contact, d.career, d.faculty, d.owner, d.stageName, d.utmSource, d.classification].join(" ").toLowerCase().includes(q))
    );
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av < bv ? -1 : 1) * sort.dir;
    });
  }, [deals, query, onlyStale, onlyNoNote, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = printing ? rows.slice(0, PRINT_MAX) : rows.slice(current * PAGE, current * PAGE + PAGE);
  const reset = () => setPage(0);

  const sortTh = (key: SortKey, label: string, right = false) => (
    <th className={`py-2 pr-3 font-medium ${right ? "text-right" : ""}`}>
      <button type="button" className="hover:text-foreground" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}>
        {label}
        {sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  function exportCsv() {
    const header = [
      "ID", "Trato", "Contacto", "Facultad", "Carrera", "Embudo", "Etapa", "Estado", "Convertido", "Asesor", "Creado",
      "Días en etapa", "Notas", "Horas a 1a nota", "Primera nota", "Fecha 1a nota", "Última nota", "Fecha última nota",
      "UTM source", "UTM medium", "UTM term", "UTM campaign", "Clasificación",
    ];
    const lines = rows.map((d) =>
      [
        d.id, d.title, d.contact, d.faculty, d.career, d.pipelineName, d.stageName, STATUS_LABEL[d.status], d.converted ? "Sí" : "No",
        d.owner, d.createdDay, d.daysInStage.toFixed(1), d.notesCount,
        d.hoursToFirstNote === null ? null : d.hoursToFirstNote.toFixed(1), d.firstNote, d.firstNoteAt, d.lastNote, d.lastNoteAt,
        d.utmSource, d.utmMedium, d.utmTerm, d.utmCampaign, d.classification,
      ]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tratos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3" data-print-hide>
        <input
          className="h-9 w-64 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
          placeholder="Buscar trato, contacto, carrera…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyStale} onChange={(e) => (setOnlyStale(e.target.checked), reset())} />
          Estancados (≥ {staleDays} d)
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyNoNote} onChange={(e) => (setOnlyNoNote(e.target.checked), reset())} />
          Sin notas
        </label>
        <span className="text-xs text-muted">{rows.length} tratos</span>
        <Button size="sm" variant="outline" className="ml-auto" onPress={exportCsv}>
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Trato</th>
              <th className="py-2 pr-3 font-medium">Carrera</th>
              <th className="py-2 pr-3 font-medium">Etapa</th>
              <th className="py-2 pr-3 font-medium">Asesor</th>
              {sortTh("createdAt", "Creado")}
              {sortTh("daysInStage", "En etapa", true)}
              {sortTh("notesCount", "Notas", true)}
              {sortTh("hoursToFirstNote", "1.ª nota", true)}
              {sortTh("lastNoteAt", "Última nota")}
              <th className="py-2 pr-3 font-medium">UTM</th>
              <th className="py-2 font-medium">Clasif.</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.id} className="border-b border-border align-top last:border-0">
                <td className="max-w-56 py-2 pr-3">
                  {dealUrl ? (
                    <a href={`${dealUrl}${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                      {d.title || `Trato ${d.id}`}
                    </a>
                  ) : (
                    <span className="font-medium">{d.title || `Trato ${d.id}`}</span>
                  )}
                  <div className="truncate text-xs text-muted">{d.contact}</div>
                </td>
                <td className="max-w-48 py-2 pr-3">
                  {d.career}
                  <div className="text-xs text-muted">{d.faculty}</div>
                </td>
                <td className="py-2 pr-3">
                  <Chip size="sm" variant="soft" color={d.converted && d.status !== "won" ? "success" : STATUS_COLOR[d.status]}>
                    {d.status === "open" ? d.stageName : STATUS_LABEL[d.status]}
                  </Chip>
                  <div className="text-xs text-muted">{d.pipelineName}</div>
                </td>
                <td className="py-2 pr-3">{d.owner}</td>
                <td className="whitespace-nowrap py-2 pr-3">{fmtDate(d.createdAt, timeZone)}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${d.stale ? "font-semibold text-red" : ""}`}>{fmtDays(d.daysInStage)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{d.enriched ? d.notesCount : "…"}</td>
                <td className="py-2 pr-3 text-right tabular-nums" title={d.firstNote ?? ""}>
                  {fmtHours(d.hoursToFirstNote)}
                </td>
                <td className="max-w-64 py-2 pr-3">
                  {d.lastNote ? (
                    <>
                      <div className="line-clamp-2 text-xs" title={d.lastNote}>
                        {d.lastNote}
                      </div>
                      <div className="text-[11px] text-muted">{fmtDate(d.lastNoteAt, timeZone)}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  <div>{d.utmSource}</div>
                  <div className="text-muted">{d.utmMedium}</div>
                </td>
                <td className="py-2 text-xs">{d.classification}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {printing && rows.length > PRINT_MAX && (
        <p className="mt-2 text-xs text-muted">
          Se incluyen los primeros {PRINT_MAX} de {rows.length} tratos; para la lista completa usa Exportar CSV.
        </p>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm" data-print-hide>
          <Button size="sm" variant="outline" isDisabled={current === 0} onPress={() => setPage(current - 1)}>
            ←
          </Button>
          <span className="text-muted">
            {current + 1} / {pages}
          </span>
          <Button size="sm" variant="outline" isDisabled={current >= pages - 1} onPress={() => setPage(current + 1)}>
            →
          </Button>
        </div>
      )}
    </div>
  );
}
