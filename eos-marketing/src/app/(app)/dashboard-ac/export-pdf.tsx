"use client";

import { ArrowDownToSquare } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";

export type PrintSection = { id: string; label: string; defaultOn?: boolean };

/** Reglas de impresión: solo el dashboard y las secciones elegidas, en A4 horizontal. */
function printCss(rootId: string, hidden: string[]) {
  const root = `#${rootId}`;
  return `@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body *:not(:has(${root})):not(${root}):not(${root} *) { display: none !important; }
  *:has(${root}) { padding: 0 !important; margin: 0 !important; max-width: none !important; width: auto !important;
    height: auto !important; min-height: 0 !important; overflow: visible !important; position: static !important;
    background: var(--background) !important; box-shadow: none !important; }
  ${root} [data-print-hide] { display: none !important; }
  ${root} [data-print-only] { display: block !important; }
  ${root} [data-section] { break-inside: avoid; }
  ${root} [data-section="career"], ${root} [data-section="owner"], ${root} [data-section="detail"] { break-inside: auto; }
  ${hidden.map((id) => `${root} [data-section="${id}"]`).join(", ") || "x-none"} { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}`;
}

/**
 * "Exportar PDF": se eligen las secciones y se abre el diálogo de impresión del navegador
 * (Guardar como PDF). Antes de imprimir se fija el ancho del tablero al de la hoja para que
 * las gráficas se dibujen a ese tamaño.
 */
export function ExportPdf({
  rootId,
  sections,
  onPrintingChange,
}: {
  rootId: string;
  sections: PrintSection[];
  onPrintingChange: (printing: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(() => sections.filter((s) => s.defaultOn !== false).map((s) => s.id));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function print() {
    setOpen(false);
    const style = document.createElement("style");
    style.textContent = printCss(rootId, sections.filter((s) => !chosen.includes(s.id)).map((s) => s.id));
    document.head.appendChild(style);
    onPrintingChange(true);
    const cleanup = () => {
      style.remove();
      onPrintingChange(false);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Deja que las gráficas se redibujen al ancho de la hoja antes de abrir el diálogo.
    setTimeout(() => window.print(), 400);
  }

  return (
    <div ref={box} className="relative" data-print-hide>
      <Button variant="outline" onPress={() => setOpen((v) => !v)} aria-expanded={open}>
        <ArrowDownToSquare aria-hidden />
        Exportar PDF
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 flex w-72 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="text-sm font-semibold">¿Qué incluir?</p>
          <div className="flex flex-col gap-1">
            {sections.map((s) => (
              <AppCheckbox
                key={s.id}
                checked={chosen.includes(s.id)}
                onChange={(e) => setChosen((c) => (e.target.checked ? [...c, s.id] : c.filter((x) => x !== s.id)))}
              >
                <span className="text-sm">{s.label}</span>
              </AppCheckbox>
            ))}
          </div>
          <div className="flex gap-3 text-xs">
            <button type="button" className="text-primary hover:underline" onClick={() => setChosen(sections.map((s) => s.id))}>
              Todo
            </button>
            <button type="button" className="text-primary hover:underline" onClick={() => setChosen([])}>
              Nada
            </button>
          </div>
          <p className="text-xs text-muted">Se usan los filtros actuales. En el diálogo elige “Guardar como PDF”.</p>
          <Button variant="primary" size="sm" isDisabled={!chosen.length} onPress={print}>
            Generar PDF
          </Button>
        </div>
      )}
    </div>
  );
}
