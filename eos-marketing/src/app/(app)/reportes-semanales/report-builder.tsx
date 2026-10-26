"use client";

import { ArrowRotateRight, ChevronLeft, ChevronRight, Envelope } from "@gravity-ui/icons";
import { Button, Input, TextArea } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import type { REPORT_KINDS, ReportKind, ReportSection } from "@/lib/domain/weekly-report-shared";
import { addDaysISO, formatWeekRange, shiftWeek } from "@/lib/utils/dates";
import { previewWeeklyReportAction, sendWeeklyReportAction } from "./actions";

type SectionOption = {
  key: ReportSection;
  label: string;
  hint: string;
  available: boolean;
  reason: string | null;
};
type Result = { ok: boolean; message: string };

export function WeeklyReportBuilder({
  kind,
  kinds,
  initialWeek,
  currentWeek,
  sections,
  initialSections,
  initialHtml,
  defaultRecipients,
}: {
  kind: ReportKind;
  kinds: typeof REPORT_KINDS;
  initialWeek: string;
  currentWeek: string;
  sections: SectionOption[];
  initialSections: ReportSection[];
  initialHtml: string;
  defaultRecipients: string;
}) {
  const [week, setWeek] = useState(initialWeek);
  const [chosen, setChosen] = useState<Set<ReportSection>>(new Set(initialSections));
  const [message, setMessage] = useState("");
  const [html, setHtml] = useState(initialHtml);
  const [recipients, setRecipients] = useState(defaultRecipients);
  const [includeTeam, setIncludeTeam] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [previewing, startPreview] = useTransition();
  const [sending, startSend] = useTransition();
  const request = useRef(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const router = useRouter();
  const kindInfo = kinds.find((k) => k.id === kind) ?? kinds[0];

  // Recalcula la vista previa (solo cuenta la respuesta más reciente).
  function refresh(nextWeek = week, nextChosen = chosen, nextMessage = message) {
    const id = ++request.current;
    startPreview(async () => {
      const r = await previewWeeklyReportAction(kind, nextWeek, [...nextChosen], nextMessage).catch(() => null);
      if (id !== request.current) return;
      // La acción no respondió (p. ej. la página es de una versión anterior): se recarga con la semana elegida.
      if (!r) {
        // Recarga completa a propósito: una página de una versión anterior necesita traer la nueva.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`?tipo=${kind}&semana=${nextWeek}`);
        return;
      }
      setPreviewError(r.ok ? null : r.message);
      if (r.ok) setHtml(r.html);
    });
  }

  function changeWeek(next: string) {
    setWeek(next);
    setResult(null);
    window.history.replaceState(null, "", `?tipo=${kind}&semana=${next}`);
    refresh(next);
  }

  function toggle(key: ReportSection, on: boolean) {
    const next = new Set(chosen);
    if (on) next.add(key);
    else next.delete(key);
    setChosen(next);
    refresh(week, next);
  }

  const availableKeys = sections.filter((s) => s.available).map((s) => s.key);
  const allOn = availableKeys.every((k) => chosen.has(k));

  function send() {
    setResult(null);
    startSend(async () => {
      const r = await sendWeeklyReportAction({
        kind,
        week,
        sections: [...chosen],
        recipients,
        includeTeam,
        message,
      }).catch(() => ({
        ok: false,
        message: "No se pudo enviar. Si se publicó una versión nueva, recarga la página e intenta de nuevo.",
      }));
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Segmented
          aria-label="Tipo de reporte"
          options={kinds.map((k) => ({ id: k.id, label: k.label }))}
          value={kind}
          onChange={(id) => router.push(`?tipo=${id}&semana=${week}`, { scroll: false })}
        />
        <p className="text-sm text-muted">{kindInfo.hint}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Semana</h2>
            <div className="flex items-center gap-1">
              <Button isIconOnly size="sm" variant="ghost" aria-label="Semana anterior" onPress={() => changeWeek(shiftWeek(week, -1))}>
                <ChevronLeft aria-hidden />
              </Button>
              <span className="flex-1 text-center text-sm font-medium tabular-nums">{formatWeekRange(week)}</span>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Semana siguiente" onPress={() => changeWeek(shiftWeek(week, 1))}>
                <ChevronRight aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Elegir semana"
                type="date"
                value={week}
                max={addDaysISO(currentWeek, 6)}
                onChange={(e) => e.target.value && changeWeek(shiftWeek(e.target.value, 0))}
                className="w-auto flex-1"
              />
              {week !== currentWeek && (
                <Button size="sm" variant="ghost" className="text-primary" onPress={() => changeWeek(currentWeek)}>
                  Esta semana
                </Button>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Secciones</h2>
              <Button
                size="sm"
                variant="ghost"
                className="text-primary"
                onPress={() => {
                  const next = new Set<ReportSection>(allOn ? [] : availableKeys);
                  setChosen(next);
                  refresh(week, next);
                }}
              >
                {allOn ? "Quitar todas" : "Elegir todas"}
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {sections.map((s) => (
                <li key={s.key} className={s.available ? "" : "opacity-60"}>
                  <AppCheckbox checked={s.available && chosen.has(s.key)} disabled={!s.available} onChange={(e) => toggle(s.key, e.target.checked)}>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="text-xs text-muted">{s.available ? s.hint : s.reason}</span>
                    </span>
                  </AppCheckbox>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Enviar por correo</h2>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Mensaje (opcional)
              <TextArea
                aria-label="Mensaje"
                rows={3}
                placeholder="Un comentario al inicio del reporte…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onBlur={() => refresh()}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Destinatarios
              <Input
                aria-label="Destinatarios"
                placeholder="correo@ejemplo.com, otro@ejemplo.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
            </label>
            <AppCheckbox checked={includeTeam} onChange={(e) => setIncludeTeam(e.target.checked)}>
              <span className="text-sm">Enviar también a todo el equipo</span>
            </AppCheckbox>
            <Button variant="primary" onPress={send} isPending={sending} isDisabled={chosen.size === 0 || (!recipients.trim() && !includeTeam)}>
              <Envelope aria-hidden />
              Enviar reporte
            </Button>
            <p className="text-xs text-muted">Se recuerdan los destinatarios y las secciones para la próxima vez.</p>
            {result && (
              <p className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-yellow-bg text-yellow"}`} role="status">
                {result.message}
              </p>
            )}
          </section>
        </div>

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Vista previa del correo</h2>
            <Button size="sm" variant="ghost" onPress={() => refresh()} isPending={previewing}>
              {!previewing && <ArrowRotateRight aria-hidden />}
              {previewing ? "Actualizando…" : "Actualizar"}
            </Button>
          </div>
          {previewError && (
          <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow" role="alert">
            {previewError} La vista previa puede no corresponder a la semana elegida.
          </p>
        )}
        {html.length > 100_000 && (
          <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
            Este correo es muy largo ({Math.round(html.length / 1000)} KB): Gmail podría recortarlo y mostrar &quot;Ver mensaje completo&quot;. Quita alguna sección si
            quieres que se vea entero.
          </p>
        )}
        <iframe
            title="Vista previa del reporte semanal"
            srcDoc={html}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className={`h-[75vh] w-full rounded-xl border border-border bg-white transition-opacity ${previewing ? "opacity-60" : ""}`}
          />
        </section>
      </div>
    </div>
  );
}
