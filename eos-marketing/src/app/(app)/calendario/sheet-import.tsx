"use client";

import { ArrowUpFromLine, Xmark } from "@gravity-ui/icons";
import { Button, Card, Chip, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { AppCheckbox } from "@/components/ui/checkbox";
import { sheetImportAction, sheetPreviewAction, sheetWeeksAction, type ActionResult, type SheetWeekInfo } from "./actions";

type Preview = Extract<Awaited<ReturnType<typeof sheetPreviewAction>>, { ok: true }>;

const URL_KEY = "eos.calendario.sheetUrl";
const ACTION_LABEL = { new: "Nueva", update: "Actualiza", same: "Sin cambios" } as const;

/** Importa o actualiza una semana del calendario desde el Plan de contenido publicado en Google Sheets. */
export function SheetImport({ currentWeek }: { currentWeek: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [weeks, setWeeks] = useState<SheetWeekInfo[] | null>(null);
  const [key, setKey] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [removeMissing, setRemoveMissing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const read = () =>
    start(async () => {
      setError("");
      setResult(null);
      setPreview(null);
      const r = await sheetWeeksAction(url);
      if (!r.ok) return setError(r.message);
      try {
        localStorage.setItem(URL_KEY, url);
      } catch {}
      setWeeks(r.weeks);
      // Por defecto, la semana en curso o la última de la hoja.
      const pick = r.weeks.find((w) => w.weekStart === currentWeek) ?? r.weeks[r.weeks.length - 1];
      setKey(pick?.key ?? "");
    });

  const showPreview = (k: string) =>
    start(async () => {
      setError("");
      setResult(null);
      const r = await sheetPreviewAction(url, k);
      if (!r.ok) return setError(r.message);
      setPreview(r);
      setRemoveMissing(false);
    });

  const apply = () =>
    start(async () => {
      const r = await sheetImportAction(url, key, removeMissing);
      setResult(r);
      if (r.ok && preview?.week) {
        setPreview(null);
        router.push(`/calendario?mes=${preview.week.slice(0, 7)}`);
        router.refresh();
      }
    });

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onPress={() => {
          // El último enlace usado se recuerda en este navegador.
          try {
            if (!url) setUrl(localStorage.getItem(URL_KEY) ?? "");
          } catch {}
          setOpen(true);
        }}
      >
        <ArrowUpFromLine aria-hidden /> Importar desde Google Sheets
      </Button>
    );
  }

  const changes = preview ? preview.rows.filter((r) => r.action !== "same").length + (removeMissing ? preview.appOnly.length : 0) : 0;

  return (
    <Card className="flex w-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Importar semana desde Google Sheets</h2>
          <p className="text-sm text-muted">
            Pega el enlace del Plan de contenido publicado en la Web. Se leen las secciones “SEMANA …”; las piezas nuevas
            se agregan y las que ya existen (mismo tema) se actualizan. Antes de guardar verás los cambios.
          </p>
        </div>
        <Button size="sm" variant="ghost" onPress={() => setOpen(false)} aria-label="Cerrar importación">
          <Xmark aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Enlace de Google Sheets"
          placeholder="https://docs.google.com/spreadsheets/d/e/…/pubhtml"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-72 flex-1"
        />
        <Button variant="primary" size="sm" onPress={read} isDisabled={pending || !url.trim()}>
          {pending && !weeks ? "Leyendo…" : "Leer hoja"}
        </Button>
      </div>
      {weeks && (
        <div className="flex flex-wrap items-center gap-2">
          <AppSelect
            aria-label="Semana a importar"
            className="w-auto"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setPreview(null);
            }}
          >
            {weeks.map((w) => (
              <option key={w.key} value={w.key}>
                {`${w.label} · ${w.count} pieza(s)`}
              </option>
            ))}
          </AppSelect>
          <Button variant="outline" size="sm" onPress={() => showPreview(key)} isDisabled={pending || !key}>
            {pending && !preview ? "Comparando…" : "Ver cambios"}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red">{error}</p>}
      {result && <p className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}

      {preview && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Cambio</th>
                  <th className="px-2">Fecha</th>
                  <th className="px-2">Pieza / Tema</th>
                  <th className="px-2">Asignación</th>
                  <th className="px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i} className={`border-b border-border last:border-0 ${r.action === "same" ? "text-muted" : ""}`}>
                    <td className="px-3 py-1.5 align-top">
                      <Chip size="sm" variant="soft" color={r.action === "new" ? "success" : r.action === "update" ? "warning" : "default"}>
                        {ACTION_LABEL[r.action]}
                      </Chip>
                      {r.changes.length > 0 && <p className="mt-0.5 text-[11px] text-muted">{r.changes.join(", ")}</p>}
                    </td>
                    <td className="whitespace-nowrap px-2 align-top tabular-nums">{r.pub_date ?? "—"}</td>
                    <td className="px-2 align-top">
                      {r.title}
                      {r.is_buffer && (
                        <Chip size="sm" variant="soft" className="ml-1">
                          buffer
                        </Chip>
                      )}
                    </td>
                    <td className="px-2 align-top">{r.assignee || "—"}</td>
                    <td className="px-2 align-top">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.appOnly.length > 0 && (
            <div className="rounded-lg border border-yellow/30 bg-yellow-bg p-3 text-sm">
              <p>
                {preview.appOnly.length} pieza(s) de esa semana están en la app pero no en la hoja:{" "}
                <span className="text-muted">{preview.appOnly.map((p) => p.title).join(" · ")}</span>
              </p>
              <AppCheckbox checked={removeMissing} onChange={(e) => setRemoveMissing(e.target.checked)}>
                Quitarlas de la app
              </AppCheckbox>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onPress={apply} isDisabled={pending || changes === 0}>
              {pending ? "Importando…" : changes === 0 ? "Sin cambios" : `Importar ${changes} cambio(s)`}
            </Button>
            <Button variant="outline" size="sm" onPress={() => setPreview(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
