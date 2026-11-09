"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chunkPlanAction, indexStatusAction, storeChunksAction } from "./actions";
import { embedPassages } from "./embedder";

/**
 * Indexador en segundo plano: calcula los vectores de las notas nuevas o editadas (con el modelo ya cargado
 * en el navegador). `reindex()` pide otra vuelta; si ya está indexando, la hace al terminar.
 */
export function useBackgroundIndexer(enabled: boolean) {
  const [indexing, setIndexing] = useState<{ done: number; total: number } | null>(null);
  const [tick, setTick] = useState(0);
  const running = useRef(false);
  const rerun = useRef(false);
  const reindex = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;
    if (running.current) {
      rerun.current = true; // se guardó algo mientras se indexaba: otra vuelta al terminar
      return;
    }
    running.current = true;
    (async () => {
      try {
        const st = await indexStatusAction();
        const ids = st.pending;
        for (let i = 0; i < ids.length; i++) {
          setIndexing({ done: i, total: ids.length });
          const plan = await chunkPlanAction(ids[i]);
          if (!plan) continue;
          const need = plan.chunks.filter((c) => c.need);
          const vectors = need.length ? await embedPassages(need.map((c) => c.text)) : [];
          await storeChunksAction(
            ids[i],
            plan.version,
            need.map((c, j) => ({ index: c.index, embedding: vectors[j] })),
          );
        }
      } catch (e) {
        console.error("[vault] indexar", e);
      } finally {
        setIndexing(null);
        running.current = false;
        if (rerun.current) {
          rerun.current = false;
          setTick((t) => t + 1);
        }
      }
    })();
  }, [enabled, tick]);

  return { indexing, reindex };
}

/** Autoguardado ~1.5 s después de dejar de escribir (cada cambio de `draft` reinicia la espera). */
export function useAutosave(dirty: boolean, draft: unknown, save: () => unknown, delay = 1500) {
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => save(), delay);
    return () => clearTimeout(t);
  }, [dirty, draft, save, delay]);
}

/** Aviso del navegador al salir con cambios sin guardar. */
export function useUnsavedWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

/** Ctrl/Cmd+K: buscador rápido. Ctrl/Cmd+S: guardar (también fuera del editor). */
export function useVaultShortcuts({ onSearch, onSave }: { onSearch: () => void; onSave: () => void }) {
  const handlers = useRef({ onSearch, onSave });
  useEffect(() => {
    handlers.current = { onSearch, onSave };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        handlers.current.onSearch();
      }
      if (k === "s") {
        e.preventDefault();
        handlers.current.onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
