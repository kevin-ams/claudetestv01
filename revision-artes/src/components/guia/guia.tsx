"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { guiaActivada, guiaVista, marcarVista, onAbrirGuia, setGuiaActivada } from "./preferencias";

export type PasoGuia = {
  /** Valor de `data-guia` del elemento a resaltar. Sin objetivo, el paso sale centrado. */
  objetivo?: string;
  titulo: string;
  texto: string;
};

type Rect = { top: number; left: number; width: number; height: number; paso: string };

const MARGEN = 8;
const ANCHO = 340;

function buscar(objetivo?: string): HTMLElement | null {
  if (!objetivo) return null;
  const el = document.querySelector<HTMLElement>(`[data-guia="${objetivo}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/**
 * Recorrido guiado de la página: oscurece la pantalla, resalta cada elemento
 * y explica para qué sirve. Se abre solo la primera vez (si las guías están
 * activadas) y siempre desde el botón de ayuda. Los pasos cuyo elemento no
 * existe en la página se saltan.
 */
export function Guia({ id, email, pasos }: { id: string; email: string; pasos: PasoGuia[] }) {
  const [abierta, setAbierta] = useState(false);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [visibles, setVisibles] = useState<PasoGuia[]>([]);
  const [noMostrar, setNoMostrar] = useState(false);
  const dialogo = useRef<HTMLDivElement>(null);

  const abrir = useCallback(() => {
    setVisibles(pasos.filter((p) => !p.objetivo || buscar(p.objetivo)));
    setIndice(0);
    setNoMostrar(!guiaActivada(email));
    setAbierta(true);
  }, [pasos, email]);

  // Apertura automática la primera vez y apertura manual desde el menú de ayuda.
  useEffect(() => {
    const t = setTimeout(() => {
      if (guiaActivada(email) && !guiaVista(email, id)) abrir();
    }, 600);
    const off = onAbrirGuia(abrir);
    return () => {
      clearTimeout(t);
      off();
    };
  }, [abrir, email, id]);

  const paso = visibles[indice];

  // Ubica el elemento resaltado (y sigue su posición al hacer scroll o cambiar el tamaño).
  useLayoutEffect(() => {
    if (!abierta || !paso) return;
    const el = buscar(paso.objetivo);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const medir = () => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - MARGEN,
        left: r.left - MARGEN,
        width: r.width + MARGEN * 2,
        height: r.height + MARGEN * 2,
        paso: paso.titulo,
      });
    };
    const raf = requestAnimationFrame(medir);
    const t = setTimeout(medir, 400);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [abierta, paso]);

  useEffect(() => {
    if (abierta) dialogo.current?.focus();
  }, [abierta, indice]);

  const cerrar = useCallback(() => {
    marcarVista(email, id);
    setGuiaActivada(email, !noMostrar);
    setAbierta(false);
  }, [email, id, noMostrar]);

  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, visibles.length - 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierta, cerrar, visibles.length]);

  if (!abierta || !paso) return null;

  const ultimo = indice === visibles.length - 1;
  // Solo vale la medición del paso actual (un paso sin elemento va centrado).
  const marco = paso.objetivo && rect?.paso === paso.titulo ? rect : null;
  const posicion = posicionDialogo(marco);

  return (
    <div className="fixed inset-0 z-[1000]" aria-live="polite">
      {/* Fondo oscuro con un "hueco" (máscara SVG) sobre el elemento resaltado. */}
      <svg className="fixed inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="guia-hueco">
            <rect width="100%" height="100%" fill="white" />
            {marco && (
              <rect x={marco.left} y={marco.top} width={marco.width} height={marco.height} rx="16" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.6)" mask="url(#guia-hueco)" />
      </svg>
      {marco && (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-white"
          style={{ top: marco.top, left: marco.left, width: marco.width, height: marco.height }}
        />
      )}
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-titulo"
        tabIndex={-1}
        className="fixed flex flex-col gap-3 rounded-2xl bg-overlay p-5 text-overlay-foreground shadow-2xl outline-none"
        style={{ width: `min(${ANCHO}px, calc(100vw - 32px))`, ...posicion }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            Guía · {indice + 1} de {visibles.length}
          </span>
          <button type="button" onClick={cerrar} className="text-xs text-muted underline hover:text-foreground">
            Omitir guía
          </button>
        </div>
        <h2 id="guia-titulo" className="text-lg font-bold leading-snug">
          {paso.titulo}
        </h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{paso.texto}</p>
        <div className="flex gap-1" aria-hidden>
          {visibles.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= indice ? "bg-accent" : "bg-surface-tertiary"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={noMostrar}
              onChange={(e) => setNoMostrar(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            No mostrar guías automáticamente
          </label>
          <div className="flex gap-2">
            {indice > 0 && (
              <Button size="sm" variant="tertiary" onPress={() => setIndice((i) => i - 1)}>
                Atrás
              </Button>
            )}
            <Button size="sm" onPress={() => (ultimo ? cerrar() : setIndice((i) => i + 1))}>
              {ultimo ? "Entendido" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Coloca el cuadro debajo del elemento si cabe; si no, arriba; sin elemento, al centro. */
function posicionDialogo(rect: Rect | null): React.CSSProperties {
  if (typeof window === "undefined" || !rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(ANCHO, vw - 32);
  const left = Math.min(Math.max(16, rect.left + rect.width / 2 - ancho / 2), vw - ancho - 16);
  const alto = 260;
  if (rect.top + rect.height + 12 + alto <= vh) return { top: rect.top + rect.height + 12, left };
  if (rect.top - 12 - alto >= 0) return { top: rect.top - 12 - alto, left };
  // Elemento alto: al costado si hay espacio; si no, abajo flotando encima.
  const top = Math.min(Math.max(16, rect.top), vh - alto - 16);
  if (rect.left + rect.width + 12 + ancho <= vw - 16) return { top, left: rect.left + rect.width + 12 };
  if (rect.left - 12 - ancho >= 16) return { top, left: rect.left - 12 - ancho };
  return { bottom: 16, left };
}
